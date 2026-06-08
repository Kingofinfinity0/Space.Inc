import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Hash, Image as ImageIcon, Lock, MessageCircle, Paperclip, Plus, Search, Send, Smile, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import { Message } from '../../types';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { MessageItem } from './MessageItem';
import { LoadingScreen, useLoadingScreenGate } from '../UI';

type SpaceChannel = {
    id: string | null;
    name: string;
    description?: string | null;
    is_private?: boolean;
};

const DEFAULT_CHANNELS: SpaceChannel[] = [
    { id: null, name: 'general', description: 'Client-facing channel', is_private: false }
];

const COMPOSER_EMOJIS = [
    0x1F44D,
    0x2764,
    0x1F602,
    0x1F60D,
    0x1F64C,
    0x1F44F,
    0x1F525,
    0x1F680,
    0x1F4A1,
    0x1F440,
    0x2705,
    0x1F3AF
].map((codePoint) => String.fromCodePoint(codePoint));

const IMAGE_FILE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'heic', 'heif', 'jfif', 'jpeg', 'jpg', 'pjp', 'pjpeg', 'png', 'svg', 'webp']);

const isImageFile = (file: File) => {
    if (file.type.startsWith('image/')) return true;
    const extension = file.name.split('.').pop()?.toLowerCase();
    return !!extension && IMAGE_FILE_EXTENSIONS.has(extension);
};

function sameMessageGroup(previous: Message | undefined, current: Message | undefined) {
    if (!previous || !current) return false;
    const previousSenderKey = previous.senderId || `${previous.senderType}:${previous.senderName || ''}`;
    const currentSenderKey = current.senderId || `${current.senderType}:${current.senderName || ''}`;
    if (previousSenderKey !== currentSenderKey) return false;
    const previousTime = new Date(previous.createdAt).getTime();
    const currentTime = new Date(current.createdAt).getTime();
    return Math.abs(currentTime - previousTime) <= 60 * 1000;
}

function shouldShowTimeMarker(previous: Message | undefined, current: Message) {
    if (!previous) return true;
    const previousDate = new Date(previous.createdAt);
    const currentDate = new Date(current.createdAt);
    if (previousDate.toDateString() !== currentDate.toDateString()) return true;
    return currentDate.getTime() - previousDate.getTime() > 60 * 60 * 1000;
}

function formatTimeMarker(value: string) {
    return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function memberInitials(member: any) {
    const label = member.full_name || member.email || 'Member';
    return label
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part: string) => part[0]?.toUpperCase())
        .join('');
}

function memberMentionToken(member: any) {
    return (member.full_name || member.email || 'member')
        .trim()
        .replace(/@.*$/, '')
        .replace(/\s+/g, '.')
        .replace(/[^A-Za-z0-9._-]/g, '')
        .toLowerCase();
}

