
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/auth/LoginForm';
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
  GripVertical
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

import { GlassCard, Button, Heading, Text, Input, Modal, Checkbox, Toggle } from './components/UI';
import { ClientSpace, ViewState, Meeting, Message, StaffMember, Task, SpaceFile, ChartData } from './types';
import { LandingPage } from './components/LandingPage';
import { Onboarding } from './components/Onboarding';

// --- Mock Data ---
const MOCK_DATA: ChartData[] = [
  { name: 'Jan', value: 4000 },
  { name: 'Feb', value: 3000 },
  { name: 'Mar', value: 5000 },
  { name: 'Apr', value: 7500 },
  { name: 'May', value: 6000 },
  { name: 'Jun', value: 9000 },
];

const INITIAL_CLIENTS: ClientSpace[] = [
  { 
    id: '1', 
    name: 'Acme Corp', 
    status: 'Active', 
    onboardingComplete: true,
    modules: { messaging: true, meetings: true, calendar: true, onboarding: true, files: true, referral: true },
    notifications: 2,
    clientData: { contactName: 'John Doe', role: 'CTO', email: 'john@acme.com' },
    analytics: { totalMeetings: 12, totalDocs: 5, lastActive: '2h ago' },
    assignedStaffId: 'staff-1'
  },
  { 
    id: '2', 
    name: 'Lumina Design', 
    status: 'Onboarding', 
    onboardingComplete: false,
    modules: { messaging: true, meetings: true, calendar: true, onboarding: true, files: true, referral: false },
    notifications: 0,
    clientData: { contactName: 'Sarah Smith', role: 'Director', email: 'sarah@lumina.design' },
    analytics: { totalMeetings: 1, totalDocs: 1, lastActive: '1d ago' },
    assignedStaffId: 'staff-1'
  }
];

const MOCK_STAFF: StaffMember[] = [
    { id: 'staff-1', name: 'You (Owner)', role: 'User', email: 'owner@space.inc', assignedSpaces: 2, status: 'Active' },
    { id: 'staff-2', name: 'Alex Support', role: 'Staff', email: 'alex@space.inc', assignedSpaces: 0, status: 'Active' }
];

const MOCK_TASKS: Task[] = [
    { id: 't1', title: 'Prepare Contract for Acme', dueDate: '2023-10-28', status: 'In Progress', assigneeId: 'staff-1', clientSpaceId: '1' },
    { id: 't2', title: 'Follow up with Lumina', dueDate: '2023-10-26', status: 'Pending', assigneeId: 'staff-1', clientSpaceId: '2' },
];

const MOCK_MEETINGS: Meeting[] = [
  { id: '1', title: 'Q3 Strategy Review', clientName: 'Acme Corp', clientId: '1', date: '2023-10-25', time: '14:00', type: 'upcoming' },
  { id: '2', title: 'Onboarding Kickoff', clientName: 'Lumina Design', clientId: '2', date: '2023-10-20', time: '10:00', type: 'past', hasRecording: true, hasNotes: true, duration: '45 mins', notesContent: 'Client agreed to the new roadmap. Requires follow-up on design assets.' },
];

const MOCK_MESSAGES: Message[] = [
  { id: '1', sender: 'John (Acme)', senderType: 'client', content: 'Hey, can we review the contract?', timestamp: '10:30 AM', isUnread: true, clientSpaceId: '1' },
  { id: '2', sender: 'You', senderType: 'staff', content: 'Sure, I will upload it shortly.', timestamp: '10:35 AM', isUnread: false, clientSpaceId: '1' },
  { id: '3', sender: 'Sarah (Lumina)', senderType: 'client', content: 'When is our next meeting?', timestamp: 'Yesterday', isUnread: false, clientSpaceId: '2' },
];

const MOCK_FILES: SpaceFile[] = [
    { id: 'f1', name: 'Welcome_Packet.pdf', type: 'pdf', uploadDate: '2023-10-01', clientSpaceId: '1', isGlobal: true },
    { id: 'f2', name: 'Q3_Report.pdf', type: 'pdf', uploadDate: '2023-10-15', clientSpaceId: '1', isGlobal: false },
    { id: 'f3', name: 'Logo_Assets.zip', type: 'zip', uploadDate: '2023-10-18', clientSpaceId: '2', isGlobal: false },
];

// --- Sub-Components ---

