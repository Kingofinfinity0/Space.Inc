import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../utils/errors';
import {
    LayoutDashboard, Users, MessageSquare, Calendar, FileText, Settings, Plus, Search,
    Briefcase, ChevronRight, LogOut, Video, Download, Upload, Clock, UserPlus, ArrowRight,
    Link as LinkIcon, Copy, ListTodo, MoreVertical, Flag, Trash2, User, ArrowLeft,
    GripVertical, Activity, Shield, Lock, FileUp, Key, FilePlus as FilePlus2,
    File as DocIcon, FileSpreadsheet, Image as ImageIcon, Rocket, LayoutGrid, Inbox, UserCheck, CheckSquare, FolderClosed,
    Bell, Eye, Play, X, FileVideo, ChevronLeft, History, Mail, ChevronsUpDown
} from 'lucide-react';
import {
    GlassCard, Button, Heading, Text, Input, Modal, Checkbox, Toggle,
    LoadingScreen, useLoadingScreenGate
} from '../UI/index';
import { FileViewerModal } from '../FileViewerModal';
import { FileUploadModal } from '../FileUploadModal';
import { FileVersionsModal } from '../FileVersionsModal';
import { SurfaceDock } from '../SurfaceDock';
import { ClientSpace, ViewState, Meeting, Message, StaffMember, Task, SpaceFile, ClientLifecycle } from '../../types';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useRealtimeFiles } from '../../hooks/useRealtimeFiles';
import SpaceChatPanel from './SpaceChatPanel';
import { CalendarWidget } from '../CalendarWidget';
import TaskWorkspace from '../tasks/TaskWorkspace';
import { usePermissions } from "../../hooks/usePermissions";
import { SpaceMemberPanel } from '../space/SpaceMemberPanel';
import { SpacePermissionsMatrix } from '../space/SpacePermissionsMatrix';
import { SpaceMessagesCard } from '../space/SpaceMessagesCard';
import { InviteMemberCard } from '../invite/InviteMemberModal';
import { getAvailableContexts, getContextRoute } from '../../lib/contextReadiness';
import type { UserContext } from '../../types/context';

type SpaceDetailTab = 'Dashboard' | 'Chat' | 'Meetings' | 'Tasks' | 'Docs';

const getContextDisplayName = (context: UserContext) => {
    return context.context_type === 'org' ? context.org_name : context.space_name;
};

const getContextSubtitle = (context: UserContext) => {
    return context.context_type === 'org'
        ? `${context.context_role} role`
        : `${context.org_name} - Client profile`;
};

const getProfileInitials = (name?: string | null, email?: string | null) => {
    const label = name || email || 'Account';
    return label
        .split(/[.@\s_-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'A';
};

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
};

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'heic', 'heif']);
const SPREADSHEET_EXTENSIONS = new Set(['xls', 'xlsx', 'csv', 'ods', 'tsv', 'numbers']);

const getFileExtension = (file: SpaceFile) => {
    const source = file.name || file.display_name || '';
    return source.includes('.') ? source.split('.').pop()?.toLowerCase() || '' : '';
};

const isImageFile = (file: SpaceFile) => {
    const mimeType = file.mime_type || file.type || '';
    return mimeType.startsWith('image/') || IMAGE_EXTENSIONS.has(getFileExtension(file));
};

const getDocumentIcon = (file: SpaceFile, size = 20) => {
    const mimeType = file.mime_type || file.type || '';
    const extension = getFileExtension(file);

    if (isImageFile(file)) return <ImageIcon size={size} />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('csv') || SPREADSHEET_EXTENSIONS.has(extension)) return <FileSpreadsheet size={size} />;
    return <DocIcon size={size} />;
};

