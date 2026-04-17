import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import {
    Plus, ChevronRight, Video, Clock, ArrowRight, Flag, Trash2, Play, Download as DownloadIcon
} from 'lucide-react';
import {
    GlassCard, Button, Heading, Text, Input, Modal, Toggle
} from '../UI/index';
import { PostMeetingDashboard } from './PostMeetingDashboard';
import { ClientSpace, Meeting, Task } from '../../types';
import { CalendarWidget } from '../CalendarWidget';


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
            <div className="flex gap-1 mb-6 rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-1 w-fit">
                <button
                    onClick={() => setTab('Upcoming')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        tab === 'Upcoming' 
                            ? 'bg-white text-[#0D0D0D] shadow-[0_1px_3px_rgba(0,0,0,0.06)]' 
                            : 'text-[#6E6E80] hover:text-[#0D0D0D]'
                    }`}
                >
                    Upcoming
                </button>
                <button
                    onClick={() => setTab('History')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        tab === 'History' 
                            ? 'bg-white text-[#0D0D0D] shadow-[0_1px_3px_rgba(0,0,0,0.06)]' 
                            : 'text-[#6E6E80] hover:text-[#0D0D0D]'
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
                                    <div className="bg-[#F7F7F8] border border-[#E5E5E5] rounded-[8px] px-4 py-3 text-center min-w-[80px]">
                                        <p className="text-[10px] text-[#6E6E80] uppercase font-semibold tracking-wider">
                                            {new Date(meeting.starts_at).toLocaleString('default', { month: 'short' })}
                                        </p>
                                        <p className="text-xl font-medium text-[#0D0D0D]">
                                            {new Date(meeting.starts_at).getDate()}
                                        </p>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-medium text-[#0D0D0D]">{meeting.title}</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-sm text-[#6E6E80] flex items-center gap-1">
                                                <Clock size={14} />
                                                {new Date(meeting.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span className="text-sm text-[#6E6E80]">
                                                {clients.find(c => c.id === meeting.space_id)?.name || 'Unknown'}
                                            </span>
                                            {meeting.status === 'active' || meeting.status === 'live' ? (
                                                <span className="px-2 py-0.5 border border-[#E5E5E5] bg-[#F7F7F8] text-[#0D0D0D] text-[10px] font-semibold rounded-full flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 bg-black rounded-full animate-pulse" />
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
                                className="p-6 flex items-center justify-between opacity-90 hover:opacity-100 transition-opacity cursor-pointer"
                                onClick={() => setSelectedMeeting(meeting)}
                            >
                                <div className="flex items-center gap-6">
                                    <div className="bg-[#F7F7F8] border border-[#E5E5E5] rounded-[8px] px-4 py-2 text-center min-w-[80px]">
                                        <p className="text-[10px] text-[#6E6E80] font-semibold">ENDED</p>
                                        <p className="text-lg font-medium text-[#6E6E80]">
                                            {new Date(meeting.starts_at).getDate()}
                                        </p>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-medium text-[#0D0D0D]">{meeting.title}</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-sm text-[#6E6E80]">
                                                {new Date(meeting.starts_at).toLocaleDateString()}
                                            </span>
                                            <span className="text-sm text-[#6E6E80]">
                                                {clients.find(c => c.id === meeting.space_id)?.name || 'Unknown'}
                                            </span>
                                            {/* Outcome badge */}
                                            {meeting.outcome && (
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                                    meeting.outcome === 'successful' ? 'border-[#E5E5E5] bg-[#F7F7F8] text-[#0D0D0D]' :
                                                    meeting.outcome === 'no_show' ? 'border-[#E5E5E5] bg-[#F7F7F8] text-[#0D0D0D]' :
                                                    meeting.outcome === 'follow_up_needed' ? 'border-[#E5E5E5] bg-[#F7F7F8] text-[#0D0D0D]' :
                                                    'border-[#E5E5E5] bg-[#F7F7F8] text-[#6E6E80]'
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
                                        className="text-[#0D0D0D] border-[#E5E5E5] hover:bg-[#F7F7F8]"
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
                            className="w-full rounded-[8px] border border-[#E5E5E5] bg-white px-5 py-3 text-sm text-[#0D0D0D] focus:outline-none"
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
                            className="w-full rounded-[8px] border border-[#E5E5E5] bg-white px-5 py-3 text-sm text-[#0D0D0D] focus:outline-none"
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
                        <label className="block text-sm font-medium text-[#0D0D0D] mb-2">Outcome</label>
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
                                                    ? 'bg-[#F7F7F8] border-black text-[#0D0D0D] font-medium'
                                                    : 'bg-white border-[#E5E5E5] text-[#6E6E80] hover:bg-[#F7F7F8]'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#0D0D0D] mb-2">Notes (optional)</label>
                        <textarea
                            value={endNotes}
                            onChange={e => setEndNotes(e.target.value)}
                            placeholder="Add any final unstructured notes..."
                            disabled={isEnding}
                            className="w-full rounded-[8px] border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#0D0D0D] outline-none focus:border-black min-h-[100px]"
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
