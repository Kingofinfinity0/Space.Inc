import React, { useEffect, useMemo, useState } from 'react';
import { AtSign, Hash, Lock, MessageCircle, Paperclip, Plus, Search, Send, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import { FileUploadModal } from '../FileUploadModal';
import { Message } from '../../types';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { MessageItem } from './MessageItem';

type SpaceChannel = {
    id: string | null;
    name: string;
    description?: string | null;
    is_private?: boolean;
};

const DEFAULT_CHANNELS: SpaceChannel[] = [
    { id: null, name: 'general', description: 'Client-facing channel', is_private: false }
];

function sameMessageGroup(previous: Message | undefined, current: Message) {
    if (!previous) return false;
    if (previous.senderId !== current.senderId) return false;
    const previousTime = new Date(previous.createdAt).getTime();
    const currentTime = new Date(current.createdAt).getTime();
    return Math.abs(currentTime - previousTime) <= 5 * 60 * 1000;
}

function formatDateDivider(value: string) {
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
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
    const { messages, loading, sendMessage, sendFile, messagesEndRef } = useRealtimeMessages(spaceId, orgId, 50);

    const [channels, setChannels] = useState<SpaceChannel[]>(DEFAULT_CHANNELS);
    const [activeChannelName, setActiveChannelName] = useState('general');
    const [messageInput, setMessageInput] = useState('');
    const [sending, setSending] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [draggingFile, setDraggingFile] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState<any>({});
    const [members, setMembers] = useState<any[]>([]);
    const [mentionOpen, setMentionOpen] = useState(false);
    const [replyTarget, setReplyTarget] = useState<Message | null>(null);
    const [dmThreads, setDmThreads] = useState<any[]>([]);

    const isStaff = ['owner', 'admin', 'staff'].includes(userRole || '');
    const activeChannel = channels.find((channel) => channel.name === activeChannelName) || channels[0];
    const activeDraftKey = activeChannel?.id || activeChannel?.name || 'general';

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
            const [presenceRes, unreadRes, dmRes] = await Promise.all([
                apiService.getSpaceMemberPresence(spaceId),
                apiService.getUnreadCounts(spaceId),
                apiService.getDmThreads()
            ]);
            if (cancelled) return;
            setMembers(Array.isArray(presenceRes.data) ? presenceRes.data : []);
            setUnreadCounts(unreadRes.data || {});
            setDmThreads(Array.isArray(dmRes.data) ? dmRes.data : []);
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
        const kind = file.type.startsWith('image/') ? 'Image' : 'File';
        showToast(result.success ? `${kind} uploaded` : 'Upload failed', result.success ? 'success' : 'error');
    };

    const replyPreviewText = (message: Message | null) => {
        if (!message) return '';
        if (message.extension === 'image' || message.payload?.mime_type?.startsWith?.('image/')) return message.payload?.file_name || 'Image';
        if (message.extension === 'file') return message.payload?.file_name || 'File';
        return message.content;
    };

    return (
        <div className="flex h-[680px] overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white">
            <aside className="hidden w-64 shrink-0 flex-col border-r border-[#E5E5E5] bg-[#F7F7F8] md:flex">
                <div className="border-b border-[#E5E5E5] p-4">
                    <p className="text-sm font-semibold text-[#0D0D0D]">{spaceName}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Channels</p>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                    {channels.map((channel) => {
                        const unread = getUnreadFor(channel);
                        const active = activeChannelName === channel.name;
                        const Icon = channel.name === 'internal' || channel.is_private ? Lock : Hash;
                        return (
                            <button
                                key={channel.id || channel.name}
                                type="button"
                                onClick={() => setActiveChannelName(channel.name)}
                                className={`mb-1 flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-sm ${active ? 'bg-white text-[#0D0D0D] shadow-[0_1px_3px_rgba(0,0,0,0.06)]' : 'text-[#6E6E80] hover:bg-white/70 hover:text-[#0D0D0D]'}`}
                            >
                                <Icon size={14} />
                                <span className="min-w-0 flex-1 truncate">{channel.name}</span>
                                {unread > 0 && <span className="rounded-full bg-black px-1.5 py-0.5 text-[10px] text-white">{unread}</span>}
                            </button>
                        );
                    })}
                    {isStaff && (
                        <button
                            type="button"
                            onClick={handleCreateChannel}
                            className="mt-2 flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-sm font-medium text-[#0D0D0D] hover:bg-white"
                        >
                            <Plus size={14} />
                            New Channel
                        </button>
                    )}
                </div>
                <div className="border-t border-[#E5E5E5] p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Direct Messages</p>
                    {dmThreads.slice(0, 4).map((thread) => (
                        <div key={thread.thread_id || thread.id} className="rounded-[8px] px-3 py-2 text-xs text-[#6E6E80]">
                            {thread.participants?.map((participant: any) => participant.full_name).filter(Boolean).join(', ') || 'Direct thread'}
                        </div>
                    ))}
                    {dmThreads.length === 0 && <p className="px-3 py-2 text-xs text-[#6E6E80]">No direct messages yet</p>}
                </div>
            </aside>

            <main className="flex min-w-0 flex-1 flex-col">
                <header className="flex items-center justify-between gap-3 border-b border-[#E5E5E5] px-4 py-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[#0D0D0D]">
                            {activeChannel?.is_private || activeChannelName === 'internal' ? <Lock size={16} /> : <Hash size={16} />}
                            <span className="truncate">{activeChannelName}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[#6E6E80]">{activeChannel?.description || 'Space conversation'}</p>
                    </div>
                    <div className="hidden items-center gap-2 rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] px-3 py-2 text-xs text-[#6E6E80] sm:flex">
                        <Search size={14} />
                        Search enabled in backend
                    </div>
                </header>

                <div
                    className={`relative flex-1 overflow-y-auto p-5 ${draggingFile ? 'bg-[#F7F7F8]' : 'bg-white'}`}
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

                    {loading ? (
                        <div className="flex h-full items-center justify-center text-sm text-[#6E6E80]">Loading messages...</div>
                    ) : activeMessages.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-center text-[#6E6E80]">
                            <MessageCircle className="mb-3" />
                            <p className="text-sm">No messages in this channel yet.</p>
                        </div>
                    ) : (
                        <div>
                            {activeMessages.map((message, index) => {
                                const previous = activeMessages[index - 1];
                                const showDateDivider = !previous || new Date(previous.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
                                return (
                                    <React.Fragment key={message.id}>
                                        {showDateDivider && (
                                            <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">
                                                <span className="h-px flex-1 bg-[#E5E5E5]" />
                                                {formatDateDivider(message.createdAt)}
                                                <span className="h-px flex-1 bg-[#E5E5E5]" />
                                            </div>
                                        )}
                                        <MessageItem
                                            msg={message}
                                            currentUserId={user?.id || ''}
                                            organizationId={orgId}
                                            theme="panel"
                                            showHeader={!sameMessageGroup(previous, message)}
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
                        <div className="flex items-end gap-2 rounded-[28px] border border-[#DADADA] bg-white px-2 py-2 shadow-[0_1px_2px_rgba(16,24,40,0.04)] focus-within:border-black">
                            <button
                                type="button"
                                onClick={() => setIsUploadModalOpen(true)}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#6E6E80] hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                                title="Attach file"
                                aria-label="Attach file"
                            >
                                <Paperclip size={18} />
                            </button>
                            <textarea
                                value={messageInput}
                                onChange={(event) => setMessageInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && !event.shiftKey) {
                                        event.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder={`Message ${activeChannelName}`}
                                className="max-h-32 min-h-[40px] flex-1 resize-none border-0 bg-transparent px-1 py-2.5 text-sm outline-none"
                                disabled={sending}
                            />
                            <button
                                type="button"
                                onClick={handleSend}
                                disabled={sending || !messageInput.trim()}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white disabled:opacity-50"
                                title="Send"
                                aria-label="Send"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                </footer>
            </main>

            <FileUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                loading={sending}
                uploadProgress={null}
                onUpload={async (file) => {
                    await handleFileDrop(file);
                    return true;
                }}
            />
        </div>
    );
};

export default SpaceChatPanel;
