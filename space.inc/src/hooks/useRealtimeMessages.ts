import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { apiService } from '../services/apiService';
import { friendlyError } from '../utils/errors';

import { Message, SpaceFile } from '../types';

const messageCache = new Map<string, Message[]>();

type SendFileResult = {
    success: boolean;
    fileData?: SpaceFile | null;
};

type SendMessageOptions = {
    replyTo?: Message | null;
};

const IMAGE_FILE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'heic', 'heif', 'jfif', 'jpeg', 'jpg', 'pjp', 'pjpeg', 'png', 'svg', 'webp']);

const isImageFile = (file: File) => {
    if (file.type.startsWith('image/')) return true;
    const extension = file.name.split('.').pop()?.toLowerCase();
    return !!extension && IMAGE_FILE_EXTENSIONS.has(extension);
};

const normalizeReactions = (raw: any) => {
    const source = raw?.reactions ?? raw?.reaction_summary ?? [];
    if (Array.isArray(source)) return source;
    if (source && typeof source === 'object') {
        return Object.entries(source).map(([emoji, value]: [string, any]) => ({
            emoji,
            count: typeof value === 'number' ? value : value?.count ?? 0,
            names: value?.names ?? [],
            users: value?.users ?? []
        }));
    }
    return [];
};

const toRealtimeMessage = (raw: any, previous?: Message): Message => ({
    ...(previous || {}),
    id: raw.id,
    spaceId: raw.space_id ?? previous?.spaceId,
    organizationId: raw.organization_id ?? previous?.organizationId,
    senderId: raw.sender_id ?? previous?.senderId,
    senderType: raw.sender_type ?? previous?.senderType ?? 'staff',
    senderName: raw.sender_name ?? raw.full_name ?? previous?.senderName,
    senderAvatar: raw.sender_avatar ?? raw.avatar_url ?? previous?.senderAvatar,
    content: raw.content ?? previous?.content ?? '',
    channel: raw.channel ?? previous?.channel ?? 'general',
    channelId: raw.channel_id ?? previous?.channelId ?? null,
    extension: raw.extension ?? previous?.extension ?? 'chat',
    payload: raw.payload ?? previous?.payload ?? {},
    parentId: raw.parent_id ?? previous?.parentId,
    threadRootId: raw.thread_root_id ?? previous?.threadRootId ?? null,
    createdAt: raw.created_at ?? previous?.createdAt,
    updatedAt: raw.updated_at ?? previous?.updatedAt ?? null,
    editedAt: raw.edited_at ?? previous?.editedAt ?? null,
    deletedAt: raw.deleted_at ?? previous?.deletedAt ?? null,
    replyCount: raw.reply_count ?? previous?.replyCount ?? 0,
    readByMe: raw.read_by_me ?? previous?.readByMe,
    isMentioned: raw.is_mentioned ?? previous?.isMentioned ?? false,
    mentionedUserIds: raw.mentioned_user_ids ?? previous?.mentionedUserIds ?? [],
    reactions: normalizeReactions(raw)
});

