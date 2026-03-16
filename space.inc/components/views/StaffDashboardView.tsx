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


// 1. Staff Dashboard
const StaffDashboardView = ({ clients, messages, meetings, tasks, profile, onJoin, onInstantMeet }: { clients: ClientSpace[], messages: Message[], meetings: Meeting[], tasks: Task[], profile: any, onJoin: (id: string) => void, onInstantMeet?: () => void }) => {
    const { showToast } = useToast();
    const { organizationId } = useAuth();
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
        .filter(t => t.status !== 'done')
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
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
                        <span className="text-4xl font-semibold text-[#1D1D1D] tracking-tight">{(tasks || []).filter(t => t.status !== 'done').length}</span>
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
                                    <div className={`h-2 w-2 rounded-full ${task.status === 'in_progress' ? 'bg-amber-400' : 'bg-zinc-300'}`} />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-[#1D1D1D]">{task.title}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                                {clients.find(c => c.id === task.space_id)?.name || 'General'}
                                            </span>
                                            <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider flex items-center gap-1">
                                                <Clock size={10} /> {task.due_date}
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
                    if (!selectedSpaceForUpload || !organizationId) return;
                    setUploading(true);
                    try {
                        const fileData = await apiService.uploadFile(selectedSpaceForUpload, organizationId, file);
                        await apiService.sendMessage(
                            selectedSpaceForUpload,
                            `Shared a file: ${file.name}`,
                            'file',
                            { file_id: fileData.id, file_name: file.name, mime_type: file.type },
                            'general',
                            organizationId
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

export default StaffDashboardView;
