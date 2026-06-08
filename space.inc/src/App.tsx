import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';
import LoginPage from './views/LoginPage';
import SignupPage from './views/SignupPage';
import { apiService } from './services/apiService';
import {
    LayoutGrid,
    Users,
    Inbox,
    UserCheck,
    Briefcase,
    CheckSquare,
    Calendar,
    FolderClosed,
    Activity,
    Bell,
    Video,
    Shield,
    X,
    ArrowLeft,
    Building2,
    UserCircle,
    Clock,
    ChevronsUpDown,
    Settings,
    LogOut,
    Moon,
    Sun
} from 'lucide-react';
import {
    Button,
    Heading,
    Text,
    GlassCard,
    LoadingScreen,
    useLoadingScreenGate
} from './components/UI/index';
import { FileViewerModal } from './components/FileViewerModal';
import { FileUploadModal } from './components/FileUploadModal';
import {
    ClientSpace, ViewState, Meeting, Message, StaffMember, Task, SpaceFile, ChartData, ClientLifecycle
} from './types';
import { supabase } from './lib/supabase';
import { friendlyError } from './utils/errors';

// Shared Layouts
import { AppLayout } from './components/Layout';
import ScrollProgressPill from './components/ScrollProgressPill';
import { VeroMark } from './components/brand/VeroLogo';

// View Components
import StaffDashboardView from './components/views/StaffDashboardView';
import OwnerDashboardView from './components/views/OwnerDashboardView';
import SpacesView from './components/views/SpacesView';
import ClientsCRMView from './components/views/ClientsCRMView';
import StaffView from './components/views/StaffView';
import SpaceDetailView from './components/views/SpaceDetailView';
import GlobalMeetingsView from './components/views/GlobalMeetingsView';
import MeetingReviewPage from './components/views/MeetingReviewPage';
import { usePermissions } from "./hooks/usePermissions";
import TaskView from './components/views/TaskView';
import GlobalFilesView from './components/views/GlobalFilesView';
import SettingsView, { BillingSettingsView } from './components/views/SettingsView';
import InboxView from './components/views/InboxView';
import HistoryView from './components/views/HistoryView';
import ClientPortalView from './components/views/ClientPortalView';
import { MeetingRoom } from './components/MeetingRoom';
import { Routes, Route, useNavigate, Navigate, useParams } from 'react-router-dom';
import ClientSpaceRoute from './components/views/ClientSpaceRoute';
import { PermissionGuard } from "./components/auth/PermissionGuard";
import { ContextSwitcher } from './components/auth/ContextSwitcher';
import { InvitePage } from './components/invite/InvitePage';
import { JoinPage } from './components/invite/JoinPage';
import { SpaceMembersPage } from './components/invite/SpaceMembersPage';
import { supabase as _supabase } from './lib/supabase';
import { getWorkspaceRoleLabel } from './lib/workspaceRoles';
import { getAvailableContexts, getContextRoute } from './lib/contextReadiness';
import type { UserContext } from './types/context';

type SpaceDetailTab = 'Dashboard' | 'Chat' | 'Meetings' | 'Tasks' | 'Docs';

const ErrorView = ({ message }: { message: string }) => (
    <div className="h-screen w-full flex items-center justify-center bg-[#FFFFFF] p-4">
        <GlassCard className="max-w-md w-full p-8 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8]">
                <Shield className="text-[#0D0D0D]" size={32} />
            </div>
            <Heading level={2} className="mb-2">Access Denied</Heading>
            <Text className="mb-8 text-[#6E6E80]">{message}</Text>
            <Button variant="primary" className="w-full" onClick={() => window.location.assign('/')}>Return to Login</Button>
        </GlassCard>
    </div>
);

const PendingSpaceView = () => (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 font-sans">
        <div className="max-w-md w-full text-center space-y-6">
            <div className="h-20 w-20 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto">
                <VeroMark className="h-12 w-12 opacity-40" />
            </div>
            <div className="space-y-2">
                <h1 className="text-2xl font-black tracking-tight text-zinc-900">
                    Your space isn't ready yet
                </h1>
                <p className="text-zinc-500 text-sm leading-relaxed">
                    Your workspace is being set up. You'll receive access as soon as the invitation is activated.
                </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
                <div className="h-2 w-2 bg-amber-400 rounded-full animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                    Pending activation
                </span>
            </div>
        </div>
    </div>
);

const LegacyClientSpaceRedirect = () => {
    const { spaceId } = useParams<{ spaceId: string }>();
    return <Navigate to={spaceId ? `/spaces/${spaceId}` : '/dashboard'} replace />;
};

const resolveClientRoute = (route?: string | null, contextId?: string | null) => {
    return route || (contextId ? `/spaces/${contextId}` : null);
};

const getContextDisplayName = (context: UserContext) => {
    return context.context_type === 'org' ? context.org_name : context.space_name;
};