const SpaceChatPanel = ({ spaceId, spaceName }: { spaceId: string; spaceName: string }) => {
    const { user, profile, organizationId, userRole } = useAuth();
    const { showToast } = useToast();
    const orgId = organizationId || profile?.organization_id || '';
    const { messages, loading, sendMessage, sendFile, messagesEndRef } = useRealtimeMessages(spaceId, orgId, 30);
    const loadingGate = useLoadingScreenGate(loading);
    const documentInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const [channels, setChannels] = useState<SpaceChannel[]>(DEFAULT_CHANNELS);
    const [activeChannelName, setActiveChannelName] = useState('general');
    const [messageInput, setMessageInput] = useState('');
    const [channelSearch, setChannelSearch] = useState('');
    const [sending, setSending] = useState(false);
    const [draggingFile, setDraggingFile] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState<any>({});
    const [members, setMembers] = useState<any[]>([]);
    const [mentionOpen, setMentionOpen] = useState(false);
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
    const [replyTarget, setReplyTarget] = useState<Message | null>(null);

    const isStaff = ['owner', 'admin', 'staff'].includes(userRole || '');
    const activeChannel = channels.find((channel) => channel.name === activeChannelName) || channels[0];
    const activeDraftKey = activeChannel?.id || activeChannel?.name || 'general';
    const filteredChannels = channels.filter((channel) => {
        const query = channelSearch.trim().toLowerCase();
        if (!query) return true;
        return [channel.name, channel.description].some((value) => String(value || '').toLowerCase().includes(query));
    });

    useEffect(() => {
        let cancelled = false;
        const loadChannels = async () => {
            const { data } = await apiService.getSpaceChannels(spaceId);
            if (cancelled) return;
            const fetched = (data || []).map((channel: any) => ({
                id: channel.id,
                name: channel.name,
                description: channel.description,
                is_private: channel.is_private
            }));
            const next = [...DEFAULT_CHANNELS, ...fetched.filter((channel: SpaceChannel) => channel.name !== 'general')];
            if (isStaff && !next.some((channel) => channel.name === 'internal')) {
                next.push({ id: null, name: 'internal', description: 'Staff-only notes', is_private: true });
            }
            setChannels(next);
        };

        const loadCompanions = async () => {
            const [presenceRes, unreadRes] = await Promise.all([
                apiService.getSpaceMemberPresence(spaceId),
                apiService.getUnreadCounts(spaceId)
            ]);
            if (cancelled) return;
            setMembers(Array.isArray(presenceRes.data) ? presenceRes.data : []);
            setUnreadCounts(unreadRes.data || {});
        };

        loadChannels();
        loadCompanions();
        return () => {
            cancelled = true;
        };
    }, [isStaff, spaceId]);

    useEffect(() => {
        let cancelled = false;
        const loadDraft = async () => {
            if (!activeChannel) return;
            if (activeChannel.id) {
                const { data } = await apiService.getDraft(activeChannel.id);
                if (!cancelled) setMessageInput(data?.content || '');
            } else {
                setMessageInput(localStorage.getItem(`space-draft:${spaceId}:${activeDraftKey}`) || '');
            }
        };
        loadDraft();
        return () => {
            cancelled = true;
        };
    }, [activeChannel?.id, activeDraftKey, spaceId]);

    useEffect(() => {
        if (!activeChannel) return;
        const handle = window.setTimeout(() => {
            if (activeChannel.id) {
                apiService.saveDraft(activeChannel.id, messageInput).catch(console.warn);
            } else {
                localStorage.setItem(`space-draft:${spaceId}:${activeDraftKey}`, messageInput);
            }
        }, 1000);
        return () => window.clearTimeout(handle);
    }, [activeChannel?.id, activeDraftKey, activeChannel, messageInput, spaceId]);

    const activeMessages = useMemo(() => {
        return messages.filter((message) => {
            if (message.threadRootId) return false;
            if (activeChannel?.id && message.channelId) return message.channelId === activeChannel.id;
            return (message.channel || 'general') === activeChannelName;
        });
    }, [activeChannel?.id, activeChannelName, messages]);

    const mentionCandidates = useMemo(() => {
        const token = messageInput.split(/\s/).pop() || '';
        if (!token.startsWith('@')) return [];
        const query = token.slice(1).toLowerCase();
        return members
            .filter((member) => (member.full_name || member.email || '').toLowerCase().includes(query))
            .slice(0, 6);
    }, [members, messageInput]);

    useEffect(() => {
        setMentionOpen(mentionCandidates.length > 0);
    }, [mentionCandidates.length]);

    useEffect(() => {
        const latest = activeMessages[activeMessages.length - 1];
        const channelId = activeChannel?.id || latest?.channelId;
        if (!channelId || !latest?.id) return;
        apiService.markMessagesRead(channelId, latest.id).catch(console.warn);
    }, [activeChannel?.id, activeMessages]);

    const getUnreadFor = (channel: SpaceChannel) => {
        if (Array.isArray(unreadCounts)) {
            const found = unreadCounts.find((item: any) => item.channel_id === channel.id || item.name === channel.name);
            return found?.unread_count || 0;
        }
        return unreadCounts?.[channel.id || channel.name] || unreadCounts?.[channel.name] || 0;
    };

    const handleSend = async () => {
        if (!messageInput.trim() || sending) return;
        setSending(true);
        const success = await sendMessage(messageInput, activeChannelName, { replyTo: replyTarget });
        if (success) {
            setMessageInput('');
            setReplyTarget(null);
            setEmojiPickerOpen(false);
            const latest = activeMessages[activeMessages.length - 1];
            if (activeChannel?.id && latest?.id) apiService.markMessagesRead(activeChannel.id, latest.id).catch(console.warn);
        }
        setSending(false);
    };

    const handleCreateChannel = async () => {
        const name = window.prompt('Channel name');
        if (!name?.trim()) return;
        const description = window.prompt('Channel description') || '';
        const { data, error } = await apiService.createSpaceChannel(spaceId, name.trim().toLowerCase().replace(/\s+/g, '-'), description);
        if (error) {
            showToast(error.message || 'Failed to create channel', 'error');
            return;
        }
        const channel = {
            id: data?.id ?? data,
            name: data?.name ?? name.trim().toLowerCase().replace(/\s+/g, '-'),
            description: data?.description ?? description,
            is_private: data?.is_private ?? false
        };
        setChannels((current) => [...current, channel]);
        setActiveChannelName(channel.name);
    };

    const handleReact = async (message: Message, emoji: string) => {
        const { error } = await apiService.toggleReaction(message.id, emoji);
        if (error) showToast(error.message || 'Failed to update reaction', 'error');
    };

    const handlePin = async (message: Message) => {
        const channelId = message.channelId || activeChannel?.id;
        if (!channelId) {
            showToast('This channel is still syncing. Try pinning again after refresh.', 'error');
            return;
        }
        const { error } = await apiService.pinMessage(message.id, channelId);
        showToast(error ? (error.message || 'Failed to pin message') : 'Message pinned', error ? 'error' : 'success');
    };

    const insertMention = (member: any) => {
        const parts = messageInput.split(/\s/);
        parts[parts.length - 1] = `@${memberMentionToken(member)}`;
        setMessageInput(`${parts.join(' ')} `);
        setMentionOpen(false);
    };

    const handleFileDrop = async (file: File) => {
        if (!orgId) return;
        const result = await sendFile(orgId, file, activeChannelName);
        const kind = isImageFile(file) ? 'Image' : 'File';
        showToast(result.success ? `${kind} shared` : 'Upload failed', result.success ? 'success' : 'error');
    };

    const handlePickedFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) await handleFileDrop(file);
    };

    const insertEmoji = (emoji: string) => {
        setMessageInput((current) => `${current}${emoji}`);
        setEmojiPickerOpen(false);
    };

    const replyPreviewText = (message: Message | null) => {
        if (!message) return '';
        if (message.extension === 'image' || message.payload?.mime_type?.startsWith?.('image/')) return message.payload?.file_name || 'Image';
        if (message.extension === 'file') return message.payload?.file_name || 'File';
        return message.content;
    };

    return (
        <div className="grid h-full min-h-0 w-full grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[380px_minmax(0,1fr)]">
            <aside className="hidden min-h-0 overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] lg:flex lg:flex-col">
                <div className="border-b border-[#E5E5E5] p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="text-[28px] font-semibold leading-none tracking-[-0.04em] text-[#0D0D0D]">Inbox</h2>
                            <p className="mt-2 text-xs text-[#6E6E80]">Space channels and threads.</p>
                        </div>
                        <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-3 text-xs font-medium text-[#6E6E80]">
                            <span className="h-2 w-2 rounded-full bg-[#3B82F6]" />
                            {channels.length} channels
                        </span>
                    </div>
                    <div className="mt-4 flex h-10 items-center gap-2 rounded-[8px] border border-[#DADADA] bg-white px-3 text-[#6E6E80]">
                        <Search size={14} />
                        <input
                            value={channelSearch}
                            onChange={(event) => setChannelSearch(event.target.value)}
                            className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-[#6E6E80]"
                            placeholder="Search chats..."
                            type="text"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2 border-b border-[#E5E5E5] p-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DADADA] bg-white px-3 py-1.5 text-sm font-medium text-[#0D0D0D]">
                        <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
                        {channels.reduce((total, channel) => total + getUnreadFor(channel), 0)} unread
                    </span>
                    <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-3 py-1.5 text-sm font-medium text-[#6E6E80]">Staff + client</span>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                    {filteredChannels.map((channel, index) => {
                        const unread = getUnreadFor(channel);
                        const active = activeChannelName === channel.name;
                        const Icon = channel.name === 'internal' || channel.is_private ? Lock : Hash;
                        const channelMessages = messages.filter((message) => {
                            if (message.threadRootId) return false;
                            if (channel.id && message.channelId) return message.channelId === channel.id;
                            return (message.channel || 'general') === channel.name;
                        });
                        const latest = channelMessages[channelMessages.length - 1];
                        return (
                            <button
                                key={channel.id || channel.name}
                                type="button"
                                onClick={() => setActiveChannelName(channel.name)}
                                style={{ animationDelay: `${index * 20}ms` }}
                                className={`block w-full border-b border-[#E5E5E5] px-4 py-4 text-left transition-colors ${active ? 'bg-[#F7F7F8]' : 'hover:bg-[#F7F7F8]'}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`h-2 w-2 shrink-0 rounded-full ${unread > 0 ? 'bg-[#3B82F6]' : 'bg-[#F43F5E]'}`} />
                                            <Icon size={13} className={active ? 'text-[#0D0D0D]' : 'text-[#9A9AA2]'} />
                                            <span className={`truncate text-sm font-medium ${active ? 'text-[#0D0D0D]' : 'text-[#6E6E80]'}`}>{channel.name}</span>
                                        </div>
                                        <p className="mt-2 line-clamp-2 text-xs text-[#6E6E80]">
                                            {latest?.content || channel.description || 'No messages yet'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] text-[#6E6E80]">
                                            {latest?.createdAt ? new Date(latest.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Join'}
                                        </span>
                                        {unread > 0 && (
                                            <div className="mt-2 inline-flex min-w-[20px] items-center justify-center rounded-full border border-[#DADADA] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#0D0D0D]">
                                                {unread}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                    {filteredChannels.length === 0 && (
                        <div className="p-4 text-center text-sm text-[#6E6E80]">No channels match your search.</div>
                    )}
                </div>
                {isStaff && (
                    <div className="border-t border-[#E5E5E5] p-3">
                        <button
                            type="button"
                            onClick={handleCreateChannel}
                            className="flex h-10 w-full items-center justify-center gap-2 rounded-[8px] border border-[#E5E5E5] bg-white text-sm font-medium text-[#0D0D0D] transition hover:bg-[#F7F7F8]"
                        >
                            <Plus size={14} />
                            New Channel
                        </button>
                    </div>
                )}
            </aside>

            <main className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <header className="border-b border-[#E5E5E5] bg-white p-4 md:flex md:items-center md:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[#DADADA] bg-[#0D0D0D] text-sm font-semibold text-white">
                            {spaceName.substring(0, 2)}
                        </div>
                        <div className="min-w-0">
                            <h3 className="truncate font-semibold tracking-[-0.03em] text-[#0D0D0D]">{spaceName}</h3>
                            <p className="text-xs text-[#6E6E80]">
                                {loading ? 'Loading...' : `${activeMessages.length} messages`}
                            </p>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 md:mt-0 md:justify-end">
                        {channels.length > 1 && (
                            <select
                                value={activeChannelName}
                                onChange={(event) => setActiveChannelName(event.target.value)}
                                className="h-8 rounded-[8px] border border-[#E5E5E5] bg-white px-3 text-[11px] font-medium text-[#0D0D0D] outline-none transition hover:bg-[#F7F7F8] focus:border-black lg:hidden"
                                title="Select channel"
                                aria-label="Select channel"
                            >
                                {channels.map((channel) => (
                                    <option key={channel.id || channel.name} value={channel.name}>
                                        {channel.name}{getUnreadFor(channel) > 0 ? ` (${getUnreadFor(channel)})` : ''}
                                    </option>
                                ))}
                            </select>
                        )}
                        {isStaff && (
                            <button
                                type="button"
                                onClick={handleCreateChannel}
                                className="flex h-8 items-center gap-1.5 rounded-[8px] border border-[#E5E5E5] bg-white px-3 text-[11px] font-medium text-[#6E6E80] transition hover:bg-[#F7F7F8] hover:text-[#0D0D0D] lg:hidden"
                            >
                                <Plus size={13} />
                                Channel
                            </button>
                        )}
                        <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-3 text-[11px] font-medium text-[#6E6E80]">
                            <span className="h-2 w-2 rounded-full bg-[#3B82F6]" />
                            Active thread
                        </span>
                    </div>
                </header>

                <div
                    className={`relative flex-1 overflow-y-auto p-4 md:p-6 ${draggingFile ? 'bg-[#F7F7F8]' : 'bg-white'}`}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setDraggingFile(true);
                    }}
                    onDragLeave={() => setDraggingFile(false)}
                    onDrop={(event) => {
                        event.preventDefault();
                        setDraggingFile(false);
                        const file = event.dataTransfer.files?.[0];
                        if (file) handleFileDrop(file);
                    }}
                >
                    {draggingFile && (
                        <div className="pointer-events-none absolute inset-4 z-20 flex items-center justify-center rounded-[8px] border border-dashed border-[#0D0D0D] bg-white/80 text-sm font-medium text-[#0D0D0D]">
                            Drop image or file to upload
                        </div>
                    )}

                    {loadingGate.isVisible ? (
                        <LoadingScreen
                            key={loadingGate.cycleKey}
                            message="Loading messages..."
                            isComplete={loadingGate.isComplete}
                            onExitComplete={loadingGate.handleExitComplete}
                        />
                    ) : activeMessages.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-center text-[#6E6E80]">
                            <MessageCircle className="mb-3" />
                            <p className="text-sm">No messages in this channel yet.</p>
                        </div>
                    ) : (
                        <div>
                            {activeMessages.map((message, index) => {
                                const previous = activeMessages[index - 1];
                                const next = activeMessages[index + 1];
                                const groupedWithPrevious = sameMessageGroup(previous, message);
                                const groupedWithNext = sameMessageGroup(message, next);
                                return (
                                    <React.Fragment key={message.id}>
                                        {shouldShowTimeMarker(previous, message) && (
                                            <div className="my-3 text-center text-[11px] font-medium text-[#6E6E80]">
                                                {formatTimeMarker(message.createdAt)}
                                            </div>
                                        )}
                                        <MessageItem
                                            msg={message}
                                            currentUserId={user?.id || ''}
                                            organizationId={orgId}
                                            theme="panel"
                                            showHeader={!groupedWithPrevious}
                                            groupedWithPrevious={groupedWithPrevious}
                                            groupedWithNext={groupedWithNext}
                                            onReply={setReplyTarget}
                                            onReact={handleReact}
                                            onPin={isStaff ? handlePin : undefined}
                                        />
                                    </React.Fragment>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                <footer className="border-t border-[#E5E5E5] bg-white p-4">
                    <div className="relative">
                        {mentionOpen && (
                            <div className="absolute bottom-full left-12 z-20 mb-2 w-80 overflow-hidden rounded-[14px] border border-[#D7D7DC] bg-white shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
                                {mentionCandidates.map((member) => (
                                    <button
                                        key={member.user_id || member.profile_id || member.email}
                                        type="button"
                                        onClick={() => insertMention(member)}
                                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[#F1F1F3]"
                                    >
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black text-[10px] font-semibold text-white">
                                            {member.avatar_url ? <img src={member.avatar_url} alt="" className="h-full w-full object-cover" /> : memberInitials(member)}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-[#0D0D0D]">{member.full_name || member.email || 'Member'}</span>
                                            <span className="block truncate text-[11px] text-[#6E6E80]">@{memberMentionToken(member)}</span>
                                        </span>
                                        {member.role && (
                                            <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-2 py-0.5 text-[9px] font-semibold uppercase text-[#6E6E80]">
                                                {member.role}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                        {replyTarget && (
                            <div className="mb-2 overflow-hidden rounded-[16px] border border-[#E5E5E5] bg-[#F7F7F8]">
                                <div className="flex items-start justify-between gap-3 px-4 py-3">
                                    <div className="min-w-0 border-l-2 border-[#C9C9CF] pl-3">
                                        <p className="text-xs font-semibold text-[#0D0D0D]">
                                            Replying to {replyTarget.senderId === user?.id ? 'yourself' : (replyTarget.senderName || 'message')}
                                        </p>
                                        <p className="mt-1 line-clamp-2 text-xs text-[#6E6E80]">{replyPreviewText(replyTarget)}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setReplyTarget(null)}
                                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#6E6E80] hover:bg-white hover:text-[#0D0D0D]"
                                        title="Cancel reply"
                                        aria-label="Cancel reply"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                        {emojiPickerOpen && (
                            <div className="absolute bottom-full right-12 z-20 mb-2 grid w-44 grid-cols-6 gap-1 rounded-[12px] border border-[#D7D7DC] bg-white p-2 shadow-[0_12px_24px_rgba(15,23,42,0.12)]">
                                {COMPOSER_EMOJIS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => insertEmoji(emoji)}
                                        className="flex h-7 w-7 items-center justify-center rounded-full text-base transition hover:bg-[#F1F1F3]"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                        <input
                            ref={documentInputRef}
                            type="file"
                            className="hidden"
                            accept=".csv,.doc,.docx,.pdf,.ppt,.pptx,.txt,.xls,.xlsx,application/*,text/*"
                            onChange={handlePickedFile}
                        />
                        <input
                            ref={imageInputRef}
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handlePickedFile}
                        />
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => documentInputRef.current?.click()}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] text-[#6E6E80] transition hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                                title="Upload file"
                                aria-label="Upload file"
                            >
                                <Paperclip size={18} />
                            </button>
                            <input
                                type="text"
                                value={messageInput}
                                onChange={(event) => setMessageInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && !event.shiftKey) {
                                        event.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder="Message..."
                                className="min-w-0 flex-1 rounded-[8px] border border-[#DADADA] bg-white px-5 py-3 text-sm text-[#0D0D0D] outline-none placeholder:text-[#6E6E80] focus:border-black"
                                disabled={sending}
                            />
                            <button
                                type="button"
                                onClick={() => setEmojiPickerOpen((open) => !open)}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] text-[#6E6E80] transition hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                                title="Add emoji"
                                aria-label="Add emoji"
                            >
                                <Smile size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={() => imageInputRef.current?.click()}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] text-[#6E6E80] transition hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                                title="Upload image"
                                aria-label="Upload image"
                            >
                                <ImageIcon size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={handleSend}
                                disabled={sending || !messageInput.trim()}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-black text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                                title="Send"
                                aria-label="Send"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </footer>
            </main>

        </div>
    );
};

export default SpaceChatPanel;
