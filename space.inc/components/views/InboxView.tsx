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


// 9. Inbox View - Realtime Chat
const InboxView = ({ clients, inboxData }: { clients: ClientSpace[], inboxData: any[] }) => {
    const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(clients[0]?.id || null);
    const { user, profile, organizationId } = useAuth();
    const [messageInput, setMessageInput] = useState('');
    const [sending, setSending] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const { showToast } = useToast(); // Added useToast hook

    // Use realtime messages hook
    const { messages, loading, error, sendMessage, sendFile, messagesEndRef } = useRealtimeMessages(selectedSpaceId || '', organizationId || '');

    const activeClient = clients.find(c => c.id === selectedSpaceId);

    const handleSend = async () => {
        if (!messageInput.trim() || sending) return;
        setSending(true);
        const success = await sendMessage(messageInput);
        if (success) {
            setMessageInput('');
        }
        setSending(false);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Format timestamp for display
    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="h-[calc(100vh-140px)] flex gap-6">
            {/* List Sidebar */}
            <GlassCard className="w-1/3 flex flex-col h-full overflow-hidden border-[#D1D5DB] rounded-lg">
                <div className="p-4 border-b border-[#D1D5DB] bg-[#F7F7F8]">
                    <Heading level={2} className="mb-4">Inbox</Heading>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8EA0]" />
                        <input type="text" placeholder="Search chats..." className="w-full bg-white border border-[#D1D5DB] rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#10A37F] focus:border-[#10A37F] transition-all" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {inboxData.map(item => (
                        <div
                            key={item.space_id}
                            onClick={() => setSelectedSpaceId(item.space_id)}
                            className={`p-4 border-b border-zinc-50 cursor-pointer hover:bg-zinc-50 transition-colors ${selectedSpaceId === item.space_id ? 'bg-zinc-50 border-l-2 border-l-[#10A37F]' : ''}`}
                        >
                            <div className="flex justify-between mb-1">
                                <span className={`font-medium ${selectedSpaceId === item.space_id ? 'text-[#1D1D1D]' : 'text-zinc-700'}`}>{item.space_name}</span>
                                <span className="text-[10px] text-zinc-400">
                                    {item.last_message_at ? new Date(item.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Join'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <p className="text-xs text-zinc-500 truncate max-w-[180px]">
                                    {item.last_message_content || 'No messages yet'}
                                </p>
                                {item.unread_count > 0 && (
                                    <div className="h-4 w-4 bg-[#10A37F] text-white text-[10px] flex items-center justify-center rounded-full font-bold">
                                        {item.unread_count}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </GlassCard>

            {/* Chat Area */}
            <GlassCard className="flex-1 flex flex-col h-full overflow-hidden relative">
                {selectedSpaceId ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-white/50 backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-[#1D1D1D] text-white flex items-center justify-center font-bold">
                                    {activeClient?.name.substring(0, 2)}
                                </div>
                                <div>
                                    <h3 className="font-medium text-[#1D1D1D]">{activeClient?.name}</h3>
                                    <p className="text-xs text-zinc-500">
                                        {loading ? 'Loading...' : `${messages.length} messages`}
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" className="h-8 w-8 p-0 rounded-full"><MoreVertical size={18} /></Button>
                        </div>

                        {/* Messages Feed */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/30">
                            {loading ? (
                                <div className="flex items-center justify-center h-full text-zinc-400">
                                    <div className="animate-pulse">Loading messages...</div>
                                </div>
                            ) : error ? (
                                <div className="flex items-center justify-center h-full text-red-400">
                                    {error}
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                                    <MessageSquare size={48} className="mb-4 opacity-20" />
                                    <p>No messages yet. Start the conversation!</p>
                                </div>
                            ) : (
                                messages.map(msg => (
                                    <div key={msg.id} className={`flex ${msg.sender_type === 'staff' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] p-4 rounded-lg ${msg.sender_type === 'staff' ? 'bg-[#1D1D1D] text-white rounded-br-none' : 'bg-white shadow-sm border border-zinc-100 rounded-bl-none'}`}>
                                            {msg.sender?.full_name && (
                                                <p className={`text-[10px] mb-1 font-medium ${msg.sender_type === 'staff' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                                    {msg.sender.full_name}
                                                </p>
                                            )}

                                            {msg.extension === 'file' ? (
                                                <div className={`flex items-center gap-3 p-3 rounded-md ${msg.sender_type === 'staff' ? 'bg-white/10' : 'bg-zinc-50'}`}>
                                                    <div className="p-2.5 bg-indigo-500/20 rounded-lg text-indigo-400">
                                                        <DocIcon size={20} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium truncate text-xs">{msg.payload?.file_name}</p>
                                                        <p className="text-[10px] opacity-60">Shared Document</p>
                                                    </div>
                                                    <button
                                                        title="Download File"
                                                        onClick={async () => {
                                                            const { data } = await apiService.getSignedUrl(msg.payload.file_id, organizationId || '');
                                                            if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                                        }}
                                                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                                    >
                                                        <Download size={18} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <p className="text-sm leading-relaxed">{msg.content}</p>
                                            )}

                                            <p className={`text-[10px] mt-2 text-right opacity-70 ${msg.sender_type === 'staff' ? 'text-zinc-300' : 'text-zinc-400'}`}>
                                                {formatTime(msg.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-zinc-100">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="ghost"
                                    className="p-2 text-zinc-400 hover:text-indigo-500"
                                    onClick={() => setIsUploadModalOpen(true)}
                                >
                                    <FilePlus2 size={20} />
                                </Button>
                                <input
                                    className="flex-1 bg-zinc-100 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-300"
                                    placeholder="Type a message..."
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    disabled={sending}
                                />
                                <button
                                    title="Send Message"
                                    className="h-10 w-10 bg-[#1D1D1D] text-white rounded-full flex items-center justify-center hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    onClick={handleSend}
                                    disabled={sending || !messageInput.trim()}
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
                                if (!selectedSpaceId || !organizationId) return;
                                await sendFile(organizationId, file);
                            }}
                        />
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
                        <MessageSquare size={48} className="mb-4 opacity-20" />
                        <p>Select a conversation to start chatting</p>
                    </div>
                )}
            </GlassCard>
        </div>
    );
};
export default InboxView;
