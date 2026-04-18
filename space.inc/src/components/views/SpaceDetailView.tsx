import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import { inviteService } from '../../services/inviteService';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../utils/errors';
import {
    LayoutDashboard, Users, MessageSquare, Calendar, FileText, Settings, Plus, Search,
    Briefcase, ChevronRight, LogOut, Video, Download, Upload, Clock, UserPlus, ArrowRight,
    Link as LinkIcon, Copy, ListTodo, MoreVertical, Flag, Trash2, User, ArrowLeft,
    GripVertical, Activity, Shield, Lock, FileUp, Key, FilePlus as FilePlus2,
    File as DocIcon, Rocket, LayoutGrid, Inbox, UserCheck, CheckSquare, FolderClosed,
    Bell, Eye, Play, X, FileVideo, ChevronLeft, History, Mail
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
import { FileVersionsModal } from '../FileVersionsModal';
import { ClientSpace, ViewState, Meeting, Message, StaffMember, Task, SpaceFile, ChartData, ClientLifecycle } from '../../types';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useRealtimeFiles } from '../../hooks/useRealtimeFiles';
import SpaceChatPanel from './SpaceChatPanel';
import { CalendarWidget } from '../CalendarWidget';
import TaskWorkspace from '../tasks/TaskWorkspace';


