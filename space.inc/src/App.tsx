import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';
import LoginPage from './views/LoginPage';
import SignupPage from './views/SignupPage';
import { apiService } from './services/apiService';
import {
    ChevronRight,
    Rocket,
    LayoutGrid,
    MessageSquare,
    FileText,
    Settings,
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
    FileVideo,
    X,
    Search,
    Copy,
    Key
} from 'lucide-react';
import {
    Button,
    Heading,
    Text,
    GlassCard,
    SkeletonLoader,
    SkeletonText,
    SkeletonCard
} from './components/UI/index';
import { FileViewerModal } from './components/FileViewerModal';
import { FileUploadModal } from './components/FileUploadModal';
import { InvitationsManagementView } from './components/views/InvitationsManagementView';
import {
    ClientSpace, ViewState, Meeting, Message, StaffMember, Task, SpaceFile, ChartData, ClientLifecycle, Invitation
} from './types';
import { supabase } from './lib/supabase';
import { friendlyError } from './utils/errors';

// Shared Layouts
import { AppLayout } from './components/Layout';

// View Components
import StaffDashboardView from './components/views/StaffDashboardView';
import OwnerDashboardView from './components/views/OwnerDashboardView';
import SpacesView from './components/views/SpacesView';
import ClientsCRMView from './components/views/ClientsCRMView';
import StaffView from './components/views/StaffView';
import SpaceDetailView from './components/views/SpaceDetailView';
import GlobalMeetingsView from './components/views/GlobalMeetingsView';
import MeetingReviewPage from './components/views/MeetingReviewPage';
import TaskView from './components/views/TaskView';
import GlobalFilesView from './components/views/GlobalFilesView';
import SettingsView from './components/views/SettingsView';
import InboxView from './components/views/InboxView';
import HistoryView from './components/views/HistoryView';
import ClientPortalView from './components/views/ClientPortalView';
import { InviteStaffModal } from './components/views/InviteStaffModal';
import { MeetingRoom } from './components/MeetingRoom';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import JoinView from './components/views/JoinView';
import AcceptInviteView from './components/views/AcceptInviteView';
import { NotificationBell } from './components/NotificationBell';
import ClientSpaceRoute from './components/views/ClientSpaceRoute';
import { supabase as _supabase } from './lib/supabase';

const ErrorView = ({ message }: { message: string }) => (
    <div className="h-screen w-full flex items-center justify-center bg-zinc-50 p-4">
        <GlassCard className="max-w-md w-full p-8 text-center border-red-100 shadow-xl">
            <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="text-red-500" size={32} />
            </div>
            <Heading level={2} className="text-zinc-900 mb-2">Access Denied</Heading>
            <Text className="text-zinc-500 mb-8">{message}</Text>
            <Button variant="primary" className="w-full" onClick={() => window.location.assign('/')}>Return to Login</Button>
        </GlassCard>
    </div>
);

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

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center animate-pulse">
                <div className="text-center space-y-3">
                    <div className="h-10 w-10 bg-zinc-100 rounded-xl mx-auto" />
                    <div className="h-4 w-32 bg-zinc-100 rounded mx-auto" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 font-sans">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center space-y-2">
                    <div className="h-12 w-12 bg-zinc-900 rounded-xl flex items-center justify-center text-white mx-auto mb-4">
                        <Rocket size={24} />
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-zinc-900">Your Spaces</h1>
                    <p className="text-zinc-500 text-sm">Select a workspace to continue</p>
                </div>
                <div className="space-y-3">
                    {spaces.map(s => (
                        <button
                            key={s.space_id}
                            onClick={() => navigate(`/spaces/${s.space_id}`, { replace: true })}
                            className="w-full p-4 bg-white border border-zinc-200 rounded-xl text-left hover:border-zinc-400 hover:shadow-sm transition-all"
                        >
                            <span className="font-bold text-sm text-zinc-900">{s.space_name}</span>
                        </button>
                    ))}
                </div>
                <div className="text-center pt-4">
                    <button onClick={signOut} className="text-xs text-zinc-400 hover:text-zinc-900 font-bold uppercase tracking-widest transition-colors">Sign Out</button>
                </div>
            </div>
        </div>
    );
};

