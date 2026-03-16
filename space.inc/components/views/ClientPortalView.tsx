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
    GlassCard, Button, Heading, Text, Input, Modal, Checkbox, Toggle,
    SkeletonLoader, SkeletonCard, SkeletonText, SkeletonImage
} from '../UI/index';
import { ClientSpace, ViewState, Meeting, Message, StaffMember, Task, SpaceFile, ChartData, ClientLifecycle } from '../../types';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useRealtimeFiles } from '../../hooks/useRealtimeFiles';

// 10. Client Portal View
const ClientPortalView = ({ client, meetings, onJoin, onLogout }: { 
    client: ClientSpace, 
    meetings: Meeting[], 
    onJoin: (id: string) => void, 
    onLogout: () => void 
}) => {
    const { profile } = useAuth();
    const { showToast } = useToast();
    
    // Fetch real-time data for this specific client space
    const { messages, loading: messagesLoading } = useRealtimeMessages(client.id, client.organization_id);
    const { files, loading: filesLoading } = useRealtimeFiles(client.id);

    const recentFiles = files.filter(f => f.status === 'available').slice(0, 3);
    const nextMeeting = meetings
        .filter(m => m.status === 'scheduled')
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
    const lastMessage = messages[messages.length - 1];

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="min-h-screen bg-white dark:bg-black p-6 md:p-12 font-sans text-black dark:text-white animate-[fadeIn_0.5s_ease-out]">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Client Header */}
                <header className="flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-10 w-10 bg-[#10A37F] rounded-lg flex items-center justify-center text-white">
                                <Rocket size={24} />
                            </div>
                            <span className="font-bold text-xl tracking-tight">Space.inc Portal</span>
                        </div>
                        <Heading level={2}>Welcome back, {profile?.full_name?.split(' ')[0] || 'Member'}</Heading>
                        <p className="text-zinc-500 font-light mt-1">Your dedicated workspace for {client.name}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="sm" onClick={() => showToast("Help request submitted.", "info")}>
                            Get Help
                        </Button>
                        <div 
                            title="Sign Out"
                            className="h-10 w-10 bg-white dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors" 
                            onClick={onLogout}
                        >
                            <LogOut size={16} />
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Main Feed */}
                    <div className="md:col-span-2 space-y-6">
                        {/* Status Guard */}
                        <GlassCard className="p-6 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white border-none shadow-lg shadow-emerald-200/20">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                                    <Shield size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Secure Workspace</h3>
                                    <p className="text-emerald-50 font-light opacity-90">All communications and documents are protected with end-to-end encryption.</p>
                                </div>
                            </div>
                        </GlassCard>

                        {/* Recent Files */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                                    <FileText size={20} className="text-zinc-400" /> Recent Documents
                                </h3>
                                <Text variant="secondary" className="text-xs uppercase font-black tracking-widest">{files.length} Total</Text>
                            </div>
                            
                            {filesLoading ? (
                                <div className="space-y-3">
                                    <SkeletonLoader height="72px" borderRadius="12px" />
                                    <SkeletonLoader height="72px" borderRadius="12px" />
                                </div>
                            ) : recentFiles.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3">
                                    {recentFiles.map(file => (
                                        <GlassCard key={file.id} className="p-4 flex justify-between items-center group hover:border-emerald-500/50 transition-all cursor-pointer">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 bg-zinc-50 rounded-lg flex items-center justify-center text-zinc-400 group-hover:text-emerald-500 transition-colors">
                                                    <DocIcon size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-zinc-900">{file.name}</p>
                                                    <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-tight">Added {formatDate(file.created_at)}</p>
                                                </div>
                                            </div>
                                            <button
                                                title="Download File"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const { data } = await apiService.getSignedUrl(file.id, client.organization_id);
                                                    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                                }}
                                                className="p-2.5 h-10 w-10 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-400 hover:bg-emerald-500 hover:text-white transition-all transform hover:scale-110"
                                            >
                                                <Download size={18} />
                                            </button>
                                        </GlassCard>
                                    ))}
                                </div>
                            ) : (
                                <GlassCard className="p-12 text-center border-dashed border-2">
                                    <FolderClosed size={48} className="mx-auto text-zinc-200 mb-4" />
                                    <p className="text-zinc-400 font-light italic">No documents have been shared with you yet.</p>
                                </GlassCard>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Next Meeting */}
                        <GlassCard className="p-6 border-zinc-100">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4">Upcoming Event</p>
                            {nextMeeting ? (
                                <div className="text-center">
                                    <div className="mb-4">
                                        <p className="text-4xl font-black text-zinc-900 tracking-tighter">
                                            {new Date(nextMeeting.starts_at).getDate()}
                                        </p>
                                        <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
                                            {new Date(nextMeeting.starts_at).toLocaleString('en-US', { month: 'short' })}
                                        </p>
                                    </div>
                                    <div className="space-y-1 mb-6">
                                        <p className="text-sm font-black text-zinc-800 truncate">{nextMeeting.title || 'Client Sync'}</p>
                                        <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
                                            <Clock size={12} /> {formatTime(nextMeeting.starts_at)}
                                        </div>
                                    </div>
                                    <Button className="w-full bg-zinc-900 hover:bg-black text-white py-3" onClick={() => onJoin(nextMeeting.id)}>
                                        <Video size={16} className="mr-2" /> Join Space
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <div className="h-12 w-12 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-3 text-zinc-200">
                                        <Calendar size={24} />
                                    </div>
                                    <p className="text-zinc-400 text-xs italic">No scheduled meetings.</p>
                                </div>
                            )}
                        </GlassCard>

                        {/* Chat Preview */}
                        <GlassCard className="p-6">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4">Recent Activity</p>
                            {messagesLoading ? (
                                <SkeletonText lines={2} />
                            ) : lastMessage ? (
                                <div className="relative">
                                    <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 mb-4">
                                        <p className="text-zinc-600 text-xs leading-relaxed italic line-clamp-3">
                                            "{lastMessage.content}"
                                        </p>
                                        <p className="text-[9px] text-zinc-400 mt-2 text-right font-medium">
                                            {formatTime(lastMessage.created_at)}
                                        </p>
                                    </div>
                                    <Button variant="secondary" className="w-full text-xs font-bold py-2">
                                        Reply in Chat
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <MessageSquare size={32} className="mx-auto text-zinc-100 mb-2" />
                                    <p className="text-zinc-400 text-[10px] italic">Your chat history is empty.</p>
                                </div>
                            )}
                        </GlassCard>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientPortalView;
