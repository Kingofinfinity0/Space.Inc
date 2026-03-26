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
    const { messages, loading, error, sendMessage, sendFile, messagesEndRef } = useRealtimeMessages(spaceId);

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
        <div className="h-[600px] flex flex-col bg-white rounded-lg border border-[#D1D5DB] overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-[#D1D5DB] bg-[#F7F7F8]">
                <h3 className="font-semibold text-[#1D1D1D]">Chat with {spaceName}</h3>
                <p className="text-[10px] text-[#8E8EA0] uppercase tracking-wider">{loading ? 'Loading...' : `${messages.length} messages`}</p>
            </div>

            {/* Messages Area */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className={`flex-1 overflow-y-auto p-6 space-y-4 bg-white ${showInternal ? 'border-b border-[#D1D5DB]' : ''}`}>
                    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm py-2 mb-4 border-b border-zinc-100 flex items-center gap-2">
                        <MessageSquare size={14} className="text-[#10A37F]" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Client Chat</span>
                    </div>
                    {loading ? (
                        <div className="flex items-center justify-center py-10 text-zinc-400">
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
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-amber-50/30">
                        <div className="sticky top-0 z-10 bg-amber-50/80 backdrop-blur-sm py-2 mb-4 border-b border-amber-100 flex items-center gap-2">
                            <Shield size={14} className="text-amber-600" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Internal (Staff Only)</span>
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
            <div className="border-t border-[#D1D5DB] bg-white divide-y divide-zinc-100">
                {/* Client Chat Input */}
                <div className="p-4 flex items-center gap-3">
                    <button
                        title="Attach File"
                        onClick={() => setIsUploadModalOpen(true)}
                        className="h-10 w-10 flex items-center justify-center text-[#8E8EA0] hover:text-[#10A37F] hover:bg-[#ECECF1] rounded-md transition-all"
                    >
                        <Plus size={20} />
                    </button>
                    <input
                        className="flex-1 border border-[#D1D5DB] rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#10A37F] focus:border-[#10A37F]"
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
                        className="h-10 w-10 rounded-md flex items-center justify-center bg-[#10A37F] hover:bg-[#0E8A6B] text-white disabled:opacity-50"
                    >
                        <ArrowRight size={18} />
                    </button>
                </div>

                {/* Internal Chat Input */}
                {showInternal && (
                    <div className="p-4 bg-amber-50/50 flex items-center gap-3">
                        <div className="h-10 w-10 flex items-center justify-center text-amber-600">
                            <Shield size={20} />
                        </div>
                        <input
                            className="flex-1 border border-amber-200 bg-white rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-amber-400 text-amber-900"
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
                            className="h-10 w-10 rounded-md flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
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
                onUpload={async (file) => {
                    if (!profile?.organization_id && !organizationId) return;
                    await sendFile(organizationId || profile?.organization_id || '', file);
                }}
            />
        </div>
    );
};
export default SpaceChatPanel;
