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


// --- Phase 16: Clients & Compliance Views ---

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
                    <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Clients</h1>
                    <p className="text-zinc-500 font-light mt-1">Client management for your organization</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" icon={<Download size={16} />}>Export Report</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Clients', value: clients.length, color: 'zinc' },
                    { label: 'Active', value: clients.filter(c => c.membership_status === 'active').length, color: 'emerald' },
                    { label: 'Pending', value: clients.filter(c => c.membership_status === 'pending').length, color: 'orange' },
                    { label: 'This Month', value: clients.filter(c => new Date(c.joined_at).getMonth() === new Date().getMonth()).length, color: 'sky' }
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
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Name</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Email</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Space</th>
                            <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Joined</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                        {clients.length > 0 ? (
                            clients.map((client) => (
                                <tr key={client.profile_id} className="hover:bg-zinc-50/30 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="font-bold text-zinc-900">{client.full_name}</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-sm text-zinc-600">{client.email}</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-sm font-medium text-zinc-700">{client.space_name || 'Current Space'}</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-sm text-zinc-600">
                                            {client.joined_at ? new Date(client.joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center">
                                    <p className="text-zinc-400 italic">No clients in this space yet.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </GlassCard>
        </div>
    );
};

export default ClientsCRMView;
