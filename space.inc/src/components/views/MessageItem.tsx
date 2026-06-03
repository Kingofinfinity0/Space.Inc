import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../../types';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../utils/errors';
import { File as DocIconLucide, Image as ImageIcon, Download as DownloadIcon, Check as CheckIcon, X as XIcon, Edit2 as EditIcon, Trash2 as TrashIcon, MoreVertical as MoreVerticalIcon, Pin, Reply, Shield, SmilePlus, Sparkles } from 'lucide-react';
import { apiService } from '../../services/apiService';

const REACTION_OPTIONS = [
    { emoji: '👍', label: 'Agree' },
    { emoji: '✅', label: 'Done' },
    { emoji: '👀', label: 'Reviewing' },
    { emoji: '🙌', label: 'Great' },
    { emoji: '💡', label: 'Idea' },
    { emoji: '🎯', label: 'On target' },
    { emoji: '🚀', label: 'Ship it' },
    { emoji: '❤️', label: 'Appreciate' }
];

export const MessageItem = ({ 
    msg, 
    currentUserId, 
    organizationId, 
    theme = 'inbox',
    showHeader = true,
    onReply,
    onReact,
    onPin
}: { 
    msg: Message, 
    currentUserId: string, 
    organizationId: string, 
    theme?: 'inbox' | 'panel',
    showHeader?: boolean,
    onReply?: (message: Message) => void,
    onReact?: (message: Message, emoji: string) => void,
    onPin?: (message: Message) => void
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(msg.content);
    const [showMenu, setShowMenu] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const isOwner = msg.senderId === currentUserId;
    const mimeType = msg.payload?.mime_type || '';
    const isImageAttachment = msg.extension === 'image' || msg.payload?.kind === 'image' || mimeType.startsWith('image/');
    const isFileAttachment = msg.extension === 'file' && !isImageAttachment;
    const quoted = msg.payload?.reply_to;

    useEffect(() => {
        let cancelled = false;
        const loadImageUrl = async () => {
            if (!isImageAttachment || !msg.payload?.file_id || !organizationId) {
                setImageUrl(null);
                return;
            }
            const { data } = await apiService.getSignedUrl(msg.payload.file_id, organizationId);
            if (!cancelled) setImageUrl(data?.signedUrl || null);
        };
        void loadImageUrl();
        return () => {
            cancelled = true;
        };
    }, [isImageAttachment, msg.payload?.file_id, organizationId]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleContextMenu = (e: React.MouseEvent) => {
        if (!isOwner || msg.content === '[Message deleted]') return;
        e.preventDefault();
        setShowMenu(true);
    };

    const handleEditSave = async () => {
        if (!editContent.trim() || editContent === msg.content) {
            setIsEditing(false);
            return;
        }
        const { error } = await supabase.rpc('edit_message', { p_message_id: msg.id, p_new_content: editContent });
        if (error) {
            alert(friendlyError(error.message)); // Using alert as fallback if no toast available
        }
        setIsEditing(false);
        setShowMenu(false);
    };

    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to delete this message?")) return;
        const { error } = await supabase.rpc('delete_message', { p_message_id: msg.id });
        if (error) alert(friendlyError(error.message));
        setShowMenu(false);
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Style variations
    const alignRight = msg.senderType === 'staff';
    const isInternal = msg.channel === 'internal';

    const bubbleClass = isInternal
        ? 'bg-[#F7F7F8] border border-[#E5E5E5] text-[#0D0D0D] group'
        : theme === 'inbox'
            ? alignRight
                ? 'bg-[#0D0D0D] text-white border border-[#0D0D0D] group'
                : 'bg-white border border-[#E5E5E5] text-[#0D0D0D] group'
            : alignRight
                ? 'bg-[#0D0D0D] text-white border border-[#0D0D0D] group'
                : 'bg-[#F7F7F8] border border-[#E5E5E5] text-[#0D0D0D] group';

    const shellTone = isInternal ? 'bg-[#F7F7F8]' : alignRight ? 'bg-[#0D0D0D] text-white' : 'bg-white';
    const senderTone = alignRight ? 'text-white/70' : 'text-[#6E6E80]';
    const quoteTone = alignRight
        ? 'border-white/20 bg-white/10 text-white/80'
        : 'border-[#DADADD] bg-[#EFEFF1] text-[#4F4F5A]';

    const quotedPreview = quoted
        ? quoted.extension === 'image' || quoted.mime_type?.startsWith?.('image/')
            ? quoted.file_name || 'Image'
            : quoted.extension === 'file'
                ? quoted.file_name || 'File'
                : quoted.content || 'Message'
        : '';

    return (
        <div className={`relative mb-4 flex ${alignRight ? 'justify-end' : 'justify-start'}`}>
            <div 
                onContextMenu={handleContextMenu}
                className={`max-w-[86%] rounded-[8px] px-4 py-3 text-sm shadow-[0_1px_3px_rgba(0,0,0,0.06)] md:max-w-[70%] ${bubbleClass}`}
            >
                {/* Context Menu Button for touch/mobile (visible on hover) */}
                {isOwner && msg.content !== '[Message deleted]' && !isEditing && (
                    <button 
                        onClick={() => setShowMenu(!showMenu)}
                        title="More options"
                        aria-label="More options"
                        className={`absolute top-2 ${alignRight ? '-left-9' : '-right-9'} flex h-7 w-7 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#6E6E80] opacity-0 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-opacity group-hover:opacity-100`}
                    >
                        <MoreVerticalIcon size={14} />
                    </button>
                )}

                {/* Context Menu */}
                {showMenu && (
                    <div ref={menuRef} className={`absolute top-0 z-10 w-32 overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white text-[#6E6E80] shadow-[0_12px_24px_rgba(0,0,0,0.08)] ${alignRight ? 'right-full mr-2' : 'left-full ml-2'}`}>
                        <button onClick={() => { setIsEditing(true); setShowMenu(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#F7F7F8]">
                            <EditIcon size={14} /> Edit
                        </button>
                        <button onClick={handleDelete} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#B42318] hover:bg-[#FEF2F2]">
                            <TrashIcon size={14} /> Delete
                        </button>
                    </div>
                )}

                {msg.channel === 'internal' && (
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">
                        <Shield size={12} />
                        Internal note
                    </div>
                )}
                {showHeader && msg.senderName && (
                    <p className={`mb-1 text-[10px] font-medium ${senderTone}`}>
                        {msg.senderName}
                    </p>
                )}

                {quoted && (
                    <div className={`mb-2 rounded-[8px] border-l-2 px-3 py-2 ${quoteTone}`}>
                        <p className="text-[11px] font-semibold">
                            Replying to {quoted.sender_id === currentUserId ? 'yourself' : (quoted.sender_name || 'message')}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs opacity-80">{quotedPreview}</p>
                    </div>
                )}

                {isImageAttachment ? (
                    <div className="overflow-hidden rounded-[10px] border border-[#E5E5E5] bg-white">
                        {imageUrl ? (
                            <button
                                type="button"
                                onClick={() => window.open(imageUrl, '_blank')}
                                className="block w-full bg-[#F7F7F8]"
                                title="Open image"
                                aria-label="Open image"
                            >
                                <img src={imageUrl} alt={msg.payload?.file_name || 'Shared image'} className="max-h-72 w-full object-cover" />
                            </button>
                        ) : (
                            <div className="flex h-40 items-center justify-center gap-2 bg-[#F7F7F8] text-xs text-[#6E6E80]">
                                <ImageIcon size={16} />
                                Image preview
                            </div>
                        )}
                        <div className="flex items-center justify-between gap-3 px-3 py-2">
                            <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-[#0D0D0D]">{msg.payload?.file_name || 'Image'}</p>
                                <p className="text-[10px] text-[#6E6E80]">Image shared</p>
                            </div>
                            <button
                                title="Download Image"
                                onClick={async () => {
                                    const { data } = await apiService.getSignedUrl(msg.payload.file_id, organizationId);
                                    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                }}
                                className="rounded-full p-1.5 text-[#6E6E80] transition-colors hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                            >
                                <DownloadIcon size={16} />
                            </button>
                        </div>
                    </div>
                ) : isFileAttachment ? (
                    <div className={`flex items-center gap-3 rounded-[8px] border border-[#E5E5E5] px-3 py-2 ${shellTone}`}>
                        <div className="rounded-[8px] border border-[#E5E5E5] bg-[#FFFFFF] p-2 text-[#0D0D0D]">
                            <DocIconLucide size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-xs">{msg.payload?.file_name}</p>
                            <p className="text-[10px] text-[#6E6E80]">Document shared</p>
                        </div>
                        <button
                            title="Download File"
                            onClick={async () => {
                                const { data } = await apiService.getSignedUrl(msg.payload.file_id, organizationId);
                                if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                            }}
                            className="rounded-full p-1.5 text-[#6E6E80] transition-colors hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                        >
                            <DownloadIcon size={16} />
                        </button>
                    </div>
                ) : isEditing ? (
                    <div className="flex flex-col gap-2 mt-1 min-w-[200px]">
                        <input 
                            title="Edit message content"
                            aria-label="Edit message content"
                            className="w-full rounded-[8px] border border-[#DADADA] bg-white px-3 py-2 text-sm text-[#0D0D0D] focus:border-black focus:outline-none"
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleEditSave();
                                if (e.key === 'Escape') setIsEditing(false);
                            }}
                            autoFocus
                        />
                        <div className="flex justify-end gap-1">
                            <button title="Cancel Edit" aria-label="Cancel Edit" onClick={() => setIsEditing(false)} className="rounded-[8px] p-1.5 text-[#6E6E80] hover:bg-[#EFEFEF]"><XIcon size={14}/></button>
                            <button title="Save Edit" aria-label="Save Edit" onClick={handleEditSave} className="rounded-[8px] p-1.5 text-[#0D0D0D] hover:bg-[#F7F7F8]"><CheckIcon size={14}/></button>
                        </div>
                    </div>
                ) : (
                    <div>
                        {msg.content === '[Message deleted]' ? (
                            <p className="text-sm italic text-[#6E6E80]">[Message deleted]</p>
                        ) : (
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                {msg.content}
                                {msg.updatedAt && msg.updatedAt !== msg.createdAt && (
                                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-[#6E6E80]">
                                        <Sparkles size={10} />
                                        edited
                                    </span>
                                )}
                            </p>
                        )}
                    </div>
                )}

                <p className="mt-2 text-right text-[10px] text-[#6E6E80]">
                    {formatTime(msg.createdAt)}
                </p>

                {Array.isArray(msg.reactions) && msg.reactions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {msg.reactions.map((reaction) => (
                            <button
                                key={reaction.emoji}
                                type="button"
                                onClick={() => onReact?.(msg, reaction.emoji)}
                                title={reaction.names?.join(', ') || `${reaction.count} reactions`}
                                className="inline-flex items-center gap-1 rounded-full border border-[#E5E5E5] bg-white px-2 py-0.5 text-[11px] text-[#0D0D0D]"
                            >
                                <span>{reaction.emoji}</span>
                                <span>{reaction.count}</span>
                            </button>
                        ))}
                    </div>
                )}

                {(onReply || onReact || onPin) && msg.content !== '[Message deleted]' && !isEditing && (
                    <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {onReact && (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowReactionPicker((current) => !current)}
                                    className="inline-flex items-center gap-1 rounded-full border border-[#E5E5E5] bg-white px-2 py-1 text-[10px] font-medium text-[#6E6E80] hover:text-[#0D0D0D]"
                                >
                                    <SmilePlus size={12} />
                                    React
                                </button>
                                {showReactionPicker && (
                                    <div className={`absolute bottom-full z-20 mb-2 grid w-44 grid-cols-4 gap-1 rounded-[12px] border border-[#D7D7DC] bg-white p-2 shadow-[0_12px_24px_rgba(15,23,42,0.12)] ${alignRight ? 'right-0' : 'left-0'}`}>
                                        {REACTION_OPTIONS.map((reaction) => (
                                            <button
                                                key={reaction.emoji}
                                                type="button"
                                                onClick={() => {
                                                    onReact(msg, reaction.emoji);
                                                    setShowReactionPicker(false);
                                                }}
                                                title={reaction.label}
                                                className="flex h-8 w-8 items-center justify-center rounded-full text-base transition hover:bg-[#F1F1F3]"
                                            >
                                                {reaction.emoji}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {onReply && (
                            <button
                                type="button"
                                onClick={() => onReply(msg)}
                                className="inline-flex items-center gap-1 rounded-full border border-[#E5E5E5] bg-white px-2 py-1 text-[10px] font-medium text-[#6E6E80] hover:text-[#0D0D0D]"
                            >
                                <Reply size={12} />
                                Reply
                            </button>
                        )}
                        {onPin && (
                            <button
                                type="button"
                                onClick={() => onPin(msg)}
                                className="inline-flex items-center gap-1 rounded-full border border-[#E5E5E5] bg-white px-2 py-1 text-[10px] font-medium text-[#6E6E80] hover:text-[#0D0D0D]"
                            >
                                <Pin size={12} />
                                Pin
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