export function useRealtimeMessages(spaceId: string | null, orgId?: string, initialLimit = 30) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom helper
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (!spaceId || !orgId) {
            setMessages([]);
            setLoading(false);
            return;
        }

        const cacheKey = `${orgId}:${spaceId}:${initialLimit}`;
        const cachedMessages = messageCache.get(cacheKey);
        if (cachedMessages) {
            setMessages(cachedMessages);
            setLoading(false);
        } else {
            setMessages([]);
            setLoading(true);
        }
        setError(null);

        // 1. Fetch initial messages
        const fetchMessages = async () => {
            try {
                const { data, error: fetchError } = await apiService.getMessages(spaceId, orgId, initialLimit);

                if (fetchError) {
                    throw fetchError;
                } else {
                    const nextMessages = data || [];
                    messageCache.set(cacheKey, nextMessages);
                    setMessages(nextMessages);
                }
            } catch (err: any) {
                console.error('Failed to fetch messages:', err);
                setError(friendlyError(err?.message));
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();

        // 2. Subscribe to realtime message changes
        // We filter by both space_id AND organization_id for multi-tenant security
        const channel = supabase
            .channel(`space-chat:${spaceId}:${orgId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages',
                    filter: `space_id=eq.${spaceId}`
                },
                (payload) => {
                    const raw = payload.new as any;

                    if (payload.eventType === 'DELETE') {
                        const oldRaw = payload.old as any;
                        setMessages(prev => {
                            const next = prev.filter(message => message.id !== oldRaw.id);
                            messageCache.set(cacheKey, next);
                            return next;
                        });
                        return;
                    }

                    // Defense-in-depth: Manual verification of organization_id in callback
                    // In some edge cases, Supabase filters might be bypassable if not correctly configured in the dashboard
                    if (raw.organization_id !== orgId) {
                        console.warn('[useRealtimeMessages] Ignoring message from different tenant:', raw.organization_id);
                        return;
                    }

                    setMessages(prev => {
                        const existing = prev.find(message => message.id === raw.id);
                        const nextMessage = toRealtimeMessage(raw, existing);
                        if (nextMessage.deletedAt) {
                            const next = prev.filter(message => message.id !== raw.id);
                            messageCache.set(cacheKey, next);
                            return next;
                        }
                        if (existing) {
                            const next = prev.map(message => message.id === raw.id ? nextMessage : message);
                            messageCache.set(cacheKey, next);
                            return next;
                        }
                        const next = [...prev, nextMessage];
                        messageCache.set(cacheKey, next);
                        return next;
                    });
                }
            )
            .subscribe();

        // Cleanup
        return () => {
            supabase.removeChannel(channel);
        };
    }, [spaceId, orgId, initialLimit]);

    // Auto-scroll when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);


    // Send message function
    const sendMessage = async (content: string, channel: string = 'general', options: SendMessageOptions = {}): Promise<boolean> => {
        if (!spaceId || !orgId || !content.trim()) return false;

        try {
            const replyTo = options.replyTo;
            const payload = replyTo ? {
                reply_to: {
                    id: replyTo.id,
                    sender_id: replyTo.senderId,
                    sender_name: replyTo.senderName,
                    content: replyTo.content,
                    extension: replyTo.extension,
                    file_name: replyTo.payload?.file_name,
                    mime_type: replyTo.payload?.mime_type
                }
            } : {};
            const { data, error: sendError } = await apiService.sendMessage(spaceId, content, 'chat', payload, channel, orgId || '');
            if (sendError) throw sendError;
            if (data) {
                setMessages(prev => {
                    if (prev.some(message => message.id === data.id)) return prev;
                    const next = [...prev, data];
                    messageCache.set(`${orgId}:${spaceId}:${initialLimit}`, next);
                    return next;
                });
            }
            return true;
        } catch (err: any) {
            console.error('Failed to send message:', err);
            setError(friendlyError(err?.message));
            return false;
        }
    };

    // Send file function
    const sendFile = async (currentOrgId: string, file: File, channel: string = 'general'): Promise<SendFileResult> => {
        const effectiveOrgId = currentOrgId || orgId;
        if (!spaceId || !effectiveOrgId || !file) return { success: false, fileData: null };

        try {
            setError(null);
            setUploadProgress(0);
            const fileData = await apiService.uploadFile(spaceId, effectiveOrgId, file, (progress) => {
                setUploadProgress(progress);
            });

            const isImage = isImageFile(file);
            const extension = isImage ? 'image' : 'file';
            const label = isImage ? `Shared an image: ${file.name}` : `Shared a file: ${file.name}`;
            const { data, error: sendError } = await apiService.sendMessage(
                spaceId,
                label,
                extension,
                {
                    file_id: fileData.id,
                    file_name: file.name,
                    mime_type: file.type,
                    file_size: file.size,
                    kind: isImage ? 'image' : 'file'
                },
                channel,
                effectiveOrgId
            );

            if (sendError) throw sendError;
            if (data) {
                setMessages(prev => {
                    if (prev.some(message => message.id === data.id)) return prev;
                    const next = [...prev, data];
                    messageCache.set(`${effectiveOrgId}:${spaceId}:${initialLimit}`, next);
                    return next;
                });
            }
            setUploadProgress(100);
            const normalizedFileData: SpaceFile = {
                ...(fileData as SpaceFile),
                name: fileData?.name || file.name,
                mime_type: fileData?.mime_type || file.type,
                file_size: fileData?.file_size || file.size,
                created_at: fileData?.created_at || new Date().toISOString(),
                status: fileData?.status || 'pending',
                space_id: fileData?.space_id || spaceId,
                organization_id: fileData?.organization_id || effectiveOrgId
            };

            return { success: true, fileData: normalizedFileData };
        } catch (err: any) {
            console.error('Failed to upload file:', err);
            setError(friendlyError(err?.message));
            setUploadProgress(null);
            return { success: false, fileData: null };
        } finally {
            setTimeout(() => {
                setUploadProgress(null);
            }, 350);
            setLoading(false);
        }
    };


    return {
        messages,
        loading,
        error,
        uploadProgress,
        sendMessage,
        sendFile,
        messagesEndRef // For attaching to scroll container
    };
}
