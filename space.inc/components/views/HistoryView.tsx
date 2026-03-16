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


// 11. Accountability Ledger (History) View
const HistoryView = ({ logs }: { logs: any[] }) => {
    const getActionIcon = (type: string) => {
        switch (type) {
            case 'SPACE_CREATED': return <Plus size={16} className="text-emerald-500" />;
            case 'INVITATION_DISPATCHED': return <UserPlus size={16} className="text-blue-500" />;
            case 'CLIENT_PORTAL_ENTRY': return <Key size={16} className="text-amber-500" />;
            case 'FILE_UPLOADED': return <FileUp size={16} className="text-indigo-500" />;
            case 'SECURITY_ALERT': return <Shield size={16} className="text-red-500" />;
            default: return <Activity size={16} className="text-zinc-400" />;
        }
    };

    return (
        <div className="space-y-6 animate-[fadeIn_0.5s_ease-out]">
            <header className="mb-8">
                <Heading level={1}>Accountability Ledger</Heading>
                <Text variant="secondary" className="mt-1">Historical audit trail of all organization activities.</Text>
            </header>

            <GlassCard className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-100">
                                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Activity</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Space</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {logs.length > 0 ? logs.map((log) => (
                                <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-white border border-zinc-100 flex items-center justify-center shadow-sm">
                                                {getActionIcon(log.action_type)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-[#1D1D1D]">{log.action_type.replace(/_/g, ' ')}</p>
                                                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter opacity-60">Success</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-600">
                                                {log.profiles?.full_name?.substring(0, 2).toUpperCase() || '??'}
                                            </div>
                                            <span className="text-sm text-zinc-600">{log.profiles?.full_name || 'System'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-zinc-500">{log.spaces?.name || 'Organization'}</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-zinc-400">
                                        {new Date(log.created_at).toLocaleString()}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 italic text-sm">
                                        No activity logs found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>
        </div>
    );
};
export default HistoryView;