const getContextSubtitle = (context: UserContext) => {
    if (context.context_type === 'org') {
        return `${getWorkspaceRoleLabel(context.context_role)} role`;
    }

    return `${context.org_name} - Client profile`;
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

// ── Client Space Picker ─────────────────────────────────────────────────
// Shown on /dashboard when a client has multiple space memberships.
const ClientSpacePicker: React.FC = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [spaces, setSpaces] = useState<Array<{ space_id: string; space_name: string }>>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        const load = async () => {
            try {
                const { data } = await _supabase
                    .from('space_memberships')
                    .select('space_id, spaces(name)')
                    .eq('profile_id', user.id)
                    .eq('status', 'active');
                if (data) {
                    setSpaces(data.map((m: any) => ({ space_id: m.space_id, space_name: m.spaces?.name || 'Untitled Space' })));
                }
            } catch (err) {
                console.error('[ClientSpacePicker] Error loading spaces:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user]);

    const clientSpacePickerLoadingGate = useLoadingScreenGate(loading);

    if (clientSpacePickerLoadingGate.isVisible) {
        return (
            <LoadingScreen
                key={clientSpacePickerLoadingGate.cycleKey}
                message="Loading your spaces..."
                isComplete={clientSpacePickerLoadingGate.isComplete}
                onExitComplete={clientSpacePickerLoadingGate.handleExitComplete}
            />
        );
    }

    return (
        <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center p-6 font-sans">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center space-y-2">
                    <div className="h-12 w-12 bg-black rounded-[8px] flex items-center justify-center text-white mx-auto mb-4">
                        <VeroMark tone="light" className="h-8 w-8" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight text-[#0D0D0D]">Your Spaces</h1>
                    <p className="text-[#6E6E80] text-sm">Select a workspace to continue</p>
                </div>
                <div className="space-y-3">
                    {spaces.map(s => (
                        <button
                            key={s.space_id}
                            onClick={() => navigate(`/spaces/${s.space_id}`, { replace: true })}
                            className="w-full rounded-[8px] border border-[#E5E5E5] bg-white p-4 text-left hover:bg-[#F7F7F8] transition-all"
                        >
                            <span className="font-medium text-sm text-[#0D0D0D]">{s.space_name}</span>
                        </button>
                    ))}
                </div>
                <div className="text-center pt-4">
                    <button onClick={signOut} className="text-xs text-[#6E6E80] hover:text-[#0D0D0D] font-semibold uppercase tracking-widest transition-colors">Sign Out</button>
                </div>
            </div>
        </div>
    );
};

const App = () => {
    const {
        user,
        profile,
        loading,
        userRole,
        organizationId,
        can,
        signOut,
        contexts,
        activeContext,
        setActiveContext,
        refreshContexts,
        refreshCapabilities
    } = useAuth();
    const { showToast, removeToast } = useToast();
    const navigate = useNavigate();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(() => new Date());
    const [isSwitchMenuOpen, setIsSwitchMenuOpen] = useState(false);
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
    const [switchingContextId, setSwitchingContextId] = useState<string | null>(null);
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window === 'undefined') return 'light';
        return window.localStorage.getItem('space-theme') === 'dark' ? 'dark' : 'light';
    });

    // Sidebar/View State
    const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
    const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
    const [selectedSpaceTab, setSelectedSpaceTab] = useState<SpaceDetailTab>('Dashboard');
    const { permissions, role: permissionRole, isLoading: permissionsLoading } = usePermissions(selectedSpaceId || undefined);
    const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
    const [activeMeetingRoomUrl, setActiveMeetingRoomUrl] = useState<string | null>(null);
    const [meetingEntrySource, setMeetingEntrySource] = useState<{ view: ViewState; spaceId?: string } | null>(null);
    // Data State
    const [clients, setClients] = useState<ClientSpace[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [files, setFiles] = useState<SpaceFile[]>([]); // although unused in App.tsx routing now, kept for state sync if needed
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [clientLifecycle, setClientLifecycle] = useState<ClientLifecycle[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [inboxData, setInboxData] = useState<any[]>([]);

    const [isInstantMeetingModalOpen, setIsInstantMeetingModalOpen] = useState(false);
    const [instantMeetingTargetSpace, setInstantMeetingTargetSpace] = useState<string | null>(null);
    const [instantMeetingTitle, setInstantMeetingTitle] = useState('Instant Meeting');
    const [instantMeetingCategory, setInstantMeetingCategory] = useState<string>('general');

    const openSpace = (spaceId: string, tab: SpaceDetailTab = 'Dashboard') => {
        setSelectedSpaceId(spaceId);
        setSelectedSpaceTab(tab);
        setCurrentView(ViewState.SPACE_DETAIL);
    };

    useEffect(() => {
        if (user && !loading) {
            setIsAuthenticated(true);
        } else {
            setIsAuthenticated(false);
        }
    }, [user, loading]);

    useEffect(() => {
        const timer = window.setInterval(() => setCurrentTime(new Date()), 30000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        document.documentElement.dataset.theme = theme;
        window.localStorage.setItem('space-theme', theme);
    }, [theme]);

    // ── Client role redirect ─────────────────────────────────────────────────
    // If the backend has already selected a client-space context, send the user
    // there immediately. Otherwise keep the dashboard/picker/pending flow intact.
    useEffect(() => {
        if (loading || !user || !userRole) return;
        if (userRole !== 'client') return;

        const pathname = window.location.pathname;
        // Only auto-redirect on /dashboard or /
        if (pathname !== '/dashboard' && pathname !== '/') return;
        // Don't redirect if already on a space route
        if (pathname.startsWith('/spaces/')) return;

        const clientRoute =
            activeContext?.context_type === 'client_space'
                ? resolveClientRoute(activeContext.route, activeContext.context_id)
                : null;

        if (clientRoute) {
            navigate(clientRoute, { replace: true });
            return;
        }

        if (contexts?.routing === 'onboarding') {
            navigate('/spaces/pending', { replace: true });
        }
    }, [loading, user, userRole, activeContext, contexts, navigate]);

    useEffect(() => {
        // Clients use route-level data loading and should not be blocked by
        // the org-wide dashboard preload gate.
        if (isAuthenticated && userRole === 'client') {
            setIsInitialLoading(false);
            return;
        }
        if (isAuthenticated && organizationId) {
            // Skip full data fetch for clients — they only need their own space data
            if (userRole === 'client') return;
            fetchData();
        } else if (!loading && !user) {
            // If we're not loading and there's no user, we're on the login/signup page
            setIsInitialLoading(false);
        }
    }, [isAuthenticated, organizationId, loading, user, userRole]);

    useEffect(() => {
        if (!user || !profile) return;

        const channel = supabase
            .channel(`notifications:${user.id}`)
            .on(
                'broadcast',
                { event: 'new_notification' },
                (payload) => {
                    const { message, severity } = payload.payload;
                    showToast(message, severity === 'critical' ? 'error' : 'info');
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, profile, showToast]);

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
                console.warn('[App] Background context refresh failed:', syncError);
            });
        } catch (err: any) {
            showToast(err?.message || 'Could not switch account right now.', 'error');
            setSwitchingContextId(null);
        }
    }, [navigate, refreshCapabilities, refreshContexts, setActiveContext, showToast]);

    const fetchData = async (silent = false) => {
        if (!user || !organizationId) {
            if (!silent && !loading && !user) setIsInitialLoading(false);
            return;
        }
        
        if (!silent) setIsInitialLoading(true);
        try {
            // Phase 1: Critical UI Data (Spaces, Tasks, Meetings)
            // We fetch these first to get the main dashboard ready
            const [spacesRes, tasksRes, meetingsRes] = await Promise.all([
                apiService.getSpaces(organizationId),
                apiService.getTasks(organizationId),
                apiService.getMeetings(organizationId)
            ]);

            if (spacesRes.data) setClients(spacesRes.data);
            if (tasksRes.data) setTasks(tasksRes.data);
            if (meetingsRes.data) setMeetings(meetingsRes.data);

            // Phase 2: Peripheral Data (Staff, Lifecycle, Logs, Inbox)
            // We use allSettled so that if one (like the heavy Unified Inbox or Logs) fails or is slow,
            // the rest of the app still functions.
            const peripheralResults = await Promise.allSettled([
                apiService.getStaffMembers(organizationId),
                apiService.getClientLifecycle(organizationId),
                apiService.getActivityLogs(organizationId),
                apiService.getUnifiedInbox(organizationId)
            ]);

            // Handle results individually
            if (peripheralResults[0].status === 'fulfilled') setStaff(peripheralResults[0].value as StaffMember[]);
            if (peripheralResults[1].status === 'fulfilled') setClientLifecycle(peripheralResults[1].value as ClientLifecycle[]);
            
            const logsRes = peripheralResults[2];
            if (logsRes.status === 'fulfilled' && (logsRes.value as any).data) {
                setLogs((logsRes.value as any).data);
            }

            if (peripheralResults[3].status === 'fulfilled') {
                setInboxData(peripheralResults[3].value as any[]);
            }

        } catch (error) {
            console.error("[App] Critical error fetching system data:", error);
            showToast("Failed to sync some data. Please check your connection.", "error");
        } finally {
            setIsInitialLoading(false);
        }
    };

    const handleJoinMeeting = (meetingId: string) => {
        // Find the meeting to determine which space it belongs to
        const meeting = meetings.find(m => m.id === meetingId);
        
        // Track where user joined from before entering meeting
        if (currentView === ViewState.SPACE_DETAIL) {
            // User is already in a space detail view
            setMeetingEntrySource({ 
                view: currentView, 
                spaceId: selectedSpaceId 
            });
        } else if (meeting && currentView === ViewState.MEETINGS) {
            // User joined from global meetings, redirect to this space's meetings tab
            setMeetingEntrySource({ 
                view: ViewState.SPACE_DETAIL, 
                spaceId: meeting.space_id 
            });
        } else {
            // Default case - redirect to current view
            setMeetingEntrySource({ 
                view: currentView, 
                spaceId: currentView === 'SPACE_DETAIL' as ViewState ? selectedSpaceId : undefined 
            });
        }
        
        setActiveMeetingId(meetingId);
    };

    const handleUpdateStaffCapability = async (staffId: string, spaceId: string, allowed: boolean) => {
        try {
            await apiService.updateStaffCapability(staffId, spaceId, allowed);
            showToast("Capability updated successfully.", "success");
            fetchData(true);
        } catch (err: any) {
            showToast(`Error updating capability: ${err.message}`, "error");
        }
    };

    const handleCreateSpace = async (data: any) => {
        const loadingId = showToast("Creating your space...", "loading");
        try {
            const { data: newSpace, error } = await apiService.createSpace(
                data.name || 'New Client',
                `Workspace for ${data.name || 'New Client'}`,
                organizationId || '',
                data.modules,
                data.metadata
            );

            if (error) throw error;
            if (newSpace) {
                // Handle both direct response and nested response structures
                const spaceData = newSpace.space || newSpace;
                const createdSpaceId = spaceData.id || newSpace.id || newSpace;
                let invitationToken = spaceData.invitation_token || spaceData.share_link_token;

                if (!invitationToken && createdSpaceId && organizationId) {
                    const { data: hydratedSpace } = await apiService.getSpaceById(createdSpaceId, organizationId);
                    invitationToken = hydratedSpace?.invitation_token;
                    if (invitationToken) {
                        setClients(prev =>
                            prev.map(space =>
                                space.id === createdSpaceId
                                    ? { ...space, invitation_token: invitationToken }
                                    : space
                            )
                        );
                    }
                }
                
                const optimisticSpace: any = {
                    id: createdSpaceId,
                    name: data.name || 'New Client',
                    description: `Workspace for ${data.name || 'New Client'}`,
                    status: 'active',
                    role: 'owner',
                    permission_level: 'principal',
                    message_count: 0,
                    file_count: 0,
                    meeting_count: 0,
                    member_count: 0,
                    last_activity_at: new Date().toISOString(),
                    organization_id: organizationId || profile?.organization_id || '',
                    visibility: 'organization',
                    metadata: data.metadata ?? {},
                    invitation_token: invitationToken,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                setClients(prev => [optimisticSpace as ClientSpace, ...prev]);
                openSpace(optimisticSpace.id, 'Dashboard');
                fetchData();
                showToast("Space Created Successfully!", "success");
                
                // Show invite URL immediately after creation
                if (invitationToken) {
                    const inviteUrl = `${window.location.origin}/join/${invitationToken}`;
                    setTimeout(() => {
                        navigator.clipboard.writeText(inviteUrl);
                        showToast("Invite link copied to clipboard!", "success");
                    }, 1000);
                }
            }
        } catch (err: any) {
            showToast(`Error creating space: ${err.message}`, "error");
        } finally {
            removeToast(loadingId);
        }
    };

    const handleCreateTask = async (data: Partial<Task>) => {
        try {
            const { data: newTask, error } = await apiService.createTask(data, organizationId || '');
            if (error) throw error;
            if (newTask) setTasks((current) => [newTask, ...current]);
        } catch (err: any) {
            showToast(`Error creating task: ${err.message}`, "error");
        }
    };

    const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
        try {
            const { data, error } = await apiService.updateTask(taskId, updates, organizationId || '');
            if (error) throw error;
            setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...(data || updates) } : task));
        } catch (err: any) {
            showToast(`Error updating task: ${err.message}`, "error");
        }
    };

    const handleArchiveTask = async (taskId: string) => {
        try {
            const { data, error } = await apiService.archiveTask(taskId);
            if (error) throw error;
            setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...(data || {}), archived_at: data?.archived_at || new Date().toISOString() } : task));
            showToast('Task archived.', 'success');
        } catch (err: any) {
            showToast(`Error archiving task: ${err.message}`, 'error');
        }
    };

    const handleRequestTaskReview = async (taskId: string, reviewerId: string) => {
        try {
            const { data, error } = await apiService.requestTaskReview(taskId, reviewerId);
            if (error) throw error;
            setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...(data || {}) } : task));
            showToast('Review requested.', 'success');
        } catch (err: any) {
            showToast(`Error requesting review: ${err.message}`, 'error');
        }
    };

    const handleCompleteTaskReview = async (taskId: string, approved: boolean, comment?: string) => {
        try {
            const { data, error } = await apiService.completeTaskReview(taskId, approved, comment);
            if (error) throw error;
            setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...(data || {}) } : task));
            showToast(approved ? 'Task approved.' : 'Task sent back.', 'success');
        } catch (err: any) {
            showToast(`Error completing review: ${err.message}`, 'error');
        }
    };

    const handleAddTaskComment = async (taskId: string, content: string) => {
        try {
            const { data, error } = await apiService.addTaskComment(taskId, content);
            if (error) throw error;
            if (data) setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...data } : task));
            showToast('Comment added.', 'success');
            return data as Task | undefined;
        } catch (err: any) {
            showToast(`Error adding comment: ${err.message}`, 'error');
            return undefined;
        }
    };

    const handleInstantMeeting = async (spaceId?: string, title?: string) => {
        try {
            const targetSpace = spaceId || instantMeetingTargetSpace || (clients.length > 0 ? clients[0].id : '');
            if (!targetSpace) {
                showToast('Please select a space first or create one.', 'info');
                return;
            }
            if (!title && !isInstantMeetingModalOpen) {
                setInstantMeetingTargetSpace(targetSpace);
                setIsInstantMeetingModalOpen(true);
                return;
            }

            const { data, error } = await apiService.createInstantMeeting({
                space_id: targetSpace,
                title: title || instantMeetingTitle || 'Instant Meeting',
                recording_enabled: true,
                category: instantMeetingCategory
            });

            if (error) {
                showToast(friendlyError(error?.message || String(error)), 'error');
                return;
            }

            // data = { meeting: {...}, roomUrl: "https://..." }
            if (data?.meeting?.id) {
                setActiveMeetingId(data.meeting.id);
                setActiveMeetingRoomUrl(data.roomUrl || data.meeting?.daily_room_url || null);
                setIsInstantMeetingModalOpen(false);
                fetchData(true);
            } else {
                showToast('Meeting created but no ID returned', 'error');
                console.error('[handleInstantMeeting] Unexpected response shape:', data);
            }
        } catch (err) {
            console.error('[handleInstantMeeting] failed:', err);
            showToast('Failed to create meeting', 'error');
        }
    };

    const handleDeleteMeeting = async (meetingId: string) => {
        // Optimistic removal — no reload needed
        setMeetings(prev => prev.filter(m => m.id !== meetingId));
        try {
            const { error } = await apiService.cancelMeeting(meetingId);
            if (error) {
                // Revert optimistic update on error
                fetchData(true);
                showToast('Failed to delete meeting. Please try again.', 'error');
            } else {
                showToast('Meeting deleted.', 'success');
            }
        } catch (err: any) {
            fetchData(true);
            showToast(friendlyError(err?.message || 'Failed to delete meeting'), 'error');
        }
    };

    const handleEndMeeting = async (meetingId: string, outcome: string, notes: string) => {
        try {
            const { error } = await apiService.endMeetingByStaff(meetingId, outcome, notes);
            if (error) throw error;
            showToast('Meeting ended successfully.', 'success');
            fetchData(true);
        } catch (err: any) {
            showToast(friendlyError(err?.message || 'Failed to end meeting'), 'error');
        }
    };

    const handleScheduleMeeting = async (data: any) => {
        try {
            const { data: newMeeting, error } = await apiService.scheduleMeeting({
                space_id: data.space_id,
                title: data.title || 'Scheduled Meeting',
                starts_at: `${data.date}T${data.time}:00Z`,
                description: data.description,
                recording_enabled: data.recording_enabled,
                category: data.category || 'general'
            });
            if (error) throw error;
            if (newMeeting) {
                setMeetings([newMeeting, ...meetings]);
                fetchData(true);
            }
        } catch (err: any) {
            showToast(friendlyError(err?.message || String(err)), "error");
        }
    };

    const renderContent = () => {
        // Sub-view rendering governed by identity first, then capabilities
        switch (currentView) {
case ViewState.DASHBOARD:
                if (permissions ? (permissions._role === 'owner' || permissions._role === 'admin') : (userRole === 'owner' || userRole === 'admin')) {
                    return (
                        <OwnerDashboardView
                            clients={clients}
                            staff={staff}
                            clientLifecycle={clientLifecycle}
                            messages={[]}
                            meetings={meetings}
                            tasks={tasks}
                            files={files}
                            profile={profile}
                            onJoin={handleJoinMeeting}
                            onInstantMeet={() => handleInstantMeeting(clients[0]?.id)}
                            onCreateSpace={handleCreateSpace}
                            onScheduleMeeting={handleScheduleMeeting}
                            onCreateTask={handleCreateTask}
                            onUpdateTask={handleUpdateTask}
                            onRequestReview={handleRequestTaskReview}
                            onCompleteReview={handleCompleteTaskReview}
                            onAddTaskComment={handleAddTaskComment}
                            onGoToSpaces={() => setCurrentView(ViewState.SPACES)}
                            onGoToClients={() => setCurrentView(ViewState.CLIENTS)}
                            onGoToStaff={() => setCurrentView(ViewState.STAFF)}
                            onGoToMeetings={() => setCurrentView(ViewState.MEETINGS)}
                            onGoToFiles={() => setCurrentView(ViewState.FILES)}
                            onGoToTasks={() => setCurrentView(ViewState.TASKS)}
                            onRefreshData={() => fetchData(true)}
                            onGoToSpace={(spaceId) => {
                                openSpace(spaceId, 'Dashboard');
                            }}
                        />
                    );
                }
                if (permissions ? (permissions._role === 'staff') : (userRole === 'staff')) {
                    return (
                        <StaffDashboardView
                            clients={clients}
                            messages={[]}
                            meetings={meetings}
                            tasks={tasks}
                            profile={profile}
                            onJoin={handleJoinMeeting}
                            onInstantMeet={() => handleInstantMeeting(clients[0]?.id)}
                            onCreateTask={handleCreateTask}
                            onUpdateTask={handleUpdateTask}
                            onRequestReview={handleRequestTaskReview}
                            onCompleteReview={handleCompleteTaskReview}
                            onAddTaskComment={handleAddTaskComment}
                            onGoToSpace={(spaceId) => {
                                openSpace(spaceId, 'Dashboard');
                            }}
                        />
                    );
                }
                if (userRole === 'client') {
                    const currentClient = clients[0];
                    if (!currentClient) return <div className="p-8">Loading Portal...</div>;
                    return <ClientPortalView client={currentClient} meetings={meetings} onJoin={handleJoinMeeting} onLogout={signOut} />;
                }
                return <ErrorView message="No dashboard available for this identity." />;
            case ViewState.ACTIVITY_LEDGER:
                if (!can('can_view_history')) return <div className="p-8">Access Denied</div>;
                return <HistoryView logs={logs} />;
            case ViewState.SPACES:
                if (!can('can_view_all_spaces')) return <div className="p-8">Access Denied</div>;
                return <SpacesView clients={clients} onSelect={(id) => openSpace(id, 'Dashboard')} onCreate={handleCreateSpace} />;
            case ViewState.SPACE_DETAIL:
                return <SpaceDetailView spaceId={selectedSpaceId!} space={clients.find(c => c.id === selectedSpaceId)} meetings={meetings} onBack={() => setCurrentView(ViewState.SPACES)} onJoin={handleJoinMeeting} onSchedule={handleScheduleMeeting} onInstantMeet={handleInstantMeeting} onEndMeeting={handleEndMeeting} activeTab={selectedSpaceTab} onTabChange={setSelectedSpaceTab} />;
            case ViewState.INBOX:
                if (!can('can_view_dashboard')) return <div className="p-8">Access Denied</div>;
                return <InboxView clients={clients} inboxData={inboxData} />;
            case ViewState.CLIENTS:
                if (!can('owner') && !can('admin')) return <div className="p-8">Access Denied</div>;
                // Use clientLifecycle data for now - this shows all clients across the organization
                // In the future, this could be enhanced to show space-specific client data
                return (
                    <ClientsCRMView
                        clients={clientLifecycle}
                        loading={false}
                        onCreateSpace={() => setCurrentView(ViewState.SPACES)}
                        onInvitePerson={() => setCurrentView(ViewState.STAFF)}
                    />
                );
case ViewState.STAFF:
                if (permissions ? !permissions.manage_team : !can('can_manage_team')) return <div className="p-8">Access Denied</div>;
                return <StaffView staff={staff} spaces={clients} onUpdateCapability={handleUpdateStaffCapability} onRefresh={fetchData} />;
            case ViewState.TASKS:
                if (permissions ? !permissions.view_tasks : !can('can_view_tasks')) return <div className="p-8">Access Denied</div>;
                return <TaskView tasks={tasks} clients={clients} onUpdateTask={handleUpdateTask} onCreateTask={handleCreateTask} onArchiveTask={handleArchiveTask} onRequestReview={handleRequestTaskReview} onCompleteReview={handleCompleteTaskReview} onAddTaskComment={handleAddTaskComment} onOpenSpace={(spaceId) => {
                    openSpace(spaceId, 'Dashboard');
                }} />;
            case ViewState.MEETINGS:
                if (permissions ? !permissions.view_meetings : !can('can_view_meetings')) return <div className="p-8">Access Denied</div>;
                return <GlobalMeetingsView meetings={meetings} clients={clients} onSchedule={handleScheduleMeeting} onJoin={handleJoinMeeting} onInstantMeet={handleInstantMeeting} onOpenSpace={(spaceId) => { openSpace(spaceId, 'Meetings'); }} onDeleteMeeting={handleDeleteMeeting} onEndMeeting={handleEndMeeting} tasks={tasks} />;
            case ViewState.FILES:
                if (permissions ? !permissions.view_files : !can('can_view_files')) return <div className="p-8">Access Denied</div>;
                return <GlobalFilesView clients={clients} profile={profile} />;
            case ViewState.SETTINGS:
                if (permissions ? (!permissions.manage_spaces && !permissions.manage_team) : !can('can_view_settings')) return <div className="p-8">Access Denied</div>;
                return <SettingsView />;
            default:
                return <div className="p-8">View Not Found</div>;
        }
    };

    const isAppLoading = loading || (isAuthenticated && userRole !== 'client' && isInitialLoading && clients.length === 0);
    const appLoadingGate = useLoadingScreenGate(isAppLoading);

    if (appLoadingGate.isVisible) {
        return (
            <LoadingScreen
                key={appLoadingGate.cycleKey}
                message="Loading Vero..."
                isComplete={appLoadingGate.isComplete}
                onExitComplete={appLoadingGate.handleExitComplete}
            />
        );
    }

    const totalInboxItems = inboxData.reduce((acc, curr) => acc + (curr.unread_count || 0), 0);
    const currentViewLabelMap: Record<ViewState, string> = {
        [ViewState.DASHBOARD]: 'Dashboard',
        [ViewState.SPACES]: 'Spaces',
        [ViewState.SPACE_DETAIL]: 'Space Detail',
        [ViewState.INBOX]: 'Inbox',
        [ViewState.MEETINGS]: 'Calendar',
        [ViewState.FILES]: 'Drive',
        [ViewState.TASKS]: 'Tasks',
        [ViewState.STAFF]: 'Team',
        [ViewState.SETTINGS]: 'Settings',
        [ViewState.ACTIVITY_LEDGER]: 'History',
        [ViewState.CLIENTS]: 'Clients',
    };
    const currentViewLabel = currentViewLabelMap[currentView] || 'Workspace';
    const roleLabel = getWorkspaceRoleLabel(permissionRole || userRole);
    const availableContexts = getAvailableContexts(contexts);
    const contextCount = contexts?.available?.count ?? contexts?.total ?? availableContexts.length;
    const isTeamContext = ['owner', 'admin', 'staff'].includes(userRole || '');
    const showSwitchAccount = isTeamContext && contextCount >= 2;
    const activeOrganizationName =
        activeContext?.org_name ||
        contexts?.org_contexts?.[0]?.org_name ||
        contexts?.client_contexts?.[0]?.org_name ||
        profile?.organization_name ||
        'Organization';
    const accountName = profile?.full_name || user?.email || 'Account';
    const accountInitials = getProfileInitials(profile?.full_name, user?.email);
    const timeLabel = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const dockItems = currentView === ViewState.SPACE_DETAIL ? [
        {
            label: 'Back',
            icon: ArrowLeft,
            allowed: true,
            isActive: false,
            onClick: () => setCurrentView(ViewState.SPACES),
        },
        {
            label: 'Overview',
            icon: LayoutGrid,
            allowed: true,
            isActive: selectedSpaceTab === 'Dashboard',
            onClick: () => setSelectedSpaceTab('Dashboard'),
        },
        {
            label: 'Chat',
            icon: Inbox,
            allowed: true,
            isActive: selectedSpaceTab === 'Chat',
            onClick: () => setSelectedSpaceTab('Chat'),
        },
        {
            label: 'Meetings',
            icon: Calendar,
            allowed: true,
            isActive: selectedSpaceTab === 'Meetings',
            onClick: () => setSelectedSpaceTab('Meetings'),
        },
        {
            label: 'Tasks',
            icon: CheckSquare,
            allowed: true,
            isActive: selectedSpaceTab === 'Tasks',
            onClick: () => setSelectedSpaceTab('Tasks'),
        },
        {
            label: 'Docs',
            icon: FolderClosed,
            allowed: true,
            isActive: selectedSpaceTab === 'Docs',
            onClick: () => setSelectedSpaceTab('Docs'),
        },
    ] : [
        {
            label: 'Dashboard',
            icon: LayoutGrid,
            allowed: permissions ? !!permissions.view_dashboard : can('can_view_dashboard'),
            isActive: currentView === ViewState.DASHBOARD,
            onClick: () => setCurrentView(ViewState.DASHBOARD),
        },
        {
            label: 'History',
            icon: Activity,
            allowed: permissions ? !!permissions.view_history : can('can_view_history'),
            isActive: currentView === ViewState.ACTIVITY_LEDGER,
            onClick: () => setCurrentView(ViewState.ACTIVITY_LEDGER),
        },
        {
            label: 'Spaces',
            icon: Users,
            allowed: permissions ? (!!permissions.view_all_spaces || !!permissions.view_assigned_spaces) : (can('can_view_all_spaces') || can('can_view_assigned_spaces')),
            isActive: currentView === ViewState.SPACES,
            onClick: () => setCurrentView(ViewState.SPACES),
        },
        {
            label: 'Inbox',
            icon: Inbox,
            allowed: permissions ? !!permissions.view_dashboard : can('can_view_dashboard'),
            isActive: currentView === ViewState.INBOX,
            onClick: () => setCurrentView(ViewState.INBOX),
            badge: totalInboxItems,
        },
        {
            label: 'Team',
            icon: UserCheck,
            allowed: permissions ? !!permissions.manage_team : can('can_manage_team'),
            isActive: currentView === ViewState.STAFF,
            onClick: () => setCurrentView(ViewState.STAFF),
        },
        {
            label: 'Clients',
            icon: Briefcase,
            allowed: permissions ? !!permissions.view_all_spaces : (userRole === 'owner' || userRole === 'admin'),
            isActive: currentView === ViewState.CLIENTS,
            onClick: () => setCurrentView(ViewState.CLIENTS),
        },
        {
            label: 'Tasks',
            icon: CheckSquare,
            allowed: permissions ? !!permissions.view_tasks : can('can_view_tasks'),
            isActive: currentView === ViewState.TASKS,
            onClick: () => setCurrentView(ViewState.TASKS),
        },
        {
            label: 'Calendar',
            icon: Calendar,
            allowed: permissions ? !!permissions.view_meetings : can('can_view_meetings'),
            isActive: currentView === ViewState.MEETINGS,
            onClick: () => setCurrentView(ViewState.MEETINGS),
        },
        {
            label: 'Drive',
            icon: FolderClosed,
            allowed: permissions ? !!permissions.view_files : can('can_view_files'),
            isActive: currentView === ViewState.FILES,
            onClick: () => setCurrentView(ViewState.FILES),
        },
    ].filter((item) => item.allowed);

    return (
        <Routes>
            <Route path="/join/:token" element={<JoinPage />} />
            <Route path="/invite/:token" element={<InvitePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/spaces/pending" element={<PendingSpaceView />} />
            <Route path="/spaces/:spaceId/meetings/:meetingId/review" element={<MeetingReviewPage />} />
            <Route path="/spaces/:spaceId/settings" element={
                <PermissionGuard requiredPermission="manage_spaces">
                    <SettingsView />
                </PermissionGuard>
            } />
            <Route path="/spaces/:spaceId/members" element={!isAuthenticated ? <LoginPage /> : <SpaceMembersPage />} />
            <Route path="/spaces/:spaceId" element={<ClientSpaceRoute />} />
            <Route path="/client/space/:spaceId" element={<LegacyClientSpaceRedirect />} />

<Route path="/org/settings/billing" element={<BillingSettingsView />} />
            <Route path="/org/settings/team" element={
                <PermissionGuard requiredPermission="manage_team">
                    <StaffView staff={staff} spaces={clients} onUpdateCapability={handleUpdateStaffCapability} onRefresh={fetchData} />
                </PermissionGuard>
            } />
            <Route path="/dashboard" element={
                (() => {
                    if (!isAuthenticated) return <LoginPage />;
                    if (contexts?.routing === 'switcher' && !activeContext) return <ContextSwitcher />;
                    if (activeContext?.context_type === 'client_space') {
                        return <Navigate to={resolveClientRoute(activeContext.route, activeContext.context_id) || '/spaces/pending'} replace />;
                    }

                    if (userRole === 'client') {
                        // ── Client dashboard ──────────────────────────────────
                        // Single membership → redirect handled by useEffect above
                        // Multiple memberships → show space picker
                        return <ClientSpacePicker />;
                    }

                    return (
                        <>
                            <button
                                type="button"
                                onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
                                className="fixed right-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#0D0D0D] shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-colors hover:bg-[#F7F7F8] md:right-5 md:top-4"
                                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                            >
                                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                            </button>
                            <AppLayout sidebar={null}>
                                <div className="flex min-h-screen flex-1 flex-col">
                                    {currentView !== ViewState.SPACE_DETAIL ? (
                                        <header className="sticky top-0 z-30 px-2 pt-2 sm:px-3 sm:pt-3 md:px-4 md:pt-4">
                                            <div className="mx-auto grid w-fit max-w-[calc(100vw-1rem)] min-w-0 grid-cols-[auto_minmax(0,180px)_auto] items-center gap-2 rounded-[999px] border border-[#E5E5E5] bg-white/95 px-2.5 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)] backdrop-blur sm:max-w-[calc(100vw-1.5rem)] sm:grid-cols-[auto_minmax(0,260px)_auto] md:max-w-[min(920px,calc(100vw-2rem))] md:grid-cols-[auto_minmax(0,360px)_auto] md:px-3">
                                                <div className="flex min-w-0 items-center justify-start">
                                                    <div className="flex h-9 items-center gap-2 rounded-full bg-[#F7F7F8] px-3 text-xs font-medium text-[#0D0D0D]">
                                                        <Clock size={14} className="text-[#6E6E80]" />
                                                        <span className="tabular-nums">{timeLabel}</span>
                                                    </div>
                                                </div>

                                                <div className="min-w-0 text-center">
                                                    <div className="truncate text-sm font-semibold text-[#0D0D0D] md:text-[15px]">
                                                        {activeOrganizationName}
                                                    </div>
                                                    <div className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-[#6E6E80] sm:block">
                                                        {currentViewLabel}
                                                    </div>
                                                </div>

                                                <div className="relative flex min-w-0 items-center justify-end gap-2">
                                                {showSwitchAccount ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsSwitchMenuOpen((open) => !open);
                                                            setIsAccountMenuOpen(false);
                                                        }}
                                                        className="flex h-9 items-center gap-2 rounded-full border border-[#E5E5E5] bg-white px-2.5 text-xs font-semibold text-[#0D0D0D] transition-colors hover:bg-[#F7F7F8] md:px-3"
                                                    >
                                                        <ChevronsUpDown size={14} />
                                                        <span className="hidden md:inline">Switch to another account</span>
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
                                                    <span className="hidden max-w-[120px] truncate sm:inline">{roleLabel}</span>
                                                </button>

                                                {isSwitchMenuOpen && showSwitchAccount ? (
                                                    <div className="absolute right-11 top-12 z-50 w-[320px] overflow-hidden rounded-[18px] border border-[#E5E5E5] bg-white shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
                                                        <div className="border-b border-[#EFEFEF] px-4 py-3">
                                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Choose profile</p>
                                                            <p className="mt-1 text-sm font-medium text-[#0D0D0D]">{contextCount} available</p>
                                                        </div>
                                                        <div className="max-h-[320px] overflow-y-auto p-2">
                                                            {availableContexts.map((context) => {
                                                                const isActive =
                                                                    activeContext?.context_type === context.context_type &&
                                                                    activeContext?.context_id === context.context_id;
                                                                const Icon = context.context_type === 'org' ? Building2 : UserCircle;
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
                                                                    setCurrentView(ViewState.SETTINGS);
                                                                    setIsAccountMenuOpen(false);
                                                                }}
                                                                className="flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-sm font-medium text-[#0D0D0D] transition-colors hover:bg-[#F7F7F8]"
                                                            >
                                                                <Settings size={16} />
                                                                Account settings
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => void signOut()}
                                                                className="flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-sm font-medium text-[#B42318] transition-colors hover:bg-[#FFF4F2]"
                                                            >
                                                                <LogOut size={16} />
                                                                Sign out
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : null}
                                                </div>
                                            </div>
                                        </header>
                                    ) : null}
                                    <div
                                        data-scroll-root="app"
                                        className={currentView === ViewState.SPACE_DETAIL && selectedSpaceTab === 'Chat'
                                        ? 'flex-1 overflow-hidden px-2 pb-2 pt-2 sm:px-3 md:px-4'
                                        : 'flex-1 overflow-y-auto px-2 pb-20 pt-3 sm:px-3 md:px-4 md:pb-24 md:pt-4'
                                    }>
                                        <div className={currentView === ViewState.SPACE_DETAIL && selectedSpaceTab === 'Chat' ? 'h-full w-full min-w-0' : 'w-full min-w-0'}>{renderContent()}</div>
                                    </div>
                                    <ScrollProgressPill />
                                    {currentView !== ViewState.SPACE_DETAIL ? (
                                    <nav className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 md:bottom-8">
                                        <div className="dock-shell dock-enter flex max-w-[calc(100vw-2rem)] items-center gap-2 overflow-x-auto rounded-[999px] px-2 py-2">
                                            {dockItems.map((item, index) => {
                                                const Icon = item.icon;
                                                return (
                                                    <button
                                                        key={item.label}
                                                        aria-label={item.label}
                                                        onClick={item.onClick}
                                                        style={{ animationDelay: `${index * 20}ms` }}
                                                        className={`group relative flex h-10 shrink-0 items-center overflow-hidden border transition-[width,background-color,border-color,color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.98] ${
                                                            item.isActive
                                                                ? 'dock-morph-enter w-[108px] justify-start rounded-[999px] border-[#DADADA] bg-[#F7F7F8] px-3.5 text-[#0D0D0D]'
                                                                : 'w-10 justify-center rounded-full border-transparent bg-transparent px-0 text-[#6E6E80] hover:border-[#DADADA] hover:bg-[#F7F7F8] hover:text-[#0D0D0D]'
                                                        }`}
                                                    >
                                                        <Icon size={16} className="shrink-0" />
                                                        <span className={`dock-tab-label ml-1.5 whitespace-nowrap text-[11px] font-medium ${item.isActive ? 'opacity-100' : 'w-0 overflow-hidden opacity-0'}`}>
                                                            {item.label}
                                                        </span>
                                                        {item.badge ? (
                                                                <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-1.5 py-0.5 text-[10px] font-semibold text-[#6E6E80]">
                                                                {item.badge}
                                                            </span>
                                                        ) : null}
                                                        <span className="tooltip-enter pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-[#DADADA] bg-white px-2.5 py-1 text-[11px] font-medium text-[#0D0D0D] shadow-[0_1px_3px_rgba(0,0,0,0.06)] group-hover:block">
                                                            {item.label}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </nav>
                                    ) : null}
                                </div>
                            </AppLayout>

                            {activeMeetingId && (
                                <MeetingRoom 
                                    meetingId={activeMeetingId}
                                    roomUrl={activeMeetingRoomUrl}
                                    onLeave={() => { 
                // Redirect user back to where they came from
                if (meetingEntrySource) {
                    if (meetingEntrySource.spaceId) {
                        openSpace(meetingEntrySource.spaceId, 'Meetings');
                    } else {
                        setCurrentView(meetingEntrySource.view);
                    }
                    setMeetingEntrySource(null);
                }
                setActiveMeetingId(null); 
                setActiveMeetingRoomUrl(null); 
            }}
                                />
                            )}

                            {isInstantMeetingModalOpen && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4">
                                    <GlassCard className="max-w-md w-full p-8 relative">
                                        <button title="Close" onClick={() => setIsInstantMeetingModalOpen(false)} className="absolute right-4 top-4 rounded-[6px] border border-[#E5E5E5] bg-white p-2 text-[#6E6E80]"><X size={18} /></button>
                                        <Heading level={2} className="mb-6 flex items-center gap-2"><Video className="text-[#6E6E80]" /> Instant Meeting</Heading>
                                        <input placeholder="Meeting Title" value={instantMeetingTitle} onChange={(e) => setInstantMeetingTitle(e.target.value)} className="mb-6 w-full rounded-[8px] border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#0D0D0D]" />
                        <div className="mb-6">
                            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6E6E80] mb-2 ml-1">Category</label>
                            <select
                                title="Meeting Category"
                                value={instantMeetingCategory}
                                onChange={(e) => setInstantMeetingCategory(e.target.value)}
                                className="w-full rounded-[8px] border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#0D0D0D] focus:outline-none"
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
                                        <div className="flex gap-3">
                                            <Button variant="ghost" className="flex-1 uppercase text-[10px] font-black tracking-widest" onClick={() => setIsInstantMeetingModalOpen(false)}>Cancel</Button>
                                            <Button variant="primary" className="flex-1 uppercase text-[10px] font-black tracking-widest" onClick={() => handleInstantMeeting(instantMeetingTargetSpace!, instantMeetingTitle)}>Create</Button>
                                        </div>
                                    </GlassCard>
                                </div>
                            )}

                        </>
                    );
                })()
            } />
            <Route path="*" element={
                !isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" replace />
            } />
        </Routes>
    );
};

export default App;
