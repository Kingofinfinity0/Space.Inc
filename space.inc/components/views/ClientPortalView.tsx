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
    const { user, profile } = useAuth();
    const { showToast } = useToast();
    
    const [notifications, setNotifications] = useState<any[]>([]);
    const [activityFeed, setActivityFeed] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const [notificationsRes, activityRes] = await Promise.all([
                // Widget 1: Notification Centre
                supabase.from('notifications')
                    .select('id, type, message, is_read, created_at')
                    .eq('user_id', user.id)
                    .eq('is_read', false)
                    .order('created_at', { ascending: false })
                    .limit(10),

                // Widget 3: Recent Activity Feed
                supabase.from('activity_logs')
                    .select('id, action_type, space_name, created_at, actor_name')
                    .eq('space_id', client.id)
                    .order('created_at', { ascending: false })
                    .limit(20)
            ]);

            setNotifications(notificationsRes.data || []);
            setActivityFeed(activityRes.data || []);
        } catch (err) {
            console.error('Failed to load client portal data:', err);
        } finally {
            setLoading(false);
        }
    }, [user, client.id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const upcomingMeetings = meetings
        .filter(m => m.status === 'scheduled')
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

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
                    <div className="md:col-span-2 space-y-8">
                        {/* Widget 1: Notification Centre */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                                    <Bell size={20} className="text-[#10A37F]" /> Inbox
                                </h3>
                                {notifications.length > 0 && (
                                    <Button variant="ghost" size="sm" onClick={async () => {
                                        await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id);
                                        loadData();
                                    }}>Mark all read</Button>
                                )}
                            </div>
                            
                            {loading ? (
                                <SkeletonCard className="h-24" />
                            ) : notifications.length > 0 ? (
                                <div className="space-y-3">
                                    {notifications.map(n => (
                                        <GlassCard key={n.id} className="p-4 flex items-center gap-4">
                                            <div className="h-10 w-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                                                {n.type === 'file_uploaded' ? <FileText size={18} /> : n.type === 'message_received' ? <MessageSquare size={18} /> : <Calendar size={18} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-zinc-900">{n.message}</p>
                                                <p className="text-[10px] text-zinc-400 mt-1">{formatTime(n.created_at)}</p>
                                            </div>
                                        </GlassCard>
                                    ))}
                                </div>
                            ) : (
                                <GlassCard className="p-8 text-center bg-zinc-50/50 border-dashed border-2">
                                    <CheckSquare size={32} className="mx-auto text-zinc-200 mb-2" />
                                    <p className="text-zinc-400 text-sm">All caught up!</p>
                                </GlassCard>
                            )}
                        </div>

                        {/* Widget 3: Recent Activity Feed */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                                <Activity size={20} className="text-blue-500" /> Recent Activity
                            </h3>
                            {loading ? (
                                <SkeletonCard className="h-40" />
                            ) : (
                                <div className="space-y-3">
                                    {activityFeed.map(item => (
                                        <div key={item.id} className="p-4 bg-white border border-zinc-100 rounded-xl flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 bg-zinc-50 rounded-lg flex items-center justify-center text-zinc-400">
                                                    {item.action_type === 'file_uploaded' ? <FileText size={18} /> : item.action_type === 'message_sent' ? <MessageSquare size={18} /> : <Video size={18} />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-zinc-900">{item.actor_name} {item.action_type === 'file_uploaded' ? 'shared a file' : item.action_type === 'message_sent' ? 'sent a message' : 'updated something'}</p>
                                                    <p className="text-xs text-zinc-400">Added {formatDate(item.created_at)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-8">
                        {/* Widget 2: Calendar */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                                <Calendar size={20} className="text-amber-500" /> Upcoming
                            </h3>
                            {upcomingMeetings.length > 0 ? (
                                <div className="space-y-3">
                                    {upcomingMeetings.map(m => (
                                        <GlassCard key={m.id} className="p-6 text-center">
                                            <div className="mb-4">
                                                <p className="text-4xl font-black text-zinc-900 tracking-tighter">
                                                    {new Date(m.starts_at).getDate()}
                                                </p>
                                                <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
                                                    {new Date(m.starts_at).toLocaleString('en-US', { month: 'short' })}
                                                </p>
                                            </div>
                                            <p className="text-sm font-black text-zinc-800 mb-4">{m.title}</p>
                                            <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 mb-6">
                                                <Clock size={12} /> {formatTime(m.starts_at)}
                                            </div>
                                            <Button variant="primary" className="w-full" onClick={() => onJoin(m.id)}>Join Meeting</Button>
                                        </GlassCard>
                                    ))}
                                </div>
                            ) : (
                                <GlassCard className="p-8 text-center bg-zinc-50/50 border-dashed border-2">
                                    <p className="text-zinc-400 text-xs italic">No scheduled meetings.</p>
                                </GlassCard>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientPortalView;
