import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
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
    const { user, profile, organizationId } = useAuth();
    const [messageInput, setMessageInput] = useState('');
    const [sending, setSending] = useState(false);
    const [isInternal, setIsInternal] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const { messages, loading, error, sendMessage, sendFile, messagesEndRef } = useRealtimeMessages(spaceId);

    const handleSend = async () => {
        if (!messageInput.trim() || sending) return;
        setSending(true);
        const success = await sendMessage(messageInput, isInternal ? 'internal' : 'general');
        if (success) {
            setMessageInput('');
            setIsInternal(false);
        }
        setSending(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
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

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-zinc-400">
                        <div className="animate-pulse">Loading messages...</div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full text-red-400">{error}</div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                        <MessageSquare size={32} className="mb-2 opacity-30" />
                        <p className="text-sm">Start the conversation!</p>
                    </div>
                ) : (
                    messages.map(msg => (
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

            {/* Input */}
            <div className="p-4 border-t border-[#D1D5DB] bg-white">
                <div className="flex items-center gap-3">
                    <button
                        title="Attach File"
                        onClick={() => setIsUploadModalOpen(true)}
                        className="h-10 w-10 flex items-center justify-center text-[#8E8EA0] hover:text-[#10A37F] hover:bg-[#ECECF1] rounded-md transition-all"
                    >
                        <Plus size={20} />
                    </button>
                    <button
                        onClick={() => setIsInternal(!isInternal)}
                        className={`h-10 w-10 flex items-center justify-center rounded-md transition-all ${isInternal ? 'bg-amber-100 text-amber-600' : 'text-[#8E8EA0] hover:text-[#10A37F] hover:bg-[#ECECF1]'}`}
                        title="Toggle Internal Note"
                    >
                        <Shield size={20} />
                    </button>
                    <input
                        className={`flex-1 border rounded-md px-4 py-2 text-sm focus:outline-none transition-all ${isInternal
                            ? 'bg-amber-50 border-amber-200 focus:ring-1 focus:ring-amber-500 placeholder-amber-400 text-amber-900'
                            : 'bg-white border-[#D1D5DB] focus:ring-1 focus:ring-[#10A37F] focus:border-[#10A37F]'
                            }`}
                        placeholder={isInternal ? "Add an internal note (visible to staff only)..." : "Type a message..."}
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={sending}
                    />
                    <button
                        title="Send Message"
                        onClick={handleSend}
                        disabled={sending || !messageInput.trim()}
                        className={`h-10 w-10 rounded-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${isInternal ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-[#10A37F] hover:bg-[#0E8A6B] text-white'
                            }`}
                    >
                        <ArrowRight size={18} />
                    </button>
                </div>
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
