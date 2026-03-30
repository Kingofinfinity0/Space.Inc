import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../../types';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../utils/errors';
import { File as DocIconLucide, Download as DownloadIcon, Check as CheckIcon, X as XIcon, Edit2 as EditIcon, Trash2 as TrashIcon, MoreVertical as MoreVerticalIcon } from 'lucide-react';
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
    const isSenderStaff = msg.senderType === 'staff';
    const alignRight = msg.senderType === 'staff'; // Matches InboxView and SpaceChatPanel.

    let bubbleClass = '';
    if (msg.channel === 'internal') {
        bubbleClass = 'bg-amber-50 border border-amber-200 text-amber-900 group';
    } else if (theme === 'inbox') {
        bubbleClass = alignRight
            ? 'bg-[#1D1D1D] text-white rounded-br-none group'
            : 'bg-white shadow-sm border border-zinc-100 rounded-bl-none text-[#1D1D1D] group';
    } else {
        // panel theme
        bubbleClass = alignRight
            ? 'bg-[#10A37F] text-white group'
            : 'bg-[#F7F7F8] text-[#1D1D1D] border border-[#D1D5DB]/30 group';
    }

    return (
        <div className={`flex ${alignRight ? 'justify-end' : 'justify-start'} relative mb-4`}>
            <div 
                onContextMenu={handleContextMenu}
                className={`max-w-[80%] md:max-w-[70%] p-3 md:p-4 rounded-lg text-sm relative ${bubbleClass}`}
            >
                {/* Context Menu Button for touch/mobile (visible on hover) */}
                {isOwner && msg.content !== '[Message deleted]' && !isEditing && (
                    <button 
                        onClick={() => setShowMenu(!showMenu)}
                        title="More options"
                        aria-label="More options"
                        className={`absolute top-2 ${alignRight ? '-left-8' : '-right-8'} p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-zinc-500 rounded-full shadow-sm border border-zinc-200`}
                    >
                        <MoreVerticalIcon size={14} />
                    </button>
                )}

                {/* Context Menu */}
                {showMenu && (
                    <div ref={menuRef} className={`absolute z-10 top-0 ${alignRight ? 'right-full mr-2' : 'left-full ml-2'} bg-white border border-zinc-200 shadow-lg rounded-md overflow-hidden text-zinc-700 w-28`}>
                        <button onClick={() => { setIsEditing(true); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex items-center gap-2">
                            <EditIcon size={14} /> Edit
                        </button>
                        <button onClick={handleDelete} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                            <TrashIcon size={14} /> Delete
                        </button>
                    </div>
                )}

                {msg.channel === 'internal' && (
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">
                        Internal Note
                    </div>
                )}
                {msg.senderName && (
                    <p className={`text-[10px] mb-1 font-medium ${alignRight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        {msg.senderName}
                    </p>
                )}

                {msg.extension === 'file' ? (
                    <div className={`flex items-center gap-3 p-2 rounded-lg ${alignRight ? 'bg-white/10' : 'bg-zinc-50'}`}>
                        <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                            <DocIconLucide size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-xs">{msg.payload?.file_name}</p>
                            <p className="text-[10px] opacity-60">Document Shared</p>
                        </div>
                        <button
                            title="Download File"
                            onClick={async () => {
                                const { data } = await apiService.getSignedUrl(msg.payload.file_id, organizationId);
                                if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                            }}
                            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <DownloadIcon size={16} />
                        </button>
                    </div>
                ) : isEditing ? (
                    <div className="flex flex-col gap-2 mt-1 min-w-[200px]">
                        <input 
                            title="Edit message content"
                            aria-label="Edit message content"
                            className="w-full text-zinc-900 bg-white border border-zinc-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleEditSave();
                                if (e.key === 'Escape') setIsEditing(false);
                            }}
                            autoFocus
                        />
                        <div className="flex justify-end gap-1">
                            <button title="Cancel Edit" aria-label="Cancel Edit" onClick={() => setIsEditing(false)} className="p-1 rounded hover:bg-zinc-200/50 text-zinc-500"><XIcon size={14}/></button>
                            <button title="Save Edit" aria-label="Save Edit" onClick={handleEditSave} className="p-1 rounded hover:bg-indigo-500/20 text-indigo-500"><CheckIcon size={14}/></button>
                        </div>
                    </div>
                ) : (
                    <div>
                        {msg.content === '[Message deleted]' ? (
                            <p className="text-sm italic opacity-60">[Message deleted]</p>
                        ) : (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {msg.content}
                                {msg.updatedAt && msg.updatedAt !== msg.createdAt && (
                                    <span className="text-[10px] opacity-60 ml-2 inline-block">(edited)</span>
                                )}
                            </p>
                        )}
                    </div>
                )}

                <p className={`text-[10px] mt-1 text-right ${alignRight ? 'text-zinc-400' : 'text-zinc-400'}`}>
                    {formatTime(msg.createdAt)}
                </p>
            </div>
        </div>
    );
};
