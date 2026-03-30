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
import { supabase } from '../../lib/supabase';
import { ClientSpace, ViewState, Meeting, Message, StaffMember, Task, SpaceFile, ChartData, ClientLifecycle } from '../../types';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useRealtimeFiles } from '../../hooks/useRealtimeFiles';


// 2. Spaces View
const SpacesView = ({ clients, onSelect, onCreate }: { clients: ClientSpace[], onSelect: (id: string) => void, onCreate: (data: any) => void }) => {
    const { showToast } = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientContact, setNewClientContact] = useState('');
    const [newClientEmail, setNewClientEmail] = useState('');
    const [selectedModules, setSelectedModules] = useState({
        messages: true,
        chat: true,
        upload: true,
        meetings: true
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
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${client.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                {client.status}
                            </span>
                        </div>
                        <h3 className="text-xl font-bold text-zinc-900 mb-1">{client.name}</h3>
                        <p className="text-sm text-zinc-500 font-light mb-6">{client.description || 'Verified Portal Environment'}</p>
                        <div className="py-4 border-t border-zinc-50 mb-2">
                            <SpaceActivityIndicators spaceId={client.id} />
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

                    <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Invitee Email (Optional)</label>
                        <Input placeholder="client@example.com" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} />
                    </div>

                    <div className="pt-2">
                        <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-4">Included Features</label>
                        <div className="grid grid-cols-2 gap-4">
                            <Checkbox
                                label="Messages"
                                checked={selectedModules.messages}
                                onChange={(val) => setSelectedModules(prev => ({ ...prev, messages: val }))}
                            />
                            <Checkbox
                                label="Chat"
                                checked={selectedModules.chat}
                                onChange={(val) => setSelectedModules(prev => ({ ...prev, chat: val }))}
                            />
                            <Checkbox
                                label="Upload"
                                checked={selectedModules.upload}
                                onChange={(val) => setSelectedModules(prev => ({ ...prev, upload: val }))}
                            />
                            <Checkbox
                                label="Meetings"
                                checked={selectedModules.meetings}
                                onChange={(val) => setSelectedModules(prev => ({ ...prev, meetings: val }))}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-6">
                        <Button className="w-full" variant="outline" onClick={() => {
                            setIsModalOpen(false);
                            setNewClientName('');
                            setNewClientEmail('');
                        }}>Cancel</Button>
                        <Button className="w-full" onClick={handleSubmit}>Create Space</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const SpaceActivityIndicators = ({ spaceId }: { spaceId: string }) => {
    const { organizationId } = useAuth();
    const [indicators, setIndicators] = useState<{
        unreadCount: number;
        upcomingMeetingsCount: number;
        recentFilesCount: number;
    }>({ unreadCount: 0, upcomingMeetingsCount: 0, recentFilesCount: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            if (!spaceId || !organizationId) return;
            try {
                const { data, error } = await apiService.getSpaceDashboardData(spaceId, organizationId);
                if (error) throw error;

                setIndicators({
                    unreadCount: data.unread_messages || 0,
                    upcomingMeetingsCount: (data.upcoming_meetings || []).length,
                    recentFilesCount: data.recent_files || 0
                });
            } catch (err) {
                console.error('Failed to load indicators for space:', spaceId, err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [spaceId, organizationId]);

    if (loading) return <div className="h-10 flex items-center justify-center"><div className="h-4 w-4 border-2 border-zinc-200 border-t-zinc-400 rounded-full animate-spin" /></div>;

    return (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {indicators.unreadCount > 0 && (
                <span className="flex-shrink-0 px-2 py-0.5 text-[9px] font-black uppercase bg-rose-50 text-rose-600 border border-rose-100 rounded">
                    {indicators.unreadCount} Unread
                </span>
            )}
            {indicators.upcomingMeetingsCount > 0 && (
                <span className="flex-shrink-0 px-2 py-0.5 text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-100 rounded">
                    {indicators.upcomingMeetingsCount} Meeting{indicators.upcomingMeetingsCount > 1 ? 's' : ''}
                </span>
            )}
            {indicators.recentFilesCount > 0 && (
                <span className="flex-shrink-0 px-2 py-0.5 text-[9px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-100 rounded">
                    {indicators.recentFilesCount} New File{indicators.recentFilesCount > 1 ? 's' : ''}
                </span>
            )}
            {!indicators.unreadCount && !indicators.upcomingMeetingsCount && !indicators.recentFilesCount && (
                <span className="text-[9px] text-zinc-400 italic">No new activity</span>
            )}
        </div>
    );
};

export default SpacesView;
