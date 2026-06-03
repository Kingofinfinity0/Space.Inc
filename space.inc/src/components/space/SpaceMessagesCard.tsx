import React, { useMemo, useState } from 'react';
import { AtSign, MessageSquare, Send, X } from 'lucide-react';
import { Message } from '../../types';

type SpaceMemberOption = {
    user_id?: string;
    profile_id?: string;
    full_name?: string | null;
    email?: string | null;
    role?: string | null;
};

type MessageSignal = {
    message: Message;
    label: 'Mention' | 'New' | 'Last read' | 'Latest';
};

type Props = {
    messages: Message[];
    loading?: boolean;
    unreadCount?: number;
    currentUserId?: string;
    mentionTokens?: string[];
    members?: SpaceMemberOption[];
    className?: string;
    onOpenChat?: () => void;
    onMarkRead?: (message: Message) => void | Promise<void>;
    onSendReply: (message: Message, content: string) => Promise<boolean>;
};

function initials(message: Message) {
    const label = message.senderName || 'Member';
    return label
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}

function memberInitials(member: SpaceMemberOption) {
    const label = member.full_name || member.email || 'Member';
    return label
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}

function memberMentionToken(member: SpaceMemberOption) {
    return (member.full_name || member.email || 'member')
        .trim()
        .replace(/@.*$/, '')
        .replace(/\s+/g, '.')
        .replace(/[^A-Za-z0-9._-]/g, '')
        .toLowerCase();
}

function previewText(message: Message) {
    if (message.extension === 'image' || message.payload?.mime_type?.startsWith?.('image/')) {
        return message.payload?.file_name ? `Shared an image: ${message.payload.file_name}` : 'Shared an image';
    }
    if (message.extension === 'file') {
        return message.payload?.file_name ? `Attached ${message.payload.file_name}` : 'Attached a file';
    }
    return message.content || 'Message';
}