const DonutStat = ({ label, value, progress, tone = '#0D0D0D' }: { label: string; value: string; progress: number; tone?: string }) => {
    const size = 156;
    const center = 60;
    const radius = 42;
    const strokeWidth = 20;
    const circumference = 2 * Math.PI * radius;
    const safeProgress = Math.max(0, Math.min(1, progress));
    const offset = circumference * (1 - safeProgress);

    return (
        <div className="flex min-w-0 flex-col items-center justify-center">
            <div className="relative h-[156px] w-[156px]">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
                    <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="none"
                        stroke="#E7E7EA"
                        strokeWidth={strokeWidth}
                    />
                    <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="none"
                        stroke={tone}
                        strokeWidth={strokeWidth}
                        strokeLinecap="butt"
                        strokeDasharray={circumference}
                        style={{
                            strokeDashoffset: circumference,
                            animation: 'donut-fill 950ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
                            ['--donut-empty' as any]: circumference,
                            ['--donut-offset' as any]: offset,
                        }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                    <p className="dashboard-number font-sans text-[30px] leading-none tracking-[-0.045em] text-[#0D0D0D]">{value}</p>
                </div>
            </div>
            <p className="mt-2 max-w-full truncate text-center font-sans text-[12px] font-semibold leading-none tracking-[-0.01em] text-[#2A2A2A]">{label}</p>
        </div>
    );
};

const PlainWeeklyStat = ({ label, value }: { label: string; value: string }) => (
    <div className="flex min-w-0 items-center justify-center">
        <div className="text-center">
            <p className="dashboard-number font-sans text-[36px] leading-none tracking-[-0.045em] text-[#0D0D0D] md:text-[42px]">{value}</p>
            <p className="mt-2 font-sans text-[12px] font-semibold leading-none tracking-[-0.01em] text-[#2A2A2A]">{label}</p>
        </div>
    </div>
);


// 3. Space Detail View
const SpaceDetailView = ({ spaceId, space: initialSpace, meetings, onBack, onJoin, onSchedule, onInstantMeet, onEndMeeting, onDeleteMeeting, activeTab: activeTabProp, onTabChange }: { spaceId: string, space?: ClientSpace, meetings: Meeting[], onBack: () => void, onJoin: (id: string) => void, onSchedule: (data: any) => void, onInstantMeet: (spaceId: string) => void, onEndMeeting?: (id: string, outcome: string, notes: string) => void, onDeleteMeeting?: (meetingId: string) => void, activeTab?: SpaceDetailTab, onTabChange?: (tab: SpaceDetailTab) => void }) => {
    const navigate = useNavigate();
    const {
        user,
        profile,
        organizationId,
        userRole,
        session,
        signOut,
        contexts,
        activeContext,
        setActiveContext,
        refreshContexts,
        refreshCapabilities
    } = useAuth();
    const { permissions, isLoading: permissionsLoading } = usePermissions(spaceId);
    const { showToast } = useToast();

    const [space, setSpace] = useState<ClientSpace | undefined>(initialSpace);
    const [spaceLoading, setSpaceLoading] = useState(!initialSpace);
    const [isUpdatingSpaceStatus, setIsUpdatingSpaceStatus] = useState(false);
    const [showDeleteSpaceModal, setShowDeleteSpaceModal] = useState(false);
    const [isSwitchMenuOpen, setIsSwitchMenuOpen] = useState(false);
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
    const [switchingContextId, setSwitchingContextId] = useState<string | null>(null);

    const [spaceStats, setSpaceStats] = useState<any>(null);
    const [spaceStatsLoading, setSpaceStatsLoading] = useState(false);
    const [activityIndicators, setActivityIndicators] = useState<{
        unreadCount: number;
        upcomingMeetings: any[];
        recentFilesCount: number;
    }>({ unreadCount: 0, upcomingMeetings: [], recentFilesCount: 0 });

    const [activeTab, setActiveTab] = useState<SpaceDetailTab>(activeTabProp || 'Dashboard');
    const [members, setMembers] = useState<any[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    
    const [tasks, setTasks] = useState<Task[]>([]);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [showTrash, setShowTrash] = useState(false);
    const [viewingFile, setViewingFile] = useState<SpaceFile | null>(null);
    const [versioningFile, setVersioningFile] = useState<SpaceFile | null>(null);
    const [newMeetingDate, setNewMeetingDate] = useState('');
    const [newMeetingTime, setNewMeetingTime] = useState('');
    const [newMeetingTitle, setNewMeetingTitle] = useState(`${initialSpace?.name || 'Space'} Sync`);
    const [notifyClient, setNotifyClient] = useState(true);
    const [newMeetingCategory, setNewMeetingCategory] = useState<string>('general');
    const [meetingToEnd, setMeetingToEnd] = useState<Meeting | null>(null);
    const [endOutcome, setEndOutcome] = useState('successful');
    const [endNotes, setEndNotes] = useState('');
    const [isEnding, setIsEnding] = useState(false);
    const isClient = userRole === 'client';
    const switchTab = useCallback((tab: SpaceDetailTab) => {
        setActiveTab(tab);
        onTabChange?.(tab);
    }, [onTabChange]);
    const canManageSpace = permissions ? !!permissions.manage_spaces : (userRole === 'owner' || userRole === 'admin');

    const allowedSpaceStatuses = ['active', 'archived', 'closed'] as const;

    const handleUpdateSpaceStatus = async (status: typeof allowedSpaceStatuses[number]) => {
        if (!spaceId) return;
        if (space?.status === status) return;
        setIsUpdatingSpaceStatus(true);
        try {
            if (status === 'closed') {
                const reason = window.prompt('Closure reason', space?.closure_reason || 'Engagement formally ended.');
                if (reason === null) return;
                const { error } = await apiService.closeSpace(spaceId, reason.trim() || 'Engagement formally ended.');
                if (error) throw error;
                setSpace((current) => current ? {
                    ...current,
                    status,
                    closure_reason: reason.trim() || 'Engagement formally ended.',
                    closed_at: new Date().toISOString(),
                    closed_by: user?.id || null
                } : current);
                showToast('Space closed.', 'success');
                return;
            }

            if (status === 'active' && space?.status === 'archived') {
                const { error } = await apiService.restoreSpace(spaceId);
                if (error) throw error;
                setSpace((current) => current ? { ...current, status, closed_at: null, closed_by: null, closure_reason: null } : current);
                showToast('Space restored.', 'success');
                return;
            }

            if (space?.status === 'closed' && status === 'active') {
                throw new Error('Closed spaces are permanent and cannot be restored.');
            }

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
                unreadCount: data?.unread_messages || data?.unreadMessages || 0,
                upcomingMeetings: data?.upcoming_meetings || data?.upcomingMeetings || [],
                recentFilesCount: data?.recent_files || data?.recentFilesCount || 0
            });
        } catch (err) {
            console.error('Failed to load activity indicators:', err);
        }
    }, [spaceId, organizationId]);

    useEffect(() => {
        setActiveTab(activeTabProp || 'Dashboard');
    }, [activeTabProp]);

    useEffect(() => {
        if (!spaceId) return;
        let cancelled = false;

        const loadSpaceFull = async () => {
            if (!spaceId) {
                if (!cancelled) setSpaceLoading(false);
                return;
            }

            if (!organizationId) {
                if (!cancelled) {
                    setSpaceLoading(false);
                    setSpace(initialSpace);
                }
                return;
            }

            if (!initialSpace) {
                setSpaceLoading(true);
                try {
                    const { data, error } = await apiService.getSpaceById(spaceId, organizationId);
                    if (!error && !cancelled) setSpace(data as ClientSpace);
                    if ((error || !data) && !cancelled) setSpace(null);
                } catch (err) {
                    console.error('Error fetching space directly:', err);
                    if (!cancelled) setSpace(null);
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
                setMembers(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Failed to refetch members:', err);
            }
        };

        const refetchTasks = async () => {
            if (!spaceId || !organizationId) return;
            try {
                const { data } = await apiService.getTasks(organizationId, spaceId);
                setTasks(data || []);
            } catch (err) {
                console.error('Failed to refetch tasks:', err);
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
                    setMembers(Array.isArray(memRes.data) ? memRes.data : []);
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
        loadActivityIndicators();
        const refreshSpaceSignals = () => {
            loadStats();
            loadActivityIndicators();
        };

        const channel = supabase
            .channel('space-live-' + spaceId)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'space_memberships',
                filter: `space_id=eq.${spaceId}` 
            }, () => {
                refetchMembers();
                refreshSpaceSignals();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'space_members',
                filter: `space_id=eq.${spaceId}`
            }, () => {
                refetchMembers();
                refreshSpaceSignals();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tasks',
                filter: `space_id=eq.${spaceId}`
            }, () => {
                refetchTasks();
                refreshSpaceSignals();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'meetings',
                filter: `space_id=eq.${spaceId}`
            }, refreshSpaceSignals)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'files',
                filter: `space_id=eq.${spaceId}`
            }, refreshSpaceSignals)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'space_stats',
                filter: `space_id=eq.${spaceId}`
            }, (payload) => {
                if (payload.eventType !== 'DELETE' && payload.new) {
                    setSpaceStats(payload.new);
                }
            })
            .subscribe();

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
        };
    }, [spaceId, organizationId, initialSpace, loadActivityIndicators]);

    useEffect(() => {
        if (activeTab === 'Chat' && spaceId) {
            localStorage.setItem(`space_${spaceId}_last_seen`, new Date().toISOString());
        }
    }, [activeTab, spaceId]);

    const handleHeaderContextSwitch = useCallback(async (context: UserContext) => {
        setSwitchingContextId(context.context_id);
        try {
            const activation = await apiService.activateMembershipContext(context.context_type, context.context_id);
            if (!activation.success) {
                throw new Error(activation.error_code || 'UNKNOWN_ERROR');
            }

            setActiveContext(context);
            setIsSwitchMenuOpen(false);
            setIsAccountMenuOpen(false);
            setSwitchingContextId(null);
            navigate(getContextRoute(context) || '/dashboard', { replace: true });
            showToast(`Switched to ${getContextDisplayName(context)}`, 'success');

            void Promise.all([refreshContexts(), refreshCapabilities()]).catch((syncError) => {
                console.warn('[SpaceDetailView] Background context refresh failed:', syncError);
            });
        } catch (err: any) {
            showToast(err?.message || 'Could not switch account right now.', 'error');
            setSwitchingContextId(null);
        }
    }, [navigate, refreshCapabilities, refreshContexts, setActiveContext, showToast]);

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

    // Filter meetings for this space
    const localMeetings = meetings.filter(m => m.space_id === space.id && !m.deleted_at);
    const availableContexts = getAvailableContexts(contexts);
    const contextCount = contexts?.available?.count ?? contexts?.total ?? availableContexts.length;
    const showContextSwitcher = isClient && contextCount >= 2;
    const activeOrganizationName =
        activeContext?.org_name ||
        profile?.organization_name ||
        space.organization_id ||
        'Organization';
    const accountName = profile?.full_name || user?.email || 'Account';
    const accountInitials = getProfileInitials(profile?.full_name, user?.email);
    const dateLabel = new Date().toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
    const isSpaceClosed = space.status === 'closed';
    const statusSelectValue = allowedSpaceStatuses.includes(space.status as typeof allowedSpaceStatuses[number])
        ? space.status as typeof allowedSpaceStatuses[number]
        : 'active';
    const canManageMeetings = ['owner', 'admin', 'staff'].includes(userRole || '');
    const canDeleteTasks = permissions ? !!(permissions.delete_task || permissions.manage_tasks) : true;
    const dashboardMentionTokens = [
        profile?.full_name?.trim().replace(/\s+/g, '.').toLowerCase(),
        profile?.email?.split('@')[0]?.toLowerCase(),
        user?.email?.split('@')[0]?.toLowerCase()
    ].filter(Boolean) as string[];

    const handleLocalSchedule = () => {
        if (isSpaceClosed) {
            showToast('Closed spaces are read-only.', 'error');
            return;
        }
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

    const handleCalendarTaskAction = async (taskId: string, action: 'complete' | 'postpone' | 'open') => {
        if (action === 'open') {
            switchTab('Tasks');
            return;
        }

        if (isSpaceClosed) {
            showToast('Closed spaces are read-only.', 'error');
            return;
        }

        if (!organizationId) return;

        const currentTask = tasks.find((task) => task.id === taskId);
        const updates: Partial<Task> = {};

        if (action === 'complete') {
            updates.status = 'done';
        } else {
            const base = currentTask?.due_date ? new Date(`${currentTask.due_date}T00:00:00`) : new Date();
            base.setDate(base.getDate() + 1);
            const year = base.getFullYear();
            const month = String(base.getMonth() + 1).padStart(2, '0');
            const day = String(base.getDate()).padStart(2, '0');
            updates.due_date = `${year}-${month}-${day}`;
        }

        try {
            const { data, error } = await apiService.updateTask(taskId, updates, organizationId);
            if (error) throw error;
            setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...updates, ...(data || {}) } : task));
            showToast(action === 'complete' ? 'Task completed.' : 'Task postponed.', 'success');
        } catch (err: any) {
            showToast(friendlyError(err?.message || 'Failed to update task'), 'error');
        }
    };

    const handleCalendarMeetingAction = async (meetingId: string, action: 'join' | 'delete' | 'review') => {
        if (action === 'join') {
            onJoin(meetingId);
            return;
        }

        if (action === 'review') {
            navigate(`/spaces/${spaceId}/meetings/${meetingId}/review`);
            return;
        }

        if (!canManageMeetings) {
            showToast('You do not have permission to delete meetings.', 'error');
            return;
        }

        if (window.confirm('Delete this meeting?')) {
            onDeleteMeeting?.(meetingId);
        }
    };

    const effectiveOrgId = organizationId || profile?.organization_id || '';
    const { files, loading: filesLoading, refreshFiles, upsertFile, removeFile } = useRealtimeFiles(space.id, organizationId || '', showTrash);
    const documentFiles = useMemo(() => files.filter((file) => !isImageFile(file)), [files]);
    const tasksLoadingGate = useLoadingScreenGate(tasksLoading);
    const filesLoadingGate = useLoadingScreenGate(filesLoading);
    const {
        messages: dashboardMessages,
        loading: messagingLoading,
        sendMessage: sendDashboardMessage,
        sendFile,
        uploadProgress
    } = useRealtimeMessages(space.id, effectiveOrgId);

    const handleFileUpload = async (file: File) => {
        if (isSpaceClosed) {
            showToast('Closed spaces are read-only.', 'error');
            return false;
        }
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
            showToast('Upload failed - please try again', 'error');
        }

        return result.success;
    };

    const handleDashboardMessageReply = async (message: Message, content: string) => {
        if (isSpaceClosed) {
            showToast('Closed spaces are read-only.', 'error');
            return false;
        }

        const success = await sendDashboardMessage(content, message.channel || 'general', { replyTo: message });
        showToast(success ? 'Reply sent.' : 'Reply failed.', success ? 'success' : 'error');
        return success;
    };

    const handleDashboardMessageRead = async (message: Message) => {
        if (message.senderId === user?.id) return;
        const { error } = await apiService.markMessageRead(message.id);
        if (error) console.warn('[SpaceDetailView] Failed to mark message read:', error);
    };

    const dockItems = [
        { label: 'Overview', icon: LayoutGrid, isActive: activeTab === 'Dashboard', onClick: () => switchTab('Dashboard') },
        { label: 'Chat', icon: Inbox, isActive: activeTab === 'Chat', onClick: () => switchTab('Chat') },
        { label: 'Meetings', icon: Calendar, isActive: activeTab === 'Meetings', onClick: () => switchTab('Meetings') },
        { label: 'Tasks', icon: CheckSquare, isActive: activeTab === 'Tasks', onClick: () => switchTab('Tasks') },
        { label: 'Docs', icon: FolderClosed, isActive: activeTab === 'Docs', onClick: () => switchTab('Docs') },
    ];

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const isThisWeek = (value?: string | null) => {
        if (!value) return false;
        const date = new Date(value);
        return !Number.isNaN(date.getTime()) && date >= weekStart && date <= now;
    };
    const weeklyMeetings = localMeetings.filter((meeting) => isThisWeek(meeting.starts_at || meeting.created_at));
    const weeklyCompletedMeetings = weeklyMeetings.filter((meeting) => meeting.status === 'ended');
    const weeklyTasks = tasks.filter((task) => isThisWeek(task.created_at || task.updated_at || task.due_date));
    const weeklyCompletedTasks = weeklyTasks.filter((task) => task.status === 'done');
    const weeklyFilesShared = files.filter((file) => !file.deleted_at && isThisWeek(file.created_at)).length;
    const userDisplayName = profile?.full_name || user?.email?.split('@')[0] || 'there';
    const weeklyStats = [
        {
            variant: 'donut',
            label: 'Meetings',
            value: `${weeklyCompletedMeetings.length}/${weeklyMeetings.length}`,
            progress: weeklyMeetings.length > 0 ? weeklyCompletedMeetings.length / weeklyMeetings.length : 0,
            tone: '#0D0D0D',
        },
        {
            variant: 'donut',
            label: 'Tasks',
            value: `${weeklyCompletedTasks.length}/${weeklyTasks.length}`,
            progress: weeklyTasks.length > 0 ? weeklyCompletedTasks.length / weeklyTasks.length : 0,
            tone: '#3F3F46',
        },
        {
            variant: 'plain',
            label: 'Files',
            value: `${weeklyFilesShared}`,
        }
    ];

    return (
        <div className={`animate-[fadeIn_0.5s_ease-out] flex w-full min-w-0 flex-col ${activeTab === 'Chat' ? 'h-full min-h-0 gap-2 pb-0' : 'gap-5 pb-20'}`}>
            {/* Navigation Header */}
            <div className="sticky top-3 z-30">
                <div className="mx-auto grid w-fit max-w-[calc(100vw-1rem)] min-w-0 grid-cols-[auto_minmax(0,180px)_auto] items-center gap-2 rounded-[999px] border border-[#E5E5E5] bg-white/95 px-2.5 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)] backdrop-blur sm:max-w-[calc(100vw-1.5rem)] sm:grid-cols-[auto_minmax(0,260px)_auto] md:max-w-[min(920px,calc(100vw-2rem))] md:grid-cols-[auto_minmax(0,360px)_auto] md:px-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <button
                            title="Go Back"
                            type="button"
                            onClick={onBack}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#6E6E80] transition-colors hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                        >
                            <ArrowLeft size={16} />
                        </button>
                        <div className="flex h-9 items-center gap-2 rounded-full bg-[#F7F7F8] px-3 text-xs font-medium text-[#0D0D0D]">
                            <Clock size={14} className="text-[#6E6E80]" />
                            <span>{dateLabel}</span>
                        </div>
                    </div>

                    <div className="min-w-0 text-center">
                        <div className="truncate text-sm font-semibold text-[#0D0D0D] md:text-[15px]">
                            {activeOrganizationName}
                        </div>
                    </div>

                    <div className="relative flex min-w-0 items-center justify-end gap-2">
                        {isClient ? (
                            <>
                        {showContextSwitcher ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsSwitchMenuOpen((open) => !open);
                                    setIsAccountMenuOpen(false);
                                }}
                                className="flex h-9 items-center gap-2 rounded-full border border-[#E5E5E5] bg-white px-2.5 text-xs font-semibold text-[#0D0D0D] transition-colors hover:bg-[#F7F7F8] md:px-3"
                            >
                                <ChevronsUpDown size={14} />
                                <span className="hidden md:inline">Switch</span>
                            </button>
                        ) : null}

                        <button
                            type="button"
                            onClick={() => {
                                setIsSwitchMenuOpen(false);
                                setIsAccountMenuOpen(false);
                                void signOut();
                            }}
                            className="flex h-9 items-center gap-2 rounded-full border border-[#F2D4D1] bg-white px-2.5 text-xs font-semibold text-[#B42318] transition-colors hover:bg-[#FFF4F2] md:px-3"
                            aria-label="Log out"
                        >
                            <LogOut size={14} />
                            <span className="hidden md:inline">Log out</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setIsAccountMenuOpen((open) => !open);
                                setIsSwitchMenuOpen(false);
                            }}
                            className="flex h-9 items-center gap-2 rounded-full border border-[#E5E5E5] bg-white px-1.5 pr-2.5 text-xs font-semibold text-[#0D0D0D] transition-colors hover:bg-[#F7F7F8]"
                            aria-label="Open account menu"
                        >
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0D0D0D] text-[11px] font-semibold text-white">
                                {accountInitials}
                            </span>
                            <span className="hidden max-w-[120px] truncate sm:inline">Account</span>
                        </button>

                        {isSwitchMenuOpen && showContextSwitcher ? (
                            <div className="absolute right-20 top-12 z-50 w-[320px] overflow-hidden rounded-[18px] border border-[#E5E5E5] bg-white shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
                                <div className="border-b border-[#EFEFEF] px-4 py-3">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Choose profile</p>
                                    <p className="mt-1 text-sm font-medium text-[#0D0D0D]">{contextCount} available</p>
                                </div>
                                <div className="max-h-[320px] overflow-y-auto p-2">
                                    {availableContexts.map((context) => {
                                        const isActive =
                                            activeContext?.context_type === context.context_type &&
                                            activeContext?.context_id === context.context_id;
                                        const Icon = context.context_type === 'org' ? Briefcase : User;
                                        const isSwitching = switchingContextId === context.context_id;

                                        return (
                                            <button
                                                key={`${context.context_type}:${context.context_id}`}
                                                type="button"
                                                disabled={switchingContextId !== null}
                                                onClick={() => void handleHeaderContextSwitch(context)}
                                                className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left transition-colors ${
                                                    isActive ? 'bg-[#F2F2F3]' : 'hover:bg-[#F7F7F8]'
                                                } ${switchingContextId !== null ? 'cursor-wait opacity-70' : ''}`}
                                            >
                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E5E5] bg-white">
                                                    <Icon size={16} className="text-[#0D0D0D]" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-semibold text-[#0D0D0D]">
                                                        {getContextDisplayName(context)}
                                                    </span>
                                                    <span className="block truncate text-xs text-[#6E6E80]">
                                                        {isSwitching ? 'Switching...' : getContextSubtitle(context)}
                                                    </span>
                                                </span>
                                                {isActive ? (
                                                    <span className="h-2 w-2 rounded-full bg-[#0D0D0D]" />
                                                ) : null}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}

                        {isAccountMenuOpen ? (
                            <div className="absolute right-0 top-12 z-50 w-[260px] overflow-hidden rounded-[18px] border border-[#E5E5E5] bg-white shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
                                <div className="border-b border-[#EFEFEF] px-4 py-4">
                                    <p className="truncate text-sm font-semibold text-[#0D0D0D]">{accountName}</p>
                                    <p className="mt-1 truncate text-xs text-[#6E6E80]">{user?.email}</p>
                                </div>
                                <div className="p-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsAccountMenuOpen(false);
                                            navigate('/dashboard', { replace: true });
                                        }}
                                        className="flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-sm font-medium text-[#0D0D0D] transition-colors hover:bg-[#F7F7F8]"
                                    >
                                        <Settings size={16} />
                                        Account
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void signOut()}
                                        className="flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-sm font-medium text-[#B42318] transition-colors hover:bg-[#FFF4F2]"
                                    >
                                        <LogOut size={16} />
                                        Log out
                                    </button>
                                </div>
                            </div>
                        ) : null}
                            </>
                        ) : (
                            canManageSpace ? (
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteSpaceModal(true)}
                                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#F2D4D1] bg-white text-[#B42318] transition-colors hover:bg-[#FFF4F2]"
                                    title="Delete space"
                                    aria-label={`Delete ${space.name}`}
                                >
                                    <Trash2 size={15} />
                                </button>
                            ) : null
                        )}
                    </div>
                </div>
            </div>

            {/* Activity Indicators (Task 7) */}
            {activeTab !== 'Chat' && (
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
                            Last active: {spaceStats?.last_activity_at ? new Date(spaceStats.last_activity_at).toLocaleString() : '-'}
                        </span>
                    </>
                )}
            </div>
            )}

            {isSpaceClosed && (
                <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    <div className="flex items-center gap-2 font-semibold">
                        <Lock size={16} />
                        This space is closed.
                    </div>
                    <p className="mt-1">
                        The engagement has formally ended. New uploads, tasks, and meetings are disabled.
                        {space.closure_reason ? ` Reason: ${space.closure_reason}` : ''}
                    </p>
                </div>
            )}

            {/* Content Area */}
            <div className={activeTab === 'Chat' ? 'h-[calc(100vh-166px)] min-h-0' : 'space-y-6'}>
                {activeTab === 'Dashboard' && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {!isClient && (
                            <GlassCard className="h-[340px] overflow-hidden border border-[#E5E5E5] bg-white/95 p-4 sm:p-5 md:col-span-2 xl:col-span-2 xl:col-start-1">
                                <div className="flex h-full flex-col gap-5">
                                    <div className="min-w-0">
                                        <Heading level={2} className="text-[31px] leading-tight tracking-[-0.04em] md:text-[39px]">
                                            {getGreeting()} {userDisplayName}
                                        </Heading>
                                        <Text variant="secondary" className="mt-2 max-w-xl text-[13px] leading-relaxed">
                                            Here's what's been happening this week
                                        </Text>
                                    </div>

                                    <div className="grid min-h-0 flex-1 grid-cols-3 items-center px-3 py-4">
                                        {weeklyStats.map((item, index) => (
                                            <div key={item.label} className="relative flex min-w-0 justify-center px-3">
                                                {index > 0 && (
                                                    <span className="absolute left-0 top-1/2 h-[112px] -translate-y-1/2 border-l border-[#EDEDED]" aria-hidden="true" />
                                                )}
                                                {item.variant === 'donut' ? (
                                                    <DonutStat
                                                        label={item.label}
                                                        value={item.value}
                                                        progress={item.progress}
                                                        tone={item.tone}
                                                    />
                                                ) : (
                                                    <PlainWeeklyStat
                                                        label={item.label}
                                                        value={item.value}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </GlassCard>
                        )}

                        {canManageSpace && !isClient && (
                            <div className="h-[340px] md:col-span-1 xl:col-span-1 xl:col-start-3">
                                <SpacePermissionsMatrix spaceId={space.id} compact className="h-full" />
                            </div>
                        )}

                        <div className={`h-[340px] ${canManageSpace && !isClient ? 'md:col-span-1 xl:col-start-4' : 'md:col-span-1 md:col-start-2 xl:col-start-4'}`}>
                            <SpaceMemberPanel spaceId={space.id} compact className="h-full" />
                        </div>

                        <GlassCard className="ui-card-lane h-[340px] border border-[#E5E5E5] bg-white/95 p-0 md:col-span-1 xl:col-span-1">
                            <div className="space-dashboard-panel-header flex items-center justify-between gap-4 border-b border-[#E5E5E5] px-4 py-3">
                                <div>
                                    <p className="space-dashboard-panel-subtitle uppercase tracking-[0.14em] text-[#6E6E80]">Task flow</p>
                                    <Heading level={3} className="space-dashboard-panel-title mt-0.5">Next tasks</Heading>
                                </div>
                                <span className="space-dashboard-meta-pill rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-3 py-1 text-[#6E6E80]">
                                    {tasks.filter((task) => task.status !== 'done').length} open
                                </span>
                            </div>
                            <div className="ui-card-scroll p-4">
                                {tasksLoadingGate.isVisible ? (
                                    <LoadingScreen
                                        key={tasksLoadingGate.cycleKey}
                                        message="Loading tasks..."
                                        isComplete={tasksLoadingGate.isComplete}
                                        onExitComplete={tasksLoadingGate.handleExitComplete}
                                    />
                                ) : tasks.length > 0 ? (
                                    <div className="grid gap-2">
                                        {tasks.slice(0, 5).map((task) => (
                                            <button
                                                key={task.id}
                                                type="button"
                                                onClick={() => switchTab('Tasks')}
                                                className="space-dashboard-list-row flex items-center justify-between gap-3 rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8]/70 px-3 py-2 text-left hover:bg-white"
                                            >
                                                <div className="min-w-0">
                                                    <p className="space-dashboard-list-name truncate text-[#0D0D0D]">{task.title}</p>
                                                    <p className="mt-0.5 text-xs text-[#6E6E80]">{task.status.replace(/_/g, ' ')}{task.due_date ? ` · ${new Date(task.due_date).toLocaleDateString()}` : ''}</p>
                                                </div>
                                                <span className="space-dashboard-meta-pill rounded-full border border-[#E5E5E5] bg-white px-2 py-0.5 uppercase tracking-[0.12em] text-[#6E6E80]">
                                                    {task.priority || 'normal'}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="rounded-[8px] border border-dashed border-[#E5E5E5] p-4 text-sm text-[#6E6E80]">No tasks yet.</p>
                                )}
                            </div>
                        </GlassCard>

                        {canManageSpace && !isClient && (
                            <div className="h-[340px] md:col-span-1 xl:col-span-1">
                                <InviteMemberCard
                                    spaceId={space.id}
                                    initialClientToken={(space as any).share_link_token || space.invitation_token || null}
                                    compact
                                    className="h-full"
                                />
                            </div>
                        )}

                        <div className="h-[340px] md:col-span-1 xl:col-span-1">
                            <SpaceMessagesCard
                                messages={dashboardMessages}
                                loading={messagingLoading}
                                unreadCount={activityIndicators.unreadCount}
                                currentUserId={user?.id}
                                mentionTokens={dashboardMentionTokens}
                                members={members}
                                className="h-full"
                                onOpenChat={() => switchTab('Chat')}
                                onMarkRead={handleDashboardMessageRead}
                                onSendReply={handleDashboardMessageReply}
                            />
                        </div>

                        <div className="h-[340px] md:col-span-1 xl:col-span-1">
                            <CalendarWidget
                                meetings={localMeetings}
                                tasks={tasks}
                                spaces={[space].filter(Boolean)}
                                defaultSpaceId={space.id}
                                showSpaceFilter={false}
                                showTypeFilter={true}
                                title=""
                                variant="compact"
                                stateKey={`space-overview.${space.id}`}
                                onTaskAction={handleCalendarTaskAction}
                                onMeetingAction={handleCalendarMeetingAction}
                                canDeleteMeetings={canManageMeetings}
                            />
                        </div>

                    </div>
                )}
                {activeTab === 'Chat' && (
                    <div className="h-full min-h-0">
                        <SpaceChatPanel spaceId={space.id} spaceName={space.name} />
                    </div>
                )}
                {activeTab === 'Meetings' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-medium">Space Meetings</h3>
                                <p className="text-xs text-zinc-500">Scheduled and live calls for this workspace.</p>
                            </div>
                            <div className="flex gap-2">
                                {!isSpaceClosed && (permissions ? permissions.schedule_meetings : true) && (
                                    <>
                                        <Button variant="secondary" size="sm" onClick={() => onInstantMeet(space.id)}>
                                            <Video size={14} className="mr-1" /> Meet Now
                                        </Button>
                                        <Button variant="primary" size="sm" onClick={() => setIsScheduleModalOpen(true)}>
                                            <Plus size={14} className="mr-1" /> Schedule
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        {localMeetings.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {localMeetings.map(m => {
    const isEnded = m.status === 'ended' || m.status === 'cancelled';
    return (
        <GlassCard key={m.id} className="ui-card-lane min-h-[156px] max-h-[156px] p-4">
            <div className="ui-card-scroll mb-3 pr-1">
                <div className="flex justify-between items-start">
                    <div className="min-w-0">
                        <p className="font-semibold text-sm truncate max-w-[200px]">{m.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
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
                    <div className="shrink-0 text-right">
                        <p className="text-xs font-bold">{new Date(m.starts_at).toLocaleDateString()}</p>
                        <p className="text-[10px] text-zinc-400">{new Date(m.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                </div>
            </div>
            <div className="flex shrink-0 gap-2 w-full">
                <Button
                    variant={isEnded ? 'outline' : 'primary'}
                    size="sm"
                    className={`flex-1 ${isEnded ? 'text-[#0D0D0D] border-[#E5E5E5] hover:bg-[#F7F7F8]' : ''}`}
                    onClick={() => !isEnded ? onJoin(m.id) : navigate(`/spaces/${spaceId}/meetings/${m.id}/review`)}
                >
                    {isEnded ? 'Review Details' : 'Enter Lobby'}
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
                                <Button className="w-full mt-4" onClick={handleLocalSchedule} disabled={isSpaceClosed}>Schedule for this Space</Button>
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
                                            { id: 'successful', label: 'Successful' },
                                            { id: 'follow_up_needed', label: 'Follow-up' },
                                            { id: 'no_show', label: 'No Show' },
                                            { id: 'inconclusive', label: 'Inconclusive' },
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
                        title="Tasks"
                        subtitle={`List-first work tracking inside ${space.name}.`}
                        allowCreate={!isSpaceClosed && (permissions ? !!permissions.manage_tasks : true)}
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
                                const { data, error } = await apiService.updateTask(taskId, updates, organizationId);
                                if (error) throw error;
                                setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...(data || updates) } : task));
                            } catch (err: any) {
                                showToast(friendlyError(err?.message || 'Failed to update task'), 'error');
                            }
                        }}
                        onArchiveTask={async (taskId) => {
                            try {
                                const { data, error } = await apiService.archiveTask(taskId);
                                if (error) throw error;
                                setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...(data || {}), archived_at: data?.archived_at || new Date().toISOString() } : task));
                                showToast('Task archived.', 'success');
                            } catch (err: any) {
                                showToast(friendlyError(err?.message || 'Failed to archive task'), 'error');
                            }
                        }}
                        onDeleteTask={canDeleteTasks ? async (taskId) => {
                            try {
                                const { error } = await apiService.deleteTask(taskId);
                                if (error) throw error;
                                setTasks((current) => current.filter((task) => task.id !== taskId));
                                showToast('Task deleted.', 'success');
                            } catch (err: any) {
                                showToast(friendlyError(err?.message || 'Failed to delete task'), 'error');
                            }
                        } : undefined}
                        onRequestReview={async (taskId, reviewerId) => {
                            try {
                                const { data, error } = await apiService.requestTaskReview(taskId, reviewerId);
                                if (error) throw error;
                                setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...(data || {}) } : task));
                                showToast('Review requested.', 'success');
                            } catch (err: any) {
                                showToast(friendlyError(err?.message || 'Failed to request review'), 'error');
                            }
                        }}
                        onCompleteReview={async (taskId, approved, comment) => {
                            try {
                                const { data, error } = await apiService.completeTaskReview(taskId, approved, comment);
                                if (error) throw error;
                                setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...(data || {}) } : task));
                                showToast(approved ? 'Task approved.' : 'Task sent back.', 'success');
                            } catch (err: any) {
                                showToast(friendlyError(err?.message || 'Failed to complete review'), 'error');
                            }
                        }}
                        onAddTaskComment={async (taskId, content) => {
                            try {
                                const { data, error } = await apiService.addTaskComment(taskId, content);
                                if (error) throw error;
                                if (data) setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...(data as Task) } : task));
                                showToast('Comment added.', 'success');
                                return data as Task | undefined;
                            } catch (err: any) {
                                showToast(friendlyError(err?.message || 'Failed to add comment'), 'error');
                                return undefined;
                            }
                        }}
                    />
                )}
                {activeTab === 'Docs' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Heading level={2}>{showTrash ? 'Trash' : 'Documents'}</Heading>
                            <div className="flex gap-2">
                                {(permissions ? permissions.delete_own_files : true) && (
                                    <Button variant="ghost" onClick={() => setShowTrash(!showTrash)} className={showTrash ? 'text-rose-500 bg-rose-50' : ''}>
                                        <Trash2 size={16} className="mr-1" /> {showTrash ? 'Exit Trash' : 'Trash'}
                                    </Button>
                                )}
                                {!isSpaceClosed && (permissions ? permissions.upload_files : true) && (
                                    <Button size="sm" onClick={() => setIsUploadModalOpen(true)}>
                                        <Upload size={16} className="mr-1" /> Upload
                                    </Button>
                                )}
                            </div>
                        </div>

                        {filesLoadingGate.isVisible ? (
                            <LoadingScreen
                                key={filesLoadingGate.cycleKey}
                                message="Loading documents..."
                                isComplete={filesLoadingGate.isComplete}
                                onExitComplete={filesLoadingGate.handleExitComplete}
                            />
                        ) : documentFiles.length === 0 ? (
                            <GlassCard className="p-12 flex flex-col items-center justify-center text-center">
                                <FileText size={48} className="text-zinc-200 mb-4" />
                                <Heading level={3} className="text-zinc-400">{showTrash ? 'Trash is empty' : 'No documents yet'}</Heading>
                                <Text variant="secondary" className="max-w-xs mt-2">
                                    {showTrash ? 'Files you moved to trash will appear here for 30 days.' : 'Upload documents to share them securely with this client.'}
                                </Text>
                            </GlassCard>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {documentFiles.map(file => (
                                    <GlassCard key={file.id} className="p-4 flex justify-between items-center group hover:border-zinc-300 transition-all shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400">
                                                {getDocumentIcon(file, 20)}
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
                                                    {file.file_size ? `${(file.file_size / (1024 * 1024)).toFixed(2)} MB` : 'Size unknown'} - {new Date(file.created_at).toLocaleDateString()}
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
                                                    {(permissions ? permissions.download_files : true) && (
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
                                                    )}
                                                    {(permissions ? permissions.upload_files : true) && (
                                                        <button
                                                            type="button"
                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#6E6E80] shadow-sm transition-all hover:border-[#E5E5E5] hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                                                            onClick={() => setVersioningFile(file as any)}
                                                            title="Version History"
                                                            aria-label={`View version history for ${file.name}`}
                                                        >
                                                            <History size={16} />
                                                        </button>
                                                    )}
                                                    {(permissions ? permissions.delete_own_files : true) && (
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
                                                    )}
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
                                                    {(permissions ? permissions.delete_own_files : true) && (
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
                                                    )}
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
                loading={messagingLoading}
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

            <SurfaceDock items={dockItems} />
        </div>
    );
};
export default SpaceDetailView;
