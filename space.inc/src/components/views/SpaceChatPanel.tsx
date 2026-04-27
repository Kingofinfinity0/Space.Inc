import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import { supabase } from '../../lib/supabase';
import {
    LayoutDashboard, Users, MessageSquare, Calendar, FileText, Settings, Plus, Search,
    Briefcase, ChevronRight, LogOut, Video, Download, Upload, Clock, UserPlus, ArrowRight,
    Link as LinkIcon, Copy, ListTodo, MoreVertical, Flag, Trash2, User, ArrowLeft,
    GripVertical, Activity, Shield, Lock, FileUp, Key, FilePlus as FilePlus2,
    File as DocIcon, Rocket, LayoutGrid, Inbox, UserCheck, CheckSquare, FolderClosed,
    Bell, Eye, Play, X, FileVideo, ChevronLeft
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
    GlassCard, Button, Heading, Text, Input, Modal, Checkbox, Toggle,
    SkeletonLoader, SkeletonCard, SkeletonText, SkeletonImage
} from '../UI/index';
import { FileViewerModal } from '../FileViewerModal';
import { FileUploadModal } from '../FileUploadModal';
import { ClientSpace, ViewState, Meeting, Message, StaffMember, Task, SpaceFile, ChartData, ClientLifecycle } from '../../types';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useRealtimeFiles } from '../../hooks/useRealtimeFiles';
import { MessageItem } from './MessageItem';


// SpaceChatPanel - Inline chat component for Space Detail view
const SpaceChatPanel = ({ spaceId, spaceName }: { spaceId: string, spaceName: string }) => {
    const { user, profile, organizationId, userRole } = useAuth();
    const [messageInput, setMessageInput] = useState('');
    const [internalMessageInput, setInternalMessageInput] = useState('');
    const [sending, setSending] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [staffCount, setStaffCount] = useState(0);
    const { messages, loading, error, sendMessage, sendFile, messagesEndRef } = useRealtimeMessages(spaceId, organizationId || profile?.organization_id);

    useEffect(() => {
        const fetchStaffCount = async () => {
            const { data, error } = await supabase
                .from('space_memberships')
                .select('user_id, profiles!inner(role)')
                .eq('space_id', spaceId)
                .eq('is_active', true)
                .in('profiles.role', ['owner', 'admin', 'staff']);

            if (!error) setStaffCount(data?.length || 0);
        };
        fetchStaffCount();
    }, [spaceId]);

    const isStaff = ['owner', 'admin', 'staff'].includes(userRole || '');
    const showInternal = isStaff && staffCount >= 2;

    const handleSend = async (channel: 'general' | 'internal' = 'general') => {
        const input = channel === 'internal' ? internalMessageInput : messageInput;
        if (!input.trim() || sending) return;
        setSending(true);
        const success = await sendMessage(input, channel);
        if (success) {
            if (channel === 'internal') setInternalMessageInput('');
            else setMessageInput('');
        }
        setSending(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent, channel: 'general' | 'internal' = 'general') => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(channel);
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="sheet-panel flex h-[600px] flex-col overflow-hidden rounded-[8px]">
            {/* Header */}
            <div className="border-b border-[#E5E5E5] bg-[#F7F7F8] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-semibold tracking-[-0.03em] text-[#0D0D0D]">Chat with {spaceName}</h3>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">{loading ? 'Loading...' : `${messages.length} messages`}</p>
                    </div>
                    <div className="surface-chip px-3 py-1.5 text-[11px] font-medium">
                        <span className="indicator-dot" data-tone="blue" />
                        Client-facing thread
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className={`flex-1 overflow-y-auto p-5 space-y-4 bg-white ${showInternal ? 'border-b border-[#E5E5E5]' : ''}`}>
                    <div className="sticky top-0 z-10 mb-4 flex items-center gap-2 border-b border-[#E5E5E5] bg-white py-2">
                        <MessageSquare size={14} className="text-[#0D0D0D]" />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Client chat</span>
                    </div>
                    {loading ? (
                        <div className="flex items-center justify-center py-10 text-[#6E6E80]">
                            <div className="animate-pulse">Loading messages...</div>
                        </div>
                    ) : (
                        messages.filter(m => m.channel !== 'internal').map(msg => (
                            <MessageItem
                                key={msg.id}
                                msg={msg}
                                currentUserId={user?.id || ''}
                                organizationId={organizationId || profile?.organization_id || ''}
                                theme="panel"
                            />
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {showInternal && (
                    <div className="flex-1 overflow-y-auto bg-[#F7F7F8] p-5 space-y-4">
                        <div className="sticky top-0 z-10 mb-4 flex items-center gap-2 border-b border-[#E5E5E5] bg-[#F7F7F8] py-2">
                            <Shield size={14} className="text-[#0D0D0D]" />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Internal staff note</span>
                        </div>
                        {messages.filter(m => m.channel === 'internal').map(msg => (
                            <MessageItem
                                key={msg.id}
                                msg={msg}
                                currentUserId={user?.id || ''}
                                organizationId={organizationId || profile?.organization_id || ''}
                                theme="panel"
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Input Areas */}
            <div className="divide-y divide-[#E5E5E5] border-t border-[#E5E5E5] bg-white">
                {/* Client Chat Input */}
                <div className="flex items-center gap-3 p-4">
                    <button
                        title="Attach File"
                        onClick={() => setIsUploadModalOpen(true)}
                        className="flex h-10 w-10 items-center justify-center rounded-[8px] text-[#6E6E80] transition-colors hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                    >
                        <Plus size={20} />
                    </button>
                    <input
                        className="flex-1 rounded-[8px] border border-[#DADADA] bg-white px-4 py-2.5 text-sm text-[#0D0D0D] placeholder:text-[#6E6E80] focus:border-black focus:outline-none"
                        placeholder="Message client..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, 'general')}
                        disabled={sending}
                    />
                    <button
                        title="Send Message"
                        onClick={() => handleSend('general')}
                        disabled={sending || !messageInput.trim()}
                        className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#0D0D0D] text-white disabled:opacity-50"
                    >
                        <ArrowRight size={18} />
                    </button>
                </div>

                {/* Internal Chat Input */}
                {showInternal && (
                    <div className="flex items-center gap-3 bg-[#F7F7F8] p-4">
                        <div className="flex h-10 w-10 items-center justify-center text-[#0D0D0D]">
                            <Shield size={20} />
                        </div>
                        <input
                            className="flex-1 rounded-[8px] border border-[#DADADA] bg-white px-4 py-2.5 text-sm text-[#0D0D0D] placeholder:text-[#6E6E80] focus:border-black focus:outline-none"
                            placeholder="Add an internal staff note..."
                            value={internalMessageInput}
                            onChange={(e) => setInternalMessageInput(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, 'internal')}
                            disabled={sending}
                        />
                        <button
                            title="Send Internal Note"
                            onClick={() => handleSend('internal')}
                            disabled={sending || !internalMessageInput.trim()}
                            className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-black text-white disabled:opacity-50"
                        >
                            <ArrowRight size={18} />
                        </button>
                    </div>
                )}
            </div>

            <FileUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                loading={sending}
                uploadProgress={null}
                onUpload={async (file) => {
                    if (!profile?.organization_id && !organizationId) return false;
                    await sendFile(organizationId || profile?.organization_id || '', file);
                    return true;
                }}
            />
        </div>
    );
};
export default SpaceChatPanel;
