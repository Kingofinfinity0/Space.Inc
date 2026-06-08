import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../../types';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../utils/errors';
import { File as DocIconLucide, Image as ImageIcon, Download as DownloadIcon, Check as CheckIcon, X as XIcon, Edit2 as EditIcon, Trash2 as TrashIcon, MoreVertical as MoreVerticalIcon, Pin, Reply, Shield, Sparkles } from 'lucide-react';
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

const IMAGE_FILE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'heic', 'heif', 'jfif', 'jpeg', 'jpg', 'pjp', 'pjpeg', 'png', 'svg', 'webp']);

const isImagePayload = (msg: Message, mimeType: string) => {
    if (msg.extension === 'image' || msg.payload?.kind === 'image' || mimeType.startsWith('image/')) return true;
    const hasAttachmentPayload = msg.extension === 'file' || Boolean(msg.payload?.file_id || msg.payload?.file_name);
    if (!hasAttachmentPayload) return false;
    const fileName = msg.payload?.file_name || msg.content || '';
    const extension = String(fileName).split('.').pop()?.toLowerCase();
    return !!extension && IMAGE_FILE_EXTENSIONS.has(extension);
};

const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, index);
    return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
};

export const MessageItem = ({ 
    msg, 
    currentUserId, 
    organizationId, 
    theme = 'inbox',
    showHeader = true,
    groupedWithPrevious = false,
    groupedWithNext = false,
    onReply,
    onReact,
    onPin
}: { 
    msg: Message, 
    currentUserId: string, 
    organizationId: string, 
    theme?: 'inbox' | 'panel',
    showHeader?: boolean,
    groupedWithPrevious?: boolean,
    groupedWithNext?: boolean,
    onReply?: (message: Message) => void,
    onReact?: (message: Message, emoji: string) => void,
    onPin?: (message: Message) => void
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(msg.content);
    const [showMenu, setShowMenu] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const isOwner = msg.senderId === currentUserId;
    const mimeType = msg.payload?.mime_type || '';
    const isImageAttachment = isImagePayload(msg, mimeType);
    const isFileAttachment = msg.extension === 'file' && !isImageAttachment;
    const fileName = msg.payload?.file_name || 'Document';
    const fileExtension = String(fileName).includes('.') ? String(fileName).split('.').pop()?.toUpperCase() || 'DOC' : 'DOC';
    const isPdfAttachment = isFileAttachment && (mimeType === 'application/pdf' || String(fileName).toLowerCase().endsWith('.pdf'));
    const isTextAttachment = isFileAttachment && mimeType.startsWith('text/');
    const canPreviewFile = isPdfAttachment || isTextAttachment;
    const fileSizeLabel = formatFileSize(msg.payload?.file_size || msg.payload?.file_size_bytes);
    const quoted = msg.payload?.reply_to;
    const isDeleted = msg.content === '[Message deleted]';
    const canOpenMenu = !isDeleted && !isEditing && Boolean(isOwner || onReply || onReact || onPin);

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
        let cancelled = false;
        const loadFileUrl = async () => {
            if (!isFileAttachment || !msg.payload?.file_id || !organizationId) {
                setFileUrl(null);
                return;
            }
            const { data } = await apiService.getSignedUrl(msg.payload.file_id, organizationId);
            if (!cancelled) setFileUrl(data?.signedUrl || null);
        };
        void loadFileUrl();
        return () => {
            cancelled = true;
        };
    }, [isFileAttachment, msg.payload?.file_id, organizationId]);

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
        if (!canOpenMenu) return;
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

    const handleOpenFile = async () => {
        if (fileUrl) {
            window.open(fileUrl, '_blank');
            return;
        }
        const { data } = await apiService.getSignedUrl(msg.payload.file_id, organizationId);
        if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    };

    // Style variations
    const alignRight = msg.senderType === 'staff';
    const isInternal = msg.channel === 'internal';

    const bubbleClass = isInternal
        ? 'bg-[#F7F7F8] border border-[#E5E5E5] text-[#0D0D0D] group'
        : isImageAttachment
            ? 'bg-transparent text-[#0D0D0D] border border-transparent shadow-none group'
            : theme === 'inbox'
            ? alignRight
                ? 'bg-[#0D0D0D] text-white border border-[#0D0D0D] group'
                : 'bg-white border border-[#E5E5E5] text-[#0D0D0D] group'
            : alignRight
                ? 'bg-[#0D0D0D] text-white border border-[#0D0D0D] group'
                : 'bg-[#F7F7F8] border border-[#E5E5E5] text-[#0D0D0D] group';

    const quoteTone = alignRight
        ? 'border-white/20 bg-white/10 text-white/80'
        : 'border-[#DADADD] bg-[#EFEFF1] text-[#4F4F5A]';
    const attachmentCardTone = alignRight && !isInternal
        ? 'border-white/15 bg-[#111111] text-white'
        : 'border-[#DADADD] bg-white text-[#0D0D0D]';
    const attachmentMetaTone = alignRight && !isInternal ? 'text-white/55' : 'text-[#6E6E80]';
    const attachmentButtonTone = alignRight && !isInternal
        ? 'text-white/70 hover:bg-white/10 hover:text-white'
        : 'text-[#6E6E80] hover:bg-[#F7F7F8] hover:text-[#0D0D0D]';

    const quotedPreview = quoted
        ? quoted.extension === 'image' || quoted.mime_type?.startsWith?.('image/')
            ? quoted.file_name || 'Image'
            : quoted.extension === 'file'
                ? quoted.file_name || 'File'
                : quoted.content || 'Message'
        : '';
    const groupRadius = alignRight
        ? `${groupedWithPrevious ? 'rounded-tr-[3px]' : 'rounded-tr-[16px]'} ${groupedWithNext ? 'rounded-br-[3px]' : 'rounded-br-[16px]'} rounded-l-[16px]`
        : `${groupedWithPrevious ? 'rounded-tl-[3px]' : 'rounded-tl-[16px]'} ${groupedWithNext ? 'rounded-bl-[3px]' : 'rounded-bl-[16px]'} rounded-r-[16px]`;
    const visibleReactions = Array.isArray(msg.reactions) ? msg.reactions.filter((reaction) => reaction.count > 0) : [];
    const hasReactions = visibleReactions.length > 0;
    const rowSpacing = groupedWithNext && !hasReactions ? 'mb-[2px]' : hasReactions ? 'mb-5' : 'mb-3';

    return (
        <div className={`relative flex ${rowSpacing} ${alignRight ? 'justify-end' : 'justify-start'}`}>
            <div 
                onContextMenu={handleContextMenu}
                className={`relative w-fit max-w-[86%] text-sm transition-[border-radius,background-color] sm:max-w-[74%] md:max-w-[64%] ${isImageAttachment ? 'p-0 shadow-none' : 'px-3 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]'} ${groupRadius} ${bubbleClass}`}
            >
                {/* Context Menu Button for touch/mobile (visible on hover) */}
                {canOpenMenu && (
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
                    <div ref={menuRef} className={`absolute top-0 z-20 w-44 overflow-hidden rounded-[10px] border border-[#E5E5E5] bg-white text-[#6E6E80] shadow-[0_12px_24px_rgba(0,0,0,0.08)] ${alignRight ? 'right-full mr-2' : 'left-full ml-2'}`}>
                        {onReply && (
                            <button
                                type="button"
                                onClick={() => {
                                    onReply(msg);
                                    setShowMenu(false);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#F7F7F8]"
                            >
                                <Reply size={14} /> Reply
                            </button>
                        )}
                        {onPin && (
                            <button
                                type="button"
                                onClick={() => {
                                    onPin(msg);
                                    setShowMenu(false);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#F7F7F8]"
                            >
                                <Pin size={14} /> Pin
                            </button>
                        )}
                        {onReact && (
                            <div className="border-t border-[#EFEFEF] px-2 py-2">
                                <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A9AA2]">React</p>
                                <div className="grid grid-cols-4 gap-1">
                                    {REACTION_OPTIONS.map((reaction) => (
                                        <button
                                            key={reaction.emoji}
                                            type="button"
                                            onClick={() => {
                                                onReact(msg, reaction.emoji);
                                                setShowMenu(false);
                                            }}
                                            title={reaction.label}
                                            className="flex h-8 w-8 items-center justify-center rounded-full text-base transition hover:bg-[#F1F1F3]"
                                        >
                                            {reaction.emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {isOwner && (
                            <div className="border-t border-[#EFEFEF]">
                                <button onClick={() => { setIsEditing(true); setShowMenu(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#F7F7F8]">
                                    <EditIcon size={14} /> Edit
                                </button>
                                <button onClick={handleDelete} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#B42318] hover:bg-[#FEF2F2]">
                                    <TrashIcon size={14} /> Delete
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {msg.channel === 'internal' && (
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">
                        <Shield size={12} />
                        Internal note
                    </div>
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
                    imageUrl ? (
                        <button
                            type="button"
                            onClick={() => window.open(imageUrl, '_blank')}
                            className="block overflow-hidden bg-transparent"
                            title="Open image"
                            aria-label="Open image"
                        >
                            <img src={imageUrl} alt={msg.payload?.file_name || 'Shared image'} className="max-h-80 max-w-full rounded-[16px] object-cover" />
                        </button>
                    ) : (
                        <div className="flex h-40 w-64 max-w-full items-center justify-center gap-2 rounded-[16px] bg-[#F7F7F8] text-xs text-[#6E6E80]">
                            <ImageIcon size={16} />
                            Image preview
                        </div>
                    )
                ) : isFileAttachment ? (
                    <div className={`w-[260px] max-w-full overflow-hidden rounded-[10px] border ${attachmentCardTone}`}>
                        {canPreviewFile && fileUrl ? (
                            <div className="relative h-36 w-full overflow-hidden border-b border-white/10 bg-[#F7F7F8]">
                                <iframe
                                    src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                                    title={`${fileName} preview`}
                                    className="h-48 w-full border-0 bg-white"
                                    tabIndex={-1}
                                />
                                <button
                                    type="button"
                                    onClick={handleOpenFile}
                                    className="absolute inset-0"
                                    title="Open document preview"
                                    aria-label="Open document preview"
                                />
                            </div>
                        ) : (
                            <div className={`flex h-24 items-center justify-center border-b ${alignRight && !isInternal ? 'border-white/10 bg-[#171717]' : 'border-[#EFEFEF] bg-[#F7F7F8]'}`}>
                                <div className="flex h-14 w-14 flex-col items-center justify-center rounded-[12px] bg-white text-[#0D0D0D] shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
                                    <DocIconLucide size={20} />
                                    <span className="mt-1 max-w-[44px] truncate text-[9px] font-bold uppercase">{fileExtension}</span>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-3 px-3 py-2">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-white text-[#0D0D0D]">
                                <DocIconLucide size={18} />
                            </div>
                            <button
                                type="button"
                                onClick={handleOpenFile}
                                className="min-w-0 flex-1 text-left"
                                title={fileName}
                            >
                                <p className="truncate text-xs font-semibold">{fileName}</p>
                                <p className={`mt-0.5 truncate text-[10px] ${attachmentMetaTone}`}>
                                    {fileSizeLabel ? `Document shared - ${fileSizeLabel}` : 'Document shared'}
                                </p>
                            </button>
                            <button
                                title="Download file"
                                aria-label="Download file"
                                onClick={handleOpenFile}
                                className={`rounded-full p-1.5 transition-colors ${attachmentButtonTone}`}
                            >
                                <DownloadIcon size={16} />
                            </button>
                        </div>
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
                        {isDeleted ? (
                            <p className="text-sm italic text-[#6E6E80]">[Message deleted]</p>
                        ) : (
                            <p className="whitespace-pre-wrap break-words text-sm leading-5">
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

                {hasReactions && (
                    <div className={`absolute -bottom-3 z-10 flex max-w-[calc(100%+2rem)] items-center gap-0.5 rounded-full border border-[#E5E5E5] bg-white px-1.5 py-0.5 text-[11px] leading-none text-[#0D0D0D] shadow-[0_1px_3px_rgba(0,0,0,0.12)] ${alignRight ? 'right-1' : 'left-1'}`}>
                        {visibleReactions.map((reaction) => (
                            <button
                                key={reaction.emoji}
                                type="button"
                                onClick={() => onReact?.(msg, reaction.emoji)}
                                title={reaction.names?.join(', ') || `${reaction.count} reactions`}
                                className="inline-flex items-center gap-0.5 rounded-full px-0.5 text-[11px] leading-none"
                            >
                                <span>{reaction.emoji}</span>
                                {reaction.count > 1 && <span className="text-[10px] font-semibold">{reaction.count}</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
