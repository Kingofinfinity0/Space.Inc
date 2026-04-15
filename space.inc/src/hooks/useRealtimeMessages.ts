import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { apiService } from '../services/apiService';
import { friendlyError } from '../utils/errors';

import { Message, SpaceFile } from '../types';

type SendFileResult = {
    success: boolean;
    fileData?: SpaceFile | null;
};

export function useRealtimeMessages(spaceId: string | null, orgId?: string) {
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
        // Immediate cleanup of messages when spaceId or orgId changes
        // This prevents showing "old" data from the previous context
        setMessages([]);

        if (!spaceId || !orgId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        // 1. Fetch initial messages
        const fetchMessages = async () => {
            try {
                const { data, error: fetchError } = await apiService.getMessages(spaceId, orgId);

                if (fetchError) {
                    throw fetchError;
                } else {
                    setMessages(data || []);
                }
            } catch (err: any) {
                console.error('Failed to fetch messages:', err);
                setError(friendlyError(err?.message));
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();

        // 2. Subscribe to realtime inserts
        // We filter by both space_id AND organization_id for multi-tenant security
        const channel = supabase
            .channel(`space-chat:${spaceId}:${orgId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `space_id=eq.${spaceId}`
                },
                (payload) => {
                    const raw = payload.new as any;
                    const newMessage: Message = {
                        id:             raw.id,
                        spaceId:        raw.space_id,
                        organizationId: raw.organization_id,
                        senderId:       raw.sender_id,
                        senderType:     raw.sender_type,
                        content:        raw.content,
                        channel:        raw.channel ?? 'general',
                        extension:      raw.extension ?? 'chat',
                        payload:        raw.payload ?? {},
                        createdAt:      raw.created_at,
                        updatedAt:      raw.updated_at ?? null,
                        editedAt:       raw.edited_at ?? null,
                        deletedAt:      raw.deleted_at ?? null,
                        replyCount:     raw.reply_count ?? 0,
                    };
                    
                    // Defense-in-depth: Manual verification of organization_id in callback
                    // In some edge cases, Supabase filters might be bypassable if not correctly configured in the dashboard
                    if (newMessage.organizationId !== orgId) {
                        console.warn('[useRealtimeMessages] Ignoring message from different tenant:', newMessage.organizationId);
                        return;
                    }

                    setMessages(prev => {
                        // Avoid duplicates (in case we already have it from optimistic update)
                        if (prev.find(m => m.id === newMessage.id)) return prev;
                        return [...prev, newMessage];
                    });
                }
            )
            .subscribe();

        // Cleanup
        return () => {
            supabase.removeChannel(channel);
        };
    }, [spaceId, orgId]);

    // Auto-scroll when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);


    // Send message function
    const sendMessage = async (content: string, channel: 'general' | 'internal' = 'general'): Promise<boolean> => {
        if (!spaceId || !content.trim()) return false;

        try {
            const { data, error: sendError } = await apiService.sendMessage(spaceId, content, 'chat', {}, channel, orgId || '');
            if (sendError) throw sendError;
            // Realtime subscription delivers the full row automatically — no optimistic update needed
            return true;
        } catch (err: any) {
            console.error('Failed to send message:', err);
            setError(friendlyError(err?.message));
            return false;
        }
    };

    // Send file function
    const sendFile = async (currentOrgId: string, file: File): Promise<SendFileResult> => {
        const effectiveOrgId = currentOrgId || orgId;
        if (!spaceId || !effectiveOrgId || !file) return { success: false, fileData: null };

        try {
            setLoading(true);
            setError(null);
            setUploadProgress(0);
            const fileData = await apiService.uploadFile(spaceId, effectiveOrgId, file, (progress) => {
                setUploadProgress(progress);
            });

            // Now send a chat message pointing to this file
            const { data, error: sendError } = await apiService.sendMessage(
                spaceId,
                `Shared a file: ${file.name}`,
                'file',
                { file_id: fileData.id, file_name: file.name, mime_type: file.type },
                'general',
                effectiveOrgId
            );

            if (sendError) throw sendError;
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