function formatRelativeTime(value?: string) {
    if (!value) return '';
    const deltaMs = Date.now() - new Date(value).getTime();
    const minutes = Math.max(0, Math.floor(deltaMs / 60000));
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function getActiveMentionToken(value: string) {
    const token = value.split(/\s/).pop() || '';
    if (!token.startsWith('@')) return '';
    return token.slice(1).toLowerCase();
}

export function SpaceMessagesCard({
    messages,
    loading = false,
    unreadCount = 0,
    currentUserId,
    mentionTokens = [],
    members = [],
    className = '',
    onOpenChat,
    onMarkRead,
    onSendReply
}: Props) {
    const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [sendingMessageId, setSendingMessageId] = useState<string | null>(null);
    const [locallyReadIds, setLocallyReadIds] = useState<Set<string>>(() => new Set());

    const normalizedMentionTokens = useMemo(() => {
        return mentionTokens
            .map((token) => token.replace(/^@/, '').trim().toLowerCase())
            .filter(Boolean);
    }, [mentionTokens]);

    const isReadByMe = (message: Message) => {
        return message.senderId === currentUserId || message.readByMe === true || locallyReadIds.has(message.id);
    };

    const isMentionForMe = (message: Message) => {
        if (message.isMentioned) return true;
        if (currentUserId && message.mentionedUserIds?.includes(currentUserId)) return true;
        const content = (message.content || '').toLowerCase();
        return normalizedMentionTokens.some((token) => content.includes(`@${token}`));
    };

    const spotlightMessages = useMemo<MessageSignal[]>(() => {
        const sorted = messages
            .filter((message) => !message.threadRootId && !message.deletedAt)
            .slice()
            .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

        const signals: MessageSignal[] = [];
        const pushUnique = (message: Message | undefined, label: MessageSignal['label']) => {
            if (!message || signals.some((signal) => signal.message.id === message.id)) return;
            signals.push({ message, label });
        };

        pushUnique(sorted.find((message) => isMentionForMe(message)), 'Mention');
        pushUnique(sorted.find((message) => message.senderId !== currentUserId && !isReadByMe(message)), 'New');
        pushUnique(sorted.find((message) => message.senderId !== currentUserId && isReadByMe(message)), 'Last read');
        pushUnique(sorted[0], 'Latest');

        return signals.slice(0, 3);
    }, [currentUserId, locallyReadIds, messages, normalizedMentionTokens]);

    const activeDraft = activeMessageId ? drafts[activeMessageId] || '' : '';
    const activeMentionToken = getActiveMentionToken(activeDraft);
    const mentionCandidates = useMemo(() => {
        if (!activeMessageId || !activeMentionToken) return [];
        return members
            .filter((member) => {
                const label = `${member.full_name || ''} ${member.email || ''}`.toLowerCase();
                return label.includes(activeMentionToken);
            })
            .slice(0, 5);
    }, [activeMentionToken, activeMessageId, members]);

    const handleDraftChange = (messageId: string, value: string) => {
        setDrafts((current) => ({ ...current, [messageId]: value }));
    };

    const handleActivate = (message: Message, active: boolean) => {
        if (active) {
            setActiveMessageId(null);
            return;
        }

        setActiveMessageId(message.id);
        if (!isReadByMe(message)) {
            setLocallyReadIds((current) => {
                const next = new Set(current);
                next.add(message.id);
                return next;
            });
            void onMarkRead?.(message);
        }
    };

    const insertMention = (messageId: string, member: SpaceMemberOption) => {
        const draft = drafts[messageId] || '';
        const parts = draft.split(/\s/);
        parts[parts.length - 1] = `@${memberMentionToken(member)}`;
        setDrafts((current) => ({ ...current, [messageId]: `${parts.join(' ')} ` }));
    };

    const handleReply = async (message: Message) => {
        const content = (drafts[message.id] || '').trim();
        if (!content || sendingMessageId) return;

        setSendingMessageId(message.id);
        const sent = await onSendReply(message, content);
        if (sent) {
            setDrafts((current) => ({ ...current, [message.id]: '' }));
            setActiveMessageId(null);
        }
        setSendingMessageId(null);
    };

    return (
        <section className={`flex flex-col overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}>
            <div className="space-dashboard-panel-header flex items-center justify-between gap-3 border-b border-[#E5E5E5] px-4 py-3">
                <button
                    type="button"
                    onClick={onOpenChat}
                    className="space-dashboard-panel-title text-[#0D0D0D] transition hover:text-[#0D0D0D]"
                >
                    Messages
                </button>
                {unreadCount > 0 && (
                    <span className="space-dashboard-meta-pill rounded-full bg-[#EEF4FF] px-2.5 py-1 text-[#2563EB]">
                        {unreadCount} unread
                    </span>
                )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {loading ? (
                    <div className="space-y-3 px-4 py-4">
                        {[0, 1].map((item) => (
                            <div key={item} className="h-16 animate-pulse rounded-[8px] bg-[#F0F0F2]" />
                        ))}
                    </div>
                ) : spotlightMessages.length > 0 ? (
                    <div className="divide-y divide-[#ECECEF]">
                        {spotlightMessages.map(({ message, label }) => {
                            const active = activeMessageId === message.id;
                            const draft = drafts[message.id] || '';
                            const isSending = sendingMessageId === message.id;
                            return (
                                <div
                                    key={`${label}-${message.id}`}
                                    className={`overflow-hidden transition-all duration-500 ease-out ${
                                        active ? 'bg-[#ECECEF]' : 'bg-white'
                                    }`}
                                >
                                    <div className="flex items-start gap-3 px-4 py-3">
                                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black text-[10px] font-semibold text-white">
                                            {message.senderAvatar ? (
                                                <img src={message.senderAvatar} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                initials(message) || <MessageSquare size={13} />
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleActivate(message, active)}
                                            className="min-w-0 flex-1 text-left"
                                        >
                                            <div className="flex min-w-0 items-center gap-2">
                                                <p className="space-dashboard-list-name truncate text-[#0D0D0D]">{message.senderName || 'Member'}</p>
                                                <span className={`space-dashboard-meta-pill shrink-0 rounded-full px-2 py-0.5 ${
                                                    label === 'Mention'
                                                        ? 'bg-[#F1EDFF] text-[#6D28D9]'
                                                        : label === 'New'
                                                            ? 'bg-[#EEF4FF] text-[#2563EB]'
                                                            : 'bg-[#E4E4E7] text-[#52525B]'
                                                }`}>
                                                    {label}
                                                </span>
                                            </div>
                                            <p className="mt-1 line-clamp-1 text-[12px] text-[#686872]">{previewText(message)}</p>
                                        </button>
                                        <div className="flex shrink-0 flex-col items-end gap-2">
                                            <span className="text-[10px] text-[#9A9AA2]">{formatRelativeTime(message.createdAt)}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleActivate(message, active)}
                                                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all duration-300 ${
                                                    active
                                                        ? 'border-black bg-black text-white'
                                                        : 'border-[#D0D0D4] bg-white text-[#0D0D0D] hover:bg-[#F1F1F3]'
                                                }`}
                                            >
                                                Reply
                                            </button>
                                        </div>
                                    </div>

                                    <div className={`overflow-hidden px-5 transition-all duration-500 ease-out ${
                                        active ? 'max-h-44 pb-4 opacity-100' : 'max-h-0 pb-0 opacity-0'
                                    }`}>
                                        <div className="relative rounded-[20px] border border-[#D7D7DC] bg-white p-2 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                                            {mentionCandidates.length > 0 && (
                                                <div className="absolute bottom-[58px] left-3 right-3 z-20 overflow-hidden rounded-[12px] border border-[#D7D7DC] bg-white shadow-[0_12px_24px_rgba(15,23,42,0.12)]">
                                                    {mentionCandidates.map((member) => (
                                                        <button
                                                            key={member.user_id || member.profile_id || member.email}
                                                            type="button"
                                                            onClick={() => insertMention(message.id, member)}
                                                            className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-[#F1F1F3]"
                                                        >
                                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-[10px] font-semibold text-white">
                                                                {memberInitials(member)}
                                                            </span>
                                                            <span className="min-w-0">
                                                                <span className="block truncate text-xs font-semibold text-[#0D0D0D]">{member.full_name || member.email || 'Member'}</span>
                                                                <span className="block truncate text-[10px] text-[#6E6E80]">@{memberMentionToken(member)}</span>
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="mb-2 flex items-start justify-between gap-2 rounded-[14px] bg-[#E1E1E6] px-3 py-2">
                                                <div className="min-w-0 border-l-2 border-[#9B9BA3] pl-3">
                                                    <p className="text-[11px] font-semibold text-[#0D0D0D]">Replying to {message.senderName || 'message'}</p>
                                                    <p className="mt-0.5 line-clamp-1 text-[11px] text-[#55555F]">{previewText(message)}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveMessageId(null)}
                                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#55555F] hover:bg-white hover:text-[#0D0D0D]"
                                                    aria-label="Close reply"
                                                >
                                                    <X size={13} />
                                                </button>
                                            </div>
                                            <form
                                                className="flex items-center gap-2 rounded-full border border-[#C9C9CF] bg-white px-3 py-1.5 focus-within:border-black"
                                                onSubmit={(event) => {
                                                    event.preventDefault();
                                                    void handleReply(message);
                                                }}
                                            >
                                                <AtSign size={13} className="shrink-0 text-[#777780]" />
                                                <input
                                                    value={draft}
                                                    onChange={(event) => handleDraftChange(message.id, event.target.value)}
                                                    placeholder="Write a reply"
                                                    className="min-w-0 flex-1 bg-transparent text-[12px] outline-none"
                                                    disabled={isSending}
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={!draft.trim() || isSending}
                                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-white transition disabled:opacity-40"
                                                    aria-label="Send reply"
                                                >
                                                    <Send size={13} />
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F1F1F3] text-[#6E6E80]">
                            <MessageSquare size={17} />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-[#0D0D0D]">No message signals</p>
                        <p className="mt-1 max-w-[240px] text-xs text-[#6E6E80]">Unread messages and mentions will appear here.</p>
                    </div>
                )}
            </div>
        </section>
    );
}
