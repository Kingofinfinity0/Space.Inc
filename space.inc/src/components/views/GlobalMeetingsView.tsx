import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import {
    LayoutDashboard, Users, MessageSquare, Calendar, FileText, Settings, Plus, Search,
    Briefcase, ChevronRight, LogOut, Video, Download, Upload, Clock, UserPlus, ArrowRight,
    Link as LinkIcon, Copy, ListTodo, MoreVertical, Flag, Trash2, User, ArrowLeft,
    GripVertical, Activity, Shield, Lock, FileUp, Key, FilePlus as FilePlus2,
    File as DocIcon, Rocket, LayoutGrid, Inbox, UserCheck, CheckSquare, FolderClosed,
    Bell, Eye, Play, X, FileVideo, ChevronLeft, Download as DownloadIcon
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
import { ClientSpace, ViewState, Meeting, Message, StaffMember, Task, SpaceFile, ChartData, ClientLifecycle } from '../../types';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useRealtimeFiles } from '../../hooks/useRealtimeFiles';
import { CalendarWidget } from '../CalendarWidget';

const PostMeetingDashboard: React.FC<{ meeting: Meeting; onClose: () => void }> = ({ meeting, onClose }) => {
    const [detail, setDetail] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiService.getMeetingDetail(meeting.id)
            .then(r => { if (r.data) setDetail(r.data); })
            .finally(() => setLoading(false));
    }, [meeting.id]);

    const outcomeColor = (outcome?: string) => {
        if (!outcome) return 'bg-zinc-100 text-zinc-500';
        const map: Record<string, string> = {
            successful: 'bg-emerald-100 text-emerald-700',
            follow_up_needed: 'bg-amber-100 text-amber-700',
            no_show: 'bg-red-100 text-red-700',
            cancelled: 'bg-zinc-200 text-zinc-600',
            inconclusive: 'bg-blue-100 text-blue-700',
        };
        return map[outcome] || 'bg-zinc-100 text-zinc-500';
    };

    if (loading) return <div className="py-8 text-center text-zinc-400">Loading...</div>;

    const d = detail || meeting;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-xl font-bold text-[#1D1D1D]">{d.title}</h3>
                    <p className="text-sm text-zinc-500 mt-1">
                        {new Date(d.starts_at).toLocaleDateString()} · {new Date(d.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
                <div className="flex gap-2">
                    {d.category && (
                        <span className="px-2 py-1 bg-zinc-100 text-zinc-500 text-[10px] font-bold rounded-full uppercase">
                            {d.category.replace(/_/g, ' ')}
                        </span>
                    )}
                    {d.outcome && (
                        <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase ${outcomeColor(d.outcome)}`}>
                            {d.outcome.replace(/_/g, ' ')}
                        </span>
                    )}
                </div>
            </div>

            {/* Metadata strip */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Duration', value: d.duration_minutes ? `${d.duration_minutes} min` : '—' },
                    { label: 'Participants', value: d.participants?.length ?? '—' },
                    { label: 'Ended by', value: d.ended_by_name || '—' },
                ].map(item => (
                    <div key={item.label} className="bg-zinc-50 rounded-xl p-3 text-center">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{item.label}</p>
                        <p className="text-sm font-semibold text-zinc-800 mt-1">{item.value}</p>
                    </div>
                ))}
            </div>

            {/* Recording */}
            {d.recording_url && d.recording_status === 'ready' ? (
                <div className="bg-zinc-900 rounded-xl p-1">
                    <div
                        className="aspect-video bg-zinc-800 rounded-lg flex items-center justify-center cursor-pointer hover:bg-zinc-700 transition-colors group"
                        onClick={() => window.open(d.recording_url, '_blank')}
                    >
                        <div className="text-center">
                            <div className="h-14 w-14 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-white/20 transition-colors">
                                <Play size={24} className="text-white ml-1" />
                            </div>
                            <p className="text-white text-sm font-medium">Watch Recording</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-zinc-50 rounded-xl p-6 text-center">
                    <p className="text-zinc-400 text-sm">
                        {d.recording_status === 'processing' ? '⏳ Recording processing...' : 'No recording available'}
                    </p>
                </div>
            )}

            {/* Participants */}
            {d.participants && d.participants.length > 0 && (
                <div>
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Participants</h4>
                    <div className="space-y-2">
                        {d.participants.map((p: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="h-7 w-7 bg-zinc-200 rounded-full flex items-center justify-center text-xs font-bold text-zinc-600">
                                        {p.name?.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-zinc-800">{p.name}</p>
                                        <p className="text-[10px] text-zinc-400 capitalize">{p.role}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-zinc-400">
                                        {p.joined_at ? new Date(p.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                        {p.left_at ? ` → ${new Date(p.left_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Notes */}
            {d.outcome_notes && (
                <div>
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Notes</h4>
                    <div className="p-4 bg-zinc-50 rounded-xl text-sm text-zinc-700 leading-relaxed">
                        {d.outcome_notes}
                    </div>
                </div>
            )}

            <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={onClose}>Close</Button>
                {d.recording_url && d.recording_status === 'ready' && (
                    <Button variant="primary" className="flex-1" onClick={() => window.open(d.recording_url, '_blank')}>
                        <DownloadIcon size={16} className="mr-2" /> Download
                    </Button>
                )}
            </div>
        </div>
    );
};

// 4. Meeting Hub
const GlobalMeetingsView = ({ meetings, clients, onSchedule, onJoin, onInstantMeet, onDeleteMeeting, onEndMeeting, tasks }: { 
    meetings: Meeting[], 
    clients: ClientSpace[], 
    onSchedule: (m: any) => void, 
    onJoin: (id: string) => void, 
    onInstantMeet: (spaceId: string) => void,
    onDeleteMeeting?: (meetingId: string) => void,
    onEndMeeting?: (id: string, outcome: string, notes: string) => void,
    tasks?: Task[]
}) => {
    const navigate = useNavigate();
    const { userRole } = useAuth();
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
    const [tab, setTab] = useState<'Upcoming' | 'History'>('Upcoming');

    const [meetingToEnd, setMeetingToEnd] = useState<Meeting | null>(null);
    const [endOutcome, setEndOutcome] = useState('successful');
    const [endNotes, setEndNotes] = useState('');
    const [isEnding, setIsEnding] = useState(false);

    // Schedule Form State
    const [newMeetingSpace, setNewMeetingSpace] = useState(clients[0]?.id || '');
    const [newMeetingDate, setNewMeetingDate] = useState('');
    const [newMeetingTime, setNewMeetingTime] = useState('');
    const [newMeetingTitle, setNewMeetingTitle] = useState('New Meeting');
    const [notifyClient, setNotifyClient] = useState(true);
    const [newMeetingCategory, setNewMeetingCategory] = useState<string>('general');

    const handleSchedule = () => {
        onSchedule({
            space_id: newMeetingSpace,
            title: newMeetingTitle,
            date: newMeetingDate,
            time: newMeetingTime,
            notify: notifyClient,
            category: newMeetingCategory
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
                    <Heading level={1}>Calendar</Heading>
                    <Text variant="secondary" className="mt-1">Schedule and manage video calls, tasks, and deadlines across spaces.</Text>
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" size="sm" onClick={() => onInstantMeet('')}>
                        <Video size={16} className="mr-1" /> Meet Now
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => setIsScheduleOpen(true)}>
                        <Plus size={16} className="mr-1" /> Schedule
                    </Button>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-zinc-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setTab('Upcoming')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        tab === 'Upcoming' 
                            ? 'bg-white text-zinc-900 shadow-sm' 
                            : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                >
                    Upcoming
                </button>
                <button
                    onClick={() => setTab('History')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        tab === 'History' 
                            ? 'bg-white text-zinc-900 shadow-sm' 
                            : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                >
                    History
                </button>
            </div>

            {/* Meeting Lists */}
            {/* ACTIVE / UPCOMING MEETINGS */}
            {tab === 'Upcoming' && (
                <div className="space-y-4">
                    {meetings
                        .filter(m => !m.deleted_at && 
                            ['scheduled', 'active', 'live'].includes(m.status))
                        .map(meeting => (
                            <GlassCard key={meeting.id} className="p-6 flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <div className="bg-[#F7F7F8] border border-[#D1D5DB]/30 rounded-md px-4 py-3 text-center min-w-[80px]">
                                        <p className="text-[10px] text-[#8E8EA0] uppercase font-bold tracking-wider">
                                            {new Date(meeting.starts_at).toLocaleString('default', { month: 'short' })}
                                        </p>
                                        <p className="text-xl font-medium text-[#1D1D1D]">
                                            {new Date(meeting.starts_at).getDate()}
                                        </p>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-medium text-[#1D1D1D]">{meeting.title}</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-sm text-zinc-500 flex items-center gap-1">
                                                <Clock size={14} />
                                                {new Date(meeting.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span className="text-sm text-zinc-500">
                                                {clients.find(c => c.id === meeting.space_id)?.name || 'Unknown'}
                                            </span>
                                            {meeting.status === 'active' || meeting.status === 'live' ? (
                                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                                    LIVE
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="secondary" size="sm" onClick={() => joinRoom(meeting.id)}>
                                        Enter Lobby <ArrowRight size={14} className="ml-1" />
                                    </Button>
                                    {!meeting.deleted_at && ['owner', 'admin', 'staff'].includes(userRole || '') && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="px-2 text-rose-600 hover:bg-rose-50 border-rose-200"
                                            onClick={() => {
                                                setEndOutcome('successful');
                                                setEndNotes('');
                                                setMeetingToEnd(meeting);
                                            }}
                                            title="End Meeting"
                                        >
                                            <Flag size={14} />
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="px-2 text-red-500 hover:bg-red-50 border-red-100"
                                        onClick={() => {
                                            if (window.confirm('Delete this meeting?')) {
                                                onDeleteMeeting?.(meeting.id);
                                            }
                                        }}
                                    >
                                        <Trash2 size={16} />
                                    </Button>
                                </div>
                            </GlassCard>
                        ))}
                    {meetings.filter(m => !m.deleted_at && ['scheduled', 'active', 'live'].includes(m.status)).length === 0 && (
                        <div className="text-center py-12 text-zinc-400 italic">No upcoming meetings.</div>
                    )}
                </div>
            )}

            {/* ENDED MEETINGS */}
            {tab === 'History' && (
                <div className="space-y-4">
                    {meetings
                        .filter(m => !m.deleted_at && ['ended', 'cancelled'].includes(m.status))
                        .map(meeting => (
                            <GlassCard
                                key={meeting.id}
                                className="p-6 flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                                onClick={() => setSelectedMeeting(meeting)}
                            >
                                <div className="flex items-center gap-6">
                                    <div className="bg-[#F7F7F8] border border-[#D1D5DB]/50 rounded-md px-4 py-2 text-center min-w-[80px]">
                                        <p className="text-[10px] text-[#8E8EA0] font-bold">ENDED</p>
                                        <p className="text-lg font-medium text-zinc-500">
                                            {new Date(meeting.starts_at).getDate()}
                                        </p>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-medium text-zinc-700">{meeting.title}</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-sm text-zinc-400">
                                                {new Date(meeting.starts_at).toLocaleDateString()}
                                            </span>
                                            <span className="text-sm text-zinc-400">
                                                {clients.find(c => c.id === meeting.space_id)?.name || 'Unknown'}
                                            </span>
                                            {/* Outcome badge */}
                                            {meeting.outcome && (
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    meeting.outcome === 'successful' ? 'bg-emerald-100 text-emerald-700' :
                                                    meeting.outcome === 'no_show' ? 'bg-red-100 text-red-700' :
                                                    meeting.outcome === 'follow_up_needed' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-zinc-100 text-zinc-600'
                                                }`}>
                                                    {meeting.outcome.replace(/_/g, ' ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="text-purple-600 border-purple-200 hover:bg-purple-50"
                                        onClick={() => navigate(`/spaces/${meeting.space_id}/meetings/${meeting.id}/review`)}
                                    >
                                        Review Details
                                    </Button>
                                </div>
                            </GlassCard>
                        ))}
                </div>
            )}

            <CalendarWidget
                meetings={meetings}
                tasks={tasks || []}
                spaces={clients}
                defaultSpaceId={null}
                showSpaceFilter={true}
                showTypeFilter={true}
                title="All Spaces Calendar"
            />

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
                    <Button className="w-full mt-4" onClick={handleSchedule}>Schedule</Button>
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

            {/* Post-Meeting Summary Modal */}
            <Modal isOpen={!!selectedMeeting} onClose={() => setSelectedMeeting(null)} title="Meeting Details">
                {selectedMeeting && (
                    <PostMeetingDashboard 
                        meeting={selectedMeeting} 
                        onClose={() => setSelectedMeeting(null)} 
                    />
                )}
            </Modal>
        </div>
    );
};
export default GlobalMeetingsView;
