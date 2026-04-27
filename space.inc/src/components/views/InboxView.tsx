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

    const activeCount = filteredInbox.length;
    const unreadCount = filteredInbox.reduce((total, item) => total + (item.unread_count || 0), 0);

    return (
        <div className="grid min-h-[calc(100svh-240px)] gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
            {/* List Sidebar */}
            <GlassCard className="sheet-panel flex min-h-[320px] flex-col overflow-hidden rounded-[8px]">
                <div className="border-b border-[#E5E5E5] bg-[#F7F7F8] p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <Heading level={2} className="mb-1">Inbox</Heading>
                            <p className="text-sm text-[#6E6E80]">All conversations across your spaces.</p>
                        </div>
                        <div className="surface-chip px-3 py-1.5 text-[11px] font-medium">
                            <span className="indicator-dot" data-tone="blue" />
                            {activeCount} threads
                        </div>
                    </div>
                    <div className="relative mt-4">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6E6E80]" />
                        <input
                            type="text"
                            placeholder="Search chats..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-[8px] border border-[#DADADA] bg-white py-2.5 pl-10 pr-4 text-sm text-[#0D0D0D] placeholder:text-[#6E6E80] focus:border-black focus:outline-none"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2 border-b border-[#E5E5E5] bg-white px-4 py-3">
                    <span className="surface-chip surface-chip-active px-3 py-1.5 text-[11px] font-medium">
                        <span className="indicator-dot" data-tone="green" />
                        {unreadCount} unread
                    </span>
                    <span className="surface-chip px-3 py-1.5 text-[11px] font-medium">Staff + client</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {filteredInbox.map((item, index) => {
                        const selected = selectedSpaceId === item.space_id;
                        return (
                        <button
                            key={item.space_id}
                            onClick={() => setSelectedSpaceId(item.space_id)}
                            style={{ animationDelay: `${index * 20}ms` }}
                            className={`database-row page-enter block w-full border-b-0 border-x-0 border-t-0 px-4 py-4 text-left transition-colors ${selected ? 'bg-[#F7F7F8]' : 'hover:bg-[#F7F7F8]'}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`indicator-dot ${selected ? '' : ''}`} data-tone={item.unread_count > 0 ? 'blue' : 'rose'} />
                                        <span className={`truncate text-sm font-medium ${selected ? 'text-[#0D0D0D]' : 'text-[#6E6E80]'}`}>{item.space_name}</span>
                                    </div>
                                    <p className="mt-2 line-clamp-2 text-xs text-[#6E6E80]">
                                        {item.last_message_content || 'No messages yet'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-[#6E6E80]">
                                        {item.last_message_at ? new Date(item.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Join'}
                                    </span>
                                    {item.unread_count > 0 && (
                                        <div className="mt-2 inline-flex min-w-[20px] items-center justify-center rounded-full border border-[#DADADA] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#0D0D0D]">
                                            {item.unread_count}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
                    )})}
                    {filteredInbox.length === 0 && (
                        <div className="p-4 text-center text-sm text-[#6E6E80]">No chats match your search.</div>
                    )}
                </div>
            </GlassCard>

            {/* Chat Area */}
            <GlassCard className="sheet-panel relative flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-[8px]">
                {selectedSpaceId ? (
                    <>
                        {/* Chat Header */}
                        <div className="border-b border-[#E5E5E5] bg-white p-4 md:flex md:items-center md:justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#DADADA] bg-[#0D0D0D] font-semibold text-white">
                                    {activeClient?.name.substring(0, 2)}
                                </div>
                                <div>
                                    <h3 className="font-semibold tracking-[-0.03em] text-[#0D0D0D]">{activeClient?.name}</h3>
                                    <p className="text-xs text-[#6E6E80]">
                                        {loading ? 'Loading...' : `${messages.length} messages`}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3 flex items-center gap-2 md:mt-0">
                                <span className="surface-chip px-3 py-1.5 text-[11px] font-medium">
                                    <span className="indicator-dot" data-tone="blue" />
                                    Active thread
                                </span>
                                <Button variant="ghost" className="h-8 w-8 rounded-full p-0"><MoreVertical size={18} /></Button>
                            </div>
                        </div>

                        {/* Messages Feed */}
                        <div className="flex-1 space-y-4 overflow-y-auto bg-[#FFFFFF] p-4 md:p-6">
                            {loading ? (
                                <div className="flex h-full items-center justify-center text-[#6E6E80]">
                                    <div className="animate-pulse">Loading messages...</div>
                                </div>
                            ) : error ? (
                                <div className="flex h-full items-center justify-center text-[#B42318]">
                                    {error}
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex h-full flex-col items-center justify-center text-[#6E6E80]">
                                    <MessageSquare size={48} className="mb-4 opacity-20" />
                                    <p>No messages yet. Start the conversation.</p>
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
                        <div className="border-t border-[#E5E5E5] bg-white p-4">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="ghost"
                                    className="h-10 w-10 rounded-[8px] p-0 text-[#6E6E80] hover:text-[#0D0D0D]"
                                    onClick={() => setIsUploadModalOpen(true)}
                                >
                                    <FilePlus2 size={20} />
                                </Button>
                                <input
                                    className="flex-1 rounded-[8px] border border-[#DADADA] bg-white px-5 py-3 text-sm text-[#0D0D0D] placeholder:text-[#6E6E80] focus:border-black focus:outline-none"
                                    placeholder="Type a message..."
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    disabled={sending}
                                />
                                <button
                                    title="Send Message"
                                    className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
