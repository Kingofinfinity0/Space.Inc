import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import {
    LayoutDashboard, Users, MessageSquare, Calendar, FileText, Settings, Plus, Search,
    Briefcase, ChevronRight, LogOut, Video, Download, Upload, Clock, UserPlus, ArrowRight,
    Link as LinkIcon, Copy, ListTodo, MoreVertical, Flag, Trash2, User, ArrowLeft,
    GripVertical, Activity, Shield, Lock, FileUp, Key, FilePlus as FilePlus2,
    File as DocIcon, Rocket, LayoutGrid, Inbox, UserCheck, CheckSquare, FolderClosed,
    Bell, Eye, Play, X, FileVideo, ChevronLeft, Sparkles, Settings2
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
    GlassCard, Button, Heading, Text, Input, Modal, Checkbox, Toggle
} from '../UI/index';
import { FileViewerModal } from '../FileViewerModal';
import { FileUploadModal } from '../FileUploadModal';
import { ClientSpace, ViewState, Meeting, Message, StaffMember, Task, SpaceFile, ChartData, ClientLifecycle } from '../../types';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useRealtimeFiles } from '../../hooks/useRealtimeFiles';
import { PolicySettings } from '../settings/PolicySettings';
import { DEFAULT_SPACE_THEME, persistSpaceTheme, SPACE_THEMES, SpaceThemeId, getStoredSpaceTheme } from '../../lib/theme';
import { ShareLinkPanel } from '../invite/ShareLinkPanel';


// 8. Settings View
const SettingsView = () => {
    const { profile } = useAuth();
    const { spaceId } = useParams<{ spaceId: string }>();
    const [spaceTheme, setSpaceTheme] = useState<SpaceThemeId>(DEFAULT_SPACE_THEME);

    useEffect(() => {
        setSpaceTheme(getStoredSpaceTheme());
    }, []);

    const handleThemeChange = (themeId: SpaceThemeId) => {
        setSpaceTheme(themeId);
        persistSpaceTheme(themeId);
    };

    return (
        <div>
            <Heading level={1} className="mb-4">Settings</Heading>
            {/* Organization Policies (Admins Only) */}
            {(profile?.role === 'owner' || profile?.role === 'admin') && (
                <div className="mb-12">
                    <PolicySettings />
                </div>
            )}

            <div className="space-y-6 max-w-2xl">
                {spaceId ? <ShareLinkPanel spaceId={spaceId} /> : null}

                <GlassCard className="theme-preview-panel p-6">
                    <div className="mb-5">
                        <Heading level={3} className="mb-2">Profile & Space Theme</Heading>
                        <p className="text-sm text-[#6E6E80]">
                            Test accent colors on buttons, interactive icons, and active controls without changing the main dashboard surfaces.
                        </p>
                    </div>

                    <div className="mb-6 flex flex-wrap gap-3">
                        {Object.values(SPACE_THEMES).map((theme) => (
                            <button
                                key={theme.id}
                                type="button"
                                onClick={() => handleThemeChange(theme.id)}
                                className="rounded-[18px] border border-[#E5E5E5] bg-white px-3 py-3 text-left transition-colors hover:bg-[#F7F7F8]"
                            >
                                <div
                                    className={`theme-preview-swatch ${spaceTheme === theme.id ? 'theme-preview-swatch-active' : ''}`}
                                    style={{ background: `linear-gradient(180deg, ${theme.accent} 0%, ${theme.accentHover} 100%)` }}
                                />
                                <p className="mt-3 text-sm font-semibold text-[#0D0D0D]">{theme.name}</p>
                                <p className="text-[11px] uppercase tracking-[0.16em] text-[#6E6E80]">{theme.accent}</p>
                            </button>
                        ))}
                    </div>

                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="space-y-3 rounded-[18px] border border-[#E5E5E5] bg-white p-4">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Live preview</p>
                            <div className="flex flex-wrap gap-3">
                                <Button variant="primary" icon={<Sparkles size={16} />}>Primary action</Button>
                                <Button variant="secondary" icon={<Eye size={16} />}>Secondary</Button>
                                <Button variant="outline" icon={<Settings2 size={16} />}>Outline</Button>
                                <Button variant="ghost" icon={<Bell size={16} />}>Ghost</Button>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="surface-chip surface-chip-active px-3 py-2 text-xs font-medium">Selected chip</span>
                                <span className="surface-chip px-3 py-2 text-xs font-medium">Default chip</span>
                                <div className="theme-preview-chip inline-flex items-center gap-2 px-3 py-2 text-xs font-medium">
                                    <Shield className="theme-preview-icon" size={14} />
                                    Accent icon
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[18px] border border-[#E5E5E5] bg-white p-4">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Current theme</p>
                            <p className="mt-2 text-lg font-semibold text-[#0D0D0D]">{SPACE_THEMES[spaceTheme].name}</p>
                            <p className="mt-1 text-sm text-[#6E6E80]">Interactive elements across your space will use this accent instantly.</p>
                        </div>
                    </div>
                </GlassCard>

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
            <Heading level={1} className="mb-4">Billing & Subscription</Heading>
            <GlassCard className="p-6">
                <Text>Subscription management and billing history will appear here.</Text>
            </GlassCard>
        </div>
    );
};
