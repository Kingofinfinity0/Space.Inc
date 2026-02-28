import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { PolicySettings } from './components/settings/PolicySettings';
import { LoginForm } from './components/auth/LoginForm';
import { apiService } from './services/apiService';
import {
    LayoutDashboard,
    Users,
    MessageSquare,
    Calendar,
    FileText,
    Settings,
    Plus,
    Search,
    Briefcase,
    ChevronRight,
    LogOut,
    Video,
    Download,
    Upload,
    Clock,
    UserPlus,
    ArrowRight,
    Link as LinkIcon,
    Copy,
    ListTodo,
    MoreVertical,
    Flag,
    Trash2,
    User,
    ArrowLeft,
    GripVertical,
    Activity,
    Shield,
    Lock,
    FileUp,
    Key,
    FilePlus as FilePlus2,
    File as DocIcon,
    Rocket,
    LayoutGrid,
    Inbox,
    UserCheck,
    CheckSquare,
    FolderClosed,
    Bell,
    Eye,
    Play,
    X,
    FileVideo,
    ChevronLeft
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

import {
    GlassCard,
    Button,
    Heading,
    Text,
    Input,
    Modal,
    Checkbox,
    Toggle,
    SkeletonLoader,
    SkeletonCard,
    SkeletonText,
    SkeletonImage
} from './components/UI/index';
import { FileViewerModal } from './components/FileViewerModal';
import { ClientSpace, ViewState, Meeting, Message, StaffMember, Task, SpaceFile, ChartData, ClientLifecycle } from './types';
import { LandingPage } from './components/LandingPage';
import { Onboarding } from './components/Onboarding';
import { useRealtimeMessages } from './hooks/useRealtimeMessages';
import { useRealtimeFiles } from './hooks/useRealtimeFiles';
import { FileUploadModal } from './components/FileUploadModal';
import { MeetingRoom } from './components/MeetingRoom';
import { supabase } from './lib/supabase';

// --- Sub-Components ---

// NavItem is the primary navigation component. legacy SidebarItem removed.

const NavItem: React.FC<{ icon: React.ReactNode; label: string; active: boolean; onClick: () => void; badge?: number }> = ({ icon, label, active, onClick, badge }) => (
    <button
        onClick={onClick}
        className={`
      w-full flex items-center justify-between px-3 py-2 rounded-md transition-all duration-200 group
      ${active ? 'bg-[#D1D5DB] text-[#1D1D1D]' : 'text-[#565869] hover:bg-[#F7F7F8] hover:text-[#1D1D1D]'}
    `}
    >
        <div className="flex items-center gap-3">
            <div className={`transition-all duration-200 ${active ? 'text-[#1D1D1D]' : 'text-[#8E8EA0] group-hover:text-[#1D1D1D]'}`}>
                {icon}
            </div>
            <span className="text-sm font-medium">{label}</span>
        </div>
        {badge && (
            <span className={`h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full text-[10px] font-bold ${active ? 'bg-white text-[#1D1D1D]' : 'bg-[#10A37F] text-white'}`}>
                {badge}
            </span>
        )}
    </button>
);

// 1. Staff Dashboard
const StaffDashboardView = ({ clients, messages, meetings, tasks, profile, onJoin, onInstantMeet }: { clients: ClientSpace[], messages: Message[], meetings: Meeting[], tasks: Task[], profile: any, onJoin: (id: string) => void, onInstantMeet?: () => void }) => {
    const { showToast } = useToast();
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isInternalUploadModalOpen, setIsInternalUploadModalOpen] = useState(false);
    const [selectedSpaceForUpload, setSelectedSpaceForUpload] = useState<string>(clients[0]?.id || '');
    const [uploading, setUploading] = useState(false);

    const upcomingMeetings = (meetings || [])
        .filter(m => {
            const isLive = m.status === 'active' || m.status === 'live';
            const isScheduled = m.status === 'scheduled';
            // Guardrail: If live, MUST have a room URL.
            if (isLive && !m.daily_room_url) return false;
            return isLive || isScheduled;
        })
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
        .slice(0, 3);

    const pendingTasks = (tasks || [])
        .filter(t => t.status !== 'Done')
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 3);

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-end mb-8">
                <div>
                    <Heading level={1}>Overview</Heading>
                    <Text variant="secondary" className="mt-1">Workspaces and activity summary.</Text>
                </div>
                <div className="flex gap-3">
                    <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-[#F7F7F8] rounded-md border border-[#D1D5DB]">
                        <div className="w-2 h-2 rounded-full bg-[#10A37F]"></div>
                        <span className="text-[10px] font-bold text-[#565869] uppercase tracking-wider">Cloud Sync Active</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard className="p-6 relative overflow-hidden group">
                    <Text variant="secondary" className="mb-4 font-semibold uppercase text-[10px] tracking-wider">Active Spaces</Text>
                    <div className="flex items-end justify-between">
                        <span className="text-4xl font-semibold text-[#1D1D1D] tracking-tight">{clients.length}</span>
                        <div className="h-10 w-10 rounded-md bg-[#ECECF1] flex items-center justify-center text-[#1D1D1D]">
                            <Users size={18} />
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="p-6 relative overflow-hidden group">
                    <Text variant="secondary" className="mb-4 font-semibold uppercase text-[10px] tracking-wider">Open Tasks</Text>
                    <div className="flex items-end justify-between">
                        <span className="text-4xl font-semibold text-[#1D1D1D] tracking-tight">{(tasks || []).filter(t => t.status !== 'Done').length}</span>
                        <div className="h-10 w-10 rounded-md bg-[#ECECF1] flex items-center justify-center text-[#1D1D1D]">
                            <ListTodo size={18} />
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="p-6 relative overflow-hidden group">
                    <Text variant="secondary" className="mb-4 font-semibold uppercase text-[10px] tracking-wider">Upcoming meetings</Text>
                    <div className="flex items-end justify-between">
                        <span className="text-4xl font-semibold text-[#1D1D1D] tracking-tight">{(meetings || []).filter(m => m.status === 'scheduled' || m.status === 'active').length}</span>
                        <div className="h-10 w-10 rounded-md bg-[#ECECF1] flex items-center justify-center text-[#1D1D1D]">
                            <Video size={18} />
                        </div>
                    </div>
                </GlassCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
                <div className="lg:col-span-2 space-y-6">
                    {/* Meeting Summary */}
                    <GlassCard className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <Heading level={3}>Upcoming Meetings</Heading>
                            <Button variant="ghost" size="sm">View All</Button>
                        </div>
                        <div className="space-y-4">
                            {upcomingMeetings.length > 0 ? upcomingMeetings.map(meeting => (
                                <div key={meeting.id} className="flex items-center justify-between p-3 hover:bg-[#F7F7F8] rounded-md border border-transparent hover:border-[#D1D5DB]/50 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-md bg-[#F7F7F8] border border-[#D1D5DB]/30 flex flex-col items-center justify-center">
                                            <span className="text-[10px] uppercase font-bold text-[#8E8EA0]">{new Date(meeting.starts_at).toLocaleString('en-US', { month: 'short' })}</span>
                                            <span className="text-sm font-bold text-[#1D1D1D] leading-none">{new Date(meeting.starts_at).getDate()}</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-[#1D1D1D]">{meeting.title || 'Client Sync'}</p>
                                            <p className="text-[10px] text-[#8E8EA0] uppercase tracking-wider">
                                                {clients.find(c => c.id === meeting.space_id)?.name || 'General Space'} • {new Date(meeting.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="secondary" onClick={() => onJoin(meeting.id)}>Join</Button>
                                </div>
                            )) : (
                                <div className="text-center py-8 text-zinc-400 text-sm italic">No meetings scheduled.</div>
                            )}
                        </div>
                    </GlassCard>

                    {/* Task Summary */}
                    <GlassCard className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <Heading level={3}>Critical Tasks</Heading>
                            <Button variant="ghost" size="sm">View All</Button>
                        </div>
                        <div className="space-y-3">
                            {pendingTasks.length > 0 ? pendingTasks.map(task => (
                                <div key={task.id} className="flex items-center gap-3 p-3 bg-white border border-zinc-100 rounded-md shadow-sm">
                                    <div className={`h-2 w-2 rounded-full ${task.status === 'In Progress' ? 'bg-amber-400' : 'bg-zinc-300'}`} />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-[#1D1D1D]">{task.title}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                                {clients.find(c => c.id === task.clientSpaceId)?.name || 'General'}
                                            </span>
                                            <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider flex items-center gap-1">
                                                <Clock size={10} /> {task.dueDate}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-600">
                                        ID
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-8 text-zinc-400 text-sm italic">All tasks completed.</div>
                            )}
                        </div>
                    </GlassCard>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <GlassCard className="p-6">
                        <Heading level={3} className="mb-4">Space Growth</Heading>
                        <div className="h-[150px] w-full mt-4 min-h-[150px]">
                            <ResponsiveContainer width="100%" height="100%" minHeight={150}>
                                <AreaChart data={[{ value: 40 }, { value: 70 }, { value: 65 }, { value: 90 }]}>
                                    <Area type="monotone" dataKey="value" stroke="#18181b" strokeWidth={2} fill="#18181b" fillOpacity={0.05} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 pt-4 border-t border-zinc-100">
                            <div className="flex justify-between text-xs text-zinc-500 mb-1">
                                <span>Optimization Score</span>
                                <span className="text-[#1D1D1D] font-medium">92%</span>
                            </div>
                            <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-[#1D1D1D] h-full w-[92%]" />
                            </div>
                        </div>
                    </GlassCard>

                    <GlassCard className="p-6">
                        <Heading level={3} className="mb-4">Quick Actions</Heading>
                        <div className="space-y-2">
                            <button
                                onClick={() => onInstantMeet?.()}
                                className="w-full flex items-center gap-3 p-3 rounded-md border border-amber-100 bg-amber-50/50 hover:bg-amber-100/50 transition-colors text-left group"
                            >
                                <div className="bg-amber-100 p-2 rounded-lg text-amber-600 group-hover:scale-110 transition-transform">
                                    <Video size={16} />
                                </div>
                                <div>
                                    <span className="text-sm font-semibold text-amber-900 block">Meet Now</span>
                                    <span className="text-[10px] text-amber-700 font-medium">Start an instant video call</span>
                                </div>
                            </button>
                            <button
                                onClick={() => setIsUploadModalOpen(true)}
                                className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-zinc-50 transition-colors border border-transparent hover:border-zinc-200 text-left"
                            >
                                <div className="bg-zinc-100 p-2 rounded-lg text-zinc-600">
                                    <FilePlus2 size={16} />
                                </div>
                                <span className="text-sm font-medium">Upload Document</span>
                            </button>
                            <button className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-zinc-50 transition-colors border border-transparent hover:border-zinc-200 text-left">
                                <div className="bg-zinc-100 p-2 rounded-lg text-zinc-600">
                                    <Clock size={16} />
                                </div>
                                <span className="text-sm font-medium">Schedule Meeting</span>
                            </button>
                            <button className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-zinc-50 transition-colors border border-transparent hover:border-zinc-200 text-left">
                                <div className="bg-zinc-100 p-2 rounded-lg text-zinc-600">
                                    <ListTodo size={16} />
                                </div>
                                <span className="text-sm font-medium">Assign Global Task</span>
                            </button>
                        </div>
                    </GlassCard>
                </div>
            </div>

            {/* Global Upload Modal with Space Selector */}
            <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Upload to Client Space">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Select Destination Space</label>
                        <select
                            title="Select Destination Space"
                            className="w-full bg-white/40 border border-zinc-200 rounded-lg px-5 py-3 text-zinc-800 text-sm focus:outline-none"
                            value={selectedSpaceForUpload}
                            onChange={(e) => setSelectedSpaceForUpload(e.target.value)}
                        >
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="pt-2">
                        <Button
                            className="w-full"
                            onClick={() => {
                                setIsUploadModalOpen(false);
                                setIsInternalUploadModalOpen(true);
                            }}
                        >
                            Continue to Upload
                        </Button>
                    </div>
                </div>
            </Modal>

            <FileUploadModal
                isOpen={isInternalUploadModalOpen}
                onClose={() => setIsInternalUploadModalOpen(false)}
                loading={uploading}
                onUpload={async (file) => {
                    if (!selectedSpaceForUpload || !profile?.organization_id) return;
                    setUploading(true);
                    try {
                        const fileData = await apiService.uploadFile(selectedSpaceForUpload, profile.organization_id, file);
                        await apiService.sendMessage(
                            selectedSpaceForUpload,
                            profile.organization_id,
                            `Shared a file: ${file.name}`,
                            'file',
                            { file_id: fileData.id, file_name: file.name, mime_type: file.type }
                        );
                        setIsInternalUploadModalOpen(false);
                        showToast("File uploaded successfully to the selected space.", "success");
                    } catch (err) {
                        console.error("Global upload error:", err);
                        showToast("Failed to upload file. Please try again.", "error");
                    } finally {
                        setUploading(false);
                    }
                }}
            />
        </div>
    );
};

// 2. Spaces View
const SpacesView = ({ clients, onSelect, onCreate }: { clients: ClientSpace[], onSelect: (id: string) => void, onCreate: (data: any) => void }) => {
    const { showToast } = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientContact, setNewClientContact] = useState('');
    const [newClientEmail, setNewClientEmail] = useState('');
    const [selectedModules, setSelectedModules] = useState({
        messaging: true,
        meetings: true,
        files: true,
        calendar: true
    });

    const handleSubmit = () => {
        if (!newClientName) {
            showToast('Please enter a space name.', "info");
            return;
        }

        onCreate({
            name: newClientName,
            contactName: newClientContact,
            email: newClientEmail,
            modules: selectedModules
        });
        setIsModalOpen(false);
        setNewClientName('');
        setNewClientContact('');
        setNewClientEmail('');
    };

    return (
        <div>
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Spaces</h1>
                    <p className="text-zinc-500 font-light mt-1">Manage all your client environments.</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)}>
                    <Plus size={18} /> New Space
                </Button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clients.map(client => (
                    <GlassCard
                        key={client.id}
                        onClick={() => onSelect(client.id)}
                        className="p-6 group relative cursor-pointer"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="h-12 w-12 rounded-xl bg-zinc-50 flex items-center justify-center text-lg font-bold text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                                {client.name ? client.name.substring(0, 2).toUpperCase() : 'SP'}
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${client.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                {client.status}
                            </span>
                        </div>
                        <h3 className="text-xl font-bold text-zinc-900 mb-1">{client.name}</h3>
                        <p className="text-sm text-zinc-500 font-light mb-6">{client.description || 'Verified Portal Environment'}</p>
                        <div className="grid grid-cols-3 gap-2 py-4 border-t border-zinc-50 mb-2">
                            <div className="text-center">
                                <p className="text-[10px] uppercase text-zinc-400 font-black">Meetings</p>
                                <p className="text-sm font-bold text-zinc-800">{client.meeting_count || 0}</p>
                            </div>
                            <div className="text-center border-l border-zinc-100">
                                <p className="text-[10px] uppercase text-zinc-400 font-black">Docs</p>
                                <p className="text-sm font-bold text-zinc-800">{client.file_count || 0}</p>
                            </div>
                            <div className="text-center border-l border-zinc-100">
                                <p className="text-[10px] uppercase text-zinc-400 font-black">Activity</p>
                                <p className="text-sm font-bold text-zinc-800">
                                    {client.last_activity_at ? new Date(client.last_activity_at).toLocaleDateString() : 'Never'}
                                </p>
                            </div>
                        </div>
                    </GlassCard>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Provision New Space">
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Space Name</label>
                        <Input placeholder="Client Name or Project" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4">
                        <Button className="w-full" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button className="w-full" onClick={handleSubmit}>Create Space</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// --- Phase 16: CRM & Compliance Views ---

const CRMProgressBar: React.FC<{ score: number }> = ({ score }) => {
    const barRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (barRef.current) {
            barRef.current.style.width = `${score}%`;
        }
    }, [score]);

    return (
        <div className="w-24 h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div
                ref={barRef}
                className={`h-full rounded-full transition-all duration-1000 ${score > 70 ? 'bg-emerald-400' :
                    score > 30 ? 'bg-amber-400' : 'bg-red-400'
                    }`}
            />
        </div>
    );
};

const ClientsCRMView: React.FC<{
    clients: any[];
    loading: boolean;
}> = ({ clients, loading }) => {
    if (loading) return <SkeletonLoader type="dashboard" />;

    return (
        <div className="space-y-8 animate-[fadeIn_0.5s_ease-out]">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Behavioral CRM</h1>
                    <p className="text-zinc-500 font-light mt-1">Lifecycle intelligence driven by real user activity</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" icon={<Download size={16} />}>Export Report</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Clients', value: clients.length, color: 'zinc' },
                    { label: 'Engaged', value: clients.filter(c => c.lifecycle_stage === 'Engaged').length, color: 'emerald' },
                    { label: 'At Risk', value: clients.filter(c => c.lifecycle_stage === 'At Risk').length, color: 'orange' },
                    { label: 'Avg score', value: Math.round(clients.reduce((acc, c) => acc + c.onboarding_score, 0) / (clients.length || 1)), color: 'sky' }
                ].map((stat, i) => (
                    <GlassCard key={i} className="p-6 text-center">
                        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.2em] mb-1">{stat.label}</p>
                        <p className={`text-2xl font-black text-${stat.color}-600`}>{stat.value}</p>
                    </GlassCard>
                ))}
            </div>

            <GlassCard className="overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-zinc-50/50 border-b border-zinc-100">
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Client</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Primary Space</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Stage</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Engagement Score</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Last Activity</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                        {clients.map((client) => (
                            <tr key={client.client_id} className="hover:bg-zinc-50/30 transition-colors group">
                                <td className="px-6 py-5">
                                    <div className="font-bold text-zinc-900">{client.full_name}</div>
                                    <div className="text-zinc-400 text-xs font-light">{client.email}</div>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="text-sm font-medium text-zinc-700">{client.space_name}</div>
                                </td>
                                <td className="px-6 py-5">
                                    <span className={`
                                        px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tight
                                        ${client.lifecycle_stage === 'Engaged' ? 'bg-emerald-50 text-emerald-600' :
                                            client.lifecycle_stage === 'At Risk' ? 'bg-orange-50 text-orange-600' :
                                                client.lifecycle_stage === 'Churned' ? 'bg-zinc-100 text-zinc-400' :
                                                    'bg-sky-50 text-sky-600'}
                                    `}>
                                        {client.lifecycle_stage}
                                    </span>
                                </td>
                                <td className="px-6 py-5 text-center">
                                    <div className="flex items-center justify-center gap-3">
                                        <CRMProgressBar score={client.onboarding_score} />
                                        <span className="text-xs font-black text-zinc-500 w-8">{client.onboarding_score}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="text-xs text-zinc-500 flex items-center gap-2">
                                        <Clock size={12} className="text-zinc-300" />
                                        {client.last_activity_at ? new Date(client.last_activity_at).toLocaleDateString() : 'Never'}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </GlassCard>
        </div>
    );
};

const StaffView: React.FC<{
    staff: StaffMember[];
    spaces: ClientSpace[];
    onInvite: () => void;
    onUpdateCapability: (staffId: string, spaceId: string, capKey: string, allowed: boolean) => void;
}> = ({ staff, spaces, onInvite, onUpdateCapability }) => (
    <div className="space-y-8 animate-[fadeIn_0.5s_ease-out]">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Staff Engine</h1>
                <p className="text-zinc-500 font-light mt-1">Manage human authority and space assignments</p>
            </div>
            <Button onClick={onInvite} icon={<UserPlus size={18} />}>Add Human</Button>
        </div>

        <div className="grid grid-cols-1 gap-6">
            {staff.map((member) => (
                <GlassCard key={member.id} className="p-8">
                    <div className="flex items-start justify-between mb-8">
                        <div className="flex items-center gap-6">
                            <div className="h-16 w-16 bg-zinc-100 rounded-2xl flex items-center justify-center border border-zinc-200/50 shadow-inner">
                                <User size={32} className="text-zinc-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-zinc-900">{member.full_name}</h3>
                                <div className="flex items-center gap-4 mt-1">
                                    <span className="text-zinc-500 text-sm font-light">{member.email}</span>
                                    <span className="h-1 w-1 bg-zinc-300 rounded-full" />
                                    <span className="px-2 py-0.5 bg-zinc-100 text-[10px] font-black uppercase text-zinc-500 rounded tracking-tight">{member.role}</span>
                                    {member.is_active ?
                                        <span className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-black uppercase tracking-tight">
                                            <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" /> Active
                                        </span> :
                                        <span className="text-zinc-400 text-[10px] font-black uppercase tracking-tight italic">Awaiting Setup</span>
                                    }
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm">Edit</Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-1">Space Authority Matrix</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {spaces.map(space => {
                                const isAssigned = (member.assigned_spaces as any[])?.some(s => s.space_id === space.id);
                                return (
                                    <div key={space.id} className={`
                                        p-4 rounded-xl border transition-all
                                        ${isAssigned ? 'bg-zinc-50/50 border-zinc-200 ring-1 ring-zinc-100' : 'bg-white border-zinc-100 opacity-50 grayscale hover:opacity-100 hover:grayscale-0'}
                                    `}>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm font-bold text-zinc-800">{space.name}</span>
                                            <Toggle
                                                checked={isAssigned}
                                                onChange={() => {
                                                    // This would trigger apiService.assignStaffToSpace logic
                                                    console.log('Toggle space assignment', member.id, space.id);
                                                }}
                                            />
                                        </div>
                                        {isAssigned && (
                                            <div className="flex flex-wrap gap-2">
                                                {['message_clients', 'manage_tasks', 'view_files'].map(cap => (
                                                    <button
                                                        key={cap}
                                                        onClick={() => onUpdateCapability(member.id, space.id, cap, true)}
                                                        className="px-2 py-1 bg-white border border-zinc-200 rounded text-[9px] font-bold text-zinc-500 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
                                                    >
                                                        {cap.replace('_', ' ')}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </GlassCard>
            ))}
        </div>
    </div>
);

// SpaceChatPanel - Inline chat component for Space Detail view
const SpaceChatPanel = ({ spaceId, spaceName }: { spaceId: string, spaceName: string }) => {
    const { user, profile } = useAuth();
    const [messageInput, setMessageInput] = useState('');
    const [sending, setSending] = useState(false);
    const [isInternal, setIsInternal] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const { messages, loading, error, sendMessage, sendFile, messagesEndRef } = useRealtimeMessages(spaceId);

    const handleSend = async () => {
        if (!messageInput.trim() || sending) return;
        setSending(true);
        const success = await sendMessage(messageInput, isInternal ? 'internal' : 'general');
        if (success) {
            setMessageInput('');
            setIsInternal(false);
        }
        setSending(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="h-[600px] flex flex-col bg-white rounded-lg border border-[#D1D5DB] overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-[#D1D5DB] bg-[#F7F7F8]">
                <h3 className="font-semibold text-[#1D1D1D]">Chat with {spaceName}</h3>
                <p className="text-[10px] text-[#8E8EA0] uppercase tracking-wider">{loading ? 'Loading...' : `${messages.length} messages`}</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-zinc-400">
                        <div className="animate-pulse">Loading messages...</div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full text-red-400">{error}</div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                        <MessageSquare size={32} className="mb-2 opacity-30" />
                        <p className="text-sm">Start the conversation!</p>
                    </div>
                ) : (
                    messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.sender_type === 'staff' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.channel === 'internal'
                                ? 'bg-amber-50 border border-amber-200 text-amber-900'
                                : msg.sender_type === 'staff'
                                    ? 'bg-[#10A37F] text-white'
                                    : 'bg-[#F7F7F8] text-[#1D1D1D] border border-[#D1D5DB]/30'
                                }`}>
                                {msg.channel === 'internal' && (
                                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">
                                        <Lock size={10} /> Internal Note
                                    </div>
                                )}
                                {msg.sender?.full_name && (
                                    <p className={`text-[10px] mb-1 font-medium ${msg.sender_type === 'staff' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                        {msg.sender.full_name}
                                    </p>
                                )}

                                {msg.extension === 'file' ? (
                                    <div className={`flex items-center gap-3 p-2 rounded-lg ${msg.sender_type === 'staff' ? 'bg-white/10' : 'bg-zinc-50'}`}>
                                        <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                            <DocIcon size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate text-xs">{msg.payload?.file_name}</p>
                                            <p className="text-[10px] opacity-60">Document Shared</p>
                                        </div>
                                        <button
                                            title="Download File"
                                            onClick={async () => {
                                                const { data } = await apiService.getSignedUrl(msg.payload.file_id, profile?.organization_id);
                                                if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                            }}
                                            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                                        >
                                            <Download size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <p>{msg.content}</p>
                                )}

                                <p className={`text-[10px] mt-1 text-right ${msg.sender_type === 'staff' ? 'text-zinc-400' : 'text-zinc-400'}`}>
                                    {formatTime(msg.created_at)}
                                </p>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[#D1D5DB] bg-white">
                <div className="flex items-center gap-3">
                    <button
                        title="Attach File"
                        onClick={() => setIsUploadModalOpen(true)}
                        className="h-10 w-10 flex items-center justify-center text-[#8E8EA0] hover:text-[#10A37F] hover:bg-[#ECECF1] rounded-md transition-all"
                    >
                        <Plus size={20} />
                    </button>
                    <button
                        onClick={() => setIsInternal(!isInternal)}
                        className={`h-10 w-10 flex items-center justify-center rounded-md transition-all ${isInternal ? 'bg-amber-100 text-amber-600' : 'text-[#8E8EA0] hover:text-[#10A37F] hover:bg-[#ECECF1]'}`}
                        title="Toggle Internal Note"
                    >
                        <Shield size={20} />
                    </button>
                    <input
                        className={`flex-1 border rounded-md px-4 py-2 text-sm focus:outline-none transition-all ${isInternal
                            ? 'bg-amber-50 border-amber-200 focus:ring-1 focus:ring-amber-500 placeholder-amber-400 text-amber-900'
                            : 'bg-white border-[#D1D5DB] focus:ring-1 focus:ring-[#10A37F] focus:border-[#10A37F]'
                            }`}
                        placeholder={isInternal ? "Add an internal note (visible to staff only)..." : "Type a message..."}
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={sending}
                    />
                    <button
                        title="Send Message"
                        onClick={handleSend}
                        disabled={sending || !messageInput.trim()}
                        className={`h-10 w-10 rounded-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${isInternal ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-[#10A37F] hover:bg-[#0E8A6B] text-white'
                            }`}
                    >
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>

            <FileUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                loading={sending}
                onUpload={async (file) => {
                    if (!profile?.organization_id) return;
                    await sendFile(profile.organization_id, file);
                }}
            />
        </div>
    );
};

// 3. Space Detail View
const SpaceDetailView = ({ space, meetings, onBack, onJoin, onSchedule, onInstantMeet }: { space: ClientSpace | undefined, meetings: Meeting[], onBack: () => void, onJoin: (id: string) => void, onSchedule: (data: any) => void, onInstantMeet: (spaceId: string) => void }) => {
    const { user, profile } = useAuth();
    const { showToast } = useToast();

    // Guard against undefined space (Alan's "Production apps never assume")
    if (!space) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-20 bg-white">
                <div className="h-12 w-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
                <Heading level={2}>Loading Space...</Heading>
                <Text variant="secondary">Preparing your workspace environments.</Text>
                <Button variant="ghost" className="mt-6" onClick={onBack}>
                    <ChevronLeft size={16} className="mr-2" /> Back to Dashboard
                </Button>
            </div>
        );
    }

    const [activeTab, setActiveTab] = useState<'Dashboard' | 'Chat' | 'Meetings' | 'Docs'>('Dashboard');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

    // Filter meetings for this space
    const localMeetings = meetings.filter(m => m.space_id === space.id && !m.deleted_at);

    // Schedule state
    const [newMeetingDate, setNewMeetingDate] = useState('');
    const [newMeetingTime, setNewMeetingTime] = useState('');
    const [newMeetingTitle, setNewMeetingTitle] = useState(`${space.name} Sync`);
    const [notifyClient, setNotifyClient] = useState(true);

    const handleLocalSchedule = () => {
        onSchedule({
            spaceId: space.id,
            title: newMeetingTitle,
            date: newMeetingDate,
            time: newMeetingTime,
            notify: notifyClient
        });
        setIsScheduleModalOpen(false);
    };
    const [showTrash, setShowTrash] = useState(false);
    const [viewingFile, setViewingFile] = useState<SpaceFile | null>(null);
    const { files, loading: filesLoading } = useRealtimeFiles(space.id, showTrash);
    const { sendFile, loading: uploadLoading } = useRealtimeMessages(space.id);

    if (!space) return null;

    const handleFileUpload = async (file: File) => {
        if (!profile?.organization_id) return;
        await sendFile(profile.organization_id, file);
    };

    return (
        <div className="animate-[fadeIn_0.5s_ease-out] flex flex-col h-[calc(100vh-64px)]">
            {/* Navigation Header */}
            <div className="flex items-center gap-4 mb-6">
                <button title="Go Back" onClick={onBack} className="p-2 rounded-full hover:bg-zinc-100 transition-colors">
                    <ArrowLeft size={20} className="text-zinc-500" />
                </button>
                <div>
                    <h1 className="text-2xl font-light text-[#1D1D1D]">{space.name}</h1>
                    <p className="text-sm text-zinc-500">Managed by You</p>
                </div>
                <div className="ml-auto flex bg-white/50 p-1 rounded-md border border-zinc-200">
                    {['Dashboard', 'Chat', 'Meetings', 'Docs'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-[#1D1D1D] text-white shadow-sm' : 'text-zinc-500 hover:text-[#1D1D1D]'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
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
                                <Heading level={3} className="mb-4">Space Info</Heading>
                                <div className="space-y-2 text-sm text-zinc-600">
                                    <p><span className="font-medium text-[#1D1D1D]">Visibility:</span> {space.visibility}</p>
                                    <p><span className="font-medium text-[#1D1D1D]">Role:</span> {space.role}</p>
                                    <p><span className="font-medium text-[#1D1D1D]">Status:</span> {space.status}</p>
                                </div>
                            </GlassCard>
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
                                {localMeetings.map(m => (
                                    <GlassCard key={m.id} className="p-4 flex flex-col justify-between h-32">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold text-sm truncate max-w-[150px]">{m.title}</p>
                                                <div className="text-[10px] text-zinc-500 uppercase tracking-tighter">
                                                    {m.status === 'live' ? (
                                                        <span className="text-emerald-500 font-bold flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> LIVE NOW
                                                        </span>
                                                    ) : m.status}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold">{new Date(m.starts_at).toLocaleDateString()}</p>
                                                <p className="text-[10px] text-zinc-400">{new Date(m.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                        </div>
                                        <Button variant={m.status === 'live' ? 'primary' : 'outline'} size="sm" className="w-full mt-2" onClick={() => onJoin(m.id)}>
                                            {m.status === 'live' ? 'Join Now' : 'Enter Lobby'}
                                        </Button>
                                    </GlassCard>
                                ))}
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
                                <Button className="w-full mt-4" onClick={handleLocalSchedule}>Schedule for this Space</Button>
                            </div>
                        </Modal>
                    </div>
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
                                                <p className="font-medium text-[#1D1D1D]">{file.name}</p>
                                                <p className="text-xs text-zinc-500">
                                                    {file.file_size ? `${(file.file_size / (1024 * 1024)).toFixed(2)} MB` : 'Size unknown'} • {new Date(file.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {!showTrash ? (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 text-zinc-400 hover:text-[#1D1D1D]"
                                                        onClick={() => setViewingFile(file as any)}
                                                    >
                                                        <Eye size={16} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        onClick={async () => {
                                                            const { data } = await apiService.getSignedUrl(file.id, profile?.organization_id);
                                                            if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                                        }}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Download size={16} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        onClick={async () => {
                                                            if (confirm('Are you sure you want to move this file to trash?')) {
                                                                try {
                                                                    await apiService.deleteFile(file.id, profile?.organization_id);
                                                                    showToast('File moved to trash.', "success");
                                                                } catch (err: any) {
                                                                    showToast(`Failed to trash file: ${err.message}`, "error");
                                                                }
                                                            }
                                                        }}
                                                        className="h-8 w-8 p-0 text-zinc-500 hover:text-rose-500"
                                                    >
                                                        <Trash2 size={16} />
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        onClick={async () => {
                                                            try {
                                                                await apiService.restoreFile(file.id, profile?.organization_id);
                                                                showToast('File restored.', "success");
                                                            } catch (err: any) {
                                                                showToast(`Failed to restore file: ${err.message}`, "error");
                                                            }
                                                        }}
                                                        className="h-8 w-8 p-0 text-zinc-400 hover:text-emerald-500"
                                                        title="Restore File"
                                                    >
                                                        <ArrowLeft size={16} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        onClick={async () => {
                                                            if (confirm('PERMANENT DELETE: Are you sure? This cannot be undone.')) {
                                                                try {
                                                                    await apiService.hardDeleteFile(file.id, profile?.organization_id);
                                                                    showToast('File permanently deleted.', "success");
                                                                } catch (err: any) {
                                                                    showToast(`Failed to delete file: ${err.message}`, "error");
                                                                }
                                                            }
                                                        }}
                                                        className="h-8 w-8 p-0 text-zinc-400 hover:text-rose-600"
                                                        title="Delete Permanently"
                                                    >
                                                        <Trash2 size={16} />
                                                    </Button>
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

            <FileUploadModal
                isOpen={activeTab !== 'Chat' && isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onUpload={handleFileUpload}
                loading={uploadLoading}
            />

            {viewingFile && (
                <FileViewerModal
                    fileId={viewingFile.id}
                    filename={viewingFile.name}
                    mimeType={viewingFile.mime_type || 'application/pdf'}
                    onClose={() => setViewingFile(null)}
                />
            )}
        </div>
    );
};

// 4. Meeting Hub
const GlobalMeetingsView = ({ meetings, clients, onSchedule, onJoin, onInstantMeet }: { meetings: Meeting[], clients: ClientSpace[], onSchedule: (m: any) => void, onJoin: (id: string) => void, onInstantMeet: (spaceId: string) => void }) => {
    const [tab, setTab] = useState<'Upcoming' | 'History'>('Upcoming');
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

    // Schedule Form State
    const [newMeetingSpace, setNewMeetingSpace] = useState(clients[0]?.id || '');
    const [newMeetingDate, setNewMeetingDate] = useState('');
    const [newMeetingTime, setNewMeetingTime] = useState('');
    const [newMeetingTitle, setNewMeetingTitle] = useState('New Meeting');
    const [notifyClient, setNotifyClient] = useState(true);

    const handleSchedule = () => {
        onSchedule({
            spaceId: newMeetingSpace,
            title: newMeetingTitle,
            date: newMeetingDate,
            time: newMeetingTime,
            notify: notifyClient
        });
        setIsScheduleOpen(false);
    };

    const joinRoom = async (meetingId: string) => {
        onJoin(meetingId);
    };

    return (
        <div>
            <header className="flex justify-between items-center mb-8">
                <div>
                    <Heading level={1}>Meetings Hub</Heading>
                    <Text variant="secondary" className="mt-1">Schedule and manage video calls.</Text>
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" size="sm" onClick={() => onInstantMeet('')}>
                        <Video size={16} className="mr-1" /> Meet Now
                    </Button>
                    <div className="bg-[#ECECF1] p-1 rounded-md border border-[#D1D5DB]/30 flex">
                        <button onClick={() => setTab('Upcoming')} className={`px-4 py-1 rounded text-xs font-semibold transition-all ${tab === 'Upcoming' ? 'bg-white text-[#1D1D1D] shadow-sm' : 'text-[#8E8EA0] hover:text-[#1D1D1D]'}`}>Upcoming</button>
                        <button onClick={() => setTab('History')} className={`px-4 py-1 rounded text-xs font-semibold transition-all ${tab === 'History' ? 'bg-white text-[#1D1D1D] shadow-sm' : 'text-[#8E8EA0] hover:text-[#1D1D1D]'}`}>History</button>
                    </div>
                    <Button variant="primary" size="sm" onClick={() => setIsScheduleOpen(true)}>
                        <Plus size={16} className="mr-1" /> Schedule
                    </Button>
                </div>
            </header>

            {tab === 'Upcoming' ? (
                <div className="space-y-4">
                    {meetings.filter(m => m.status === 'scheduled' || m.status === 'active').map(meeting => (
                        <GlassCard key={meeting.id} className="p-6 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="bg-[#F7F7F8] border border-[#D1D5DB]/30 rounded-md px-4 py-3 text-center min-w-[80px]">
                                    <p className="text-[10px] text-[#8E8EA0] uppercase font-bold tracking-wider">{new Date(meeting.starts_at).toLocaleString('default', { month: 'short' })}</p>
                                    <p className="text-xl font-medium text-[#1D1D1D]">{new Date(meeting.starts_at).getDate()}</p>
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-[#1D1D1D]">{meeting.title}</h3>
                                    <div className="flex items-center gap-4 mt-1">
                                        <span className="text-sm text-zinc-500 flex items-center gap-1"><Clock size={14} /> {new Date(meeting.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="text-sm text-zinc-500 flex items-center gap-1"><Users size={14} /> {clients.find(c => c.id === meeting.space_id)?.name || 'Unknown'}</span>
                                    </div>
                                </div>
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => joinRoom(meeting.id)}>
                                Join Room <ArrowRight size={14} className="ml-1" />
                            </Button>
                        </GlassCard>
                    ))}
                </div>
            ) : (
                <div className="space-y-4">
                    {meetings.filter(m => m.status === 'ended' || m.status === 'cancelled').map(meeting => (
                        <GlassCard key={meeting.id} className="p-6 flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity cursor-pointer" onClick={() => setSelectedMeeting(meeting)}>
                            <div className="flex items-center gap-6">
                                <div className="bg-[#F7F7F8] border border-[#D1D5DB]/50 rounded-md px-4 py-2 text-center min-w-[80px]">
                                    <p className="text-[10px] text-[#8E8EA0] font-bold">ENDED</p>
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-zinc-700">{meeting.title}</h3>
                                    <div className="flex items-center gap-4 mt-1">
                                        <span className="text-sm text-zinc-400">{new Date(meeting.starts_at).toLocaleDateString()}</span>
                                        <span className="text-sm text-zinc-400">{clients.find(c => c.id === meeting.space_id)?.name || 'Unknown'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {meeting.recording_status === 'available' && <div className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs">Rec</div>}
                                {meeting.notes && <div className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs">Notes</div>}
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}

            {/* Schedule Modal */}
            <Modal isOpen={isScheduleOpen} onClose={() => setIsScheduleOpen(false)} title="Schedule Meeting">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Meeting Title</label>
                        <Input placeholder="e.g. Weekly Update" value={newMeetingTitle} onChange={e => setNewMeetingTitle(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Select Space</label>
                        <select
                            title="Select Space"
                            className="w-full bg-white/40 border border-zinc-200 rounded-lg px-5 py-3 text-zinc-800 text-sm focus:outline-none"
                            value={newMeetingSpace}
                            onChange={(e) => setNewMeetingSpace(e.target.value)}
                        >
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
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
                    <Button className="w-full mt-4" onClick={handleSchedule}>Schedule Meeting</Button>
                </div>
            </Modal>

            {/* Post-Meeting Summary Modal */}
            <Modal isOpen={!!selectedMeeting} onClose={() => setSelectedMeeting(null)} title="Meeting Summary">
                {selectedMeeting && (
                    <div className="space-y-6">
                        {/* Header Info */}
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-medium text-[#1D1D1D] mb-1">{selectedMeeting.title}</h3>
                                <p className="text-sm text-zinc-500 flex items-center gap-2">
                                    <Calendar size={14} /> {new Date(selectedMeeting.starts_at).toLocaleDateString()}
                                    <span className="text-zinc-300">•</span>
                                    <Clock size={14} /> {new Date(selectedMeeting.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <div className="px-3 py-1 bg-zinc-100 rounded-full text-xs font-semibold text-zinc-600">
                                {selectedMeeting.duration_minutes ? `${selectedMeeting.duration_minutes} min` : 'Ended'}
                            </div>
                        </div>

                        {/* Recording Section */}
                        <div className="bg-zinc-900 rounded-lg p-1 overflow-hidden">
                            {selectedMeeting.recording_status === 'available' ? (
                                <div className="relative group cursor-pointer" onClick={() => selectedMeeting.recording_url && window.open(selectedMeeting.recording_url, '_blank')}>
                                    <div className="aspect-video bg-zinc-800 rounded flex items-center justify-center relative overflow-hidden">
                                        {/* Placeholder Thumbnail or Abstract Gradient */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 opacity-50" />

                                        <div className="h-16 w-16 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-white/20 transition-all z-10">
                                            <Play size={32} className="text-white ml-2" />
                                        </div>
                                        <div className="absolute bottom-4 left-4 z-10">
                                            <p className="text-white font-medium text-sm">Watch Recording</p>
                                            <p className="text-zinc-400 text-xs">Click to open in new tab</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="aspect-video bg-zinc-800 rounded flex flex-col items-center justify-center text-zinc-500 gap-2">
                                    <Video size={32} className="opacity-20" />
                                    <p className="text-sm">No recording available</p>
                                </div>
                            )}
                        </div>

                        {/* Notes & Transcript Tabs */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-medium text-zinc-900 uppercase tracking-wider">Meeting Notes</h4>
                            <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-lg text-sm text-zinc-600 leading-relaxed min-h-[100px]">
                                {selectedMeeting.notes || <span className="text-zinc-400 italic">No notes were taken during this session.</span>}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button className="flex-1" variant="secondary" onClick={() => setSelectedMeeting(null)}>Close</Button>
                            {selectedMeeting.recording_url && (
                                <Button className="flex-1" onClick={() => window.open(selectedMeeting.recording_url, '_blank')}>
                                    <Download size={16} className="mr-2" /> Download Recording
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

// 5. Task View
const TaskView = ({ tasks, clients, onUpdateStatus, onCreate }: { tasks: Task[], clients: ClientSpace[], onUpdateStatus: (id: string, status: any) => void, onCreate: (t: any) => void }) => {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskSpace, setNewTaskSpace] = useState(clients[0]?.id || '');
    const [newTaskDate, setNewTaskDate] = useState('');

    const handleDrop = (e: React.DragEvent, newStatus: Task['status']) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('taskId');
        onUpdateStatus(taskId, newStatus);
    };

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        e.dataTransfer.setData('taskId', taskId);
    };

    const handleCreate = () => {
        onCreate({
            title: newTaskTitle,
            clientSpaceId: newTaskSpace,
            dueDate: newTaskDate,
            status: 'Pending',
            assigneeId: 'staff-1'
        });
        setIsCreateOpen(false);
    };

    return (
        <div className="h-full flex flex-col">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <Heading level={1}>Tasks</Heading>
                    <Text variant="secondary" className="mt-1">Manage team workload.</Text>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus size={18} /> New Task
                </Button>
            </header>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
                {(['Pending', 'In Progress', 'Done'] as const).map(status => (
                    <div
                        key={status}
                        className="bg-[#F7F7F8] rounded-lg p-4 flex flex-col h-full border border-[#D1D5DB]"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, status)}
                    >
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h3 className="font-medium text-zinc-500 text-sm uppercase tracking-wider">{status}</h3>
                            <span className="bg-white text-zinc-500 text-xs px-2 py-0.5 rounded-full shadow-sm">{tasks.filter(t => t.status === status).length}</span>
                        </div>
                        <div className="space-y-3 overflow-y-auto flex-1 min-h-[200px]">
                            {tasks.filter(t => t.status === status).map(task => {
                                const spaceName = clients.find(c => c.id === task.clientSpaceId)?.name || 'General';
                                return (
                                    <div
                                        key={task.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, task.id)}
                                        className="bg-white p-4 rounded-md border border-[#D1D5DB] shadow-sm cursor-grab active:cursor-grabbing hover:border-[#10A37F] transition-colors"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 truncate max-w-[100px]">{spaceName}</span>
                                            <div className="text-zinc-300"><GripVertical size={14} /></div>
                                        </div>
                                        <p className="text-sm font-medium text-[#1D1D1D] mb-3">{task.title}</p>
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-50">
                                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                                                <Clock size={12} /> {task.dueDate}
                                            </div>
                                            <div className="h-6 w-6 rounded-full bg-[#1D1D1D] text-white text-[10px] flex items-center justify-center" title="Assigned to You">YO</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Task">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Task Title</label>
                        <Input placeholder="e.g. Prepare Contract" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Linked Space</label>
                        <select
                            title="Link to Space"
                            className="w-full bg-white/40 border border-zinc-200 rounded-lg px-5 py-3 text-zinc-800 text-sm focus:outline-none"
                            value={newTaskSpace}
                            onChange={e => setNewTaskSpace(e.target.value)}
                        >
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Due Date</label>
                        <Input type="date" value={newTaskDate} onChange={e => setNewTaskDate(e.target.value)} />
                    </div>
                    <Button className="w-full mt-4" onClick={handleCreate}>Create Task</Button>
                </div>
            </Modal>
        </div>
    )
}

// 6. Files View
const GlobalFilesView = ({ clients, profile }: { clients: ClientSpace[], profile: any }) => {
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isInternalUploadModalOpen, setIsInternalUploadModalOpen] = useState(false);
    const [selectedSpaceForUpload, setSelectedSpaceForUpload] = useState<string>(clients[0]?.id || '');
    const [uploading, setUploading] = useState(false);
    const [viewingFile, setViewingFile] = useState<SpaceFile | null>(null);
    const [showTrash, setShowTrash] = useState(false);
    const { files: realtimeFiles, loading: filesLoading } = useRealtimeFiles('', showTrash);
    const { showToast } = useToast(); // Added useToast hook

    // Group files by client
    const groupedFiles = clients.map(client => ({
        client,
        files: realtimeFiles.filter(f => f.space_id === client.id)
    }));

    return (
        <div>
            <header className="flex justify-between items-center mb-8">
                <div>
                    <Heading level={1}>Files</Heading>
                    <Text variant="secondary" className="mt-1">Central repository for all documents.</Text>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setShowTrash(!showTrash)} className={showTrash ? 'text-rose-500 bg-rose-50' : ''}>
                        <Trash2 size={18} className="mr-2" /> {showTrash ? 'Exit Trash' : 'Trash'}
                    </Button>
                    <Button onClick={() => setIsUploadOpen(true)}>
                        <Upload size={18} className="mr-2" /> Upload Doc
                    </Button>
                </div>
            </header>

            <div className="space-y-8">
                {groupedFiles.map(({ client, files }) => (
                    <div key={client.id}>
                        <h3 className="text-lg font-medium text-[#1D1D1D] mb-4 flex items-center gap-2">
                            <Briefcase size={18} className="text-zinc-400" /> {client.name}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {files.length > 0 ? files.map(file => (
                                <GlassCard key={file.id} className="p-4 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-zinc-100 p-2 rounded-lg text-zinc-600">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-[#1D1D1D] truncate max-w-[150px]">{file.name}</p>
                                            <p className="text-xs text-zinc-500">
                                                {file.is_global ? 'Global Asset' : (file.file_size ? `${(file.file_size / (1024 * 1024)).toFixed(2)} MB • ` : '') + new Date(file.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {!showTrash ? (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 text-zinc-400 hover:text-[#1D1D1D]"
                                                    onClick={() => setViewingFile(file as any)}
                                                >
                                                    <Eye size={16} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0"
                                                    onClick={async () => {
                                                        const { data } = await apiService.getSignedUrl(file.id, profile?.organization_id);
                                                        if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                                    }}
                                                >
                                                    <Download size={16} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    onClick={async () => {
                                                        if (confirm('Are you sure you want to move this file to trash?')) {
                                                            try {
                                                                await apiService.deleteFile(file.id, profile?.organization_id);
                                                                showToast('File moved to trash.', "success");
                                                            } catch (err: any) {
                                                                showToast(`Failed to trash file: ${err.message}`, "error");
                                                            }
                                                        }
                                                    }}
                                                    className="h-8 w-8 p-0 text-zinc-500 hover:text-rose-500"
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    onClick={async () => {
                                                        try {
                                                            await apiService.restoreFile(file.id, profile?.organization_id);
                                                            showToast('File restored.', "success");
                                                        } catch (err: any) {
                                                            showToast(`Failed to restore file: ${err.message}`, "error");
                                                        }
                                                    }}
                                                    className="h-8 w-8 p-0 text-zinc-400 hover:text-emerald-500"
                                                    title="Restore File"
                                                >
                                                    <ArrowLeft size={16} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    onClick={async () => {
                                                        if (confirm('PERMANENT DELETE: Are you sure? This cannot be undone.')) {
                                                            try {
                                                                await apiService.hardDeleteFile(file.id, profile?.organization_id);
                                                                showToast('File permanently deleted.', "success");
                                                            } catch (err: any) {
                                                                showToast(`Failed to delete file: ${err.message}`, "error");
                                                            }
                                                        }
                                                    }}
                                                    className="h-8 w-8 p-0 text-zinc-400 hover:text-rose-600"
                                                    title="Delete Permanently"
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </GlassCard>
                            )) : (
                                <div className="col-span-3 text-center py-8 border border-dashed border-[#D1D5DB] rounded-lg text-[#8E8EA0] text-sm">
                                    No files in this space.
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <Modal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} title="Select Destination Space">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Upload To</label>
                        <select
                            title="Select Destination Space"
                            className="w-full bg-white/40 border border-zinc-200 rounded-lg px-5 py-3 text-zinc-800 text-sm focus:outline-none"
                            value={selectedSpaceForUpload}
                            onChange={(e) => setSelectedSpaceForUpload(e.target.value)}
                        >
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <Button
                        className="w-full mt-4"
                        onClick={() => {
                            setIsUploadOpen(false);
                            setIsInternalUploadModalOpen(true);
                        }}
                    >
                        Continue to Upload
                    </Button>
                </div>
            </Modal>

            <FileUploadModal
                isOpen={isInternalUploadModalOpen}
                onClose={() => setIsInternalUploadModalOpen(false)}
                loading={uploading}
                onUpload={async (file) => {
                    if (!selectedSpaceForUpload || !profile?.organization_id) return;
                    setUploading(true);
                    try {
                        const fileData = await apiService.uploadFile(selectedSpaceForUpload, profile.organization_id, file);
                        await apiService.sendMessage(
                            selectedSpaceForUpload,
                            profile.organization_id,
                            `Shared a file: ${file.name}`,
                            'file',
                            { file_id: fileData.id, file_name: file.name, mime_type: file.type }
                        );
                        setIsInternalUploadModalOpen(false);
                        showToast("File uploaded successfully.", "success");
                    } catch (err: any) {
                        console.error("Upload error:", err);
                        showToast(`Failed to upload file: ${err.message}`, "error");
                    } finally {
                        setUploading(false);
                    }
                }}
            />

            {viewingFile && (
                <FileViewerModal
                    fileId={viewingFile.id}
                    filename={viewingFile.name}
                    mimeType={viewingFile.mime_type || 'application/pdf'} // Default to PDF if unknown, or handle strictly
                    onClose={() => setViewingFile(null)}
                />
            )}
        </div>
    );
};


// 8. Settings View
const SettingsView = () => {
    const { profile } = useAuth();

    return (
        <div>
            <Heading level={1} className="mb-8">Settings</Heading>
            {/* Organization Policies (Admins Only) */}
            {(profile?.role === 'owner' || profile?.role === 'admin') && (
                <div className="mb-12">
                    <PolicySettings />
                </div>
            )}

            <div className="space-y-6 max-w-2xl">
                <GlassCard className="p-6">
                    <Heading level={3} className="mb-4">Data Management</Heading>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-[#F7F7F8] rounded-md border border-[#D1D5DB]/30">
                            <div>
                                <p className="font-medium text-[#1D1D1D]">Export All Data</p>
                                <p className="text-sm text-zinc-500">Download clients, records, and logs.</p>
                            </div>
                            <Button variant="secondary"><Download size={16} className="mr-2" /> Download</Button>
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="p-6 border-red-100">
                    <Heading level={3} className="mb-4 text-red-600">Danger Zone</Heading>
                    <div className="flex items-center justify-between p-4 bg-red-50 rounded-md">
                        <div>
                            <p className="font-medium text-red-900">Delete Account</p>
                            <p className="text-sm text-red-500">Permanently delete your organization.</p>
                        </div>
                        <Button variant="danger"><Trash2 size={16} className="mr-2" /> Delete</Button>
                    </div>
                </GlassCard>
            </div>
        </div>
    )
}

// 9. Inbox View - Realtime Chat
const InboxView = ({ clients, inboxData }: { clients: ClientSpace[], inboxData: any[] }) => {
    const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(clients[0]?.id || null);
    const { user, profile } = useAuth();
    const [messageInput, setMessageInput] = useState('');
    const [sending, setSending] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const { showToast } = useToast(); // Added useToast hook

    // Use realtime messages hook
    const { messages, loading, error, sendMessage, sendFile, messagesEndRef } = useRealtimeMessages(selectedSpaceId || '', profile?.organization_id);

    const activeClient = clients.find(c => c.id === selectedSpaceId);

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
            <GlassCard className="w-1/3 flex flex-col h-full overflow-hidden border-[#D1D5DB] rounded-lg">
                <div className="p-4 border-b border-[#D1D5DB] bg-[#F7F7F8]">
                    <Heading level={2} className="mb-4">Inbox</Heading>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8EA0]" />
                        <input type="text" placeholder="Search chats..." className="w-full bg-white border border-[#D1D5DB] rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#10A37F] focus:border-[#10A37F] transition-all" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {inboxData.map(item => (
                        <div
                            key={item.space_id}
                            onClick={() => setSelectedSpaceId(item.space_id)}
                            className={`p-4 border-b border-zinc-50 cursor-pointer hover:bg-zinc-50 transition-colors ${selectedSpaceId === item.space_id ? 'bg-zinc-50 border-l-2 border-l-[#10A37F]' : ''}`}
                        >
                            <div className="flex justify-between mb-1">
                                <span className={`font-medium ${selectedSpaceId === item.space_id ? 'text-[#1D1D1D]' : 'text-zinc-700'}`}>{item.space_name}</span>
                                <span className="text-[10px] text-zinc-400">
                                    {item.last_message_at ? new Date(item.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Join'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <p className="text-xs text-zinc-500 truncate max-w-[180px]">
                                    {item.last_message_content || 'No messages yet'}
                                </p>
                                {item.unread_count > 0 && (
                                    <div className="h-4 w-4 bg-[#10A37F] text-white text-[10px] flex items-center justify-center rounded-full font-bold">
                                        {item.unread_count}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </GlassCard>

            {/* Chat Area */}
            <GlassCard className="flex-1 flex flex-col h-full overflow-hidden relative">
                {selectedSpaceId ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-white/50 backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-[#1D1D1D] text-white flex items-center justify-center font-bold">
                                    {activeClient?.name.substring(0, 2)}
                                </div>
                                <div>
                                    <h3 className="font-medium text-[#1D1D1D]">{activeClient?.name}</h3>
                                    <p className="text-xs text-zinc-500">
                                        {loading ? 'Loading...' : `${messages.length} messages`}
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" className="h-8 w-8 p-0 rounded-full"><MoreVertical size={18} /></Button>
                        </div>

                        {/* Messages Feed */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/30">
                            {loading ? (
                                <div className="flex items-center justify-center h-full text-zinc-400">
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
                                    <div key={msg.id} className={`flex ${msg.sender_type === 'staff' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] p-4 rounded-lg ${msg.sender_type === 'staff' ? 'bg-[#1D1D1D] text-white rounded-br-none' : 'bg-white shadow-sm border border-zinc-100 rounded-bl-none'}`}>
                                            {msg.sender?.full_name && (
                                                <p className={`text-[10px] mb-1 font-medium ${msg.sender_type === 'staff' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                                    {msg.sender.full_name}
                                                </p>
                                            )}

                                            {msg.extension === 'file' ? (
                                                <div className={`flex items-center gap-3 p-3 rounded-md ${msg.sender_type === 'staff' ? 'bg-white/10' : 'bg-zinc-50'}`}>
                                                    <div className="p-2.5 bg-indigo-500/20 rounded-lg text-indigo-400">
                                                        <DocIcon size={20} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium truncate text-xs">{msg.payload?.file_name}</p>
                                                        <p className="text-[10px] opacity-60">Shared Document</p>
                                                    </div>
                                                    <button
                                                        title="Download File"
                                                        onClick={async () => {
                                                            const { data } = await apiService.getSignedUrl(msg.payload.file_id, profile?.organization_id);
                                                            if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                                        }}
                                                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                                    >
                                                        <Download size={18} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <p className="text-sm leading-relaxed">{msg.content}</p>
                                            )}

                                            <p className={`text-[10px] mt-2 text-right opacity-70 ${msg.sender_type === 'staff' ? 'text-zinc-300' : 'text-zinc-400'}`}>
                                                {formatTime(msg.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-zinc-100">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="ghost"
                                    className="p-2 text-zinc-400 hover:text-indigo-500"
                                    onClick={() => setIsUploadModalOpen(true)}
                                >
                                    <FilePlus2 size={20} />
                                </Button>
                                <input
                                    className="flex-1 bg-zinc-100 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-300"
                                    placeholder="Type a message..."
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    disabled={sending}
                                />
                                <button
                                    title="Send Message"
                                    className="h-10 w-10 bg-[#1D1D1D] text-white rounded-full flex items-center justify-center hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                            onUpload={async (file) => {
                                if (!selectedSpaceId || !profile?.organization_id) return;
                                await sendFile(profile.organization_id, file);
                            }}
                        />
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
                        <MessageSquare size={48} className="mb-4 opacity-20" />
                        <p>Select a conversation to start chatting</p>
                    </div>
                )}
            </GlassCard>
        </div>
    );
};

// 11. Accountability Ledger (History) View
const HistoryView = ({ logs }: { logs: any[] }) => {
    const getActionIcon = (type: string) => {
        switch (type) {
            case 'SPACE_CREATED': return <Plus size={16} className="text-emerald-500" />;
            case 'INVITATION_DISPATCHED': return <UserPlus size={16} className="text-blue-500" />;
            case 'CLIENT_PORTAL_ENTRY': return <Key size={16} className="text-amber-500" />;
            case 'FILE_UPLOADED': return <FileUp size={16} className="text-indigo-500" />;
            case 'SECURITY_ALERT': return <Shield size={16} className="text-red-500" />;
            default: return <Activity size={16} className="text-zinc-400" />;
        }
    };

    return (
        <div className="space-y-6 animate-[fadeIn_0.5s_ease-out]">
            <header className="mb-8">
                <Heading level={1}>Accountability Ledger</Heading>
                <Text variant="secondary" className="mt-1">Historical audit trail of all organization activities.</Text>
            </header>

            <GlassCard className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-100">
                                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Activity</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Space</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {logs.length > 0 ? logs.map((log) => (
                                <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-white border border-zinc-100 flex items-center justify-center shadow-sm">
                                                {getActionIcon(log.action_type)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-[#1D1D1D]">{log.action_type.replace(/_/g, ' ')}</p>
                                                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter opacity-60">Success</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-600">
                                                {log.profiles?.full_name?.substring(0, 2).toUpperCase() || '??'}
                                            </div>
                                            <span className="text-sm text-zinc-600">{log.profiles?.full_name || 'System'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-zinc-500">{log.client_spaces?.name || 'Organization'}</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-zinc-400">
                                        {new Date(log.created_at).toLocaleString()}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 italic text-sm">
                                        No activity logs found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>
        </div>
    );
};

// 10. Client Portal View
const ClientPortalView = ({ client, meetings, files, messages, onJoin, onLogout }: { client: ClientSpace, meetings: Meeting[], files: SpaceFile[], messages: Message[], onJoin: (id: string) => void, onLogout: () => void }) => {
    const recentFiles = files.filter(f => f.status === 'available').slice(0, 3);
    const nextMeeting = meetings
        .filter(m => m.status === 'scheduled')
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
    const lastMessage = messages[messages.length - 1];
    const { showToast } = useToast(); // Added useToast hook

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="min-h-screen bg-white dark:bg-black p-6 md:p-12 font-sans text-black dark:text-white">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Client Header */}
                <header className="flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-10 w-10 bg-[#1D1D1D] text-white rounded-lg flex items-center justify-center font-bold text-xl">N</div>
                            <span className="font-semibold text-lg tracking-tight">Nexus Portal</span>
                        </div>
                        <Heading level={2}>Welcome back to your Space</Heading>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="danger" onClick={() => showToast("Reporting Staff Member to Owner (Simulator)...", "info")}>
                            Report Performance
                        </Button>
                        <div className="h-10 w-10 bg-white rounded-full border border-zinc-200 flex items-center justify-center cursor-pointer" onClick={onLogout}>
                            <LogOut size={16} />
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Main Feed */}
                    <div className="md:col-span-2 space-y-6">
                        {/* Notification / Alert */}
                        <GlassCard className="p-6 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white border-none">
                            <h3 className="text-xl font-light mb-2">Workspace Update</h3>
                            <p className="text-zinc-300 font-light mb-4">Your workspace is active and secure. All shared documents are listed below.</p>
                        </GlassCard>

                        {/* Recent Files */}
                        <div>
                            <h3 className="text-lg font-medium mb-4 flex items-center gap-2"><FileText size={18} /> Shared Documents</h3>
                            <div className="space-y-3">
                                {recentFiles.length > 0 ? recentFiles.map(file => (
                                    <GlassCard key={file.id} className="p-4 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-zinc-50 text-zinc-600 p-2 rounded-lg"><FileText size={20} /></div>
                                            <div>
                                                <p className="font-medium text-sm">{file.name}</p>
                                                <p className="text-xs text-zinc-500">Added {formatDate(file.created_at)}</p>
                                            </div>
                                        </div>
                                        <button
                                            title="Download File"
                                            onClick={async () => {
                                                const { data } = await apiService.getSignedUrl(file.id, client.organization_id);
                                                if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                            }}
                                            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                                        >
                                            <Download size={18} className="text-zinc-400 hover:text-[#1D1D1D]" />
                                        </button>
                                    </GlassCard>
                                )) : (
                                    <div className="text-center py-8 text-zinc-400 italic text-sm">No documents shared yet.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Next Meeting */}
                        <GlassCard className="p-6">
                            <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Next Meeting</h3>
                            {nextMeeting ? (
                                <div className="text-center py-4">
                                    <p className="text-3xl font-light">{new Date(nextMeeting.starts_at).getDate()} {new Date(nextMeeting.starts_at).toLocaleString('en-US', { month: 'short' })}</p>
                                    <p className="text-zinc-500">{formatTime(nextMeeting.starts_at)}</p>
                                    <p className="text-sm font-medium mt-2">{nextMeeting.title || 'Client Sync'}</p>
                                    <Button className="w-full mt-4" onClick={() => onJoin(nextMeeting.id)}>Join Meeting</Button>
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-zinc-400 text-sm italic">No upcoming meetings.</p>
                                </div>
                            )}
                        </GlassCard>

                        {/* Chat Preview */}
                        <GlassCard className="p-6">
                            <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Space Activity</h3>
                            {lastMessage ? (
                                <div className="bg-zinc-100 dark:bg-[#1D1D1D] rounded-md p-3 mb-4 text-sm text-zinc-600 dark:text-zinc-400 italic">
                                    "{lastMessage.content.length > 50 ? lastMessage.content.substring(0, 50) + '...' : lastMessage.content}"
                                </div>
                            ) : (
                                <div className="bg-zinc-100 dark:bg-[#1D1D1D] rounded-md p-3 mb-4 text-xs text-zinc-400 text-center italic">
                                    No recent messages.
                                </div>
                            )}
                            <Button variant="secondary" className="w-full">Open Chat</Button>
                        </GlassCard>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Client Onboarding View ---

const ClientOnboardingView = ({ space, onComplete }: { space: any, onComplete: (profileData: any) => void }) => {
    const { showToast } = useToast();
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleComplete = async () => {
        if (!name) return;
        setLoading(true);
        try {
            const { error } = await apiService.updateProfile({ full_name: name });
            if (error) throw error;
            onComplete({ full_name: name });
        } catch (err) {
            console.error("Onboarding error:", err);
            showToast("Error completing onboarding. Please try again.", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-4">
            <GlassCard className="max-w-md w-full p-8 text-center">
                <div className="h-16 w-16 bg-[#1D1D1D] rounded-lg flex items-center justify-center mx-auto mb-6">
                    <span className="text-white font-bold text-2xl">N</span>
                </div>
                <h2 className="text-2xl font-bold text-[#1D1D1D] mb-2">Welcome to your Portal</h2>
                <p className="text-zinc-500 mb-8">You've been invited to the <strong>{space?.name}</strong> workspace. Let's set up your profile.</p>

                <div className="space-y-4 text-left">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Your Full Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2 rounded-md border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                            placeholder="John Doe"
                        />
                    </div>
                </div>

                <Button
                    className="w-full mt-8"
                    onClick={handleComplete}
                    disabled={!name || loading}
                >
                    {loading ? 'Setting up...' : 'Enter Workspace'}
                </Button>
            </GlassCard>
        </div>
    );
};

// --- Layout Shells (Phase 15) ---

const AppLayout = ({ children, sidebar }: { children: React.ReactNode, sidebar: React.ReactNode }) => (
    <div className="flex h-screen w-full bg-white overflow-hidden font-sans">
        {sidebar}
        <main className="flex-1 relative flex flex-col bg-white overflow-hidden">
            {children}
        </main>
    </div>
);

const ClientLayout = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-white dark:bg-black font-sans text-black dark:text-white">
        {children}
    </div>
);

// --- Main App Component ---

const App = () => {
    const { user, profile, capabilities, loading } = useAuth();
    const can = (cap: string) => capabilities.includes(cap);
    const { showToast, removeToast } = useToast();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    useEffect(() => {
        if (user && !loading) {
            setIsAuthenticated(true);
        } else {
            setIsAuthenticated(false);
        }
    }, [user, loading]);

    // Global View State (Landing -> Onboarding -> App)
    const [globalView, setGlobalView] = useState<'AUTH' | 'APP' | 'ONBOARDING'>('AUTH');
    const [invitationToken, setInvitationToken] = useState<string | null>(null);
    const [onboardingSpace, setOnboardingSpace] = useState<any>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        if (token) {
            setInvitationToken(token);
            setGlobalView('ONBOARDING');
        }
    }, []);

    useEffect(() => {
        const checkInvite = async () => {
            if (invitationToken && isAuthenticated) {
                try {
                    const { data, error } = await apiService.acceptInvitation(invitationToken);
                    if (error) throw error;
                    setOnboardingSpace(data);
                } catch (err) {
                    console.error("Invite error:", err);
                    showToast("Invalid or expired invitation link.", "error");
                    setGlobalView('APP');
                }
            }
        };
        checkInvite();
    }, [invitationToken, isAuthenticated]);

    useEffect(() => {
        if (!user || !profile) return;

        const channel = supabase
            .channel(`notifications:${user.id}`)
            .on(
                'broadcast',
                { event: 'new_notification' },
                (payload) => {
                    console.log('Realtime notification received:', payload);
                    const { message, severity } = payload.payload;
                    showToast(message, severity === 'critical' ? 'error' : 'info');
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Subscribed to realtime notifications for user:', user.id);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, profile, showToast]);

    // App Internal State
    const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
    const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
    const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [lastInviteData, setLastInviteData] = useState<{ link: string | null, email: string, status?: string, invite_id?: string } | null>(null);

    const handleCloseMeeting = useCallback(() => {
        setActiveMeetingId(null);
    }, []);

    // Data State
    const [clients, setClients] = useState<ClientSpace[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [files, setFiles] = useState<SpaceFile[]>([]);
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [clientLifecycle, setClientLifecycle] = useState<ClientLifecycle[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [inboxData, setInboxData] = useState<any[]>([]);

    const [isInstantMeetingModalOpen, setIsInstantMeetingModalOpen] = useState(false);
    const [instantMeetingTargetSpace, setInstantMeetingTargetSpace] = useState<string | null>(null);
    const [instantMeetingTitle, setInstantMeetingTitle] = useState('Instant Meeting');

    const handleJoinMeeting = (meetingId: string) => {
        setActiveMeetingId(meetingId);
    };

    const handleUpdateStaffCapability = async (staffId: string, spaceId: string, capKey: string, allowed: boolean) => {
        try {
            await apiService.updateStaffCapability(staffId, spaceId, capKey, allowed);
            showToast("Capability updated successfully.", "success");
            fetchData(); // Refresh to show changes
        } catch (err: any) {
            showToast(`Error updating capability: ${err.message}`, "error");
        }
    };

    const fetchData = async () => {
        if (!user) return;
        setIsInitialLoading(true);
        try {
            const [spacesRes, tasksRes, meetingsRes, filesRes, staffRes, lifecycleRes] = await Promise.all([
                apiService.getSpaces(),
                apiService.getTasks(),
                apiService.getMeetings(),
                apiService.getFiles(),
                apiService.getStaffMembers(),
                apiService.getClientLifecycle()
            ]);

            if (spacesRes.data) setClients(spacesRes.data);
            if (tasksRes.data) setTasks(tasksRes.data);
            if (meetingsRes.data) setMeetings(meetingsRes.data);
            if (filesRes.data) setFiles(filesRes.data);
            if (staffRes) setStaff(staffRes);
            if (lifecycleRes) setClientLifecycle(lifecycleRes);

            const [logsRes, inboxRes] = await Promise.all([
                apiService.getActivityLogs(),
                apiService.getUnifiedInbox()
            ]);
            if (logsRes.data) setLogs(logsRes.data);
            if (inboxRes) setInboxData(inboxRes);

            setMessages([]);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setIsInitialLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchData();
        }
    }, [isAuthenticated]);

    if (loading || (isAuthenticated && isInitialLoading)) {
        return (
            <div className="flex h-screen w-full bg-white dark:bg-black overflow-hidden">
                {/* Skeleton Sidebar - Matches main sidebar dimensions */}
                <aside className="w-64 bg-white dark:bg-black border-r border-zinc-200 dark:border-zinc-800 flex flex-col justify-between p-4 z-20">
                    <div className="space-y-6">
                        {/* Logo Area */}
                        <div className="flex items-center gap-3 px-4 mb-10 mt-2">
                            <SkeletonLoader width="32px" height="32px" borderRadius="8px" />
                            <SkeletonText lines={1} width="60px" />
                        </div>
                        {/* Nav Items */}
                        <div className="space-y-2">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <SkeletonLoader key={i} height="44px" borderRadius="12px" className="w-full" />
                            ))}
                        </div>
                    </div>
                    {/* User Profile */}
                    <div className="p-2">
                        <SkeletonLoader height="56px" borderRadius="12px" />
                    </div>
                </aside>

                {/* Skeleton Main Content */}
                <main className="flex-1 p-8 space-y-8 overflow-hidden">
                    {/* Header */}
                    <div className="flex justify-between items-end">
                        <div className="space-y-3">
                            <SkeletonLoader width="200px" height="40px" borderRadius="8px" />
                            <SkeletonText lines={1} width="300px" />
                        </div>
                        <SkeletonLoader width="150px" height="32px" borderRadius="20px" />
                    </div>

                    {/* Dashboard Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <SkeletonCard key={i} className="h-40 bg-white dark:bg-black border-zinc-200 dark:border-zinc-800" />
                        ))}
                    </div>

                    {/* Large Chart/Table Area */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96">
                        <div className="lg:col-span-2 p-6 bg-white dark:bg-black rounded-md border border-zinc-200 dark:border-zinc-800">
                            <SkeletonLoader height="100%" borderRadius="8px" />
                        </div>
                        <div className="p-6 bg-white dark:bg-black rounded-md border border-zinc-200 dark:border-zinc-800">
                            <SkeletonLoader height="100%" borderRadius="8px" />
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // Handlers
    const handleCreateSpace = async (data: any) => {
        const loadingId = showToast("Creating your space...", "loading");
        try {
            const { data: newSpace, error } = await apiService.createSpace({
                name: data.name || 'New Client',
                description: `Workspace for ${data.name}`,
                modules: data.modules
            });

            if (error) throw error;
            if (newSpace) {
                // Construct a complete optimistic object to prevent UI crashes
                const optimisticSpace: ClientSpace = {
                    id: newSpace.id || newSpace, // Handle both object and string return types just in case
                    name: data.name || 'New Client',
                    description: `Workspace for ${data.name || 'New Client'}`,
                    modules: data.modules,
                    status: 'Active',
                    meeting_count: 0,
                    file_count: 0,
                    created_at: new Date().toISOString()
                };

                // Ensure we have a fresh list and navigate safely
                setClients(prev => [{ ...optimisticSpace }, ...prev]);
                setSelectedSpaceId(optimisticSpace.id);
                setCurrentView(ViewState.SPACE_DETAIL);

                // Background sync to pull real database defaults
                fetchData();

                showToast("Space Created Successfully!", "success");

                // SEED: Generate the hardened invitation via invite_user_secure() RPC
                // [AGENT 1] Token is never returned — email is dispatched asynchronously by the worker
                if (data.email) {
                    const { data: inviteRes, error: inviteErr } = await apiService.sendInvitation(
                        newSpace.id,
                        data.email,
                        'client'  // Space creation always invites as client
                    );

                    if (inviteErr) {
                        // Surface specific errors without blocking space creation success
                        if ((inviteErr as any).code === 'DUPLICATE_INVITE') {
                            showToast(`Invite not sent: An active invitation already exists for ${data.email}.`, 'info');
                        } else if ((inviteErr as any).code === 'CAPABILITY_DENIED') {
                            showToast('Invite not sent: You do not have permission to invite clients.', 'error');
                        } else if ((inviteErr as any).code === 'RATE_LIMITED') {
                            showToast('Invite not sent: Too many invitations sent recently.', 'error');
                        } else {
                            showToast(`Invite not sent: ${inviteErr.message}`, 'error');
                        }
                    } else if (inviteRes) {
                        // New behavior: email is sent asynchronously — show confirmation
                        setLastInviteData({
                            email: inviteRes.email || data.email,
                            invite_id: inviteRes.invite_id,
                            status: 'pending',
                            // No link — the email was dispatched by the worker
                            link: null
                        });
                        setShowInviteModal(true);
                    }
                }
            }
        } catch (err: any) {
            showToast(`Error creating space: ${err.message}`, "error");
        } finally {
            removeToast(loadingId);
        }
    };

    const handleCreateTask = async (data: any) => {
        try {
            const { data: newTask, error } = await apiService.createTask(data);
            if (error) throw error;
            if (newTask) {
                setTasks([newTask, ...tasks]);
            }
        } catch (err: any) {
            showToast(`Error creating task: ${err.message}`, "error");
        }
    };

    const handleTaskStatusUpdate = async (taskId: string, newStatus: Task['status']) => {
        try {
            const { error } = await apiService.updateTask(taskId, { status: newStatus });
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
                showToast('Please select a space first or create one.', "info");
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
                recording_enabled: true
            });

            if (data?.meeting?.id) {
                setActiveMeetingId(data.meeting.id);
                setIsInstantMeetingModalOpen(false);
                fetchData(); // Refresh list to show new meeting
            } else if (error) {
                showToast(`Meeting error: ${error}`, "error");
            }
        } catch (err) {
            console.error('Instant meeting failed:', err);
        }
    };

    const handleScheduleMeeting = async (data: any) => {
        try {
            const { data: newMeeting, error } = await apiService.scheduleMeeting({
                space_id: data.spaceId,
                title: data.title || 'Scheduled Meeting',
                starts_at: `${data.date}T${data.time}:00Z`,
                description: data.description,
                recording_enabled: data.recording_enabled
            });
            if (error) throw error;
            if (newMeeting) {
                setMeetings([newMeeting, ...meetings]);
                if (data.notify) {
                    const clientName = clients.find(c => c.id === data.spaceId)?.name || 'Unknown';
                    showToast(`Meeting scheduled. Notification sent to ${clientName}`, "success");
                }
                fetchData(); // Refresh UI
            }
        } catch (err: any) {
            showToast(`Error scheduling meeting: ${err.message}`, "error");
        }
    };


    // View Routing (Phase 15 - Capability Driven)
    const renderContent = () => {
        if (can('is_client_portal')) {
            const currentClient = clients[0];
            if (!currentClient) return <div className="p-8">Loading Portal...</div>;
            return <ClientPortalView
                client={currentClient}
                meetings={meetings}
                files={files}
                messages={messages}
                onJoin={handleJoinMeeting}
                onLogout={() => supabase.auth.signOut()}
            />;
        }

        // --- Route Selection using Capability Lens ---
        switch (currentView) {
            case ViewState.DASHBOARD:
                if (!can('can_view_dashboard')) return <div className="p-8">Access Denied</div>;
                return <StaffDashboardView
                    clients={clients}
                    messages={messages}
                    meetings={meetings}
                    tasks={tasks}
                    profile={profile}
                    onJoin={handleJoinMeeting}
                    onInstantMeet={() => handleInstantMeeting(clients[0]?.id)}
                />;
            case ViewState.ACTIVITY_LEDGER:
                if (!can('can_view_history')) return <div className="p-8">Access Denied</div>;
                return <HistoryView logs={logs} />;
            case ViewState.SPACES:
                if (!can('can_view_all_spaces')) return <div className="p-8">Access Denied</div>;
                return <SpacesView clients={clients} onSelect={(id) => { setSelectedSpaceId(id); setCurrentView(ViewState.SPACE_DETAIL); }} onCreate={handleCreateSpace} />;
            case ViewState.SPACE_DETAIL:
                return <SpaceDetailView
                    space={clients.find(c => c.id === selectedSpaceId)}
                    meetings={meetings}
                    onBack={() => setCurrentView(ViewState.SPACES)}
                    onJoin={handleJoinMeeting}
                    onSchedule={handleScheduleMeeting}
                    onInstantMeet={handleInstantMeeting}
                />;
            case ViewState.INBOX:
                if (!can('can_view_dashboard')) return <div className="p-8">Access Denied</div>;
                return <InboxView clients={clients} inboxData={inboxData} />;
            case ViewState.CRM:
                if (!can('owner') && !can('admin')) return <div className="p-8">Access Denied</div>;
                return (
                    <ClientsCRMView
                        clients={clientLifecycle}
                        loading={isInitialLoading}
                    />
                );
            case ViewState.STAFF:
                if (!can('can_manage_team')) return <div className="p-8">Access Denied</div>;
                return (
                    <StaffView
                        staff={staff}
                        spaces={clients}
                        onInvite={() => { }}
                        onUpdateCapability={handleUpdateStaffCapability}
                    />
                );
            case ViewState.TASKS:
                if (!can('can_view_tasks')) return <div className="p-8">Access Denied</div>;
                return <TaskView tasks={tasks} clients={clients} onUpdateStatus={handleTaskStatusUpdate} onCreate={handleCreateTask} />;
            case ViewState.MEETINGS:
                if (!can('can_view_meetings')) return <div className="p-8">Access Denied</div>;
                return <GlobalMeetingsView
                    meetings={meetings}
                    clients={clients}
                    onSchedule={handleScheduleMeeting}
                    onJoin={handleJoinMeeting}
                    onInstantMeet={handleInstantMeeting}
                />;
            case ViewState.FILES:
                if (!can('can_view_files')) return <div className="p-8">Access Denied</div>;
                return <GlobalFilesView clients={clients} profile={profile} />;
            case ViewState.SETTINGS:
                if (!can('can_view_settings')) return <div className="p-8">Access Denied</div>;
                return <SettingsView />;
            default:
                return <div className="p-8">View Not Found</div>;
        }
    };

    if (!isAuthenticated) {
        return <LoginForm onSuccess={() => {
            if (invitationToken) setGlobalView('ONBOARDING');
            else setGlobalView('APP');
        }} />;
    }

    if (globalView === 'ONBOARDING') {
        return <ClientOnboardingView
            space={onboardingSpace}
            onComplete={(data) => {
                setGlobalView('APP');
                // Clean up token from URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }}
        />;
    }

    if (globalView === 'AUTH') {
        setGlobalView('APP');
    }

    if (can('is_client_portal')) {
        return (
            <ClientLayout>
                {renderContent()}
            </ClientLayout>
        );
    }

    return (
        <>
            <AppLayout
                sidebar={
                    <aside className="w-64 bg-[#ECECF1] border-r border-[#D1D5DB] flex flex-col justify-between p-4 z-20 transition-all duration-200">
                        <div className="space-y-8">
                            {/* Logo Area */}
                            <div className="flex items-center gap-3 px-3 mb-8 mt-2">
                                <div className="h-8 w-8 bg-[#10A37F] rounded-md flex items-center justify-center text-white">
                                    <Rocket size={20} />
                                </div>
                                <span className="font-bold text-xl tracking-tight text-[#1D1D1D]">Space.inc</span>
                            </div>

                            {/* Search Bar */}
                            <div className="px-2 relative group mb-4">
                                <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#8E8EA0]" />
                                <input
                                    placeholder="Search..."
                                    className="w-full bg-white border border-[#D1D5DB] rounded-md py-2 pl-10 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-[#10A37F] focus:border-[#10A37F] transition-all"
                                />
                            </div>

                            {/* Nav Items */}
                            <nav className="space-y-1">
                                {can('can_view_dashboard') && <NavItem icon={<LayoutGrid size={16} />} label="Dashboard" active={currentView === ViewState.DASHBOARD} onClick={() => setCurrentView(ViewState.DASHBOARD)} />}
                                {can('can_view_history') && <NavItem icon={<Activity size={16} />} label="History" active={currentView === ViewState.ACTIVITY_LEDGER} onClick={() => setCurrentView(ViewState.ACTIVITY_LEDGER)} />}
                                {(can('can_view_all_spaces') || can('can_view_assigned_spaces')) && <NavItem icon={<Users size={16} />} label="Spaces" active={currentView === ViewState.SPACES || currentView === ViewState.SPACE_DETAIL} onClick={() => setCurrentView(ViewState.SPACES)} />}
                                {can('can_view_dashboard') && <NavItem icon={<Inbox size={16} />} label="Conversations" active={currentView === ViewState.INBOX} onClick={() => setCurrentView(ViewState.INBOX)} badge={inboxData.reduce((acc, curr) => acc + (curr.unread_count || 0), 0) || 3} />}

                                {(can('can_manage_team') || can('can_view_tasks') || can('can_view_meetings') || can('can_view_files')) && (
                                    <div className="my-4 pt-4 border-t border-[#D1D5DB]">
                                        <p className="text-[10px] font-bold text-[#8E8EA0] uppercase tracking-wider px-3 mb-2">Management</p>
                                        {can('can_manage_team') && <NavItem icon={<UserCheck size={16} />} label="Team" active={currentView === ViewState.STAFF} onClick={() => setCurrentView(ViewState.STAFF)} />}
                                        {(can('owner') || can('admin')) && <NavItem icon={<Briefcase size={16} />} label="CRM" active={currentView === ViewState.CRM} onClick={() => setCurrentView(ViewState.CRM)} />}
                                        {can('can_view_tasks') && <NavItem icon={<CheckSquare size={16} />} label="Tasks" active={currentView === ViewState.TASKS} onClick={() => setCurrentView(ViewState.TASKS)} />}
                                        {can('can_view_meetings') && <NavItem icon={<Calendar size={16} />} label="Calendar" active={currentView === ViewState.MEETINGS} onClick={() => setCurrentView(ViewState.MEETINGS)} />}
                                        {can('can_view_files') && <NavItem icon={<FolderClosed size={16} />} label="Drive" active={currentView === ViewState.FILES} onClick={() => setCurrentView(ViewState.FILES)} />}
                                    </div>
                                )}
                            </nav>
                        </div>

                        {/* Bottom User Profile */}
                        <div className="p-2 border-t border-[#D1D5DB] pt-4">
                            <div
                                onClick={() => setCurrentView(ViewState.SETTINGS)}
                                className="flex items-center gap-3 p-2 rounded-md hover:bg-[#D1D5DB]/30 cursor-pointer transition-all active:scale-[0.98] group"
                            >
                                <div className="h-9 w-9 bg-[#1D1D1D] rounded-md flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                                    {profile?.full_name?.substring(0, 2).toUpperCase() || 'AD'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-[#1D1D1D] truncate">{profile?.full_name || 'Admin User'}</p>
                                    <p className="text-[10px] text-[#565869] font-medium uppercase tracking-tight">{profile?.role || 'Org Owner'}</p>
                                </div>
                            </div>
                        </div>
                    </aside>
                }
            >
                {/* Top Navbar */}
                <header className="h-16 border-b border-[#D1D5DB] flex items-center justify-between px-8 bg-white z-10 sticky top-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[#8E8EA0] text-sm font-medium">Main</span>
                        <ChevronRight size={14} className="text-[#D1D5DB]" />
                        <span className="text-[#1D1D1D] text-sm font-semibold">
                            {Object.keys(ViewState).find(key => ViewState[key as keyof typeof ViewState] === currentView)}
                        </span>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center -space-x-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-7 w-7 rounded-full border border-white bg-[#ECECF1] flex items-center justify-center text-[10px] font-medium">U{i}</div>
                            ))}
                            <div className="h-7 w-7 rounded-full border border-white bg-[#10A37F] flex items-center justify-center text-white text-[10px] font-bold">+5</div>
                        </div>
                        <div className="h-8 w-px bg-[#D1D5DB]" />
                        <div className="flex items-center gap-2">
                            <button title="Notifications" className="p-2 text-[#8E8EA0] hover:text-[#1D1D1D] transition-colors">
                                <Bell size={18} />
                            </button>
                            <Button variant="primary" size="sm" className="font-semibold">
                                Upgrade Plan
                            </Button>
                        </div>
                    </div>
                </header>

                {/* Dynamic View Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                    <div className="max-w-7xl mx-auto px-8 py-10 h-full">
                        {renderContent()}
                    </div>
                </div>
            </AppLayout>

            {/* Instant Meeting Confirmation Modal */}
            {isInstantMeetingModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                    <GlassCard className="max-w-md w-full p-8 shadow-2xl relative border-zinc-200">
                        <button
                            title="Close Modal"
                            onClick={() => setIsInstantMeetingModalOpen(false)}
                            className="absolute right-4 top-4 p-2 hover:bg-zinc-100 rounded-full transition-colors"
                        >
                            <X size={18} className="text-zinc-400" />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-12 w-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                                <Video size={24} />
                            </div>
                            <div>
                                <Heading level={2}>Instant Meeting</Heading>
                                <Text variant="secondary">Start a live call immediately.</Text>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Meeting Title</label>
                                <input
                                    type="text"
                                    value={instantMeetingTitle}
                                    onChange={(e) => setInstantMeetingTitle(e.target.value)}
                                    placeholder="e.g. Quick Sync - Spaceinc"
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                />
                            </div>

                            <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-100 space-y-2">
                                <div className="flex items-center gap-2 text-xs text-zinc-600 font-medium">
                                    <Shield size={14} className="text-emerald-500" />
                                    <span>Encrypted Video & Audio</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-zinc-600 font-medium">
                                    <FileVideo size={14} className="text-emerald-500" />
                                    <span>Cloud Recording Enabled</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <Button variant="ghost" className="flex-1" onClick={() => setIsInstantMeetingModalOpen(false)}>Cancel</Button>
                            <Button variant="primary" className="flex-1 font-bold" onClick={() => handleInstantMeeting(instantMeetingTargetSpace!, instantMeetingTitle)}>
                                Create Room
                            </Button>
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* Invitation Link Modal (Hardened) */}
            {showInviteModal && lastInviteData && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-[fadeIn_0.3s_ease-out]">
                    <GlassCard className="max-w-md w-full p-10 border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] text-center relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400" />

                        <div className="h-20 w-20 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-inner shadow-emerald-200/50">
                            <Rocket className="text-emerald-500" size={40} />
                        </div>

                        <h2 className="text-3xl font-extrabold text-zinc-900 mb-2 tracking-tight">Space is Ready!</h2>
                        <p className="text-zinc-500 mb-6 text-lg font-light leading-relaxed">
                            Invitation generated for <br />
                            <strong className="text-zinc-900 font-semibold">{lastInviteData.email}</strong>
                        </p>

                        {!lastInviteData.link ? (
                            <div className="bg-emerald-50 rounded-lg p-4 mb-10 text-emerald-700 text-sm border border-emerald-100 italic">
                                A secure invitation email has been successfully dispatched to the client.
                            </div>
                        ) : (
                            <div className="space-y-4 mb-10 text-left">
                                <label htmlFor="invite-link" className="block text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 px-1">Secure Access Link</label>
                                <div className="relative group/link">
                                    <input
                                        id="invite-link"
                                        title="Space Invitation Link"
                                        placeholder="Generating link..."
                                        readOnly
                                        value={lastInviteData.link}
                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-4 pr-32 text-xs font-mono text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all select-all overflow-hidden whitespace-nowrap"
                                    />
                                    <button
                                        onClick={() => {
                                            if (lastInviteData.link) navigator.clipboard.writeText(lastInviteData.link);
                                            showToast("Link copied to clipboard!", "success");
                                        }}
                                        className="absolute right-2 top-2 bottom-2 bg-zinc-900 text-white text-[10px] font-bold px-4 rounded-lg hover:bg-emerald-600 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        <Copy size={12} /> Copy Link
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t border-zinc-100">
                            <Button
                                variant="ghost"
                                className="w-full py-4 text-zinc-400 hover:text-zinc-900 transition-colors"
                                onClick={() => setShowInviteModal(false)}
                            >
                                Done
                            </Button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </>
    );
};

export default App;