const SidebarItem: React.FC<{ icon: any; label: string; active: boolean; onClick: () => void }> = ({ icon: Icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`
      w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group
      ${active ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-500 hover:bg-white/50 hover:text-zinc-900'}
    `}
  >
    <Icon size={18} strokeWidth={1.5} className={active ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-900 transition-colors'} />
    <span className="text-sm font-medium">{label}</span>
  </button>
);

// 1. Staff Dashboard
const StaffDashboardView = ({ clients, messages, meetings }: { clients: ClientSpace[], messages: Message[], meetings: Meeting[] }) => {
  return (
    <div className="space-y-6 animate-[fadeIn_0.5s_ease-out]">
      <header className="flex justify-between items-end mb-8">
        <div>
          <Heading level={1}>Overview</Heading>
          <Text variant="secondary" className="mt-1">Good morning. Here is the organization activity.</Text>
        </div>
        <div className="flex gap-3">
             <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-zinc-100 rounded-full border border-zinc-200">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-xs font-medium text-zinc-600">Pro Plan Active</span>
             </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-6 relative overflow-hidden group">
          <Text variant="secondary" className="mb-4">Active Clients</Text>
          <div className="flex items-end justify-between">
            <span className="text-4xl font-light text-zinc-900 tracking-tight">{clients.length}</span>
            <div className="flex items-center text-emerald-600 text-xs font-medium bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
              <ArrowRight size={12} className="mr-1 -rotate-45" /> +2 this month
            </div>
          </div>
        </GlassCard>
        
        <GlassCard className="p-6 relative overflow-hidden group">
          <Text variant="secondary" className="mb-4">Unread Messages</Text>
          <div className="flex items-end justify-between">
            <span className="text-4xl font-light text-zinc-900 tracking-tight">{messages.filter(m => m.isUnread).length}</span>
            {messages.filter(m => m.isUnread).length > 0 && (
                 <div className="flex items-center text-zinc-600 text-xs font-medium bg-zinc-100 px-2 py-1 rounded-full border border-zinc-200">
                    Needs attention
                 </div>
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-6 relative overflow-hidden group">
          <Text variant="secondary" className="mb-4">Upcoming Meetings</Text>
          <div className="flex items-end justify-between">
            <span className="text-4xl font-light text-zinc-900 tracking-tight">{meetings.filter(m => m.type === 'upcoming').length}</span>
            <div className="h-8 w-8 rounded-full bg-zinc-900 flex items-center justify-center text-white">
                <Calendar size={14} />
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        <div className="lg:col-span-2">
            <GlassCard className="p-6 h-full">
                <div className="flex justify-between items-center mb-6">
                    <Heading level={3}>Organization Activity</Heading>
                    <select className="bg-transparent text-sm text-zinc-500 border-none focus:ring-0 cursor-pointer outline-none">
                        <option>Last 6 months</option>
                        <option>This Year</option>
                    </select>
                </div>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={MOCK_DATA}>
                        <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#18181b" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#18181b" stopOpacity={0}/>
                        </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#a1a1aa', fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#a1a1aa', fontSize: 12}} />
                        <Tooltip 
                            contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                            itemStyle={{color: '#18181b'}}
                            cursor={{stroke: '#e4e4e7', strokeWidth: 1}}
                        />
                        <Area type="monotone" dataKey="value" stroke="#18181b" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                    </ResponsiveContainer>
                </div>
            </GlassCard>
        </div>

        <div className="lg:col-span-1">
             <GlassCard className="p-6 h-full flex flex-col">
                <Heading level={3} className="mb-4">Quick Actions</Heading>
                <div className="space-y-3 flex-1">
                    <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 transition-colors border border-transparent hover:border-zinc-200 text-left">
                        <div className="bg-zinc-100 p-2 rounded-lg text-zinc-600">
                            <UserPlus size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-zinc-900">Invite New Client</p>
                            <p className="text-xs text-zinc-500">Send onboarding email</p>
                        </div>
                    </button>
                    <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 transition-colors border border-transparent hover:border-zinc-200 text-left">
                        <div className="bg-zinc-100 p-2 rounded-lg text-zinc-600">
                            <Calendar size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-zinc-900">Schedule Meeting</p>
                            <p className="text-xs text-zinc-500">With existing client</p>
                        </div>
                    </button>
                    <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 transition-colors border border-transparent hover:border-zinc-200 text-left">
                        <div className="bg-zinc-100 p-2 rounded-lg text-zinc-600">
                            <FileText size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-zinc-900">Create Invoice</p>
                            <p className="text-xs text-zinc-500">Via Polar.sh</p>
                        </div>
                    </button>
                </div>
            </GlassCard>
        </div>
      </div>
    </div>
  );
};

// ... [Existing SpacesView, SpaceDetailView, etc. remain unchanged. I am truncating them here for brevity but they should be kept in the final file] ...
// 2. Spaces View
const SpacesView = ({ clients, onSelect, onCreate }: { clients: ClientSpace[], onSelect: (id: string) => void, onCreate: (data: any) => void }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientContact, setNewClientContact] = useState('');

    const handleSubmit = () => {
        if(newClientName && newClientContact) {
            onCreate({ name: newClientName, contactName: newClientContact });
            setIsModalOpen(false);
            setNewClientName('');
            setNewClientContact('');
        }
    };

    return (
        <div className="animate-[fadeIn_0.5s_ease-out]">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <Heading level={1}>Spaces</Heading>
                    <Text variant="secondary" className="mt-1">Manage all your client environments.</Text>
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
                        className="p-6 group relative"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-lg font-bold ${client.status === 'Active' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                                {client.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${client.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                {client.status}
                            </span>
                        </div>
                        <h3 className="text-xl font-medium text-zinc-900 mb-1">{client.name}</h3>
                        <p className="text-sm text-zinc-500 font-light mb-6">{client.clientData?.contactName}</p>
                        <div className="grid grid-cols-3 gap-2 py-4 border-t border-zinc-100 mb-2">
                            <div className="text-center">
                                <p className="text-xs text-zinc-400">Meetings</p>
                                <p className="text-sm font-medium text-zinc-800">{client.analytics.totalMeetings}</p>
                            </div>
                            <div className="text-center border-l border-zinc-100">
                                <p className="text-xs text-zinc-400">Docs</p>
                                <p className="text-sm font-medium text-zinc-800">{client.analytics.totalDocs}</p>
                            </div>
                            <div className="text-center border-l border-zinc-100">
                                <p className="text-xs text-zinc-400">Activity</p>
                                <p className="text-sm font-medium text-zinc-800">{client.analytics.lastActive}</p>
                            </div>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                             <span className="text-xs text-zinc-400 group-hover:text-zinc-900 flex items-center gap-1 transition-colors">
                                Access Space <ChevronRight size={14} />
                             </span>
                        </div>
                    </GlassCard>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Space">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Client Business Name</label>
                        <Input placeholder="e.g. Acme Corp" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Primary Contact Name</label>
                        <Input placeholder="e.g. John Doe" value={newClientContact} onChange={e => setNewClientContact(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Modules</label>
                        <div className="grid grid-cols-2 gap-2">
                            <Checkbox label="Messaging" checked={true} onChange={() => {}} />
                            <Checkbox label="Meetings" checked={true} onChange={() => {}} />
                            <Checkbox label="Files" checked={true} onChange={() => {}} />
                        </div>
                    </div>
                    <Button className="w-full mt-4" onClick={handleSubmit}>Create Space</Button>
                </div>
            </Modal>
        </div>
    )
}

// 3. Space Detail View
const SpaceDetailView = ({ space, onBack }: { space: ClientSpace, onBack: () => void }) => {
    const [activeTab, setActiveTab] = useState<'Dashboard' | 'Chat' | 'Meetings' | 'Docs'>('Dashboard');

    if (!space) return null;

    return (
        <div className="animate-[fadeIn_0.5s_ease-out] flex flex-col h-[calc(100vh-64px)]">
            {/* Navigation Header */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-100 transition-colors">
                    <ArrowLeft size={20} className="text-zinc-500" />
                </button>
                <div>
                    <h1 className="text-2xl font-light text-zinc-900">{space.name}</h1>
                    <p className="text-sm text-zinc-500">Managed by You</p>
                </div>
                <div className="ml-auto flex bg-white/50 p-1 rounded-xl border border-zinc-200">
                    {['Dashboard', 'Chat', 'Meetings', 'Docs'].map(tab => (
                        <button 
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
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
                                    <Button variant="secondary" className="w-full justify-start"><Upload size={16} className="mr-2"/> Upload Document</Button>
                                    <Button variant="secondary" className="w-full justify-start"><MessageSquare size={16} className="mr-2"/> Create Auto-Message</Button>
                                    <Button variant="secondary" className="w-full justify-start"><ListTodo size={16} className="mr-2"/> Create Task</Button>
                                </div>
                            </GlassCard>
                            <GlassCard className="p-6">
                                <Heading level={3} className="mb-4">Client Overview</Heading>
                                <div className="space-y-2 text-sm text-zinc-600">
                                    <p><span className="font-medium text-zinc-900">Contact:</span> {space.clientData?.contactName}</p>
                                    <p><span className="font-medium text-zinc-900">Email:</span> {space.clientData?.email}</p>
                                    <p><span className="font-medium text-zinc-900">Status:</span> {space.status}</p>
                                </div>
                            </GlassCard>
                        </div>
                    </div>
                )}
                {activeTab === 'Chat' && (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                         <MessageSquare size={48} className="mb-4 opacity-20" />
                         <p>Direct Message History with {space.name}</p>
                         <Button variant="secondary" className="mt-4">Open Full Chat</Button>
                    </div>
                )}
                {activeTab === 'Meetings' && (
                    <div className="space-y-4">
                         <div className="flex justify-between">
                            <Heading level={2}>Scheduled Meetings</Heading>
                            <Button size="sm"><Plus size={16}/> Schedule</Button>
                         </div>
                         <GlassCard className="p-4 flex justify-between items-center">
                            <div>
                                <p className="font-medium">Strategy Review</p>
                                <p className="text-xs text-zinc-500">Oct 25, 2:00 PM</p>
                            </div>
                            <Button variant="secondary">View</Button>
                         </GlassCard>
                    </div>
                )}
                 {activeTab === 'Docs' && (
                    <div className="space-y-4">
                         <div className="flex justify-between">
                            <Heading level={2}>Documents</Heading>
                            <Button size="sm"><Upload size={16}/> Upload</Button>
                         </div>
                         <GlassCard className="p-4 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <FileText className="text-red-500" />
                                <div>
                                    <p className="font-medium">Welcome_Packet.pdf</p>
                                    <p className="text-xs text-zinc-500">Shared globally</p>
                                </div>
                            </div>
                            <Button variant="ghost"><Download size={16}/></Button>
                         </GlassCard>
                    </div>
                )}
            </div>
        </div>
    );
};

// 4. Meeting Hub
const GlobalMeetingsView = ({ meetings, clients, onSchedule }: { meetings: Meeting[], clients: ClientSpace[], onSchedule: (m: any) => void }) => {
    const [tab, setTab] = useState<'Upcoming' | 'History'>('Upcoming');
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

    // Schedule Form State
    const [newMeetingSpace, setNewMeetingSpace] = useState(clients[0]?.id || '');
    const [newMeetingDate, setNewMeetingDate] = useState('');
    const [newMeetingTime, setNewMeetingTime] = useState('');
    const [notifyClient, setNotifyClient] = useState(true);

    const handleSchedule = () => {
        onSchedule({
            spaceId: newMeetingSpace,
            date: newMeetingDate,
            time: newMeetingTime,
            notify: notifyClient
        });
        setIsScheduleOpen(false);
    };

    const joinRoom = () => {
        alert("Joining Daily.co room... (Integration Point)");
    };

    return (
        <div className="animate-[fadeIn_0.5s_ease-out]">
             <header className="flex justify-between items-center mb-8">
                <div>
                    <Heading level={1}>Meetings Hub</Heading>
                    <Text variant="secondary" className="mt-1">Schedule and manage video calls.</Text>
                </div>
                <div className="flex gap-2">
                    <div className="bg-white/50 p-1 rounded-full border border-zinc-200 flex">
                        <button onClick={() => setTab('Upcoming')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${tab === 'Upcoming' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}>Upcoming</button>
                        <button onClick={() => setTab('History')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${tab === 'History' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}>History</button>
                    </div>
                    <Button onClick={() => setIsScheduleOpen(true)}>
                        <Plus size={18} /> Schedule
                    </Button>
                </div>
            </header>

            {tab === 'Upcoming' ? (
                 <div className="space-y-4">
                    {meetings.filter(m => m.type === 'upcoming').map(meeting => (
                        <GlassCard key={meeting.id} className="p-6 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="bg-zinc-100 rounded-xl px-4 py-3 text-center min-w-[80px]">
                                    <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">{new Date(meeting.date).toLocaleString('default', { month: 'short' })}</p>
                                    <p className="text-xl font-light text-zinc-900">{new Date(meeting.date).getDate()}</p>
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-zinc-900">{meeting.title}</h3>
                                    <div className="flex items-center gap-4 mt-1">
                                        <span className="text-sm text-zinc-500 flex items-center gap-1"><Clock size={14}/> {meeting.time}</span>
                                        <span className="text-sm text-zinc-500 flex items-center gap-1"><Users size={14}/> {meeting.clientName}</span>
                                    </div>
                                </div>
                            </div>
                            <Button onClick={joinRoom}>
                                Join Room <ArrowRight size={16} />
                            </Button>
                        </GlassCard>
                    ))}
                 </div>
            ) : (
                <div className="space-y-4">
                     {meetings.filter(m => m.type === 'past').map(meeting => (
                        <GlassCard key={meeting.id} className="p-6 flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity cursor-pointer" onClick={() => setSelectedMeeting(meeting)}>
                            <div className="flex items-center gap-6">
                                <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-center min-w-[80px]">
                                    <p className="text-sm text-zinc-400">Ended</p>
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-zinc-700">{meeting.title}</h3>
                                    <div className="flex items-center gap-4 mt-1">
                                        <span className="text-sm text-zinc-400">{meeting.date}</span>
                                        <span className="text-sm text-zinc-400">{meeting.clientName}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {meeting.hasRecording && <div className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs">Rec</div>}
                                {meeting.hasNotes && <div className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs">Notes</div>}
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}

            {/* Schedule Modal */}
            <Modal isOpen={isScheduleOpen} onClose={() => setIsScheduleOpen(false)} title="Schedule Meeting">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Select Space</label>
                        <select 
                            className="w-full bg-white/40 border border-zinc-200 rounded-2xl px-5 py-3 text-zinc-800 text-sm focus:outline-none"
                            value={newMeetingSpace}
                            onChange={(e) => setNewMeetingSpace(e.target.value)}
                        >
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Date</label>
                            <Input type="date" value={newMeetingDate} onChange={e => setNewMeetingDate(e.target.value)}/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Time</label>
                            <Input type="time" value={newMeetingTime} onChange={e => setNewMeetingTime(e.target.value)}/>
                        </div>
                    </div>
                    <Toggle label="Notify Client (Email & Push)" checked={notifyClient} onChange={setNotifyClient} />
                    <Button className="w-full mt-4" onClick={handleSchedule}>Schedule Meeting</Button>
                </div>
            </Modal>

            {/* Past Meeting Detail Modal */}
            <Modal isOpen={!!selectedMeeting} onClose={() => setSelectedMeeting(null)} title="Meeting Details">
                {selectedMeeting && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-light mb-1">{selectedMeeting.title}</h3>
                            <p className="text-sm text-zinc-500">with {selectedMeeting.clientName} on {selectedMeeting.date}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                             <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                                <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Duration</p>
                                <p className="font-medium">{selectedMeeting.duration || 'N/A'}</p>
                             </div>
                             <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                                <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Recording</p>
                                {selectedMeeting.hasRecording ? (
                                    <Button variant="secondary" className="h-8 text-xs w-full">Download MP4</Button>
                                ) : (
                                    <p className="text-xs text-zinc-400">Not available</p>
                                )}
                             </div>
                        </div>

                        <div>
                            <p className="text-sm font-medium mb-2">Staff Notes</p>
                            <div className="p-4 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-600 leading-relaxed">
                                {selectedMeeting.notesContent || 'No notes taken for this meeting.'}
                            </div>
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
        <div className="animate-[fadeIn_0.5s_ease-out] h-full flex flex-col">
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
                        className="bg-zinc-100/50 rounded-2xl p-4 flex flex-col h-full border border-dashed border-zinc-200"
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
                                        className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm cursor-grab active:cursor-grabbing hover:border-zinc-400 transition-colors"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 truncate max-w-[100px]">{spaceName}</span>
                                            <div className="text-zinc-300"><GripVertical size={14}/></div>
                                        </div>
                                        <p className="text-sm font-medium text-zinc-900 mb-3">{task.title}</p>
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-50">
                                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                                                <Clock size={12} /> {task.dueDate}
                                            </div>
                                            <div className="h-6 w-6 rounded-full bg-zinc-900 text-white text-[10px] flex items-center justify-center" title="Assigned to You">YO</div>
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
                        <select className="w-full bg-white/40 border border-zinc-200 rounded-2xl px-5 py-3 text-zinc-800 text-sm focus:outline-none" value={newTaskSpace} onChange={e => setNewTaskSpace(e.target.value)}>
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
const GlobalFilesView = ({ files, clients }: { files: SpaceFile[], clients: ClientSpace[] }) => {
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [uploadGlobal, setUploadGlobal] = useState(false);

    // Group files by client
    const groupedFiles = clients.map(client => ({
        client,
        files: files.filter(f => f.clientSpaceId === client.id || f.isGlobal)
    }));

    return (
        <div className="animate-[fadeIn_0.5s_ease-out]">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <Heading level={1}>Files</Heading>
                    <Text variant="secondary" className="mt-1">Central repository for all documents.</Text>
                </div>
                <Button onClick={() => setIsUploadOpen(true)}>
                    <Upload size={18} /> Upload Doc
                </Button>
            </header>

            <div className="space-y-8">
                {groupedFiles.map(({ client, files }) => (
                    <div key={client.id}>
                         <h3 className="text-lg font-medium text-zinc-900 mb-4 flex items-center gap-2">
                            <Briefcase size={18} className="text-zinc-400"/> {client.name}
                         </h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {files.length > 0 ? files.map(file => (
                                <GlassCard key={file.id} className="p-4 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-zinc-100 p-2 rounded-lg text-zinc-600">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-zinc-900 truncate max-w-[150px]">{file.name}</p>
                                            <p className="text-xs text-zinc-500">
                                                {file.isGlobal ? 'Global Asset' : file.uploadDate}
                                            </p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" className="h-8 w-8 p-0"><Download size={16}/></Button>
                                </GlassCard>
                            )) : (
                                <div className="col-span-3 text-center py-8 border border-dashed border-zinc-200 rounded-2xl text-zinc-400 text-sm">
                                    No files in this space.
                                </div>
                            )}
                         </div>
                    </div>
                ))}
            </div>

            <Modal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} title="Upload Document">
                <div className="space-y-4">
                    <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-8 text-center hover:bg-zinc-50 transition-colors cursor-pointer">
                        <Upload size={32} className="mx-auto text-zinc-400 mb-2"/>
                        <p className="text-sm text-zinc-600">Click to select file</p>
                    </div>
                    
                    {!uploadGlobal && (
                        <div>
                             <label className="block text-sm font-medium text-zinc-700 mb-1">Select Space</label>
                             <select className="w-full bg-white/40 border border-zinc-200 rounded-2xl px-5 py-3 text-zinc-800 text-sm focus:outline-none">
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <Checkbox 
                            label="Add to all spaces (Global)" 
                            checked={uploadGlobal} 
                            onChange={setUploadGlobal} 
                        />
                        <p className="text-xs text-blue-700 mt-2 ml-8">If checked, this document will appear in every client's space automatically (e.g. Welcome Packet).</p>
                    </div>

                    <Button className="w-full mt-4" onClick={() => {alert("Uploading..."); setIsUploadOpen(false)}}>Upload</Button>
                </div>
            </Modal>
        </div>
    );
};

// 7. Staff View
const StaffView = ({ staffList }: { staffList: StaffMember[] }) => {
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    
    // Invite Form
    const [inviteName, setInviteName] = useState('');
    const [inviteRole, setInviteRole] = useState('Staff');

    const generateInvite = () => {
        const token = Math.random().toString(36).substring(7);
        setInviteLink(`https://portal.space.inc/join?token=${token}`);
    };

    return (
        <div className="animate-[fadeIn_0.5s_ease-out]">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <Heading level={1}>Staff Management</Heading>
                    <Text variant="secondary" className="mt-1">Manage team access and roles.</Text>
                </div>
                <Button onClick={() => setShowInviteModal(true)}>
                    <UserPlus size={18} /> Invite Staff
                </Button>
            </header>

            <GlassCard className="overflow-hidden">
                <table className="w-full">
                    <thead className="bg-zinc-50 border-b border-zinc-100">
                        <tr>
                            <th className="text-left py-4 px-6 text-xs font-medium text-zinc-500 uppercase">Name</th>
                            <th className="text-left py-4 px-6 text-xs font-medium text-zinc-500 uppercase">Role</th>
                            <th className="text-left py-4 px-6 text-xs font-medium text-zinc-500 uppercase">Assigned Spaces</th>
                            <th className="text-left py-4 px-6 text-xs font-medium text-zinc-500 uppercase">Status</th>
                            <th className="text-right py-4 px-6 text-xs font-medium text-zinc-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {staffList.map(member => (
                            <tr key={member.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors cursor-pointer" onClick={() => setSelectedStaff(member)}>
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600">
                                            {member.name.substring(0,2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-zinc-900">{member.name}</p>
                                            <p className="text-xs text-zinc-500">{member.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-4 px-6">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800">
                                        {member.role}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-sm text-zinc-600">{member.assignedSpaces} Spaces</td>
                                <td className="py-4 px-6">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${member.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${member.status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                        {member.status}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <ChevronRight size={16} className="text-zinc-400 ml-auto"/>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </GlassCard>

            {/* Invite Modal */}
            <Modal isOpen={showInviteModal} onClose={() => {setShowInviteModal(false); setInviteLink(null)}} title="Invite Staff Member">
                <div className="space-y-4">
                    {!inviteLink ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Name</label>
                                <Input placeholder="Jane Doe" value={inviteName} onChange={e => setInviteName(e.target.value)}/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Role</label>
                                <select className="w-full bg-white/40 border border-zinc-200 rounded-2xl px-5 py-3 text-zinc-800 text-sm focus:outline-none" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                                    <option value="Manager">Manager (Assign & Access Spaces)</option>
                                    <option value="Staff">Staff (Assigned Spaces Only)</option>
                                    <option value="User">User (Full Admin Access)</option>
                                </select>
                            </div>
                            <Button className="w-full mt-4" onClick={generateInvite}>Generate Credential Link</Button>
                        </>
                    ) : (
                        <div className="text-center space-y-4 animate-[fadeIn_0.3s_ease-out]">
                            <div className="mx-auto h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                                <LinkIcon size={24} />
                            </div>
                            <Heading level={3}>Link Generated</Heading>
                            <Text>Send this link to {inviteName}.</Text>
                            
                            <div className="flex items-center gap-2 p-3 bg-zinc-50 border border-zinc-200 rounded-xl mt-4">
                                <code className="text-xs text-zinc-600 flex-1 truncate">{inviteLink}</code>
                                <Button variant="ghost" className="h-8 w-8 p-0"><Copy size={14}/></Button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Staff Detail Modal */}
            <Modal isOpen={!!selectedStaff} onClose={() => setSelectedStaff(null)} title={selectedStaff?.name || ''}>
                {selectedStaff && (
                    <div>
                         <div className="mb-6">
                             <p className="text-sm text-zinc-500">Role: {selectedStaff.role}</p>
                             <p className="text-sm text-zinc-500">Email: {selectedStaff.email}</p>
                         </div>
                         <Heading level={3} className="mb-3">Assigned Spaces</Heading>
                         <div className="space-y-2">
                            {/* Mock assigned spaces */}
                            <GlassCard className="p-3 flex justify-between items-center">
                                <span className="text-sm font-medium">Acme Corp</span>
                                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Active</span>
                            </GlassCard>
                            {selectedStaff.role === 'User' && <p className="text-xs text-zinc-400 mt-2 italic">* User has access to all spaces.</p>}
                         </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

// 8. Settings View
const SettingsView = () => {
    return (
        <div className="animate-[fadeIn_0.5s_ease-out]">
             <Heading level={1} className="mb-8">Settings</Heading>
             <div className="space-y-6 max-w-2xl">
                 <GlassCard className="p-6">
                    <Heading level={3} className="mb-4">Data Management</Heading>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl">
                            <div>
                                <p className="font-medium text-zinc-900">Export All Data</p>
                                <p className="text-sm text-zinc-500">Download clients, records, and logs.</p>
                            </div>
                            <Button variant="secondary"><Download size={16} className="mr-2"/> Download</Button>
                        </div>
                    </div>
                 </GlassCard>

                 <GlassCard className="p-6 border-red-100">
                    <Heading level={3} className="mb-4 text-red-600">Danger Zone</Heading>
                    <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl">
                            <div>
                                <p className="font-medium text-red-900">Delete Account</p>
                                <p className="text-sm text-red-500">Permanently delete your organization.</p>
                            </div>
                            <Button variant="danger"><Trash2 size={16} className="mr-2"/> Delete</Button>
                        </div>
                 </GlassCard>
             </div>
        </div>
    )
}

// 9. Inbox View
const InboxView = ({ messages, clients }: { messages: Message[], clients: ClientSpace[] }) => {
    const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(messages[0]?.clientSpaceId || null);
    
    // Filter messages for the selected space
    const activeMessages = messages.filter(m => m.clientSpaceId === selectedSpaceId);
    const activeClient = clients.find(c => c.id === selectedSpaceId);

    return (
        <div className="h-[calc(100vh-140px)] flex gap-6 animate-[fadeIn_0.5s_ease-out]">
            {/* List Sidebar */}
            <GlassCard className="w-1/3 flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-zinc-100">
                    <Heading level={2} className="mb-2">Inbox</Heading>
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-3 text-zinc-400" />
                        <input type="text" placeholder="Search chats..." className="w-full bg-zinc-50 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-200" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {clients.filter(c => c.modules.messaging).map(client => {
                        const lastMsg = messages.find(m => m.clientSpaceId === client.id);
                        return (
                            <div 
                                key={client.id}
                                onClick={() => setSelectedSpaceId(client.id)}
                                className={`p-4 border-b border-zinc-50 cursor-pointer hover:bg-zinc-50 transition-colors ${selectedSpaceId === client.id ? 'bg-zinc-50' : ''}`}
                            >
                                <div className="flex justify-between mb-1">
                                    <span className="font-medium text-zinc-900">{client.name}</span>
                                    <span className="text-xs text-zinc-400">{lastMsg?.timestamp || 'Now'}</span>
                                </div>
                                <p className="text-sm text-zinc-500 truncate">{lastMsg?.content || 'No messages yet'}</p>
                            </div>
                        )
                    })}
                </div>
            </GlassCard>

            {/* Chat Area */}
            <GlassCard className="flex-1 flex flex-col h-full overflow-hidden relative">
                {selectedSpaceId ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-white/50 backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold">
                                    {activeClient?.name.substring(0, 2)}
                                </div>
                                <div>
                                    <h3 className="font-medium text-zinc-900">{activeClient?.name}</h3>
                                    <p className="text-xs text-zinc-500">Contact: {activeClient?.clientData?.contactName}</p>
                                </div>
                            </div>
                            <Button variant="ghost" className="h-8 w-8 p-0 rounded-full"><MoreVertical size={18} /></Button>
                        </div>

                        {/* Messages Feed */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/30">
                            {activeMessages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.senderType === 'staff' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] p-4 rounded-2xl ${msg.senderType === 'staff' ? 'bg-zinc-900 text-white rounded-br-none' : 'bg-white shadow-sm border border-zinc-100 rounded-bl-none'}`}>
                                        <p className="text-sm leading-relaxed">{msg.content}</p>
                                        <p className={`text-[10px] mt-2 opacity-70 ${msg.senderType === 'staff' ? 'text-zinc-300' : 'text-zinc-400'}`}>{msg.timestamp}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-zinc-100">
                            <div className="flex items-center gap-3">
                                <Button variant="ghost" className="p-2"><Upload size={18}/></Button>
                                <input className="flex-1 bg-zinc-100 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-300" placeholder="Type a message..." />
                                <Button className="h-10 w-10 p-0 rounded-full"><ArrowRight size={18}/></Button>
                            </div>
                        </div>
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

// 10. Client Portal View
const ClientPortalView = ({ client, onLogout }: { client: ClientSpace, onLogout: () => void }) => {
    return (
        <div className="min-h-screen bg-zinc-50 p-6 md:p-12 font-sans text-zinc-900">
             <div className="max-w-6xl mx-auto space-y-8">
                {/* Client Header */}
                <header className="flex justify-between items-center">
                    <div>
                         <div className="flex items-center gap-3 mb-2">
                             <div className="h-10 w-10 bg-zinc-900 text-white rounded-lg flex items-center justify-center font-bold text-xl">N</div>
                             <span className="font-semibold text-lg tracking-tight">Nexus Portal</span>
                         </div>
                         <Heading level={2}>Welcome back, {client.clientData?.contactName}</Heading>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="danger" onClick={() => alert("Reporting Staff Member to Owner...")}>
                            <Flag size={16}/> Report Issue
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
                            <h3 className="text-xl font-light mb-2">Project Update</h3>
                            <p className="text-zinc-300 font-light mb-4">We have uploaded the latest strategy documents for your review.</p>
                            <Button variant="secondary" className="bg-white/10 text-white border-white/20 hover:bg-white/20">View Documents</Button>
                        </GlassCard>

                        {/* Recent Files */}
                        <div>
                            <h3 className="text-lg font-medium mb-4 flex items-center gap-2"><FileText size={18}/> Shared Documents</h3>
                            <div className="space-y-3">
                                <GlassCard className="p-4 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-red-50 text-red-600 p-2 rounded-lg"><FileText size={20}/></div>
                                        <div>
                                            <p className="font-medium text-sm">Contract_v2.pdf</p>
                                            <p className="text-xs text-zinc-500">Added yesterday</p>
                                        </div>
                                    </div>
                                    <Download size={18} className="text-zinc-400 hover:text-zinc-900 cursor-pointer"/>
                                </GlassCard>
                                <GlassCard className="p-4 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-50 text-blue-600 p-2 rounded-lg"><Video size={20}/></div>
                                        <div>
                                            <p className="font-medium text-sm">Onboarding_Recording.mp4</p>
                                            <p className="text-xs text-zinc-500">Added 3 days ago</p>
                                        </div>
                                    </div>
                                    <Download size={18} className="text-zinc-400 hover:text-zinc-900 cursor-pointer"/>
                                </GlassCard>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                         {/* Next Meeting */}
                         <GlassCard className="p-6">
                             <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Next Meeting</h3>
                             <div className="text-center py-4">
                                 <p className="text-3xl font-light">Oct 25</p>
                                 <p className="text-zinc-500">2:00 PM</p>
                                 <p className="text-sm font-medium mt-2">Q3 Strategy Review</p>
                             </div>
                             <Button className="w-full mt-4">Join Meeting</Button>
                         </GlassCard>

                         {/* Chat Preview */}
                         <GlassCard className="p-6">
                            <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Staff Chat</h3>
                            <div className="bg-zinc-50 rounded-xl p-3 mb-4 text-sm text-zinc-600 italic">
                                "Sure, I will upload it shortly."
                            </div>
                            <Button variant="secondary" className="w-full">Open Chat</Button>
                         </GlassCard>
                    </div>
                </div>
             </div>
        </div>
    )
}

// --- Main App Component ---

const App = () => {
  const { user, loading } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, [user, loading]);
  // Global View State (Landing -> Onboarding -> App)
  const [globalView, setGlobalView] = useState<'LANDING' | 'ONBOARDING' | 'APP'>('LANDING');

  // App Internal State
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'client'>('admin'); 

  // Data State
  const [clients, setClients] = useState<ClientSpace[]>(INITIAL_CLIENTS);
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [meetings, setMeetings] = useState<Meeting[]>(MOCK_MEETINGS);
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [files, setFiles] = useState<SpaceFile[]>(MOCK_FILES);
  const [staff, setStaff] = useState<StaffMember[]>(MOCK_STAFF);

    if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>; // Or a proper loading spinner
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  // Handlers
  const handleCreateSpace = (data: Partial<ClientSpace>) => {
      const newSpace: ClientSpace = {
          id: Math.random().toString(36).substr(2, 9),
          name: data.name || 'New Client',
          status: 'Active',
          onboardingComplete: false,
          modules: { messaging: true, meetings: true, calendar: true, onboarding: true, files: true, referral: true },
          clientData: { contactName: data.clientData?.contactName },
          analytics: { totalMeetings: 0, totalDocs: 0, lastActive: 'Just now' },
          notifications: 0
      };
      setClients([...clients, newSpace]);
  };

  const handleCreateTask = (data: any) => {
      const newTask: Task = {
          id: Math.random().toString(),
          ...data
      };
      setTasks([...tasks, newTask]);
  };

  const handleTaskStatusUpdate = (taskId: string, newStatus: Task['status']) => {
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const handleScheduleMeeting = (data: any) => {
      const clientName = clients.find(c => c.id === data.spaceId)?.name || 'Unknown';
      const newMeeting: Meeting = {
          id: Math.random().toString(),
          clientId: data.spaceId,
          clientName: clientName,
          title: 'Scheduled Meeting', 
          date: data.date,
          time: data.time,
          type: 'upcoming'
      };
      setMeetings([...meetings, newMeeting]);
      if(data.notify) alert(`Notification sent to ${clientName}`);
  };

  // View Routing
  const renderContent = () => {
    switch (currentView) {
      case ViewState.DASHBOARD:
        return <StaffDashboardView clients={clients} messages={messages} meetings={meetings} />;
      case ViewState.SPACES:
        return <SpacesView clients={clients} onSelect={(id) => { setSelectedSpaceId(id); setCurrentView(ViewState.SPACE_DETAIL); }} onCreate={handleCreateSpace} />;
      case ViewState.SPACE_DETAIL:
        return <SpaceDetailView space={clients.find(c => c.id === selectedSpaceId)!} onBack={() => setCurrentView(ViewState.SPACES)} />;
      case ViewState.INBOX:
        return <InboxView messages={messages} clients={clients} />;
      case ViewState.STAFF:
        return <StaffView staffList={staff} />;
      case ViewState.TASKS:
        return <TaskView tasks={tasks} clients={clients} onUpdateStatus={handleTaskStatusUpdate} onCreate={handleCreateTask} />;
      case ViewState.MEETINGS:
        return <GlobalMeetingsView meetings={meetings} clients={clients} onSchedule={handleScheduleMeeting} />;
      case ViewState.FILES:
        return <GlobalFilesView files={files} clients={clients} />;
      case ViewState.SETTINGS:
        return <SettingsView />;
      default:
        return <div className="p-8">View Not Found</div>;
    }
  };

  // --- Global Routing ---

  if (globalView === 'LANDING') {
      return <LandingPage onStartOnboarding={() => setGlobalView('ONBOARDING')} />;
  }

  if (globalView === 'ONBOARDING') {
      return <Onboarding onComplete={() => setGlobalView('APP')} />;
  }

  // --- Main App Logic ---

  // If Client View, show separate layout
  if (currentUserRole === 'client') {
      return <ClientPortalView client={clients[0]} onLogout={() => setCurrentUserRole('admin')} />;
  }

  // Admin/Staff Layout
  return (
    <div className="flex h-screen w-full bg-[#f3f4f6] text-zinc-900 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 bg-white/40 backdrop-blur-xl border-r border-white/40 flex flex-col justify-between p-4 z-20">
        <div>
          <div className="flex items-center gap-3 px-4 mb-10 mt-2">
            <div className="h-8 w-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <span className="text-lg font-semibold tracking-tight text-zinc-800">Nexus</span>
          </div>

          <nav className="space-y-1">
            <SidebarItem icon={LayoutDashboard} label="Dashboard" active={currentView === ViewState.DASHBOARD} onClick={() => setCurrentView(ViewState.DASHBOARD)} />
            <SidebarItem icon={Briefcase} label="Spaces" active={currentView === ViewState.SPACES || currentView === ViewState.SPACE_DETAIL} onClick={() => setCurrentView(ViewState.SPACES)} />
            <SidebarItem icon={MessageSquare} label="Inbox" active={currentView === ViewState.INBOX} onClick={() => setCurrentView(ViewState.INBOX)} />
            <SidebarItem icon={Video} label="Meetings" active={currentView === ViewState.MEETINGS} onClick={() => setCurrentView(ViewState.MEETINGS)} />
            <SidebarItem icon={ListTodo} label="Tasks" active={currentView === ViewState.TASKS} onClick={() => setCurrentView(ViewState.TASKS)} />
            <SidebarItem icon={FileText} label="Files" active={currentView === ViewState.FILES} onClick={() => setCurrentView(ViewState.FILES)} />
            <div className="pt-4 mt-4 border-t border-zinc-200/50">
                <p className="px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Admin</p>
                <SidebarItem icon={Users} label="Staff" active={currentView === ViewState.STAFF} onClick={() => setCurrentView(ViewState.STAFF)} />
                <SidebarItem icon={Settings} label="Settings" active={currentView === ViewState.SETTINGS} onClick={() => setCurrentView(ViewState.SETTINGS)} />
            </div>
          </nav>
        </div>

        <div className="p-4">
          <GlassCard className="p-3 flex items-center gap-3 cursor-pointer hover:bg-white/60" onClick={() => setCurrentUserRole('client')}>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-zinc-200 to-zinc-300 flex items-center justify-center">
                <User size={16} className="text-zinc-600"/>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">Demo Admin</p>
              <p className="text-xs text-zinc-500 truncate">Switch to Client View</p>
            </div>
          </GlassCard>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative p-8">
        {renderContent()}
      </main>

    </div>
  );
};

export default App;
