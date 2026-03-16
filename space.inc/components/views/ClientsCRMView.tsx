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

export default ClientsCRMView;
