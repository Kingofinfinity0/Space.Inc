import React, { useState } from 'react';
import { GlassCard, Button, Heading, Input, Modal, Toggle } from '../../components/UI';
import { ClientSpace, Meeting } from '../../types';
import { Plus, ArrowRight, Clock, Users, Calendar } from 'lucide-react';

interface MeetingHubProps {
  spaces: ClientSpace[];
}

export const MeetingHub: React.FC<MeetingHubProps> = ({ spaces }) => {
    const [tab, setTab] = useState<'Upcoming' | 'History'>('Upcoming');
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

    // Schedule Form State
    const [newMeetingSpace, setNewMeetingSpace] = useState(spaces[0]?.id || '');
    const [newMeetingDate, setNewMeetingDate] = useState('');
    const [newMeetingTime, setNewMeetingTime] = useState('');
    const [notifyClient, setNotifyClient] = useState(true);

    // Mock data - this should be passed as props or fetched
    const mockMeetings: Meeting[] = [
        { 
            id: '1', 
            title: 'Q3 Strategy Review', 
            clientName: 'Acme Corp', 
            clientId: '1', 
            date: '2023-10-25', 
            time: '14:00', 
            type: 'upcoming',
            starts_at: '2023-10-25T14:00:00Z',
            space_id: '1',
            organization_id: 'org-1',
            status: 'scheduled'
        },
        { 
            id: '2', 
            title: 'Onboarding Kickoff', 
            clientName: 'Lumina Design', 
            clientId: '2', 
            date: '2023-10-20', 
            time: '10:00', 
            type: 'past', 
            hasRecording: true, 
            hasNotes: true, 
            duration: '45 mins', 
            notesContent: 'Client agreed to the new roadmap. Requires follow-up on design assets.',
            starts_at: '2023-10-20T10:00:00Z',
            space_id: '2',
            organization_id: 'org-1',
            status: 'ended',
            ended_at: '2023-10-20T10:45:00Z'
        },
    ];

    const meetings = mockMeetings;

    const handleSchedule = () => {
        // This should be passed as a prop or handled by parent
        console.log('Scheduling meeting:', {
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
                            {spaces.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                                {selectedMeeting.notes || 'No notes taken for this meeting.'}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
