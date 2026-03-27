import React, { useState, useEffect } from 'react';
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
    Video,
    Shield,
    X,
    Search,
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
import { InvitationsManagementView } from './components/views/InvitationsManagementView';
import {
    ClientSpace, ViewState, Meeting, StaffMember, Task, ClientLifecycle
} from './types';
import { supabase } from './lib/supabase';
import { friendlyError } from './utils/errors';

import { NavItem, AppLayout } from './components/Layout';

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

    const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
    const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
    const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [lastInviteData, setLastInviteData] = useState<any>(null);
    const [copiedLink, setCopiedLink] = useState(false);

    const [clients, setClients] = useState<ClientSpace[]>([]);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [clientLifecycle, setClientLifecycle] = useState<ClientLifecycle[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [inboxData, setInboxData] = useState<any[]>([]);

    const [isInstantMeetingModalOpen, setIsInstantMeetingModalOpen] = useState(false);
    const [instantMeetingTargetSpace, setInstantMeetingTargetSpace] = useState<string | null>(null);
    const [instantMeetingTitle, setInstantMeetingTitle] = useState('Instant Meeting');
    const [instantMeetingCategory, setInstantMeetingCategory] = useState<string>('general');

    useEffect(() => {
        if (user && !loading) setIsAuthenticated(true);
        else setIsAuthenticated(false);
    }, [user, loading]);

    useEffect(() => {
        if (isAuthenticated) fetchData();
    }, [isAuthenticated]);

    useEffect(() => {
        if (!user || !profile) return;
        const channel = supabase.channel(`notifications:${user.id}`).on('broadcast', { event: 'new_notification' }, (payload) => {
            const { message, severity } = payload.payload;
            showToast(message, severity === 'critical' ? 'error' : 'info');
        }).subscribe();
        return () => { supabase.removeChannel(channel); };
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

    const handleJoinMeeting = (meetingId: string) => setActiveMeetingId(meetingId);

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
            const { data: newSpace, error } = await apiService.createSpace(data.name || 'New Client', `Workspace for ${data.name || 'New Client'}`, organizationId || '');
            if (error) throw error;
            if (newSpace) {
                fetchData();
                setCurrentView(ViewState.SPACE_DETAIL);
                setSelectedSpaceId(newSpace.id || newSpace);
                showToast("Space Created!", "success");
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
            if (!targetSpace) { showToast('Select a space.', 'info'); return; }
            if (!title && !isInstantMeetingModalOpen) { setInstantMeetingTargetSpace(targetSpace); setIsInstantMeetingModalOpen(true); return; }
            const { data, error } = await apiService.createInstantMeeting({ space_id: targetSpace, title: title || instantMeetingTitle, recording_enabled: true, category: instantMeetingCategory });
            if (error) { showToast(friendlyError(error?.message), 'error'); return; }
            if (data?.meeting?.id) { setActiveMeetingId(data.meeting.id); setIsInstantMeetingModalOpen(false); fetchData(); }
        } catch (err) {
            showToast('Failed to create meeting', 'error');
        }
    };

    const handleScheduleMeeting = async (data: any) => {
        try {
            const { data: newMeeting, error } = await apiService.scheduleMeeting({ space_id: data.space_id, title: data.title || 'Scheduled Meeting', starts_at: `${data.date}T${data.time}:00Z`, description: data.description, recording_enabled: data.recording_enabled, category: data.category || 'general' });
            if (error) throw error;
            if (newMeeting) { setMeetings([newMeeting, ...meetings]); fetchData(); }
        } catch (err: any) {
            showToast(friendlyError(err?.message), "error");
        }
    };

    const renderContent = () => {
        switch (currentView) {
            case ViewState.DASHBOARD:
                if (userRole === 'owner' || userRole === 'admin') return <OwnerDashboardView onGoToSpace={(id) => { setSelectedSpaceId(id); setCurrentView(ViewState.SPACE_DETAIL); }} />;
                if (userRole === 'staff') return <StaffDashboardView clients={clients} onJoin={handleJoinMeeting} onInstantMeet={() => handleInstantMeeting(clients[0]?.id)} onGoToSpace={(id) => { setSelectedSpaceId(id); setCurrentView(ViewState.SPACE_DETAIL); }} />;
                if (userRole === 'client' && clients[0]) return <ClientPortalView client={clients[0]} meetings={meetings} onJoin={handleJoinMeeting} onLogout={signOut} />;
                return <ErrorView message="Unauthorized." />;
            case ViewState.ACTIVITY_LEDGER: return <HistoryView logs={logs} />;
            case ViewState.SPACES: return <SpacesView clients={clients} onSelect={(id) => { setSelectedSpaceId(id); setCurrentView(ViewState.SPACE_DETAIL); }} onCreate={handleCreateSpace} />;
            case ViewState.SPACE_DETAIL: return <SpaceDetailView space={clients.find(c => c.id === selectedSpaceId)} meetings={meetings} onBack={() => setCurrentView(ViewState.SPACES)} onJoin={handleJoinMeeting} onSchedule={handleScheduleMeeting} onInstantMeet={handleInstantMeeting} />;
            case ViewState.INBOX: return <InboxView clients={clients} inboxData={inboxData} />;
            case ViewState.CRM: return <ClientsCRMView clients={clientLifecycle} loading={isInitialLoading} />;
            case ViewState.STAFF: return <StaffView staff={staff} spaces={clients} onInvite={() => setShowInviteModal(true)} onUpdateCapability={handleUpdateStaffCapability} onRefresh={fetchData} />;
            case ViewState.TASKS: return <TaskView tasks={tasks} clients={clients} onUpdateStatus={handleTaskStatusUpdate} onCreate={handleCreateTask} />;
            case ViewState.MEETINGS: return <GlobalMeetingsView meetings={meetings} clients={clients} onSchedule={handleScheduleMeeting} onJoin={handleJoinMeeting} onInstantMeet={handleInstantMeeting} />;
            case ViewState.FILES: return <GlobalFilesView clients={clients} profile={profile} />;
            case ViewState.SETTINGS: return <SettingsView />;
            case ViewState.INVITATIONS: return <InvitationsManagementView />;
            default: return <div className="p-8">View Not Found</div>;
        }
    };

    if (loading || (isAuthenticated && isInitialLoading)) return <div className="flex h-screen w-full bg-white items-center justify-center"><SkeletonLoader width="200px" height="40px" /></div>;

    return (
        <Routes>
            <Route path="/join" element={<JoinView />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="*" element={
                isAuthenticated ? (
                    userRole === 'client' ? <ClientPortalView client={clients[0]} meetings={meetings} onJoin={handleJoinMeeting} onLogout={signOut} /> : (
                        <AppLayout sidebar={
                            <aside className="w-64 bg-[#ECECF1] border-r border-[#D1D5DB] flex flex-col justify-between p-4 z-20">
                                <div className="space-y-8">
                                    <div className="flex items-center gap-3 px-3 mb-8 mt-2"><div className="h-8 w-8 bg-[#1D1D1D] rounded-md flex items-center justify-center text-white"><Rocket size={20} /></div><span className="font-bold text-xl text-[#1D1D1D]">Space.inc</span><div className="ml-auto"><NotificationBell /></div></div>
                                    <nav className="space-y-1">
                                        <NavItem icon={<LayoutGrid size={16} />} label="Dashboard" active={currentView === ViewState.DASHBOARD} onClick={() => setCurrentView(ViewState.DASHBOARD)} />
                                        <NavItem icon={<Users size={16} />} label="Spaces" active={currentView === ViewState.SPACES} onClick={() => setCurrentView(ViewState.SPACES)} />
                                        <NavItem icon={<Inbox size={16} />} label="Inbox" active={currentView === ViewState.INBOX} onClick={() => setCurrentView(ViewState.INBOX)} />
                                        <div className="my-4 pt-4 border-t border-[#D1D5DB]">
                                            <NavItem icon={<UserCheck size={16} />} label="Team" active={currentView === ViewState.STAFF} onClick={() => setCurrentView(ViewState.STAFF)} />
                                            <NavItem icon={<Calendar size={16} />} label="Meetings" active={currentView === ViewState.MEETINGS} onClick={() => setCurrentView(ViewState.MEETINGS)} />
                                            <NavItem icon={<CheckSquare size={16} />} label="Tasks" active={currentView === ViewState.TASKS} onClick={() => setCurrentView(ViewState.TASKS)} />
                                        </div>
                                    </nav>
                                </div>
                                <div className="p-2 border-t border-[#D1D5DB] pt-4" onClick={() => setCurrentView(ViewState.SETTINGS)}>
                                    <div className="flex items-center gap-3 p-2 rounded-md hover:bg-[#D1D5DB]/30 cursor-pointer">
                                        <div className="h-9 w-9 bg-[#1D1D1D] rounded-md flex items-center justify-center text-white text-xs font-bold">{profile?.full_name?.substring(0, 2).toUpperCase() || 'AD'}</div>
                                        <div className="flex-1 min-w-0"><p className="font-medium text-sm text-[#1D1D1D] truncate">{profile?.full_name || 'User'}</p></div>
                                    </div>
                                </div>
                            </aside>
                        }>
                            <header className="h-16 border-b border-[#D1D5DB] flex items-center justify-between px-8 bg-white"><div className="flex items-center gap-2"><span className="text-[#8E8EA0] text-[10px] font-black uppercase tracking-[0.2em]">Main</span><ChevronRight size={14} className="text-[#D1D5DB]" /><span className="text-[#1D1D1D] text-[10px] font-black uppercase tracking-[0.2em]">{currentView}</span></div></header>
                            <div className="flex-1 overflow-y-auto bg-zinc-50/30"><div className="max-w-7xl mx-auto px-8 py-10">{renderContent()}</div></div>
                        </AppLayout>
                    )
                ) : <LoginPage />
            } />
        </Routes>
    );
};

export default App;
