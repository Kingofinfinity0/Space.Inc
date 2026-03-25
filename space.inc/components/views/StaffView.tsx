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


const StaffView: React.FC<{
    staff: StaffMember[];
    spaces: ClientSpace[];
    onInvite: () => void;
    onUpdateCapability: (staffId: string, spaceId: string, allowed: boolean) => void;
    onRefresh?: () => void;
}> = ({ staff, spaces, onInvite, onUpdateCapability, onRefresh }) => {
    const { showToast } = useToast();

    const handleToggleSpace = async (staffUserId: string, spaceId: string, currentValue: boolean) => {
        try {
            await apiService.updateStaffCapability(staffUserId, spaceId, !currentValue);
            showToast("Staff capability updated successfully.", "success");
            // Refresh staff list after update
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error('Failed to update staff capability:', err);
            showToast("Failed to update staff capability.", "error");
        }
    };

    return (
    <div className="space-y-8 animate-[fadeIn_0.5s_ease-out]">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Staff Engine</h1>
                <p className="text-zinc-500 font-light mt-1">Manage human authority and space assignments</p>
            </div>
            <Button onClick={onInvite} icon={<UserPlus size={18} />}>Add Human</Button>
        </div>

        <div className="grid grid-cols-1 gap-6">
            {staff.map((member) => (
                <GlassCard key={member.id} className="p-8">
                    <div className="flex items-start justify-between mb-8">
                        <div className="flex items-center gap-6">
                            <div className="h-16 w-16 bg-zinc-100 rounded-2xl flex items-center justify-center border border-zinc-200/50 shadow-inner">
                                <User size={32} className="text-zinc-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-zinc-900">{member.full_name}</h3>
                                <div className="flex items-center gap-4 mt-1">
                                    <span className="text-zinc-500 text-sm font-light">{member.email}</span>
                                    <span className="h-1 w-1 bg-zinc-300 rounded-full" />
                                    <span className="px-2 py-0.5 bg-zinc-100 text-[10px] font-black uppercase text-zinc-500 rounded tracking-tight">{member.role}</span>
                                    {member.is_active ?
                                        <span className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-black uppercase tracking-tight">
                                            <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" /> Active
                                        </span> :
                                        <span className="text-zinc-400 text-[10px] font-black uppercase tracking-tight italic">Awaiting Setup</span>
                                    }
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm">Edit</Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-1">Space Authority Matrix</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {spaces.map(space => {
                                const isAssigned = (member.assigned_spaces as any[])?.some(s => s.space_id === space.id);
                                return (
                                    <div key={space.id} className={`
                                        p-4 rounded-xl border transition-all
                                        ${isAssigned ? 'bg-zinc-50/50 border-zinc-200 ring-1 ring-zinc-100' : 'bg-white border-zinc-100 opacity-50 grayscale hover:opacity-100 hover:grayscale-0'}
                                    `}>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm font-bold text-zinc-800">{space.name}</span>
                                            <Toggle
                                                checked={isAssigned}
                                                onChange={() => handleToggleSpace(member.id, space.id, isAssigned)}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </GlassCard>
            ))}
        </div>
    </div>
    );
};

export default StaffView;