// 3. Space Detail View
const SpaceDetailView = ({ spaceId, space: initialSpace, meetings, onBack, onJoin, onSchedule, onInstantMeet, onEndMeeting, onDeleteMeeting }: { spaceId: string, space?: ClientSpace, meetings: Meeting[], onBack: () => void, onJoin: (id: string) => void, onSchedule: (data: any) => void, onInstantMeet: (spaceId: string) => void, onEndMeeting?: (id: string, outcome: string, notes: string) => void, onDeleteMeeting?: (meetingId: string) => void }) => {
    const navigate = useNavigate();
    const { user, profile, organizationId, userRole, session } = useAuth();
    const { showToast } = useToast();

    const [space, setSpace] = useState<ClientSpace | undefined>(initialSpace);
    const [spaceLoading, setSpaceLoading] = useState(!initialSpace);
    const [isUpdatingSpaceStatus, setIsUpdatingSpaceStatus] = useState(false);
    const [showDeleteSpaceModal, setShowDeleteSpaceModal] = useState(false);

    const [spaceStats, setSpaceStats] = useState<any>(null);
    const [spaceStatsLoading, setSpaceStatsLoading] = useState(false);
    const [activityIndicators, setActivityIndicators] = useState<{
        unreadCount: number;
        upcomingMeetings: any[];
        recentFilesCount: number;
    }>({ unreadCount: 0, upcomingMeetings: [], recentFilesCount: 0 });

    const [activeTab, setActiveTab] = useState<'Dashboard' | 'Chat' | 'Meetings' | 'Tasks' | 'Docs'>('Dashboard');
    const [invites, setInvites] = useState<any[]>([]);
    const [invitesLoading, setInvitesLoading] = useState(false);
    const [spaceInviteUrl, setSpaceInviteUrl] = useState<string>('');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [personalInviteEmail, setPersonalInviteEmail] = useState('');
    const [isSendingPersonal, setIsSendingPersonal] = useState(false);
    const [lastPersonalInvite, setLastPersonalInvite] = useState<{ url: string; email: string } | null>(null);
    
    const [members, setMembers] = useState<any[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    
    const [tasks, setTasks] = useState<Task[]>([]);
    const [tasksLoading, setTasksLoading] = useState(false);
    const canManageInvites = userRole === 'owner' || userRole === 'admin' || userRole === 'staff';
    const canManageSpace = userRole === 'owner' || userRole === 'admin';

    const allowedSpaceStatuses = ['active', 'onboarding', 'archived', 'closed'] as const;

    const handleUpdateSpaceStatus = async (status: typeof allowedSpaceStatuses[number]) => {
        if (!spaceId) return;
        setIsUpdatingSpaceStatus(true);
        try {
            const { error } = await supabase.rpc('update_space_status', {
                p_space_id: spaceId,
                p_status: status
            });
            if (error) throw error;
            setSpace((current) => current ? { ...current, status } : current);
            showToast(`Space status updated to ${status}.`, 'success');
        } catch (err: any) {
            showToast(friendlyError(err?.message || 'Failed to update space status'), 'error');
        } finally {
            setIsUpdatingSpaceStatus(false);
        }
    };

    const handleDeleteSpace = async () => {
        if (!spaceId) return;
        try {
            const { error } = await supabase.rpc('delete_space_soft', {
                p_space_id: spaceId
            });
            if (error) throw error;
            showToast('Space removed.', 'success');
            setShowDeleteSpaceModal(false);
            onBack();
        } catch (err: any) {
            showToast(friendlyError(err?.message || 'Failed to delete space'), 'error');
        }
    };

    const loadActivityIndicators = useCallback(async () => {
        if (!spaceId || !organizationId) return;
        try {
            const { data, error } = await apiService.getSpaceDashboardData(spaceId, organizationId);
            if (error) throw error;
            
            setActivityIndicators({
                unreadCount: data.unread_messages || 0,
                upcomingMeetings: data.upcoming_meetings || [],
                recentFilesCount: data.recent_files || 0
            });
        } catch (err) {
            console.error('Failed to load activity indicators:', err);
        }
    }, [spaceId, organizationId]);

    const loadSpaceInviteUrl = useCallback(async () => {
        if (!spaceId || !session?.access_token) return;
        try {
            const result = await inviteService.getSpaceInviteLink(spaceId, session.access_token);
            if (result.success && result.data?.invitation_url) {
                setSpaceInviteUrl(result.data.invitation_url);
            }
        } catch (err) {
            console.error('[SpaceDetailView] Failed to load space invite link:', err);
        }
    }, [spaceId, session?.access_token]);

    const loadInvites = useCallback(async () => {
        if (!spaceId || !organizationId) return;
        try {
            setInvitesLoading(true);
            const { data, error } = await supabase.rpc('list_sent_invitations');
            if (error) throw error;
            // Filter client-side by space_id since RPC returns all org invitations
            const filteredInvites = (data || []).filter((invite: any) => invite.space_id === spaceId);
            setInvites(filteredInvites);
        } catch (err) {
            console.error('Failed to fetch invites:', err);
        } finally {
            setInvitesLoading(false);
        }
    }, [spaceId, organizationId]);

    const handleRegenerateSpaceInvite = async () => {
        if (!spaceId || !session?.access_token) return;
        if (!window.confirm("Are you sure? This will immediately invalidate the existing link and all clients using it will need the new one.")) return;
        
        try {
            setInviteLoading(true);
            const result = await inviteService.regenerateSpaceLink(spaceId, session.access_token);
            
            if (result.success && result.data?.invitation_url) {
                setSpaceInviteUrl(result.data.invitation_url);
                showToast("Space invite link regenerated successfully.", "success");
            } else {
                throw new Error('Failed to regenerate invite link');
            }
        } catch (err: any) {
            console.error('Failed to regenerate space invite link:', err);
            showToast(friendlyError(err.message), "error");
        } finally {
            setInviteLoading(false);
        }
    };

    const handleSendPersonalInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!spaceId || !session?.access_token || !personalInviteEmail) return;

        setIsSendingPersonal(true);
        try {
            const res = await inviteService.sendClientInvite(personalInviteEmail, spaceId, session.access_token);
            if (res.success && res.data) {
                setLastPersonalInvite({ url: res.data.invite_url, email: res.data.email });
                setPersonalInviteEmail('');
                showToast(`Invitation created for ${res.data.email}`, 'success');
                loadInvites();
            } else {
                showToast(res.error || 'Failed to create personal invite', 'error');
            }
        } catch (err: any) {
            console.error('[SpaceDetailView] Personal invite failed:', err);
            showToast('An unexpected error occurred', 'error');
        } finally {
            setIsSendingPersonal(false);
        }
    };

    useEffect(() => {
        if (!spaceId) return;
        let cancelled = false;

        const loadSpaceFull = async () => {
            if (!spaceId || !organizationId) return;
            if (!initialSpace) {
                setSpaceLoading(true);
                try {
                    const { data, error } = await apiService.getSpaceById(spaceId, organizationId);
                    if (!error && !cancelled) setSpace(data as ClientSpace);
                } catch (err) {
                    console.error('Error fetching space directly:', err);
                } finally {
                    if (!cancelled) setSpaceLoading(false);
                }
            } else {
                setSpace(initialSpace);
                setSpaceLoading(false);
            }
        };

        const loadStats = async () => {
            if (!spaceId || !organizationId) return;
            try {
                setSpaceStatsLoading(true);
                const { data, error } = await apiService.getSpaceStats(spaceId, organizationId);
                if (error) throw error;
                if (!cancelled) setSpaceStats(data);
            } catch (err: any) {
                console.error('[SpaceDetailView] Failed to load space_stats:', err);
            } finally {
                if (!cancelled) setSpaceStatsLoading(false);
            }
        };

        const refetchMembers = async () => {
            if (!spaceId) return;
            try {
                const { data } = await supabase.rpc('get_space_members', { p_space_id: spaceId });
                setMembers(data || []);
            } catch (err) {
                console.error('Failed to refetch members:', err);
            }
        };

        const loadActivities = async () => {
            if (!spaceId || !organizationId) return;
            try {
                setMembersLoading(true);
                setTasksLoading(true);
                const [memRes, taskRes] = await Promise.all([
                    supabase.rpc('get_space_members', { p_space_id: spaceId }),
                    apiService.getTasks(organizationId, spaceId)
                ]);
                if (!cancelled) {
                    setMembers(memRes.data || []);
                    setTasks(taskRes.data || []);
                }
            } catch (err: any) {
                console.error('Failed to load activities:', err);
            } finally {
                if (!cancelled) {
                    setMembersLoading(false);
                    setTasksLoading(false);
                }
            }
        };

        loadSpaceFull();
        loadStats();
        loadActivities();
        loadInvites();
        loadActivityIndicators();
        loadSpaceInviteUrl();

        // Set up real-time subscription for space_memberships changes
        const channel = supabase
            .channel('space-members-' + spaceId)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'space_memberships',
                filter: `space_id=eq.${spaceId}` 
            }, () => refetchMembers())
            .subscribe();

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
        };
    }, [spaceId, initialSpace, loadInvites, loadActivityIndicators, loadSpaceInviteUrl]);

    useEffect(() => {
        if (activeTab === 'Chat' && spaceId) {
            localStorage.setItem(`space_${spaceId}_last_seen`, new Date().toISOString());
        }
    }, [activeTab, spaceId]);

    if (spaceLoading && !space) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-20 bg-white">
                <div className="h-12 w-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
                <Heading level={2}>Entering Space...</Heading>
                <Text variant="secondary">Preparing your secure environment.</Text>
                <Button variant="ghost" className="mt-6" onClick={onBack}>
                    <ChevronLeft size={16} className="mr-2" /> Back
                </Button>
            </div>
        );
    }

    if (!space) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-20 bg-white text-center">
                <Shield size={48} className="text-zinc-200 mb-4" />
                <Heading level={2}>Space Not Found</Heading>
                <Text variant="secondary" className="max-w-xs mx-auto mt-2">The requested workspace could not be located or you don't have access.</Text>
                <Button variant="primary" className="mt-8" onClick={onBack}>
                    Return to Spaces
                </Button>
            </div>
        );
    }

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [showTrash, setShowTrash] = useState(false);
    const [viewingFile, setViewingFile] = useState<SpaceFile | null>(null);
    const [versioningFile, setVersioningFile] = useState<SpaceFile | null>(null);

    // Filter meetings for this space
    const localMeetings = meetings.filter(m => m.space_id === space.id && !m.deleted_at);

    // Schedule state
    const [newMeetingDate, setNewMeetingDate] = useState('');
    const [newMeetingTime, setNewMeetingTime] = useState('');
    const [newMeetingTitle, setNewMeetingTitle] = useState(`${space.name} Sync`);
    const [notifyClient, setNotifyClient] = useState(true);
    const [newMeetingCategory, setNewMeetingCategory] = useState<string>('general');

    const [meetingToEnd, setMeetingToEnd] = useState<Meeting | null>(null);
    const [endOutcome, setEndOutcome] = useState('successful');
    const [endNotes, setEndNotes] = useState('');
    const [isEnding, setIsEnding] = useState(false);

    const handleLocalSchedule = () => {
        onSchedule({
            space_id: space.id,
            title: newMeetingTitle,
            date: newMeetingDate,
            time: newMeetingTime,
            notify: notifyClient,
            category: newMeetingCategory
        });
        setIsScheduleModalOpen(false);
    };

    const { files, loading: filesLoading, refreshFiles, upsertFile, removeFile } = useRealtimeFiles(space.id, organizationId || '', showTrash);
    const { sendFile, loading: uploadLoading, uploadProgress } = useRealtimeMessages(space.id, organizationId || profile?.organization_id);

    const handleFileUpload = async (file: File) => {
        if (!organizationId) return false;

        const result = await sendFile(organizationId, file);

        if (result.success && result.fileData && !showTrash) {
            upsertFile(result.fileData);
            setTimeout(() => {
                refreshFiles();
            }, 1200);
        }

        if (result.success) {
            showToast(`${file.name} uploaded successfully`, 'success');
        } else {
            showToast('Upload failed — please try again', 'error');
        }

        return result.success;
    };

    return (
        <div className="animate-[fadeIn_0.5s_ease-out] flex flex-col h-[calc(100vh-64px)]">
            {/* Navigation Header */}
            <div className="flex items-center gap-4 mb-6">
                <button title="Go Back" onClick={onBack} className="p-2 rounded-[6px] border border-[#E5E5E5] bg-white hover:bg-[#F7F7F8] transition-colors">
                    <ArrowLeft size={20} className="text-[#6E6E80]" />
                </button>
                <div>
                    <h1 className="text-2xl font-semibold text-[#0D0D0D]">{space.name}</h1>
                    <p className="text-sm text-[#6E6E80]">Managed by You</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    {canManageSpace && (
                        <>
                            <select
                                title="Space status"
                                value={space?.status || 'active'}
                                onChange={(e) => handleUpdateSpaceStatus(e.target.value as typeof allowedSpaceStatuses[number])}
                                disabled={isUpdatingSpaceStatus}
                                className="rounded-full border border-[#E5E5E5] bg-white px-4 py-2 text-xs font-medium text-[#0D0D0D] outline-none"
                            >
                                {allowedSpaceStatuses.map((status) => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-[#0D0D0D] border-[#E5E5E5] hover:bg-[#F7F7F8]"
                                onClick={() => setShowDeleteSpaceModal(true)}
                            >
                                <Trash2 size={14} className="mr-1" /> Delete
                            </Button>
                        </>
                    )}
                    <div className="flex rounded-[999px] border border-[#E5E5E5] bg-[#F7F7F8] p-1">
                    {['Dashboard', 'Chat', 'Meetings', 'Tasks', 'Docs'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === tab ? 'bg-black text-white' : 'text-[#6E6E80] hover:text-[#0D0D0D]'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                </div>
            </div>

            {/* Activity Indicators (Task 7) */}
            <div className="flex gap-2 flex-wrap mb-6">
                {spaceStatsLoading ? (
                    <span className="px-3 py-1 text-[10px] rounded-full bg-[#F7F7F8] text-[#6E6E80] border border-[#E5E5E5]">Loading indicators...</span>
                ) : (
                    <>
                        {activityIndicators.unreadCount > 0 && (
                            <span className="px-3 py-1 text-[10px] font-semibold rounded-full bg-[#F7F7F8] border border-[#E5E5E5] text-[#0D0D0D] flex items-center gap-1.5">
                                <div className="h-1.5 w-1.5 bg-black rounded-full animate-pulse" /> {activityIndicators.unreadCount} unread
                            </span>
                        )}
                        {activityIndicators.upcomingMeetings.length > 0 && (
                            <span className="px-3 py-1 text-[10px] font-semibold rounded-full bg-[#F7F7F8] border border-[#E5E5E5] text-[#0D0D0D] flex items-center gap-1.5">
                                <Calendar size={10} />
                                {(() => {
                                    const next = activityIndicators.upcomingMeetings[0];
                                    const date = new Date(next.starts_at);
                                    const isToday = date.toDateString() === new Date().toDateString();
                                    return isToday ? `Meeting today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `${activityIndicators.upcomingMeetings.length} upcoming meetings`;
                                })()}
                            </span>
                        )}
                        {activityIndicators.recentFilesCount > 0 && (
                            <span className="px-3 py-1 text-[10px] font-semibold rounded-full bg-[#F7F7F8] border border-[#E5E5E5] text-[#0D0D0D] flex items-center gap-1.5">
                                <FolderClosed size={10} /> {activityIndicators.recentFilesCount} new files
                            </span>
                        )}
                        {!activityIndicators.unreadCount && !activityIndicators.upcomingMeetings.length && !activityIndicators.recentFilesCount && (
                            <span className="px-3 py-1 text-[10px] rounded-full bg-white border border-[#E5E5E5] text-[#6E6E80]">No new activity</span>
                        )}
                        <span className="px-3 py-1 text-[10px] rounded-full bg-white border border-[#E5E5E5] text-[#0D0D0D] ml-auto">
                            Last active: {spaceStats?.last_activity_at ? new Date(spaceStats.last_activity_at).toLocaleString() : '—'}
                        </span>
                    </>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pr-2">
                {activeTab === 'Dashboard' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <GlassCard className="p-6">
                                <Heading level={3} className="mb-4">Space Actions</Heading>
                                <div className="space-y-3">
                                    <Button variant="secondary" className="w-full justify-start" onClick={() => setIsUploadModalOpen(true)}>
                                        <Upload size={16} className="mr-2" /> Upload Document
                                    </Button>
                                    <Button variant="secondary" className="w-full justify-start"><MessageSquare size={16} className="mr-2" /> Create Auto-Message</Button>
                                    <Button variant="secondary" className="w-full justify-start"><ListTodo size={16} className="mr-2" /> Create Task</Button>
                                </div>
                            </GlassCard>
                            <GlassCard className="p-6">
                                <Heading level={3} className="mb-4">Space Members</Heading>
                                <div className="space-y-3">
                                    {membersLoading ? (
                                        <SkeletonText lines={2} />
                                    ) : members.length > 0 ? (
                                        members.map(member => (
                                            <div key={member.profile_id} className="flex items-center gap-3 p-2 hover:bg-[#F7F7F8] rounded-[8px] transition-colors border border-transparent">
                                                {/* Avatar */}
                                                <div className="h-8 w-8 rounded-[8px] bg-black flex items-center justify-center text-white font-semibold text-xs uppercase">
                                                    {member.avatar_url ? (
                                                        <img src={member.avatar_url} alt={member.full_name} className="h-8 w-8 rounded-full object-cover" />
                                                    ) : (
                                                        member.full_name?.charAt(0) || <User size={14} />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-medium text-[#0D0D0D] truncate">
                                                            {member.full_name || 'Pending User'}
                                                        </p>
                                                        {/* Online indicator */}
                                                        <div className={`h-2 w-2 rounded-full ${member.is_online ? 'bg-black' : 'bg-[#D4D4D8]'}`} title={member.is_online ? 'Online' : 'Offline'} />
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {/* Role badge */}
                                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium border ${
                                                            member.membership_role === 'client' ? 'bg-[#F7F7F8] text-[#0D0D0D] border-[#E5E5E5]' :
                                                            member.membership_role === 'staff' ? 'bg-[#F7F7F8] text-[#0D0D0D] border-[#E5E5E5]' :
                                                            member.membership_role === 'admin' ? 'bg-[#F7F7F8] text-[#0D0D0D] border-[#E5E5E5]' :
                                                            'bg-[#F7F7F8] text-[#6E6E80] border-[#E5E5E5]'
                                                        }`}>
                                                            {member.membership_role}
                                                        </span>
                                                        {/* Joined date */}
                                                        <span className="text-[9px] text-[#6E6E80]">
                                                            Joined {member.joined_at ? new Date(member.joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-[#6E6E80] italic">No members yet. Share the invite link to get started.</p>
                                    )}
                                </div>
                            </GlassCard>

                            {canManageInvites && (
                                <GlassCard className="p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <Heading level={3}>Shareable Space Link</Heading>
                                            <p className="text-[10px] text-[#6E6E80] uppercase tracking-wider font-semibold">Public/Ghost Access</p>
                                        </div>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={handleRegenerateSpaceInvite}
                                            disabled={inviteLoading}
                                        >
                                            <History size={14} className="mr-2" /> {inviteLoading ? 'Wait...' : 'Regenerate'}
                                        </Button>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-white border border-[#E5E5E5] rounded-[8px] px-4 py-2 text-sm font-mono text-[#6E6E80] truncate">
                                                {spaceInviteUrl || 'No active link'}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    if (spaceInviteUrl) {
                                                        navigator.clipboard.writeText(spaceInviteUrl);
                                                        showToast("Copied to clipboard", "success");
                                                    }
                                                }}
                                                disabled={!spaceInviteUrl}
                                            >
                                                <Copy size={14} />
                                            </Button>
                                        </div>
                                        <div className="bg-[#F7F7F8] border border-[#E5E5E5] rounded-[8px] p-3 flex gap-3">
                                            <LinkIcon size={16} className="text-[#6E6E80] shrink-0 mt-0.5" />
                                            <Text variant="secondary" className="text-xs leading-relaxed">
                                                Clients using this link will be added to this space immediately. Recommended for generic onboarding.
                                            </Text>
                                        </div>
                                    </div>
                                </GlassCard>
                            )}

                            {canManageInvites && (
                                <GlassCard className="p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <Heading level={3}>Personal Client Invite</Heading>
                                            <p className="text-[10px] text-emerald-600 uppercase tracking-wider font-bold">Secure/One-Time</p>
                                        </div>
                                    </div>
                                    
                                    <form onSubmit={handleSendPersonalInvite} className="space-y-4 mb-6">
                                        <div className="flex gap-2">
                                            <Input 
                                                className="flex-1"
                                                type="email"
                                                placeholder="client@email.com"
                                                required
                                                value={personalInviteEmail}
                                                onChange={e => setPersonalInviteEmail(e.target.value)}
                                            />
                                            <Button variant="primary" type="submit" disabled={isSendingPersonal || !personalInviteEmail}>
                                                {isSendingPersonal ? '...' : <ArrowRight size={16} />}
                                            </Button>
                                        </div>
                                        <p className="text-[11px] text-zinc-500 italic">This will generate a unique link tied to their email.</p>
                                    </form>

                                    {lastPersonalInvite && (
                                        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl animate-[fadeIn_0.3s_ease-out]">
                                            <label className="block text-[10px] font-bold text-emerald-700 uppercase tracking-tight mb-2">New Invite Link for {lastPersonalInvite.email}</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    readOnly 
                                                    title="Invite link"
                                                    value={lastPersonalInvite.url} 
                                                    className="flex-1 bg-white border border-emerald-200 rounded-lg px-3 py-1.5 text-xs font-mono text-emerald-800"
                                                />
                                                <Button 
                                                    size="sm" 
                                                    className="bg-emerald-600 hover:bg-emerald-700 h-8"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(lastPersonalInvite.url);
                                                        showToast("Personal link copied!", "success");
                                                    }}
                                                >
                                                    <Copy size={14} />
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-3 pt-4 border-t border-zinc-100">
                                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Recent Pending Invites</label>
                                        {invitesLoading ? (
                                            <SkeletonText lines={2} />
                                        ) : invites.length > 0 ? (
                                            invites.slice(0, 3).map(invite => (
                                                <div key={invite.id} className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-lg border border-zinc-100 group">
                                                    <div className="min-w-0 flex-1 mr-3">
                                                        <div className="flex items-center gap-2">
                                                            <Mail size={12} className="text-zinc-400" />
                                                            <span className="text-[12px] font-medium text-zinc-700 truncate">{invite.email || 'Unspecified'}</span>
                                                        </div>
                                                        <span className="text-[9px] text-zinc-400 font-mono ml-5">Expires {new Date(invite.expires_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => {
                                                            const url = `${window.location.origin}/accept-invite?token=${invite.token}`;
                                                            navigator.clipboard.writeText(url);
                                                            showToast("Copied to clipboard", "success");
                                                        }}
                                                        title="Copy Link"
                                                    >
                                                        <Copy size={14} />
                                                    </Button>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-center py-2 text-zinc-400 text-[11px] italic">No active personal invites.</p>
                                        )}
                                    </div>
                                </GlassCard>
                            )}
                            <CalendarWidget
                                meetings={localMeetings}
                                tasks={tasks}
                                spaces={[space].filter(Boolean)}
                                defaultSpaceId={space.id}
                                showSpaceFilter={false}
                                showTypeFilter={true}
                                title={`${space.name} Calendar`}
                            />
                        </div>
                    </div>
                )}
                {activeTab === 'Chat' && (
                    <SpaceChatPanel spaceId={space.id} spaceName={space.name} />
                )}
                {activeTab === 'Meetings' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-medium">Space Meetings</h3>
                                <p className="text-xs text-zinc-500">Scheduled and live calls for this workspace.</p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="secondary" size="sm" onClick={() => onInstantMeet(space.id)}>
                                    <Video size={14} className="mr-1" /> Meet Now
                                </Button>
                                <Button variant="primary" size="sm" onClick={() => setIsScheduleModalOpen(true)}>
                                    <Plus size={14} className="mr-1" /> Schedule
                                </Button>
                            </div>
                        </div>

                        {localMeetings.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {localMeetings.map(m => {
    const isEnded = m.status === 'ended' || m.status === 'cancelled';
    return (
        <GlassCard key={m.id} className="p-4 flex flex-col justify-between h-auto">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <p className="font-semibold text-sm truncate max-w-[200px]">{m.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-zinc-500 uppercase">
                            {isEnded ? m.status : m.status}
                        </span>
                        {!isEnded && (m.status === 'active' || m.status === 'live') && (
                            <span className="text-emerald-500 font-bold text-[10px] flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> LIVE
                            </span>
                        )}
                        {isEnded && m.outcome && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                m.outcome === 'successful' ? 'bg-emerald-100 text-emerald-700' :
                                m.outcome === 'no_show' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                            }`}>
                                {m.outcome.replace(/_/g, ' ')}
                            </span>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold">{new Date(m.starts_at).toLocaleDateString()}</p>
                    <p className="text-[10px] text-zinc-400">{new Date(m.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
            </div>
            <div className="flex gap-2 w-full mt-2">
                <Button
                    variant={isEnded ? 'outline' : 'primary'}
                    size="sm"
                    className={`flex-1 ${isEnded ? 'text-[#0D0D0D] border-[#E5E5E5] hover:bg-[#F7F7F8]' : ''}`}
                    onClick={() => !isEnded ? onJoin(m.id) : navigate(`/spaces/${spaceId}/meetings/${m.id}/review`)}
                >
                    {isEnded ? '📋 Review Details' : 'Enter Lobby'}
                </Button>
                {!isEnded && ['owner', 'admin', 'staff'].includes(userRole || '') && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-[#0D0D0D] border-[#E5E5E5] hover:bg-[#F7F7F8] px-3"
                        onClick={() => {
                            setEndOutcome('successful');
                            setEndNotes('');
                            setMeetingToEnd(m);
                        }}
                        title="End Meeting"
                    >
                        <Flag size={14} /> 
                    </Button>
                )}
                {['owner', 'admin', 'staff'].includes(userRole || '') && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="px-2 text-red-500 hover:bg-red-50 border-red-100"
                        onClick={() => {
                            if (window.confirm('Delete this meeting?')) {
                                onDeleteMeeting?.(m.id);
                            }
                        }}
                        title="Delete Meeting"
                    >
                        <Trash2 size={16} />
                    </Button>
                )}
            </div>
        </GlassCard>
    );
})}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200">
                                <Video size={40} className="text-zinc-300 mb-3 opacity-50" />
                                <p className="text-zinc-500 text-sm italic">No recordings or upcoming meetings found.</p>
                            </div>
                        )}

                        {/* Space-specific Schedule Modal */}
                        <Modal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)} title={`Schedule Meeting for ${space.name}`}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Meeting Title</label>
                                    <Input placeholder="e.g. Project Discovery Sync" value={newMeetingTitle} onChange={e => setNewMeetingTitle(e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1">Date</label>
                                        <Input type="date" value={newMeetingDate} onChange={e => setNewMeetingDate(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1">Time</label>
                                        <Input type="time" value={newMeetingTime} onChange={e => setNewMeetingTime(e.target.value)} />
                                    </div>
                                </div>
                                <Toggle label="Notify Client (Email & Push)" checked={notifyClient} onChange={setNotifyClient} />
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Category</label>
                                    <select
                                        value={newMeetingCategory}
                                        onChange={(e) => setNewMeetingCategory(e.target.value)}
                                        className="w-full bg-white/40 border border-zinc-200 rounded-lg px-5 py-3 text-zinc-800 text-sm focus:outline-none"
                                        title="Meeting category"
                                    >
                                        <option value="sales_call">Sales Call</option>
                                        <option value="onboarding">Onboarding</option>
                                        <option value="check_in">Check-in</option>
                                        <option value="project_review">Project Review</option>
                                        <option value="strategy">Strategy</option>
                                        <option value="general">General</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <Button className="w-full mt-4" onClick={handleLocalSchedule}>Schedule for this Space</Button>
                            </div>
                        </Modal>

                        {/* End Meeting Modal */}
                        <Modal isOpen={!!meetingToEnd} onClose={() => !isEnding && setMeetingToEnd(null)} title="End meeting for everyone?">
                            <div className="space-y-4">
                                <Text variant="secondary" className="mb-2">This marks the meeting as complete and notifies all participants.</Text>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-2">Outcome</label>
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        {[
                                            { id: 'successful', label: '✅ Successful' },
                                            { id: 'follow_up_needed', label: '🔄 Follow-up' },
                                            { id: 'no_show', label: '👻 No Show' },
                                            { id: 'inconclusive', label: '❓ Inconclusive' },
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setEndOutcome(opt.id)}
                                                className={`px-3 py-2 rounded-xl border text-sm transition-all ${
                                                    endOutcome === opt.id
                                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold shadow-sm'
                                                        : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-2">Notes (optional)</label>
                                    <textarea
                                        value={endNotes}
                                        onChange={e => setEndNotes(e.target.value)}
                                        placeholder="Add any final unstructured notes..."
                                        disabled={isEnding}
                                        className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 min-h-[100px]"
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button variant="secondary" className="flex-1" onClick={() => setMeetingToEnd(null)} disabled={isEnding}>Cancel</Button>
                                    <Button variant="primary" className="flex-1 bg-rose-600 hover:bg-rose-700 border-rose-600 text-white" disabled={isEnding} onClick={async () => {
                                        if (meetingToEnd && onEndMeeting) {
                                            setIsEnding(true);
                                            await onEndMeeting(meetingToEnd.id, endOutcome, endNotes);
                                            setIsEnding(false);
                                            setMeetingToEnd(null);
                                        }
                                    }}>
                                        {isEnding ? 'Ending...' : 'End Meeting'}
                                    </Button>
                                </div>
                            </div>
                        </Modal>
                    </div>
                )}
                {activeTab === 'Tasks' && (
                    <TaskWorkspace
                        tasks={tasks}
                        clients={[space]}
                        loading={tasksLoading}
                        title={`${space.name} Tasks`}
                        subtitle="Manage action items for this workspace with the same multi-view system used in the main overview."
                        scopeSpaceId={space.id}
                        groupOptions={['Design', 'Engineering', 'Marketing']}
                        emptyTitle="No tasks assigned to this space"
                        emptyDescription="Create the next action item here and move it through To Do, In Progress, Review, and Done."
                        onCreateTask={async (draft) => {
                            if (!organizationId) return;
                            try {
                                const { data, error } = await apiService.createTask(
                                    {
                                        ...draft,
                                        space_id: space.id,
                                        status: draft.status || 'todo'
                                    },
                                    organizationId
                                );
                                if (error) throw error;
                                if (data) {
                                    setTasks((current) => [data as Task, ...current]);
                                    showToast('Task created.', 'success');
                                }
                            } catch (err: any) {
                                showToast(friendlyError(err?.message || 'Failed to create task'), 'error');
                            }
                        }}
                        onUpdateTask={async (taskId, updates) => {
                            if (!organizationId) return;
                            try {
                                const { error } = await apiService.updateTask(taskId, updates, organizationId);
                                if (error) throw error;
                                setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...updates } : task));
                            } catch (err: any) {
                                showToast(friendlyError(err?.message || 'Failed to update task'), 'error');
                            }
                        }}
                    />
                )}
                {activeTab === 'Docs' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Heading level={2}>{showTrash ? 'Trash' : 'Documents'}</Heading>
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => setShowTrash(!showTrash)} className={showTrash ? 'text-rose-500 bg-rose-50' : ''}>
                                    <Trash2 size={16} className="mr-1" /> {showTrash ? 'Exit Trash' : 'Trash'}
                                </Button>
                                <Button size="sm" onClick={() => setIsUploadModalOpen(true)}>
                                    <Upload size={16} className="mr-1" /> Upload
                                </Button>
                            </div>
                        </div>

                        {filesLoading ? (
                            <div className="flex items-center justify-center py-12 text-zinc-400">
                                <p className="animate-pulse">Loading documents...</p>
                            </div>
                        ) : files.length === 0 ? (
                            <GlassCard className="p-12 flex flex-col items-center justify-center text-center">
                                <FileText size={48} className="text-zinc-200 mb-4" />
                                <Heading level={3} className="text-zinc-400">{showTrash ? 'Trash is empty' : 'No documents yet'}</Heading>
                                <Text variant="secondary" className="max-w-xs mt-2">
                                    {showTrash ? 'Files you moved to trash will appear here for 30 days.' : 'Upload documents to share them securely with this client.'}
                                </Text>
                            </GlassCard>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {files.map(file => (
                                    <GlassCard key={file.id} className="p-4 flex justify-between items-center group hover:border-zinc-300 transition-all shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400">
                                                <DocIcon size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-[#1D1D1D]">{file.name}</p>
                                                    {!showTrash && file.status && file.status !== 'available' && (
                                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                                            file.status === 'pending'
                                                                ? 'bg-[#F7F7F8] text-[#6E6E80] border border-[#E5E5E5]'
                                                                : 'bg-[#F7F7F8] text-[#6E6E80] border border-[#E5E5E5]'
                                                        }`}>
                                                            {file.status === 'pending' ? 'Uploading' : 'Processing'}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-zinc-500">
                                                    {file.file_size ? `${(file.file_size / (1024 * 1024)).toFixed(2)} MB` : 'Size unknown'} • {new Date(file.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {!showTrash ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950"
                                                        onClick={() => setViewingFile(file as any)}
                                                        title="Preview"
                                                        aria-label={`Preview ${file.name}`}
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            const { data } = await apiService.getSignedUrl(file.id, organizationId || '');
                                                            if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                                        }}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950"
                                                        title="Download"
                                                        aria-label={`Download ${file.name}`}
                                                    >
                                                        <Download size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#6E6E80] shadow-sm transition-all hover:border-[#E5E5E5] hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                                                        onClick={() => setVersioningFile(file as any)}
                                                        title="Version History"
                                                        aria-label={`View version history for ${file.name}`}
                                                    >
                                                        <History size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            if (confirm('Are you sure you want to move this file to trash?')) {
                                                         try {
                                                             await apiService.deleteFile(file.id, organizationId || '');
                                                             removeFile(file.id);
                                                             showToast('File moved to trash.', "success");
                                                                 } catch (err: any) {
                                                                    showToast(friendlyError(err?.message), "error");
                                                                 }
                                                            }
                                                        }}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#6E6E80] shadow-sm transition-all hover:border-[#E5E5E5] hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                                                        title="Move to trash"
                                                        aria-label={`Move ${file.name} to trash`}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            try {
                                                                await apiService.restoreFile(file.id, organizationId || '');
                                                                removeFile(file.id);
                                                                showToast('File restored.', "success");
                                                            } catch (err: any) {
                                                                    showToast(friendlyError(err?.message), "error");
                                                            }
                                                        }}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                                                        title="Restore File"
                                                        aria-label={`Restore ${file.name}`}
                                                    >
                                                        <ArrowLeft size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            if (confirm('PERMANENT DELETE: Are you sure? This cannot be undone.')) {
                                                                try {
                                                                    await apiService.hardDeleteFile(file.id, organizationId || '');
                                                                    removeFile(file.id);
                                                                    showToast('File permanently deleted.', "success");
                                                                } catch (err: any) {
                                                                    showToast(friendlyError(err?.message), "error");
                                                                }
                                                            }
                                                        }}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                                                        title="Delete Permanently"
                                                        aria-label={`Delete ${file.name} permanently`}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </GlassCard>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Modal
                isOpen={showDeleteSpaceModal}
                onClose={() => setShowDeleteSpaceModal(false)}
                title="Delete Space?"
            >
                <div className="space-y-4">
                    <Text variant="secondary">
                        This will archive the space and remove it from the active workspace list.
                    </Text>
                    <div className="flex gap-3 pt-2">
                        <Button variant="secondary" className="flex-1" onClick={() => setShowDeleteSpaceModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" className="flex-1 bg-black hover:bg-[#1A1A1A]" onClick={handleDeleteSpace}>
                            Delete Space
                        </Button>
                    </div>
                </div>
            </Modal>

            <FileUploadModal
                isOpen={activeTab !== 'Chat' && isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onUpload={handleFileUpload}
                loading={uploadLoading}
                uploadProgress={uploadProgress}
            />

            {viewingFile && (
                <FileViewerModal
                    fileId={viewingFile.id}
                    filename={viewingFile.name}
                    mimeType={viewingFile.mime_type || 'application/pdf'}
                    onClose={() => setViewingFile(null)}
                />
            )}

            <FileVersionsModal
                isOpen={!!versioningFile}
                onClose={() => setVersioningFile(null)}
                file={versioningFile}
            />

        </div>
    );
};
export default SpaceDetailView;
