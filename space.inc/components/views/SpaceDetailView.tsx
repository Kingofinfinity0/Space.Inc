import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../utils/errors';
import {
    LayoutDashboard, Users, MessageSquare, Calendar, FileText, Settings, Plus, Search,
    Briefcase, ChevronRight, LogOut, Video, Download, Upload, Clock, UserPlus, ArrowRight,
    Link as LinkIcon, Copy, ListTodo, MoreVertical, Flag, Trash2, User, ArrowLeft,
    GripVertical, Activity, Shield, Lock, FileUp, Key, FilePlus as FilePlus2,
    Bell, Eye, Play, X, FileVideo, ChevronLeft, History
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
import { FileVersionsModal } from '../FileVersionsModal';
import { ClientSpace, ViewState, Meeting, Message, StaffMember, Task, SpaceFile, ChartData, ClientLifecycle } from '../../types';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useRealtimeFiles } from '../../hooks/useRealtimeFiles';
import SpaceChatPanel from './SpaceChatPanel';


// 3. Space Detail View
const SpaceDetailView = ({ space, meetings, onBack, onJoin, onSchedule, onInstantMeet }: { space: ClientSpace | undefined, meetings: Meeting[], onBack: () => void, onJoin: (id: string) => void, onSchedule: (data: any) => void, onInstantMeet: (spaceId: string) => void }) => {
    const { user, profile, organizationId } = useAuth();
    const { showToast } = useToast();

    const [spaceStats, setSpaceStats] = useState<any>(null);
    const [spaceStatsLoading, setSpaceStatsLoading] = useState(false);

    useEffect(() => {
        if (!space?.id) return;
        let cancelled = false;
        const loadStats = async () => {
            try {
                setSpaceStatsLoading(true);
                const { data, error } = await supabase
                    .from('space_stats')
                    .select('message_count, file_count, meeting_count, last_activity_at')
                    .eq('space_id', space.id)
                    .single();
                if (error) throw error;
                if (!cancelled) setSpaceStats(data);
            } catch (err: any) {
                console.error('[SpaceDetailView] Failed to load space_stats:', err);
            } finally {
                if (!cancelled) setSpaceStatsLoading(false);
            }
        };
        loadStats();
        return () => {
            cancelled = true;
        };
    }, [space?.id]);

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
    const [showTrash, setShowTrash] = useState(false);
    const [viewingFile, setViewingFile] = useState<SpaceFile | null>(null);
    const [versioningFile, setVersioningFile] = useState<SpaceFile | null>(null);

    // Filter meetings for this space
    const localMeetings = meetings.filter(m => m.space_id === space.id && !m.deleted_at);

    // Schedule state
    const [newMeetingDate, setNewMeetingDate] = useState('');
    const [newMeetingTime, setNewMeetingTime] = useState('');
    const [newMeetingTitle, setNewMeetingTitle] = useState(`${space.name} Sync`);
    const [notifyClient, setNotifyClient] = useState(true);
    const [newMeetingCategory, setNewMeetingCategory] = useState<string>('general');

    const handleLocalSchedule = () => {
        onSchedule({
            space_id: space.id,
            title: newMeetingTitle,
            date: newMeetingDate,
            time: newMeetingTime,
            notify: notifyClient,
            category: newMeetingCategory
        });
        setIsScheduleModalOpen(false);
    };

    const { files, loading: filesLoading } = useRealtimeFiles(space.id, showTrash);
    const { sendFile, loading: uploadLoading } = useRealtimeMessages(space.id);

    const handleFileUpload = async (file: File) => {
        if (!organizationId) return;
        await sendFile(organizationId, file);
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

            {/* Mini stats bar (Task 5C) */}
            <div className="flex gap-2 flex-wrap mb-6">
                {spaceStatsLoading ? (
                    <>
                        <span className="px-3 py-1 text-[10px] rounded-full bg-zinc-100 text-zinc-400">Loading...</span>
                    </>
                ) : (
                    <>
                        <span className="px-3 py-1 text-[10px] rounded-full bg-white/60 border border-zinc-200 text-zinc-700">
                            Messages: {spaceStats?.message_count ?? 0}
                        </span>
                        <span className="px-3 py-1 text-[10px] rounded-full bg-white/60 border border-zinc-200 text-zinc-700">
                            Files: {spaceStats?.file_count ?? 0}
                        </span>
                        <span className="px-3 py-1 text-[10px] rounded-full bg-white/60 border border-zinc-200 text-zinc-700">
                            Meetings: {spaceStats?.meeting_count ?? 0}
                        </span>
                        <span className="px-3 py-1 text-[10px] rounded-full bg-white/60 border border-zinc-200 text-zinc-700">
                            Last active: {spaceStats?.last_activity_at ? new Date(spaceStats.last_activity_at).toLocaleString() : '—'}
                        </span>
                    </>
                )}
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
                                                            const { data } = await apiService.getSignedUrl(file.id, organizationId || '');
                                                            if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                                        }}
                                                        className="h-8 w-8 p-0"
                                                        title="Download"
                                                    >
                                                        <Download size={16} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 text-zinc-400 hover:text-indigo-500"
                                                        onClick={() => setVersioningFile(file as any)}
                                                        title="Version History"
                                                    >
                                                        <History size={16} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        onClick={async () => {
                                                            if (confirm('Are you sure you want to move this file to trash?')) {
                                                                 try {
                                                                     await apiService.deleteFile(file.id);
                                                                     showToast('File moved to trash.', "success");
                                                                 } catch (err: any) {
                                                                    showToast(friendlyError(err?.message), "error");
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
                                                                await apiService.restoreFile(file.id);
                                                                showToast('File restored.', "success");
                                                            } catch (err: any) {
                                                                    showToast(friendlyError(err?.message), "error");
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
                                                                    await apiService.hardDeleteFile(file.id);
                                                                    showToast('File permanently deleted.', "success");
                                                                } catch (err: any) {
                                                                    showToast(friendlyError(err?.message), "error");
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

            <FileVersionsModal
                isOpen={!!versioningFile}
                onClose={() => setVersioningFile(null)}
                file={versioningFile}
            />
        </div>
    );
};
export default SpaceDetailView;
