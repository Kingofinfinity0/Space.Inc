import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../../types';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../utils/errors';
import { File as DocIconLucide, Download as DownloadIcon, Check as CheckIcon, X as XIcon, Edit2 as EditIcon, Trash2 as TrashIcon, MoreVertical as MoreVerticalIcon, Shield, Sparkles } from 'lucide-react';
import { apiService } from '../../services/apiService';

export const MessageItem = ({ 
    msg, 
    currentUserId, 
    organizationId, 
    theme = 'inbox'
}: { 
    msg: Message, 
    currentUserId: string, 
    organizationId: string, 
    theme?: 'inbox' | 'panel'
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(msg.content);
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const isOwner = msg.senderId === currentUserId;

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
                {msg.senderName && (
                    <p className={`mb-1 text-[10px] font-medium ${senderTone}`}>
                        {msg.senderName}
                    </p>
                )}

                {msg.extension === 'file' ? (
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
            </div>
        </div>
    );
};
