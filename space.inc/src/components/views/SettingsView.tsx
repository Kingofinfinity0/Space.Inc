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
import { PolicySettings } from '../settings/PolicySettings';


// 8. Settings View
const SettingsView = () => {
    const { profile } = useAuth();

    return (
        <div>
            <Heading level={1} className="mb-8">Settings</Heading>
            {/* Organization Policies (Admins Only) */}
            {(profile?.role === 'owner' || profile?.role === 'admin') && (
                <div className="mb-12">
                    <PolicySettings />
                </div>
            )}

            <div className="space-y-6 max-w-2xl">
                <GlassCard className="p-6">
                    <Heading level={3} className="mb-4">Data Management</Heading>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-[#F7F7F8] rounded-md border border-[#D1D5DB]/30">
                            <div>
                                <p className="font-medium text-[#1D1D1D]">Export All Data</p>
                                <p className="text-sm text-zinc-500">Download clients, records, and logs.</p>
                            </div>
                            <Button variant="secondary"><Download size={16} className="mr-2" /> Download</Button>
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="p-6 border-red-100">
                    <Heading level={3} className="mb-4 text-red-600">Danger Zone</Heading>
                    <div className="flex items-center justify-between p-4 bg-red-50 rounded-md">
                        <div>
                            <p className="font-medium text-red-900">Delete Account</p>
                            <p className="text-sm text-red-500">Permanently delete your organization.</p>
                        </div>
                        <Button variant="danger"><Trash2 size={16} className="mr-2" /> Delete</Button>
                    </div>
                </GlassCard>
            </div>
        </div>
    )
}
export default SettingsView;

export const BillingSettingsView = () => {
    const { userRole } = useAuth();

    if (userRole !== 'owner') {
        return <div className="p-8 text-center text-[#6E6E80]">Access Denied. Billing is only accessible by the organization owner.</div>;
    }

    return (
        <div>
            <Heading level={1} className="mb-8">Billing & Subscription</Heading>
            <GlassCard className="p-6">
                <Text>Subscription management and billing history will appear here.</Text>
            </GlassCard>
        </div>
    );
};