const App = () => {
    const { user, profile, loading, userRole, organizationId, can, signOut } = useAuth();
    const { showToast, removeToast } = useToast();
    const navigate = useNavigate();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    // Sidebar/View State
    const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
    const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
    const [activeSpaceTab, setActiveSpaceTab] = useState<string>("Dashboard");
    const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
    const [activeMeetingRoomUrl, setActiveMeetingRoomUrl] = useState<string | null>(null);
    const [meetingEntrySource, setMeetingEntrySource] = useState<{ view: ViewState; spaceId?: string } | null>(null);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [lastInviteData, setLastInviteData] = useState<{ link: string | null, email: string, status?: string, invite_id?: string } | null>(null);
    const [copiedLink, setCopiedLink] = useState(false);
    const [isMenuTransitioning, setIsMenuTransitioning] = useState(false);

    useEffect(() => {
        setIsMenuTransitioning(true);
        const timer = setTimeout(() => setIsMenuTransitioning(false), 400);
        return () => clearTimeout(timer);
    }, [currentView, selectedSpaceId]);

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

    useEffect(() => {
        if (user && !loading) {
            setIsAuthenticated(true);
        } else {
            setIsAuthenticated(false);
        }
    }, [user, loading]);

    // ── Client role redirect ─────────────────────────────────────────────────
    // After auth resolves: if the user is a client on /dashboard or /,
    // look up their active space memberships and redirect accordingly.
    // Single membership → /spaces/:id; Multiple → space picker; None → holding.
    useEffect(() => {
        if (loading || !user || !userRole) return;
        if (userRole !== 'client') return;

        const pathname = window.location.pathname;
        // Only auto-redirect on /dashboard or /
        if (pathname !== '/dashboard' && pathname !== '/') return;
        // Don't redirect if already on a space route
        if (pathname.startsWith('/spaces/')) return;

        const redirectClient = async () => {
            try {
                const { data: memberships } = await _supabase
                    .from('space_memberships')
                    .select('space_id')
                    .eq('profile_id', user.id)
                    .eq('status', 'active');

                if (memberships && memberships.length === 1) {
                    navigate(`/spaces/${memberships[0].space_id}`, { replace: true });
                } else if (memberships && memberships.length > 1) {
                    // Multiple memberships — stay on /dashboard, picker will show
                } else {
                    navigate('/spaces/pending', { replace: true });
                }
            } catch {
                navigate('/spaces/pending', { replace: true });
            }
        };

        redirectClient();
    }, [loading, user, userRole]);

    useEffect(() => {
        // Clients use route-level data loading and should not be blocked by
        // the org-wide dashboard preload gate.
        if (isAuthenticated && userRole === 'client') {
            setIsInitialLoading(false);
            return;
        }
        if (isAuthenticated && organizationId) {
            console.log('[App] Auth and Tenant ready, initiating data fetch...');
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

    const fetchData = async (silent = false) => {
        if (!user || !organizationId) {
            if (!silent && !loading && !user) setIsInitialLoading(false);
            return;
        }
        
        if (!silent) setIsInitialLoading(true);
        const startTime = Date.now();
        console.log('[App] Fetching organization data for:', organizationId);

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

            console.log(`[App] Data fetch completed in ${Date.now() - startTime}ms`);
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
                organizationId || ''
            );

            if (error) throw error;
            if (newSpace) {
                // Handle both direct response and nested response structures
                const spaceData = newSpace.space || newSpace;
                const invitationToken = spaceData.invitation_token;
                
                const optimisticSpace: any = {
                    id: spaceData.id || newSpace.id || newSpace,
                    name: data.name || 'New Client',
                    description: `Workspace for ${data.name || 'New Client'}`,
                    status: 'active',
                    role: 'client',
                    permission_level: 'principal',
                    message_count: 0,
                    file_count: 0,
                    meeting_count: 0,
                    member_count: 0,
                    last_activity_at: new Date().toISOString(),
                    organization_id: profile?.organization_id || '',
                    invitation_token: invitationToken,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                setClients(prev => [optimisticSpace as ClientSpace, ...prev]);
                setSelectedSpaceId(optimisticSpace.id);
                setCurrentView(ViewState.SPACE_DETAIL);
                fetchData();
                showToast("Space Created Successfully!", "success");
                
                // Show invite URL immediately after creation
                if (invitationToken) {
                    const inviteUrl = `https://app.space.inc/join/${invitationToken}`;
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
            const { error } = await apiService.updateTask(taskId, updates, organizationId || '');
            if (error) throw error;
            setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...updates } : task));
        } catch (err: any) {
            showToast(`Error updating task: ${err.message}`, "error");
        }
    };
    const handleTaskStatusUpdate = async (taskId: string, newStatus: Task['status'], beforeId?: string | null, afterId?: string | null) => {
        try {
            // 1. Update status if changed
            const task = tasks.find(t => t.id === taskId);
            if (task && task.status !== newStatus) {
                const { error } = await apiService.updateTask(taskId, { status: newStatus });
                if (error) throw error;
            }

            // 2. Perform reordering via RPC
            const { error: reorderError } = await apiService.reorderTask(taskId, beforeId, afterId);
            if (reorderError) throw reorderError;

            // 3. Refresh tasks (using listTasks if a space is selected, otherwise getTasks)
            const { data: updatedTasks, error: fetchError } = selectedSpaceId
                ? await apiService.listTasks(selectedSpaceId)
                : await apiService.getTasks(organizationId || '');

            if (fetchError) throw fetchError;
            if (updatedTasks) setTasks(updatedTasks);

        } catch (err: any) {
            showToast(`Error updating task: ${err.message}`, "error");
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
                if (userRole === 'owner' || userRole === 'admin') {
                    return (
                        <OwnerDashboardView
                            clients={clients}
                            messages={[]}
                            meetings={meetings}
                            tasks={tasks}
                            profile={profile}
                            onJoin={handleJoinMeeting}
                            onInstantMeet={() => handleInstantMeeting(clients[0]?.id)}
                            onCreateTask={handleCreateTask}
                            onUpdateTask={handleUpdateTask}
                            onGoToSpace={(spaceId) => {
                                setSelectedSpaceId(spaceId);
                                setCurrentView(ViewState.SPACE_DETAIL);
                            }}
                        />
                    );
                }
                if (userRole === 'staff') {
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
                            onGoToSpace={(spaceId) => {
                                setSelectedSpaceId(spaceId);
                                setCurrentView(ViewState.SPACE_DETAIL);
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
                return <SpacesView clients={clients} onSelect={(id) => { setSelectedSpaceId(id); setCurrentView(ViewState.SPACE_DETAIL); }} onCreate={handleCreateSpace} />;
            case ViewState.SPACE_DETAIL:
                return <SpaceDetailView activeTab={activeSpaceTab} onTabChange={setActiveSpaceTab} spaceId={selectedSpaceId!} space={clients.find(c => c.id === selectedSpaceId)} meetings={meetings} onBack={() => setCurrentView(ViewState.SPACES)} onJoin={handleJoinMeeting} onSchedule={handleScheduleMeeting} onInstantMeet={handleInstantMeeting} onEndMeeting={handleEndMeeting} />;
            case ViewState.INBOX:
                if (!can('can_view_dashboard')) return <div className="p-8">Access Denied</div>;
                return <InboxView clients={clients} inboxData={inboxData} />;
            case ViewState.CLIENTS:
                if (!can('owner') && !can('admin')) return <div className="p-8">Access Denied</div>;
                // Use clientLifecycle data for now - this shows all clients across the organization
                // In the future, this could be enhanced to show space-specific client data
                return <ClientsCRMView clients={clientLifecycle} loading={isInitialLoading} />;
            case ViewState.STAFF:
                if (!can('can_manage_team')) return <div className="p-8">Access Denied</div>;
                return <StaffView staff={staff} spaces={clients} onInvite={() => setShowInviteModal(true)} onUpdateCapability={handleUpdateStaffCapability} onRefresh={fetchData} />;
            case ViewState.TASKS:
                if (!can('can_view_tasks')) return <div className="p-8">Access Denied</div>;
                return <TaskView tasks={tasks} clients={clients} onUpdateTask={handleUpdateTask} onCreateTask={handleCreateTask} onOpenSpace={(spaceId) => {
                    setSelectedSpaceId(spaceId);
                    setCurrentView(ViewState.SPACE_DETAIL);
                }} />;
            case ViewState.MEETINGS:
                if (!can('can_view_meetings')) return <div className="p-8">Access Denied</div>;
                return <GlobalMeetingsView meetings={meetings} clients={clients} onSchedule={handleScheduleMeeting} onJoin={handleJoinMeeting} onInstantMeet={handleInstantMeeting} onDeleteMeeting={handleDeleteMeeting} onEndMeeting={handleEndMeeting} tasks={tasks} />;
            case ViewState.FILES:
                if (!can('can_view_files')) return <div className="p-8">Access Denied</div>;
                return <GlobalFilesView clients={clients} profile={profile} />;
            case ViewState.SETTINGS:
                if (!can('can_view_settings')) return <div className="p-8">Access Denied</div>;
                return <SettingsView />;
            case ViewState.INVITATIONS:
                if (!can('can_manage_team')) return <div className="p-8">Access Denied</div>;
                return <InvitationsManagementView />;
            default:
                return <div className="p-8">View Not Found</div>;
        }
    };

    // Only show full-screen skeleton on the very first load if we have no data yet
    if (loading || (isAuthenticated && userRole !== 'client' && isInitialLoading && clients.length === 0)) {
        return (
            <div className="flex h-screen w-full bg-white font-sans animate-pulse">
                <aside className="w-64 bg-[#ECECF1] border-r border-[#D1D5DB] flex flex-col justify-between p-4 z-20">
                    <div className="space-y-8">
                        <div className="flex items-center gap-3 px-3 mb-8 mt-2">
                            <div className="h-8 w-8 bg-zinc-200 rounded-md"></div>
                            <div className="h-5 w-24 bg-zinc-200 rounded"></div>
                        </div>
                        <div className="space-y-3 px-2">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="h-10 bg-white/50 border border-zinc-100 rounded-md w-full"></div>
                            ))}
                        </div>
                    </div>
                </aside>
                <main className="flex-1 bg-zinc-50/30 p-8 flex flex-col">
                    <header className="h-16 border-b border-zinc-100 flex items-center justify-between px-8 bg-white/50 -mx-8 -mt-8 mb-8">
                        <div className="h-4 w-48 bg-zinc-100 rounded"></div>
                    </header>
                    <div className="max-w-7xl mx-auto w-full space-y-8">
                        <div className="flex justify-between items-end">
                            <div className="space-y-2">
                                <div className="h-10 w-64 bg-zinc-200 rounded-lg"></div>
                                <div className="h-4 w-96 bg-zinc-100 rounded"></div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-48 bg-white border border-zinc-100 rounded-2xl shadow-sm"></div>
                            ))}
                        </div>
                    </div>
                </main>
            </div>
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
        [ViewState.INVITATIONS]: 'Invitations',
    };
    const currentViewLabel = currentViewLabelMap[currentView] || 'Workspace';

    const dockItems = [
        {
            label: 'Dashboard',
            icon: LayoutGrid,
    MessageSquare,
    FileText,
    Settings,
            allowed: can('can_view_dashboard'),
            isActive: currentView === ViewState.DASHBOARD,
            onClick: () => setCurrentView(ViewState.DASHBOARD),
        },
        {
            label: 'History',
            icon: Activity,
            allowed: can('can_view_history'),
            isActive: currentView === ViewState.ACTIVITY_LEDGER,
            onClick: () => setCurrentView(ViewState.ACTIVITY_LEDGER),
        },
        {
            label: 'Spaces',
            icon: Users,
            allowed: can('can_view_all_spaces') || can('can_view_assigned_spaces'),
            isActive: currentView === ViewState.SPACES || currentView === ViewState.SPACE_DETAIL,
            onClick: () => setCurrentView(ViewState.SPACES),
        },
        {
            label: 'Inbox',
            icon: Inbox,
            allowed: can('can_view_dashboard'),
            isActive: currentView === ViewState.INBOX,
            onClick: () => setCurrentView(ViewState.INBOX),
            badge: totalInboxItems,
        },
        {
            label: 'Team',
            icon: UserCheck,
            allowed: can('can_manage_team'),
            isActive: currentView === ViewState.STAFF,
            onClick: () => setCurrentView(ViewState.STAFF),
        },
        {
            label: 'Invites',
            icon: Key,
            allowed: can('can_manage_team'),
            isActive: currentView === ViewState.INVITATIONS,
            onClick: () => setCurrentView(ViewState.INVITATIONS),
        },
        {
            label: 'Clients',
            icon: Briefcase,
            allowed: userRole === 'owner' || userRole === 'admin',
            isActive: currentView === ViewState.CLIENTS,
            onClick: () => setCurrentView(ViewState.CLIENTS),
        },
        {
            label: 'Tasks',
            icon: CheckSquare,
            allowed: can('can_view_tasks'),
            isActive: currentView === ViewState.TASKS,
            onClick: () => setCurrentView(ViewState.TASKS),
        },
        {
            label: 'Calendar',
            icon: Calendar,
            allowed: can('can_view_meetings'),
            isActive: currentView === ViewState.MEETINGS,
            onClick: () => setCurrentView(ViewState.MEETINGS),
        },
        {
            label: 'Drive',
            icon: FolderClosed,
            allowed: can('can_view_files'),
            isActive: currentView === ViewState.FILES,
            onClick: () => setCurrentView(ViewState.FILES),
        },
    ].filter((item) => item.allowed);

    return (
        <Routes>
            <Route path="/join/:token" element={<JoinView />} />
            <Route path="/accept-invite" element={<AcceptInviteView />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/spaces/:spaceId/meetings/:meetingId/review" element={<MeetingReviewPage />} />

            {/* ── Client-only route ─────────────────────────────────────────
                Locked: ClientSpaceRoute enforces role === 'client' internally.
                Staff/owner/admin hitting this URL are redirected back to /.
            ─────────────────────────────────────────────────────────────── */}
            <Route path="/spaces/:spaceId" element={<ClientSpaceRoute />} />
            <Route path="/spaces/pending" element={<ClientSpaceRoute />} />
            <Route path="/dashboard" element={
                (() => {
                    if (!isAuthenticated) {
                        return <LoginPage />;
                    }

                    if (userRole === 'client') {
                        // ── Client dashboard ──────────────────────────────────
                        // Single membership → redirect handled by useEffect above
                        // Multiple memberships → show space picker
                        return <ClientSpacePicker />;
                    }

                    return (
                        <>
                            <AppLayout>
                                <div className="flex min-h-screen flex-1 flex-col">
                                    <div className="flex-1 overflow-y-auto px-4 pb-36 pt-6 md:px-8 md:pb-40 md:pt-8 transition-colors duration-300">
                                        <div className="mx-auto max-w-7xl">{renderContent()}</div>
                                    </div>

                                    <div className="dock-container">
                                        <div className={`menu-pill ${isMenuTransitioning ? 'condensed' : ''}`}>
                                            {(currentView === ViewState.SPACE_DETAIL ? [
                                                { label: 'Dashboard', icon: LayoutGrid, isActive: activeSpaceTab === 'Dashboard', onClick: () => setActiveSpaceTab('Dashboard') },
                                                { label: 'Chat', icon: MessageSquare, isActive: activeSpaceTab === 'Chat', onClick: () => setActiveSpaceTab('Chat') },
                                                { label: 'Meeting', icon: Video, isActive: activeSpaceTab === 'Meetings', onClick: () => setActiveSpaceTab('Meetings') },
                                                { label: 'Task', icon: CheckSquare, isActive: activeSpaceTab === 'Tasks', onClick: () => setActiveSpaceTab('Tasks') },
                                                { label: 'Docs', icon: FileText, isActive: activeSpaceTab === 'Docs', onClick: () => setActiveSpaceTab('Docs') },
                                                { label: 'Exit', icon: X, onClick: () => setCurrentView(ViewState.DASHBOARD) }
                                            ] : [
                                                { label: 'Dashboard', icon: LayoutGrid, isActive: currentView === ViewState.DASHBOARD, onClick: () => setCurrentView(ViewState.DASHBOARD) },
                                                { label: 'Spaces', icon: Briefcase, isActive: currentView === ViewState.SPACES, onClick: () => setCurrentView(ViewState.SPACES) },
                                                { label: 'Meetings', icon: Calendar, isActive: currentView === ViewState.MEETINGS, onClick: () => setCurrentView(ViewState.MEETINGS) },
                                                { label: 'Tasks', icon: CheckSquare, isActive: currentView === ViewState.TASKS, onClick: () => setCurrentView(ViewState.TASKS) },
                                                { label: 'Files', icon: FolderClosed, isActive: currentView === ViewState.FILES, onClick: () => setCurrentView(ViewState.FILES) },
                                                { label: 'Settings', icon: Settings, isActive: currentView === ViewState.SETTINGS, onClick: () => setCurrentView(ViewState.SETTINGS) }
                                            ]).map((item: any) => {
                                                const Icon = item.icon;
                                                if (isMenuTransitioning) return null;
                                                return (
                                                    <button
                                                        key={item.label}
                                                        onClick={() => {
                                                            if (item.onClick) item.onClick();
                                                        }}
                                                        className={`menu-item ${item.isActive ? 'active' : ''}`}
                                                    >
                                                        <Icon size={20} />
                                                        <span className="tooltip">{item.label}</span>
                                                    </button>
                                                );
                                            })}
                                            {isMenuTransitioning && (
                                                <div className="flex items-center justify-center w-12 h-12">
                                                    <div className="w-2 h-2 bg-zinc-400 rounded-full animate-pulse" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="fixed top-6 right-6 z-50 flex items-center gap-4">
                                        <NotificationBell />
                                        <button
                                            onClick={() => setCurrentView(ViewState.SETTINGS)}
                                            className="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm"
                                        >
                                            {profile?.avatar_url ? (
                                                <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                                            ) : (
                                                <span className="text-xs font-bold">{profile?.full_name?.substring(0, 2).toUpperCase() || 'US'}</span>
                                            )}
                                        </button>
                                    </div>
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
                        setSelectedSpaceId(meetingEntrySource.spaceId);
                        setCurrentView(ViewState.SPACE_DETAIL);
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
                                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                                    <GlassCard className="max-w-md w-full p-8 relative">
                                        <button title="Close" onClick={() => setIsInstantMeetingModalOpen(false)} className="absolute right-4 top-4 p-2 rounded-full"><X size={18} /></button>
                                        <Heading level={2} className="mb-6 flex items-center gap-2 uppercase tracking-tighter"><Video className="text-emerald-500" /> Instant Meeting</Heading>
                                        <input placeholder="Meeting Title" value={instantMeetingTitle} onChange={(e) => setInstantMeetingTitle(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 text-sm mb-6" />
                        <div className="mb-6">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 ml-1">Category</label>
                            <select
                                title="Meeting Category"
                                value={instantMeetingCategory}
                                onChange={(e) => setInstantMeetingCategory(e.target.value)}
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 text-sm focus:outline-none"
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

                            {showInviteModal && lastInviteData && (
                                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                                    <GlassCard className="max-w-md w-full p-10 text-center relative overflow-hidden">
                                        <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner border border-emerald-100/50">
                                            <Rocket className="text-emerald-500" size={40} />
                                        </div>
                                        <h2 className="text-3xl font-extrabold mb-2 tracking-tight text-zinc-900 uppercase">Space Ready!</h2>
                                        <p className="text-zinc-500 mb-8 font-light leading-relaxed text-sm">
                                            Invite generated for <strong>{lastInviteData.email}</strong>.<br/> Share the link below with your client.
                                        </p>
                                        
                                        <div className="space-y-4 mb-10 text-left">
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 ml-1">Secure Link</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    readOnly 
                                                    title="Invitation Link"
                                                    value={lastInviteData.link || ''} 
                                                    className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 text-[10px] font-mono text-zinc-600 focus:outline-none"
                                                />
                                                <Button 
                                                    variant={copiedLink ? "primary" : "secondary"}
                                                    size="sm" 
                                                    onClick={() => {
                                                        if (lastInviteData.link) {
                                                            navigator.clipboard.writeText(lastInviteData.link);
                                                            setCopiedLink(true);
                                                            setTimeout(() => setCopiedLink(false), 2000);
                                                        }
                                                    }}
                                                    className="min-w-[100px] font-black uppercase tracking-widest text-[9px]"
                                                >
                                                    {copiedLink ? 'Copied!' : 'Copy Link'}
                                                </Button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                                                    This link expires in 72 hours
                                                </p>
                                            </div>
                                        </div>

                                        <Button variant="primary" className="w-full py-4 text-xs font-black uppercase tracking-[0.3em] shadow-xl shadow-zinc-200/50" onClick={() => { setShowInviteModal(false); setLastInviteData(null); }}>Done</Button>
                                    </GlassCard>
                                </div>
                            )}

                            <InviteStaffModal 
                                isOpen={showInviteModal && !lastInviteData} 
                                onClose={() => setShowInviteModal(false)}
                                organizationId={organizationId || ''}
                                spaces={clients}
                            />
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
