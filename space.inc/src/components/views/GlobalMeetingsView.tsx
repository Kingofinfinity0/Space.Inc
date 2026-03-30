import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import {
    LayoutDashboard, Users, MessageSquare, Calendar, FileText, Settings, Plus, Search,
    Briefcase, ChevronRight, LogOut, Video, Download, Upload, Clock, UserPlus, ArrowRight,
    Link as LinkIcon, Copy, ListTodo, MoreVertical, Flag, Trash2, User, ArrowLeft,
    GripVertical, Activity, Shield, Lock, FileUp, Key, FilePlus as FilePlus2,
    File as DocIcon, Rocket, LayoutGrid, Inbox, UserCheck, CheckSquare, FolderClosed,
    Bell, Eye, Play, X, FileVideo, ChevronLeft
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


// 4. Meeting Hub
const GlobalMeetingsView = ({ meetings, clients, onSchedule, onJoin, onInstantMeet, onDeleteMeeting }: { 
    meetings: Meeting[], 
    clients: ClientSpace[], 
    onSchedule: (m: any) => void, 
    onJoin: (id: string) => void, 
    onInstantMeet: (spaceId: string) => void,
    onDeleteMeeting?: (meetingId: string) => void
}) => {
    const [tab, setTab] = useState<'Upcoming' | 'History'>('Upcoming');
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

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
                            <div className="flex gap-2">
                                <Button variant="secondary" size="sm" onClick={() => joinRoom(meeting.id)}>
                                    Join Room <ArrowRight size={14} className="ml-1" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="px-2 text-red-500 hover:bg-red-50 border-red-100"
                                    onClick={(e) => {
                                        e.stopPropagation();
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
                                {(meeting.has_recording ?? !!meeting.recording_url) &&
                                    (meeting.recording_status === 'ready' || meeting.recording_status === 'available') && (
                                        <div className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs">Rec</div>
                                    )}
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
                    <Button className="w-full mt-4" onClick={handleSchedule}>Schedule Meeting</Button>
                </div>
            </Modal>

            {/* Post-Meeting Summary Modal */}
            <Modal isOpen={!!selectedMeeting} onClose={() => setSelectedMeeting(null)} title="Meeting Summary">
                {selectedMeeting && (
                    <div className="space-y-6">
                        {/*
                          Task 3E: show recording only when backend marks it ready.
                          We support both legacy ('available') and newer ('ready') values for recording_status.
                        */}
                        {(() => {
                            const isRecordingReady =
                                selectedMeeting.recording_status === 'ready' || selectedMeeting.recording_status === 'available';
                            const hasRecording = selectedMeeting.has_recording ?? !!selectedMeeting.recording_url;
                            const canViewRecording = isRecordingReady && hasRecording && !!selectedMeeting.recording_url;

                            return (
                                <>
                                    {/* Header Info */}
                                    {/* Recording Section */}
                                    <div className="bg-zinc-900 rounded-lg p-1 overflow-hidden">
                                        {canViewRecording ? (
                                            <div
                                                className="relative group cursor-pointer"
                                                onClick={() => selectedMeeting.recording_url && window.open(selectedMeeting.recording_url, '_blank')}
                                            >
                                                <div className="aspect-video bg-zinc-800 rounded flex items-center justify-center relative overflow-hidden">
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
                                </>
                            );
                        })()}
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

                        {/* Notes & Transcript Tabs */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-medium text-zinc-900 uppercase tracking-wider">Meeting Notes</h4>
                            <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-lg text-sm text-zinc-600 leading-relaxed min-h-[100px]">
                                {selectedMeeting.notes || <span className="text-zinc-400 italic">No notes were taken during this session.</span>}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button className="flex-1" variant="secondary" onClick={() => setSelectedMeeting(null)}>Close</Button>
                            {(selectedMeeting.has_recording ?? !!selectedMeeting.recording_url) &&
                                (selectedMeeting.recording_status === 'ready' || selectedMeeting.recording_status === 'available') &&
                                selectedMeeting.recording_url && (
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
export default GlobalMeetingsView;
