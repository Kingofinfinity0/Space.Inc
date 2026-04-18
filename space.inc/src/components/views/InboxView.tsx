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

// 9. Inbox View - Realtime Chat
const InboxView = ({ clients, inboxData }: { clients: ClientSpace[], inboxData: any[] }) => {
    const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(clients[0]?.id || null);
    const { user, profile, organizationId } = useAuth();
    const [messageInput, setMessageInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [sending, setSending] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const { showToast } = useToast(); // Added useToast hook

    // Use realtime messages hook
    const { messages, loading, error, sendMessage, sendFile, messagesEndRef, uploadProgress } = useRealtimeMessages(selectedSpaceId || '', organizationId || '');

    const activeClient = clients.find(c => c.id === selectedSpaceId);
    const filteredInbox = inboxData.filter((item) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return [
            item.space_name,
            item.last_message_content,
            item.last_message_at
        ].some((value) => String(value || '').toLowerCase().includes(q));
    });

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
            <GlassCard className="w-1/3 flex flex-col h-full overflow-hidden rounded-[8px]">
                <div className="p-4 border-b border-[#E5E5E5] bg-[#F7F7F8]">
                    <Heading level={2} className="mb-4">Inbox</Heading>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6E6E80]" />
                        <input
                            type="text"
                            placeholder="Search chats..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-[8px] border border-[#E5E5E5] bg-white pl-10 pr-4 py-2 text-sm text-[#0D0D0D] focus:outline-none focus:border-black transition-all"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {filteredInbox.map(item => (
                        <div
                            key={item.space_id}
                            onClick={() => setSelectedSpaceId(item.space_id)}
                            className={`p-4 border-b border-[#E5E5E5] cursor-pointer hover:bg-[#F7F7F8] transition-colors ${selectedSpaceId === item.space_id ? 'bg-[#F7F7F8] border-l-2 border-l-black' : ''}`}
                        >
                            <div className="flex justify-between mb-1">
                                <span className={`font-medium ${selectedSpaceId === item.space_id ? 'text-[#0D0D0D]' : 'text-[#6E6E80]'}`}>{item.space_name}</span>
                                <span className="text-[10px] text-[#6E6E80]">
                                    {item.last_message_at ? new Date(item.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Join'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <p className="text-xs text-[#6E6E80] truncate max-w-[180px]">
                                    {item.last_message_content || 'No messages yet'}
                                </p>
                                {item.unread_count > 0 && (
                                    <div className="h-4 w-4 bg-black text-white text-[10px] flex items-center justify-center rounded-full font-semibold">
                                        {item.unread_count}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {filteredInbox.length === 0 && (
                        <div className="p-4 text-center text-sm text-[#6E6E80]">No chats match your search.</div>
                    )}
                </div>
            </GlassCard>

            {/* Chat Area */}
            <GlassCard className="flex-1 flex flex-col h-full overflow-hidden relative rounded-[8px]">
                {selectedSpaceId ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-[#E5E5E5] flex justify-between items-center bg-white">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-[8px] bg-black text-white flex items-center justify-center font-semibold">
                                    {activeClient?.name.substring(0, 2)}
                                </div>
                                <div>
                                    <h3 className="font-medium text-[#0D0D0D]">{activeClient?.name}</h3>
                                    <p className="text-xs text-[#6E6E80]">
                                        {loading ? 'Loading...' : `${messages.length} messages`}
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" className="h-8 w-8 p-0 rounded-full"><MoreVertical size={18} /></Button>
                        </div>

                        {/* Messages Feed */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#FFFFFF]">
                            {loading ? (
                                <div className="flex items-center justify-center h-full text-[#6E6E80]">
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
                                    <MessageItem 
                                        key={msg.id} 
                                        msg={msg} 
                                        currentUserId={user?.id || ''} 
                                        organizationId={organizationId || profile?.organization_id || ''} 
                                        theme="inbox" 
                                    />
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-[#E5E5E5]">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="ghost"
                                    className="p-2 text-[#6E6E80] hover:text-[#0D0D0D]"
                                    onClick={() => setIsUploadModalOpen(true)}
                                >
                                    <FilePlus2 size={20} />
                                </Button>
                                <input
                                    className="flex-1 rounded-[8px] border border-[#E5E5E5] bg-white px-5 py-3 text-sm text-[#0D0D0D] focus:outline-none focus:border-black"
                                    placeholder="Type a message..."
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    disabled={sending}
                                />
                                <button
                                    title="Send Message"
                                    className="h-10 w-10 bg-black text-white rounded-[8px] flex items-center justify-center hover:bg-[#1A1A1A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                            uploadProgress={uploadProgress}
                            onUpload={async (file) => {
                                if (!selectedSpaceId || !organizationId) return false;
                                const result = await sendFile(organizationId, file);
                                return result.success;
                            }}
                        />
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#6E6E80]">
                        <MessageSquare size={48} className="mb-4 opacity-20" />
                        <p>Select a conversation to start chatting</p>
                    </div>
                )}
            </GlassCard>
        </div>
    );
};
export default InboxView;
