import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';
import LoginPage from './src/views/LoginPage';
import SignupPage from './src/views/SignupPage';
import { apiService } from './services/apiService';
import {
    ChevronRight,
    Rocket,
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
import { NavItem, AppLayout, ClientLayout } from './components/Layout';

// View Components
import StaffDashboardView from './components/views/StaffDashboardView';
import OwnerDashboardView from './components/views/OwnerDashboardView';
import SpacesView from './components/views/SpacesView';
import ClientsCRMView from './components/views/ClientsCRMView';
import StaffView from './components/views/StaffView';
import SpaceDetailView from './components/views/SpaceDetailView';
import GlobalMeetingsView from './components/views/GlobalMeetingsView';
import TaskView from './components/views/TaskView';
import GlobalFilesView from './components/views/GlobalFilesView';
import SettingsView from './components/views/SettingsView';
import InboxView from './components/views/InboxView';
import HistoryView from './components/views/HistoryView';
import ClientPortalView from './components/views/ClientPortalView';
import { InviteStaffModal } from './components/views/InviteStaffModal';
import { MeetingRoom } from './components/MeetingRoom';
import { Routes, Route } from 'react-router-dom';
import JoinView from './components/views/JoinView';
import { NotificationBell } from './components/NotificationBell';

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

const App = () => {
    const { user, profile, loading, userRole, organizationId, can, signOut } = useAuth();
    const { showToast, removeToast } = useToast();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    // Sidebar/View State
    const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
    const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
    const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
    const [activeMeetingRoomUrl, setActiveMeetingRoomUrl] = useState<string | null>(null);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [lastInviteData, setLastInviteData] = useState<{ link: string | null, email: string, status?: string, invite_id?: string } | null>(null);
    const [copiedLink, setCopiedLink] = useState(false);

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

    useEffect(() => {
        if (isAuthenticated) {
            fetchData();
        }
    }, [isAuthenticated]);

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

    const fetchData = async () => {
        if (!user) return;
        setIsInitialLoading(true);
        try {
            const [spacesRes, tasksRes, meetingsRes, staffRes, lifecycleRes, logsRes, inboxRes] = await Promise.all([
                apiService.getSpaces(),
                apiService.getTasks(),
                apiService.getMeetings(),
                apiService.getStaffMembers(),
                apiService.getClientLifecycle(),
                apiService.getActivityLogs(),
                apiService.getUnifiedInbox()
            ]);

            if (spacesRes.data) setClients(spacesRes.data);
            if (tasksRes.data) setTasks(tasksRes.data);
            if (meetingsRes.data) setMeetings(meetingsRes.data);
            if (staffRes) setStaff(staffRes);
            if (lifecycleRes) setClientLifecycle(lifecycleRes);
            if (logsRes.data) setLogs(logsRes.data);
            if (inboxRes) setInboxData(inboxRes);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setIsInitialLoading(false);
        }
    };

    const handleJoinMeeting = (meetingId: string) => {
        setActiveMeetingId(meetingId);
    };

    const handleUpdateStaffCapability = async (staffId: string, spaceId: string, allowed: boolean) => {
        try {
            await apiService.updateStaffCapability(staffId, spaceId, allowed);
            showToast("Capability updated successfully.", "success");
            fetchData();
        } catch (err: any) {
            showToast(`Error updating capability: ${err.message}`, "error");
        }
    };

    const handleCreateSpace = async (data: any) => {
        const loadingId = showToast("Creating your space...", "loading");
        try {
            const { data: newSpace, error } = await apiService.createSpace(
                data.name || 'New Client',
                `Workspace for ${data.name || 'New Client'}`
            );

            if (error) throw error;
            if (newSpace) {
                const optimisticSpace: any = {
                    id: newSpace.id || newSpace,
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
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                setClients(prev => [optimisticSpace as ClientSpace, ...prev]);
                setSelectedSpaceId(optimisticSpace.id);
                setCurrentView(ViewState.SPACE_DETAIL);
                fetchData();
                showToast("Space Created Successfully!", "success");
            }
        } catch (err: any) {
            showToast(`Error creating space: ${err.message}`, "error");
        } finally {
            removeToast(loadingId);
        }
    };

    const handleCreateTask = async (data: any) => {
        try {
            const { data: newTask, error } = await apiService.createTask(data, organizationId || '');
            if (error) throw error;
            if (newTask) setTasks([newTask, ...tasks]);
        } catch (err: any) {
            showToast(`Error creating task: ${err.message}`, "error");
        }
    };

    const handleTaskStatusUpdate = async (taskId: string, newStatus: Task['status']) => {
        try {
            const { error } = await apiService.updateTask(taskId, { status: newStatus }, organizationId || '');
            if (error) throw error;
            setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
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
                fetchData();
            } else {
                showToast('Meeting created but no ID returned', 'error');
                console.error('[handleInstantMeeting] Unexpected response shape:', data);
            }
        } catch (err) {
            console.error('[handleInstantMeeting] failed:', err);
            showToast('Failed to create meeting', 'error');
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
                fetchData();
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
                return <SpaceDetailView space={clients.find(c => c.id === selectedSpaceId)} meetings={meetings} onBack={() => setCurrentView(ViewState.SPACES)} onJoin={handleJoinMeeting} onSchedule={handleScheduleMeeting} onInstantMeet={handleInstantMeeting} />;
            case ViewState.INBOX:
                if (!can('can_view_dashboard')) return <div className="p-8">Access Denied</div>;
                return <InboxView clients={clients} inboxData={inboxData} />;
            case ViewState.CRM:
                if (!can('owner') && !can('admin')) return <div className="p-8">Access Denied</div>;
                return <ClientsCRMView clients={clientLifecycle} loading={isInitialLoading} />;
            case ViewState.STAFF:
                if (!can('can_manage_team')) return <div className="p-8">Access Denied</div>;
                return <StaffView staff={staff} spaces={clients} onInvite={() => setShowInviteModal(true)} onUpdateCapability={handleUpdateStaffCapability} onRefresh={fetchData} />;
            case ViewState.TASKS:
                if (!can('can_view_tasks')) return <div className="p-8">Access Denied</div>;
                return <TaskView tasks={tasks} clients={clients} onUpdateStatus={handleTaskStatusUpdate} onCreate={handleCreateTask} />;
            case ViewState.MEETINGS:
                if (!can('can_view_meetings')) return <div className="p-8">Access Denied</div>;
                return <GlobalMeetingsView meetings={meetings} clients={clients} onSchedule={handleScheduleMeeting} onJoin={handleJoinMeeting} onInstantMeet={handleInstantMeeting} />;
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

    if (loading || (isAuthenticated && isInitialLoading)) {
        return (
            <div className="flex h-screen w-full bg-white dark:bg-black overflow-hidden">
                <aside className="w-64 bg-white dark:bg-black border-r border-zinc-200 dark:border-zinc-800 flex flex-col justify-between p-4 z-20">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 px-4 mb-10 mt-2">
                            <SkeletonLoader width="32px" height="32px" borderRadius="8px" />
                            <SkeletonText lines={1} width="60px" />
                        </div>
                        <div className="space-y-2">
                             {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonLoader key={i} height="44px" borderRadius="12px" className="w-full" />)}
                        </div>
                    </div>
                    <div className="p-2">
                        <SkeletonLoader height="56px" borderRadius="12px" />
                    </div>
                </aside>
                <main className="flex-1 p-8 space-y-8 overflow-hidden">
                    <div className="flex justify-between items-end">
                        <div className="space-y-3">
                            <SkeletonLoader width="200px" height="40px" borderRadius="8px" />
                            <SkeletonText lines={1} width="300px" />
                        </div>
                        <SkeletonLoader width="150px" height="32px" borderRadius="20px" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => <SkeletonCard key={i} className="h-40 bg-white dark:bg-black border-zinc-200 dark:border-zinc-800" />)}
                    </div>
                </main>
            </div>
        );
    }

    return (
        <Routes>
            <Route path="/join" element={<JoinView />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="*" element={
                (() => {
                    if (!isAuthenticated) {
                        return <LoginPage />;
                    }

                    if (userRole === 'client') {
                        const currentClient = clients[0];
                        if (!currentClient) return <div className="p-8">Loading Portal...</div>;
                        return (
                            <div className="flex flex-col h-screen w-full bg-white font-sans">
                                <ClientPortalView client={currentClient} meetings={meetings} onJoin={handleJoinMeeting} onLogout={signOut} />
                            </div>
                        );
                    }

                    return (
                        <>
                            <AppLayout
                                sidebar={
                                    <aside className="w-64 bg-[#ECECF1] border-r border-[#D1D5DB] flex flex-col justify-between p-4 z-20">
                                        <div className="space-y-8">
                                            <div className="flex items-center gap-3 px-3 mb-8 mt-2">
                                                <div className="h-8 w-8 bg-[#1D1D1D] rounded-md flex items-center justify-center text-white"><Rocket size={20} /></div>
                                                <span className="font-bold text-xl tracking-tight text-[#1D1D1D]">Space.inc</span>
                                                <div className="ml-auto">
                                                    <NotificationBell />
                                                </div>
                                            </div>
                                            <div className="px-2 relative mb-4">
                                                <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#8E8EA0]" />
                                                <input placeholder="Search..." className="w-full bg-white border border-[#D1D5DB] rounded-md py-2 pl-10 pr-4 text-xs focus:outline-none" />
                                            </div>
                                            <nav className="space-y-1">
                                                {can('can_view_dashboard') && <NavItem icon={<LayoutGrid size={16} />} label="Dashboard" active={currentView === ViewState.DASHBOARD} onClick={() => setCurrentView(ViewState.DASHBOARD)} />}
                                                {can('can_view_history') && <NavItem icon={<Activity size={16} />} label="History" active={currentView === ViewState.ACTIVITY_LEDGER} onClick={() => setCurrentView(ViewState.ACTIVITY_LEDGER)} />}
                                                {(can('can_view_all_spaces') || can('can_view_assigned_spaces')) && <NavItem icon={<Users size={16} />} label="Spaces" active={currentView === ViewState.SPACES || currentView === ViewState.SPACE_DETAIL} onClick={() => setCurrentView(ViewState.SPACES)} />}
                                                {can('can_view_dashboard') && <NavItem icon={<Inbox size={16} />} label="Inbox" active={currentView === ViewState.INBOX} onClick={() => setCurrentView(ViewState.INBOX)} badge={inboxData.reduce((acc, curr) => acc + (curr.unread_count || 0), 0)} />}
                                                <div className="my-4 pt-4 border-t border-[#D1D5DB]">
                                                    <p className="text-[10px] font-bold text-[#8E8EA0] uppercase tracking-wider px-3 mb-2">Management</p>
                                                    {can('can_manage_team') && <NavItem icon={<UserCheck size={16} />} label="Team" active={currentView === ViewState.STAFF} onClick={() => setCurrentView(ViewState.STAFF)} />}
                                                    {can('can_manage_team') && <NavItem icon={<Key size={16} />} label="Invitations" active={currentView === ViewState.INVITATIONS} onClick={() => setCurrentView(ViewState.INVITATIONS)} />}
                                                    {(userRole === 'owner' || userRole === 'admin') && <NavItem icon={<Briefcase size={16} />} label="CRM" active={currentView === ViewState.CRM} onClick={() => setCurrentView(ViewState.CRM)} />}
                                                    {can('can_view_tasks') && <NavItem icon={<CheckSquare size={16} />} label="Tasks" active={currentView === ViewState.TASKS} onClick={() => setCurrentView(ViewState.TASKS)} />}
                                                    {can('can_view_meetings') && <NavItem icon={<Calendar size={16} />} label="Calendar" active={currentView === ViewState.MEETINGS} onClick={() => setCurrentView(ViewState.MEETINGS)} />}
                                                    {can('can_view_files') && <NavItem icon={<FolderClosed size={16} />} label="Drive" active={currentView === ViewState.FILES} onClick={() => setCurrentView(ViewState.FILES)} />}
                                                </div>
                                            </nav>
                                        </div>
                                        <div className="p-2 border-t border-[#D1D5DB] pt-4">
                                            <div onClick={() => setCurrentView(ViewState.SETTINGS)} className="flex items-center gap-3 p-2 rounded-md hover:bg-[#D1D5DB]/30 cursor-pointer">
                                                <div className="h-9 w-9 bg-[#1D1D1D] rounded-md flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                                                    {profile?.full_name?.substring(0, 2).toUpperCase() || 'AD'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm text-[#1D1D1D] truncate">{profile?.full_name || 'User'}</p>
                                                    <p className="text-[10px] text-[#565869] font-medium uppercase">{userRole || 'Member'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </aside>
                                }
                            >
                                <header className="h-16 border-b border-[#D1D5DB] flex items-center justify-between px-8 bg-white z-10 sticky top-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[#8E8EA0] text-[10px] font-black uppercase tracking-[0.2em]">Main</span>
                                        <ChevronRight size={14} className="text-[#D1D5DB]" />
                                        <span className="text-[#1D1D1D] text-[10px] font-black uppercase tracking-[0.2em]">{Object.keys(ViewState).find(key => ViewState[key as keyof typeof ViewState] === currentView)}</span>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <Button variant="primary" size="sm" className="font-black uppercase tracking-widest text-[10px]">Upgrade</Button>
                                    </div>
                                </header>
                                <div className="flex-1 overflow-y-auto bg-zinc-50/30">
                                    <div className="max-w-7xl mx-auto px-8 py-10">{renderContent()}</div>
                                </div>
                            </AppLayout>

                            {activeMeetingId && (
                                <MeetingRoom 
                                    meetingId={activeMeetingId}
                                    roomUrl={activeMeetingRoomUrl}
                                    onLeave={() => { setActiveMeetingId(null); setActiveMeetingRoomUrl(null); }}
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
                                spaces={clients}
                            />
                        </>
                    );
                })()
            } />
        </Routes>
    );
};

export default App;
