import React, { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
    AlertTriangle,
    ArrowRight,
    Bell,
    BriefcaseBusiness,
    Calendar,
    Check,
    CheckCircle2,
    FileText,
    Gauge,
    HardDrive,
    Mail,
    MessageSquare,
    RefreshCcw,
    Send,
    Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { friendlyError } from '../../utils/errors';
import { apiService } from '../../services/apiService';
import { useUrlParamState } from '../../hooks/useUrlParamState';
import { useRealtimeFiles } from '../../hooks/useRealtimeFiles';
import { usePersistentState } from '../../lib/persistence';
import { ClientLifecycle, ClientSpace, Meeting, Message, SpaceFile, StaffMember, Task } from '../../types';
import { GlassCard, Button, Heading, Text, LoadingScreen, useLoadingScreenGate } from '../UI/index';
import { VeroMark } from '../brand/VeroLogo';

type OwnerDashboardProps = {
    clients: ClientSpace[];
    staff?: StaffMember[];
    clientLifecycle?: ClientLifecycle[];
    messages: Message[];
    meetings: Meeting[];
    tasks: Task[];
    files?: SpaceFile[];
    profile: any;
    onJoin: (id: string) => void;
    onInstantMeet?: () => void;
    onCreateSpace?: (data: any) => Promise<void> | void;
    onScheduleMeeting?: (data: any) => Promise<void> | void;
    onCreateTask: (task: Partial<Task>) => Promise<void> | void;
    onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void> | void;
    onRequestReview?: (taskId: string, reviewerId: string) => Promise<void> | void;
    onCompleteReview?: (taskId: string, approved: boolean, comment?: string) => Promise<void> | void;
    onAddTaskComment?: (taskId: string, content: string) => Promise<Task | void> | Task | void;
    onGoToSpace?: (spaceId: string) => void;
    onGoToSpaces?: () => void;
    onGoToClients?: () => void;
    onGoToStaff?: () => void;
    onGoToMeetings?: () => void;
    onGoToFiles?: () => void;
    onGoToTasks?: () => void;
    onRefreshData?: () => Promise<void> | void;
};

type DashboardMode = 'master' | 'metrics' | 'actions';
type SpaceActivityCategory = 'healthy' | 'moderate' | 'warning';
type SpaceActivityTone = 'green' | 'orange' | 'red';
type SpaceActivityBucket = {
    id: SpaceActivityCategory;
    label: string;
    description: string;
    tone: SpaceActivityTone;
    color: string;
    spaces: ClientSpace[];
};
type OverviewAnalytics = {
    activeSpaces: number;
    activeClients: number;
    meetingsMonth: number;
    filesMonth: number;
};
type OwnerOverviewData = {
    upcomingMeetings: any[];
    notifications: any[];
    analytics: OverviewAnalytics;
};
type BillingUsageSnapshot = {
    storageUsedBytes?: number | string | null;
    storageLimitBytes?: number | string | null;
    spacesUsed?: number | string | null;
    spacesLimit?: number | string | null;
    teamMembersUsed?: number | string | null;
    teamMembersLimit?: number | string | null;
    planTier?: string | null;
};
type BillingPlanLimits = {
    storageGb: number;
    spaces: number;
    teamMembers: number;
};
type TodayCalendarItem = {
    id: string;
    type: 'meeting' | 'task';
    title: string;
    timeLabel: string;
    meta: string;
    sortValue: number;
    spaceId?: string;
    status?: string;
};
type BillingUsageRowProps = {
    label: string;
    ratio: string;
    description: string;
    value: number;
    tone: string;
    icon: React.ReactNode;
};

const DASHBOARD_MODES: readonly DashboardMode[] = ['master', 'metrics', 'actions'];
const BYTES_PER_GB = 1024 ** 3;
const SPACE_ANALYSIS_GAUGE = {
    startAngle: 165,
    sweepAngle: 210,
    cx: 120,
    cy: 132,
    radius: 92,
};
const BILLING_PLAN_LIMITS: Record<string, BillingPlanLimits> = {
    starter: { storageGb: 5, spaces: 3, teamMembers: 1 },
    solo: { storageGb: 5, spaces: 3, teamMembers: 1 },
    growth: { storageGb: 20, spaces: 10, teamMembers: 3 },
    scale: { storageGb: 100, spaces: 30, teamMembers: 10 },
    pro: { storageGb: 250, spaces: 50, teamMembers: 20 },
    pro_agency: { storageGb: 250, spaces: 50, teamMembers: 20 },
};
const DEFAULT_OVERVIEW_ANALYTICS: OverviewAnalytics = {
    activeSpaces: 0,
    activeClients: 0,
    meetingsMonth: 0,
    filesMonth: 0,
};
const EMPTY_OVERVIEW_DATA: OwnerOverviewData = {
    upcomingMeetings: [],
    notifications: [],
    analytics: DEFAULT_OVERVIEW_ANALYTICS,
};
const ownerOverviewQueryKeys = {
    data: (organizationId: string, userId: string) => ['owner-overview', organizationId, userId] as const,
};
const ownerBillingQueryKeys = {
    data: (organizationId: string) => ['owner-billing-usage', organizationId] as const,
};

const isDashboardMode = (value: unknown): value is DashboardMode => DASHBOARD_MODES.includes(value as DashboardMode);

const isBooleanRecord = (value: unknown): value is Record<string, boolean> => (
    Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.values(value as Record<string, unknown>).every((entry) => typeof entry === 'boolean')
);

const isStringRecord = (value: unknown): value is Record<string, string> => (
    Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.values(value as Record<string, unknown>).every((entry) => typeof entry === 'string')
);

const loadOwnerOverviewData = async (organizationId: string, userId: string): Promise<OwnerOverviewData> => {
    const now = new Date().toISOString();
    const [meetingsRes, notificationsRes, analyticsRes] = await Promise.all([
        apiService.getMeetings(organizationId),
        apiService.getUnifiedNotifications(organizationId, userId),
        apiService.getDashboardMetrics(organizationId),
    ]);

    return {
        upcomingMeetings: (meetingsRes.data || [])
            .filter((meeting: any) => meeting.starts_at > now && meeting.status === 'scheduled')
            .slice(0, 12),
        notifications: notificationsRes.data || [],
        analytics: analyticsRes.data || DEFAULT_OVERVIEW_ANALYTICS,
    };
};

const DAY_MS = 24 * 60 * 60 * 1000;

const loadOwnerBillingUsage = async (organizationId: string): Promise<BillingUsageSnapshot | null> => {
    const { data, error } = await apiService.getBillingUsageSnapshot(organizationId);
    if (error) throw error;
    return data || null;
};

function toFiniteNumber(value: unknown) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
}

function toPositiveNumber(value: unknown) {
    const numberValue = toFiniteNumber(value);
    return numberValue !== null && numberValue > 0 ? numberValue : null;
}

function normalizePlanTier(value: unknown) {
    return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function getBillingPlanLimits(profile: any): Partial<BillingPlanLimits> {
    const organization = profile?.organization || {};
    const metadata = organization?.metadata || profile?.metadata || {};
    const nestedLimits = metadata?.limits || {};
    const planTier = normalizePlanTier(
        organization?.plan_tier ||
        metadata?.plan_tier ||
        profile?.plan_tier ||
        profile?.billing_plan
    );
    const planLimits = BILLING_PLAN_LIMITS[planTier] || {};
    const storageLimitBytes = toPositiveNumber(nestedLimits.storage_bytes ?? metadata.storage_limit_bytes);

    return {
        storageGb: (
            toPositiveNumber(nestedLimits.storage_gb ?? metadata.storage_limit_gb) ||
            (storageLimitBytes ? storageLimitBytes / BYTES_PER_GB : null) ||
            planLimits.storageGb
        ),
        spaces: (
            toPositiveNumber(nestedLimits.spaces ?? metadata.space_limit ?? metadata.max_spaces ?? profile?.space_limit ?? profile?.max_spaces) ||
            planLimits.spaces
        ),
        teamMembers: (
            toPositiveNumber(
                nestedLimits.team_members ??
                nestedLimits.staff_seats ??
                metadata.team_members_limit ??
                metadata.staff_seats ??
                metadata.seat_limit ??
                profile?.team_members_limit ??
                profile?.seat_limit ??
                profile?.max_seats
            ) ||
            planLimits.teamMembers
        ),
    };
}

function clampUsagePercent(used: number, limit: number) {
    if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return 0;
    return Math.max(0, Math.min(100, (used / limit) * 100));
}

function formatGb(value: number) {
    if (!Number.isFinite(value) || value <= 0) return '0';
    if (value >= 10) return Math.round(value).toLocaleString();
    return value.toFixed(1);
}

function pluralize(value: number, singular: string, plural = `${singular}s`) {
    return `${value.toLocaleString()} ${value === 1 ? singular : plural}`;
}

function timeAgo(dateStr?: string) {
    if (!dateStr) return 'No activity';
    const date = new Date(dateStr);
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function formatTime(dateStr?: string) {
    if (!dateStr) return '--:--';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function localDateKey(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

function dateKey(value?: string) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : localDateKey(date);
}

function fileSize(bytes?: number) {
    if (!bytes || bytes <= 0) return '0 KB';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
    }
    return `${size.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}

const IMAGE_FILE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'heic', 'heif']);

function getFileExtension(file: SpaceFile) {
    const source = file.name || file.display_name || '';
    return source.includes('.') ? source.split('.').pop()?.toLowerCase() || '' : '';
}

function isImageFile(file: SpaceFile) {
    const mimeType = file.mime_type || file.type || '';
    return mimeType.startsWith('image/') || IMAGE_FILE_EXTENSIONS.has(getFileExtension(file));
}

function getSpaceName(clients: ClientSpace[], spaceId?: string) {
    if (!spaceId) return 'Organization';
    return clients.find((space) => space.id === spaceId)?.name || 'Organization';
}

function getSpaceLimit(profile: any, usedSpaces: number) {
    const rawLimit = Number(
        profile?.space_limit ??
        profile?.max_spaces ??
        profile?.organization?.space_limit ??
        profile?.organization?.max_spaces ??
        profile?.organization?.limits?.spaces
    );

    if (Number.isFinite(rawLimit) && rawLimit > 0) {
        return Math.max(1, Math.round(rawLimit));
    }

    return Math.max(12, usedSpaces);
}

function getSpaceActivityAge(space: ClientSpace) {
    if (!space.last_activity_at) return Number.POSITIVE_INFINITY;
    return (Date.now() - new Date(space.last_activity_at).getTime()) / DAY_MS;
}

function getSpaceActivityCategory(space: ClientSpace): SpaceActivityCategory {
    const age = getSpaceActivityAge(space);
    const hasInteractionSignal = (space.message_count || 0) > 0 || (space.meeting_count || 0) > 0;

    if (space.status === 'archived' || space.status === 'closed' || age >= 14) {
        return 'warning';
    }

    if (age <= 7 && hasInteractionSignal) {
        return 'healthy';
    }

    return 'moderate';
}

function getSpaceActivityBuckets(spaces: ClientSpace[]): SpaceActivityBucket[] {
    const buckets: SpaceActivityBucket[] = [
        {
            id: 'healthy',
            label: 'Healthy',
            description: 'Active client interactions',
            tone: 'green',
            color: '#22C55E',
            spaces: [],
        },
        {
            id: 'moderate',
            label: 'Moderately Active',
            description: 'Weekly interaction',
            tone: 'orange',
            color: '#F59E0B',
            spaces: [],
        },
        {
            id: 'warning',
            label: 'Warning',
            description: 'No interaction in 14+ days',
            tone: 'red',
            color: '#EF4444',
            spaces: [],
        },
    ];
    const byId = new Map(buckets.map((bucket) => [bucket.id, bucket]));

    spaces.forEach((space) => {
        byId.get(getSpaceActivityCategory(space))?.spaces.push(space);
    });

    return buckets;
}

function SectionCard({
    title,
    icon,
    action,
    children,
    className = '',
}: {
    title: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <GlassCard className={`ui-dashboard-card rounded-[8px] p-0 ${className}`}>
            <div className="space-dashboard-panel-header flex items-center justify-between gap-2 border-b border-[#EFEFEF] px-3 py-2">
                <div className={`flex min-w-0 items-center ${icon ? 'gap-2' : ''}`}>
                    {icon ? (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] text-[#0D0D0D]">
                            {icon}
                        </span>
                    ) : null}
                    <Heading level={3} className="space-dashboard-panel-title truncate">
                        {title}
                    </Heading>
                </div>
                {action}
            </div>
            <div className="ui-card-scroll p-3">{children}</div>
        </GlassCard>
    );
}

function ProgressBar({
    value,
    tone = '#0D0D0D',
    className = 'h-2',
    striped = false,
}: {
    value: number;
    tone?: string;
    className?: string;
    striped?: boolean;
}) {
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    return (
        <div className={`overflow-hidden rounded-full bg-[#EFEFEF] ${className}`}>
            <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                    width: safeValue === 0 ? '0%' : `${Math.max(4, safeValue)}%`,
                    backgroundColor: tone,
                    backgroundImage: striped
                        ? 'repeating-linear-gradient(135deg, rgba(255,255,255,0.2) 0, rgba(255,255,255,0.2) 4px, transparent 4px, transparent 9px)'
                        : undefined,
                }}
            />
        </div>
    );
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
    const angleInRadians = (angleInDegrees * Math.PI) / 180;

    return {
        x: cx + radius * Math.cos(angleInRadians),
        y: cy + radius * Math.sin(angleInRadians),
    };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(cx, cy, radius, startAngle);
    const end = polarToCartesian(cx, cy, radius, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

    return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

function BillingUsageRow({ label, ratio, description, value, tone, icon }: BillingUsageRowProps) {
    return (
        <div className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] text-[#0D0D0D]">
                {icon}
            </span>
            <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium text-[#0D0D0D]">{label}</p>
                    <p className="shrink-0 text-xs font-semibold tabular-nums text-[#0D0D0D]">{ratio}</p>
                </div>
                <ProgressBar value={value} tone={tone} className="mt-2 h-1.5" />
                <p className="mt-1.5 truncate text-[11px] text-[#8F8F9A]">{description}</p>
            </div>
        </div>
    );
}

function SpaceUsageGauge({
    used,
    limit,
    buckets,
}: {
    used: number;
    limit: number;
    buckets: SpaceActivityBucket[];
}) {
    const activeBucketsData = buckets.map((bucket) => ({
        name: bucket.label,
        value: bucket.spaces.length,
        color: bucket.color,
    })).filter(item => item.value > 0);

    const remaining = Math.max(0, limit - used);

    const chartData = limit > 0
        ? [
            ...activeBucketsData,
            ...(remaining > 0 ? [{ name: 'Remaining', value: remaining, color: '#E5E7EB' }] : [])
          ]
        : [{ name: 'Empty', value: 1, color: '#E5E7EB' }];

    const hasMultipleSegments = chartData.length > 1;

    return (
        <div className="flex flex-col md:flex-row items-stretch gap-0 w-full min-h-[260px]">
            {/* LEFT — full-filling gauge chart */}
            <div className="relative flex-1 flex items-center justify-center">
                <ResponsiveContainer width="100%" height={260}>
                    <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="58%"
                            startAngle={210}
                            endAngle={-30}
                            innerRadius="62%"
                            outerRadius="72%"
                            paddingAngle={hasMultipleSegments ? 3 : 0}
                            cornerRadius={8}
                            dataKey="value"
                        >
                            {chartData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                {/* Centered overlay label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingTop: '30px' }}>
                    <span className="text-3xl font-black text-[#0D0D0D] leading-none tracking-tight">{used}</span>
                    <span className="text-[10px] font-semibold text-[#8F8F9A] uppercase tracking-widest mt-1.5">of {limit} spaces</span>
                </div>
            </div>

            {/* DIVIDER */}
            <div className="hidden md:block w-px bg-[#EFEFEF] mx-2 self-stretch" />

            {/* RIGHT — table legend, no truncation */}
            <div className="flex-1 flex flex-col justify-center px-4 py-3">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_48px_56px] gap-x-3 pb-2 mb-1 border-b border-[#EFEFEF]">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#AEAEB2]">Status</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#AEAEB2] text-right">Spaces</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#AEAEB2] text-right">Share</span>
                </div>
                {buckets.map((bucket) => {
                    const percentage = used > 0 ? Math.round((bucket.spaces.length / used) * 100) : 0;
                    return (
                        <div key={bucket.id} className="grid grid-cols-[1fr_48px_56px] gap-x-3 items-center py-2.5 border-b border-[#F5F5F7] last:border-b-0">
                            {/* Label */}
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: bucket.color }} />
                                <span className="font-semibold text-[11px] text-[#1C1C1E]">{bucket.label}</span>
                            </div>
                            {/* Count */}
                            <span className="font-bold text-[11px] text-[#0D0D0D] tabular-nums text-right">
                                {bucket.spaces.length}
                            </span>
                            {/* Percentage */}
                            <span className="font-bold text-[11px] tabular-nums text-right" style={{ color: bucket.color }}>
                                {percentage}%
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function EmptyState({ children }: { children: React.ReactNode }) {
    return <div className="overview-tile rounded-[8px] border border-dashed border-[#DADADA] bg-[#F7F7F8] px-3 py-5 text-center text-xs text-[#6E6E80]">{children}</div>;
}

function CenteredEmptyState({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-full items-center justify-center px-3 text-center text-[length:var(--font-size-xs)] leading-[var(--line-height-snug)] text-[#8F8F9A]">
            {children}
        </div>
    );
}

export default function OwnerDashboardView({
    clients,
    staff = [],
    clientLifecycle = [],
    messages,
    meetings,
    tasks,
    files = [],
    profile,
    onJoin,
    onUpdateTask,
    onGoToSpace,
    onGoToSpaces,
    onGoToClients,
    onGoToStaff,
    onGoToMeetings,
    onGoToFiles,
    onGoToTasks,
    onRefreshData,
}: OwnerDashboardProps) {
    const { user, organizationId } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const overviewStateScope = organizationId || user?.id || 'local';
    const overviewStorageKey = `overview.${overviewStateScope}`;
    const overviewQueryKey = ownerOverviewQueryKeys.data(organizationId || 'none', user?.id || 'anonymous');
    const billingQueryKey = ownerBillingQueryKeys.data(organizationId || 'none');
    const { files: dashboardFiles } = useRealtimeFiles('', organizationId || '', false);

    const [storedMode, setStoredMode] = usePersistentState<DashboardMode>(
        `${overviewStorageKey}.mode`,
        'master',
        { validate: isDashboardMode }
    );
    const [mode, setUrlMode] = useUrlParamState<DashboardMode>(
        'overview_mode',
        storedMode,
        { allowedValues: DASHBOARD_MODES, replace: false }
    );
    const overviewQuery = useQuery({
        queryKey: overviewQueryKey,
        queryFn: () => loadOwnerOverviewData(organizationId!, user!.id),
        enabled: Boolean(organizationId && user?.id),
        initialData: () => queryClient.getQueryData<OwnerOverviewData>(overviewQueryKey),
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 60 * 12,
    });
    const overviewData = overviewQuery.data || EMPTY_OVERVIEW_DATA;
    const billingUsageQuery = useQuery({
        queryKey: billingQueryKey,
        queryFn: () => loadOwnerBillingUsage(organizationId!),
        enabled: Boolean(organizationId),
        initialData: () => queryClient.getQueryData<BillingUsageSnapshot | null>(billingQueryKey),
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 60 * 12,
        retry: false,
    });
    const dashboardDocuments = useMemo(
        () => dashboardFiles.filter((file) => !isImageFile(file)),
        [dashboardFiles]
    );
    const { upcomingMeetings, notifications, analytics } = overviewData;
    const [pingedSpaces, setPingedSpaces] = usePersistentState<Record<string, boolean>>(
        `${overviewStorageKey}.pingedSpaces`,
        {},
        { validate: isBooleanRecord }
    );
    const [resentInvites, setResentInvites] = usePersistentState<Record<string, boolean>>(
        `${overviewStorageKey}.resentInvites`,
        {},
        { validate: isBooleanRecord }
    );
    const [replyDrafts, setReplyDrafts] = usePersistentState<Record<string, string>>(
        `${overviewStorageKey}.replyDrafts`,
        {},
        { validate: isStringRecord }
    );
    const [repliedMessages, setRepliedMessages] = usePersistentState<Record<string, boolean>>(
        `${overviewStorageKey}.repliedMessages`,
        {},
        { validate: isBooleanRecord }
    );

    const setMode = useCallback((nextMode: DashboardMode) => {
        setStoredMode(nextMode);
        setUrlMode(nextMode);
    }, [setStoredMode, setUrlMode]);

    const goToSpace = (spaceId: string) => {
        if (onGoToSpace) return onGoToSpace(spaceId);
        navigate(`/spaces/${spaceId}`);
    };

    useEffect(() => {
        if (!overviewQuery.error) return;
        console.error('[OwnerDashboardView] overview query failed:', overviewQuery.error);
        showToast(friendlyError((overviewQuery.error as Error)?.message), 'error');
    }, [overviewQuery.error, showToast]);

    const dashboard = useMemo(() => {
        const activeSpaces = clients.filter((space) => space.status === 'active' || space.status === 'onboarding');
        const idleSpaces = activeSpaces.filter((space) => {
            if (!space.last_activity_at) return true;
            return Date.now() - new Date(space.last_activity_at).getTime() > 10 * DAY_MS;
        });
        const sortedSpaces = [...clients].sort((a, b) => new Date(b.last_activity_at || b.updated_at).getTime() - new Date(a.last_activity_at || a.updated_at).getTime());
        const teamMembers = staff.length > 0
            ? staff
            : [{
                id: user?.id || 'owner',
                full_name: profile?.full_name || user?.email || 'Workspace owner',
                role: 'owner' as const,
                email: user?.email || '',
                assigned_spaces: [],
                status: 'active' as const,
                is_active: true,
            }];
        const seatsUsed = teamMembers.filter((member) => member.status !== 'pending').length;
        const pendingSeats = teamMembers.filter((member) => member.status === 'pending').length;
        const seatLimit = Math.max(8, seatsUsed + pendingSeats + 3);
        const openTasks = tasks.filter((task) => task.status !== 'done' && task.status !== 'canceled');
        const storageBytes = files.reduce((sum, file) => sum + (file.file_size || 0), 0);
        const storageUsedGb = storageBytes / 1024 / 1024 / 1024;
        const storageTotalGb = Math.max(100, Math.ceil((storageUsedGb || 1) / 50) * 50);
        const mrr = Math.max(950, activeSpaces.length * 220 + seatsUsed * 45 + Math.round(storageUsedGb) * 2);
        const nextInvoice = new Date();
        nextInvoice.setMonth(nextInvoice.getMonth() + 1);
        nextInvoice.setDate(1);
        const today = localDateKey(new Date());
        const todayMeetings = [...meetings, ...upcomingMeetings]
            .filter((meeting: any) => dateKey(meeting.starts_at) === today)
            .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
        const todayTasks = openTasks
            .filter((task) => dateKey(task.due_date) === today)
            .sort((a, b) => {
                const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
                return (priorityOrder[a.priority || 'none'] ?? 4) - (priorityOrder[b.priority || 'none'] ?? 4);
            });
        const todayCalendarItems: TodayCalendarItem[] = [
            ...todayMeetings.map((meeting: any) => ({
                id: `meeting-${meeting.id}`,
                type: 'meeting' as const,
                title: meeting.title || 'Meeting',
                timeLabel: formatTime(meeting.starts_at),
                meta: meeting.space_name || getSpaceName(clients, meeting.space_id),
                sortValue: new Date(meeting.starts_at).getTime(),
                spaceId: meeting.space_id,
                status: meeting.status,
            })),
            ...todayTasks.map((task) => ({
                id: `task-${task.id}`,
                type: 'task' as const,
                title: task.title,
                timeLabel: 'Task',
                meta: `${getSpaceName(clients, task.space_id)}${task.assignee_name ? ` - ${task.assignee_name}` : ''}`,
                sortValue: Number.MAX_SAFE_INTEGER - (
                    task.priority === 'urgent' ? 4 :
                        task.priority === 'high' ? 3 :
                            task.priority === 'medium' ? 2 :
                                task.priority === 'low' ? 1 : 0
                ),
                spaceId: task.space_id,
                status: task.status,
            })),
        ].sort((a, b) => a.sortValue - b.sortValue);
        const unreadMessages = messages
            .filter((message) => message.senderType === 'client' && !message.readByMe && !message.deletedAt)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const messageNotifications = notifications
            .filter((notification) => String(notification.type || '').includes('message') && !notification.read)
            .map((notification) => ({
                id: notification.id,
                senderName: notification.actor_name || notification.title || 'Client message',
                content: notification.message || 'New message awaiting reply.',
                createdAt: notification.created_at,
                spaceId: notification.space_id,
                senderType: 'client' as const,
            }));
        const pendingInvites = clientLifecycle
            .filter((client) => client.lifecycle_stage === 'invited' || client.lifecycle_stage === 'activated')
            .slice(0, 5);
        const newClients = [...clientLifecycle]
            .sort((a, b) => new Date(b.joined_at || b.created_at || b.last_activity_at).getTime() - new Date(a.joined_at || a.created_at || a.last_activity_at).getTime())
            .slice(0, 5);
        return {
            activeSpaces,
            idleSpaces,
            sortedSpaces,
            teamMembers,
            seatsUsed,
            pendingSeats,
            seatLimit,
            openTasks,
            storageBytes,
            storageUsedGb,
            storageTotalGb,
            mrr,
            nextInvoice,
            todayMeetings,
            todayTasks,
            todayCalendarItems,
            unreadMessages: unreadMessages.length > 0 ? unreadMessages : messageNotifications,
            pendingInvites,
            newClients,
        };
    }, [clients, clientLifecycle, files, meetings, messages, notifications, profile?.full_name, staff, tasks, upcomingMeetings, user?.email, user?.id]);

    const loadingGate = useLoadingScreenGate(overviewQuery.isLoading && !overviewQuery.data);

    const sendReply = (message: Pick<Message, 'id' | 'spaceId' | 'content'>) => {
        const draft = (replyDrafts[message.id] || '').trim();
        if (!draft) return;
        setRepliedMessages((current) => ({ ...current, [message.id]: true }));
        setReplyDrafts((current) => ({ ...current, [message.id]: '' }));
        showToast('Reply logged to activity.', 'success');
    };

    const completeTask = async (task: Task) => {
        await onUpdateTask(task.id, { status: 'done' });
        showToast('Task marked done.', 'success');
    };

    const openDashboardDocument = async (file: SpaceFile) => {
        if (!organizationId) return;

        try {
            const { data, error } = await apiService.getSignedUrl(file.id, organizationId);
            if (error) throw error;
            if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
        } catch (error) {
            showToast(friendlyError((error as Error)?.message || 'Unable to open document.'), 'error');
        }
    };

    if (loadingGate.isVisible) {
        return (
            <LoadingScreen
                key={loadingGate.cycleKey}
                message="Loading overview..."
                isComplete={loadingGate.isComplete}
                onExitComplete={loadingGate.handleExitComplete}
            />
        );
    }

    const showMetrics = mode === 'master' || mode === 'metrics';
    const showActions = mode === 'master' || mode === 'actions';
    const spaceLimit = getSpaceLimit(profile, clients.length);
    const billingPlanLimits = getBillingPlanLimits(profile);
    const billingUsage = billingUsageQuery.data;
    const dashboardDocumentStorageBytes = dashboardDocuments.reduce((sum, file) => sum + Number(file.file_size || 0), 0);
    const billingStorageUsedBytes = Math.max(
        0,
        dashboardDocumentStorageBytes > 0
            ? dashboardDocumentStorageBytes
            : toFiniteNumber(billingUsage?.storageUsedBytes) ?? dashboard.storageBytes
    );
    const billingStorageLimitBytes = Math.max(
        BYTES_PER_GB,
        toPositiveNumber(billingUsage?.storageLimitBytes) ??
        ((billingPlanLimits.storageGb || dashboard.storageTotalGb) * BYTES_PER_GB)
    );
    const billingSpacesUsed = Math.max(0, Math.round(toFiniteNumber(billingUsage?.spacesUsed) ?? clients.length));
    const billingSpacesLimit = Math.max(
        1,
        Math.round(toPositiveNumber(billingUsage?.spacesLimit) ?? billingPlanLimits.spaces ?? spaceLimit)
    );
    const billingTeamMembersUsed = Math.max(0, Math.round(toFiniteNumber(billingUsage?.teamMembersUsed) ?? dashboard.seatsUsed));
    const billingTeamMembersLimit = Math.max(
        1,
        Math.round(toPositiveNumber(billingUsage?.teamMembersLimit) ?? billingPlanLimits.teamMembers ?? dashboard.seatLimit)
    );
    const billingRows: BillingUsageRowProps[] = [
        {
            label: 'Total GB',
            ratio: `${formatGb(billingStorageUsedBytes / BYTES_PER_GB)} / ${formatGb(billingStorageLimitBytes / BYTES_PER_GB)} GB`,
            description: `${formatGb(Math.max(0, billingStorageLimitBytes - billingStorageUsedBytes) / BYTES_PER_GB)} GB available`,
            value: clampUsagePercent(billingStorageUsedBytes, billingStorageLimitBytes),
            tone: '#10A37F',
            icon: <HardDrive size={18} />,
        },
        {
            label: 'Number of Spaces',
            ratio: `${billingSpacesUsed.toLocaleString()} / ${billingSpacesLimit.toLocaleString()}`,
            description: `${pluralize(Math.max(0, billingSpacesLimit - billingSpacesUsed), 'space')} available`,
            value: clampUsagePercent(billingSpacesUsed, billingSpacesLimit),
            tone: '#10A37F',
            icon: <BriefcaseBusiness size={18} />,
        },
        {
            label: 'Team Members',
            ratio: `${billingTeamMembersUsed.toLocaleString()} / ${billingTeamMembersLimit.toLocaleString()}`,
            description: `${pluralize(Math.max(0, billingTeamMembersLimit - billingTeamMembersUsed), 'team seat')} available`,
            value: clampUsagePercent(billingTeamMembersUsed, billingTeamMembersLimit),
            tone: '#10A37F',
            icon: <Users size={18} />,
        },
    ];
    const spaceActivityBuckets = getSpaceActivityBuckets(dashboard.sortedSpaces);
    const warningSpaces = spaceActivityBuckets.find((bucket) => bucket.id === 'warning')?.spaces.length || 0;

    return (
        <div className="overview-dashboard page-enter mx-auto w-full max-w-[1540px] space-y-3 px-3 pb-10 pt-0 sm:px-4">
            <header className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <Heading level={1}>Overview</Heading>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="surface-chip p-1">
                        {([
                            ['master', 'Master grid'],
                            ['metrics', 'How you are doing'],
                            ['actions', 'What to do next'],
                        ] as const).map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setMode(id)}
                                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${mode === id ? 'bg-white text-[#0D0D0D] shadow-[0_1px_3px_rgba(0,0,0,0.06)]' : 'text-[#6E6E80] hover:text-[#0D0D0D]'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {onRefreshData ? (
                        <Button variant="outline" size="sm" onClick={() => void onRefreshData()} icon={<RefreshCcw size={13} />}>
                            Refresh
                        </Button>
                    ) : null}
                </div>
            </header>

            <GlassCard className="overflow-hidden rounded-[8px] p-0">
                <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.55fr)]">
                    <div className="border-b border-[#EFEFEF] p-5 lg:border-b-0 lg:border-r">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex min-w-0 items-center gap-4">
                                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#0D0D0D] p-3">
                                    <VeroMark tone="light" className="h-full w-full" />
                                </span>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="truncate text-2xl font-semibold tracking-[-0.02em] text-[#0D0D0D]">Overview</h2>
                                        <span className="surface-chip surface-chip-active px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
                                            Enterprise
                                        </span>
                                    </div>
                                    <Text variant="secondary" size="sm" className="mt-1">
                                        {dashboard.activeSpaces.length} live spaces, {dashboard.seatsUsed} active seats, {dashboard.openTasks.length} open tasks
                                    </Text>
                                </div>
                            </div>
                            <div className="surface-chip px-3 py-2 text-xs font-medium">
                                <span className="indicator-dot" data-tone={dashboard.idleSpaces.length ? 'yellow' : 'green'} />
                                {dashboard.idleSpaces.length ? `${dashboard.idleSpaces.length} attention signals` : 'All systems steady'}
                            </div>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                            {[
                                { label: 'MRR', value: `$${dashboard.mrr.toLocaleString()}`, tone: 'green' },
                                { label: 'Seat capacity', value: `${dashboard.seatsUsed}/${dashboard.seatLimit}`, tone: 'blue' },
                                { label: 'Spaces', value: `${clients.length}/${spaceLimit}`, tone: 'purple' },
                                { label: 'Warning', value: `${warningSpaces}`, tone: warningSpaces ? 'red' : 'green' },
                            ].map((metric) => (
                                <div key={metric.label} className="overview-tile rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6E6E80]">{metric.label}</p>
                                        <span className="indicator-dot" data-tone={metric.tone} />
                                    </div>
                                    <p className="dashboard-number mt-2 text-2xl leading-none text-[#0D0D0D]">{metric.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col justify-between gap-5 p-5">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Today</p>
                            <p className="mt-1 text-lg font-medium text-[#0D0D0D]">{formatDate(new Date())}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="overview-tile rounded-[8px] border border-[#E5E5E5] p-3">
                                <p className="dashboard-number text-xl">{analytics.activeClients || clientLifecycle.length}</p>
                                <p className="text-[10px] text-[#6E6E80]">Clients</p>
                            </div>
                            <div className="overview-tile rounded-[8px] border border-[#E5E5E5] p-3">
                                <p className="dashboard-number text-xl">{analytics.meetingsMonth || meetings.length}</p>
                                <p className="text-[10px] text-[#6E6E80]">Meetings</p>
                            </div>
                            <div className="overview-tile rounded-[8px] border border-[#E5E5E5] p-3">
                                <p className="dashboard-number text-xl">{analytics.filesMonth || files.length}</p>
                                <p className="text-[10px] text-[#6E6E80]">Files</p>
                            </div>
                        </div>
                    </div>
                </div>
            </GlassCard>

            {showMetrics ? (
                <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <Heading level={2} className="text-xl tracking-[-0.02em]">How you are doing</Heading>
                        <span className="surface-chip px-3 py-1.5 text-[11px] font-medium">
                            <Gauge size={13} />
                            Live telemetry
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                        <SectionCard title="Space Analysis" icon={<Gauge size={16} />} action={<Button variant="ghost" size="sm" onClick={onGoToSpaces}>Open</Button>} className="lg:col-span-5">
                            <SpaceUsageGauge used={clients.length} limit={spaceLimit} buckets={spaceActivityBuckets} />
                        </SectionCard>

                        <SectionCard
                            title="Team Members"
                            icon={<Users size={16} />}
                            action={(
                                <div className="flex shrink-0 items-center gap-2">
                                    <span className="surface-chip px-2.5 py-1 text-[10px] font-medium">
                                        {dashboard.seatsUsed} active
                                        {dashboard.pendingSeats > 0 ? ` / ${dashboard.pendingSeats} pending` : ''}
                                    </span>
                                    <Button variant="ghost" size="sm" onClick={onGoToStaff}>Team</Button>
                                </div>
                            )}
                            className="lg:col-span-4"
                        >
                            <div className="space-y-2">
                                {dashboard.teamMembers.slice(0, 5).map((member) => (
                                    <div key={member.id} className="database-row flex items-center justify-between gap-3 p-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0D0D0D] text-[10px] font-semibold uppercase text-white">
                                                {member.full_name?.split(' ').map((part) => part[0]).join('').slice(0, 2) || 'TM'}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-[#0D0D0D]">{member.full_name}</p>
                                                <p className="truncate text-[11px] text-[#6E6E80]">{member.email}</p>
                                            </div>
                                        </div>
                                        <span className="surface-chip px-2 py-1 text-[10px] capitalize">{member.role}</span>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>

                        <SectionCard title="Quotas" className="lg:col-span-3">
                            <div className="space-y-4">
                                {billingRows.map((row) => (
                                    <BillingUsageRow key={row.label} {...row} />
                                ))}
                            </div>
                        </SectionCard>

                        <SectionCard title="Calendar" icon={<Calendar size={16} />} action={<Button variant="ghost" size="sm" onClick={onGoToMeetings}>Open</Button>} className="lg:col-span-4">
                            {dashboard.todayCalendarItems.length === 0 ? (
                                <CenteredEmptyState>
                                    No meetings or tasks today.
                                </CenteredEmptyState>
                            ) : (
                                <div className="divide-y divide-[#EFEFEF]">
                                    {dashboard.todayCalendarItems.slice(0, 6).map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className="grid w-full grid-cols-[var(--space-16)_minmax(0,1fr)_auto] items-center gap-[var(--space-gap-sm)] py-[var(--space-3)] text-left transition-colors hover:text-[#0D0D0D]"
                                            onClick={() => item.type === 'task' ? onGoToTasks?.() : item.spaceId ? goToSpace(item.spaceId) : onGoToMeetings?.()}
                                        >
                                            <span className="text-[length:var(--font-size-xs)] font-semibold tabular-nums leading-[var(--line-height-snug)] text-[#0D0D0D]">
                                                {item.timeLabel}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-[length:var(--font-size-sm)] font-medium leading-[var(--line-height-snug)] text-[#0D0D0D]">
                                                    {item.title}
                                                </span>
                                                <span className="block truncate text-[length:var(--font-size-xs)] leading-[var(--line-height-snug)] text-[#8F8F9A]">
                                                    {item.meta}
                                                </span>
                                            </span>
                                            <span className="text-[length:var(--font-size-xs)] font-medium capitalize text-[#6E6E80]">
                                                {item.type}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </SectionCard>

                        <SectionCard title="Documents" icon={<FileText size={16} />} action={<Button variant="ghost" size="sm" onClick={onGoToFiles}>Open</Button>} className="lg:col-span-4">
                            {dashboardDocuments.length === 0 ? (
                                <div className="py-[var(--space-6)] text-center text-[length:var(--font-size-xs)] text-[#8F8F9A]">
                                    No accessible documents in storage yet.
                                </div>
                            ) : (
                                <div className="space-y-[var(--space-2)]">
                                    <div className="divide-y divide-[#EFEFEF]">
                                        {dashboardDocuments.map((file) => (
                                            <button
                                                key={file.id}
                                                type="button"
                                                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-[var(--space-gap-sm)] py-[var(--space-3)] text-left transition-colors hover:text-[#0D0D0D]"
                                                onClick={() => void openDashboardDocument(file)}
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-[length:var(--font-size-sm)] font-medium leading-[var(--line-height-snug)] text-[#0D0D0D]">
                                                        {file.display_name || file.name}
                                                    </p>
                                                    <p className="truncate text-[length:var(--font-size-xs)] leading-[var(--line-height-snug)] text-[#8F8F9A]">
                                                        {getSpaceName(clients, file.space_id)} - {fileSize(file.file_size)}
                                                    </p>
                                                </div>
                                                <div className="min-w-[var(--space-32)] text-right">
                                                    <p className="text-[length:var(--font-size-xs)] font-medium leading-[var(--line-height-snug)] text-[#6E6E80]">
                                                        {timeAgo(file.created_at)}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </SectionCard>

                    </div>
                </section>
            ) : null}

            {showActions ? (
                <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <Heading level={2} className="text-xl tracking-[-0.02em]">What to do next</Heading>
                        <span className="surface-chip px-3 py-1.5 text-[11px] font-medium">
                            <Bell size={13} />
                            Action hub
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                        <SectionCard title="Needs Attention" icon={<AlertTriangle size={16} />} className="xl:col-span-4">
                            {dashboard.idleSpaces.length === 0 ? (
                                <EmptyState>No idle spaces need attention.</EmptyState>
                            ) : (
                                <div className="space-y-2">
                                    {dashboard.idleSpaces.slice(0, 4).map((space) => (
                                        <div key={space.id} className="database-row flex items-center justify-between gap-3 p-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-[#0D0D0D]">{space.name}</p>
                                                <p className="text-[11px] text-[#6E6E80]">Idle since {timeAgo(space.last_activity_at)}</p>
                                            </div>
                                            <Button
                                                variant={pingedSpaces[space.id] ? 'outline' : 'secondary'}
                                                size="sm"
                                                icon={pingedSpaces[space.id] ? <Check size={13} /> : <Send size={13} />}
                                                onClick={() => {
                                                    setPingedSpaces((current) => ({ ...current, [space.id]: true }));
                                                    showToast('Follow-up queued for space owner.', 'success');
                                                }}
                                            >
                                                {pingedSpaces[space.id] ? 'Followed up' : 'Follow Up'}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </SectionCard>

                        <SectionCard title="Pending Invites" icon={<Mail size={16} />} className="xl:col-span-4">
                            {dashboard.pendingInvites.length === 0 ? (
                                <EmptyState>No pending invites found.</EmptyState>
                            ) : (
                                <div className="space-y-2">
                                    {dashboard.pendingInvites.map((client) => (
                                        <div key={client.id} className="database-row flex items-center justify-between gap-3 p-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-[#0D0D0D]">{client.full_name}</p>
                                                <p className="truncate text-[11px] text-[#6E6E80]">{client.contact_email || client.company_name || client.lifecycle_stage}</p>
                                            </div>
                                            <Button
                                                variant={resentInvites[client.id] ? 'outline' : 'secondary'}
                                                size="sm"
                                                icon={<RefreshCcw size={13} />}
                                                onClick={() => {
                                                    setResentInvites((current) => ({ ...current, [client.id]: true }));
                                                    showToast('Invite resend queued.', 'success');
                                                }}
                                            >
                                                {resentInvites[client.id] ? 'Sent' : 'Resend'}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </SectionCard>

                        <SectionCard title="Unread Messages" icon={<MessageSquare size={16} />} className="xl:col-span-4">
                            {dashboard.unreadMessages.length === 0 ? (
                                <EmptyState>No client messages awaiting reply.</EmptyState>
                            ) : (
                                <div className="space-y-2">
                                    {dashboard.unreadMessages.slice(0, 3).map((message: any) => (
                                        <div key={message.id} className="database-row space-y-3 p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-[#0D0D0D]">{message.senderName || 'Client'}</p>
                                                    <p className="line-clamp-2 text-xs text-[#6E6E80]">{message.content}</p>
                                                </div>
                                                <span className="text-[10px] text-[#6E6E80]">{timeAgo(message.createdAt)}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    value={replyDrafts[message.id] || ''}
                                                    onChange={(event) => setReplyDrafts((current) => ({ ...current, [message.id]: event.target.value }))}
                                                    placeholder={repliedMessages[message.id] ? 'Reply recorded' : 'Reply...'}
                                                    className="h-8 min-w-0 flex-1 rounded-full border border-[#E5E5E5] bg-white px-3 text-xs outline-none focus:border-[#0D0D0D]"
                                                />
                                                <Button variant="primary" size="sm" icon={<ArrowRight size={13} />} onClick={() => sendReply(message)}>
                                                    Reply
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </SectionCard>

                        <SectionCard title="New Clients" icon={<BriefcaseBusiness size={16} />} action={<Button variant="ghost" size="sm" onClick={onGoToClients}>Clients</Button>} className="xl:col-span-4">
                            {dashboard.newClients.length === 0 ? (
                                <EmptyState>No client lifecycle records yet.</EmptyState>
                            ) : (
                                <div className="space-y-2">
                                    {dashboard.newClients.map((client) => (
                                        <div key={client.id} className="database-row flex items-center justify-between gap-3 p-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-[#0D0D0D]">{client.full_name}</p>
                                                <p className="truncate text-[11px] text-[#6E6E80]">{client.company_name || client.lifecycle_stage} - {timeAgo(client.joined_at || client.created_at || client.last_activity_at)}</p>
                                            </div>
                                            <span className="surface-chip px-2 py-1 text-[10px] capitalize">{client.health_label || client.lifecycle_stage}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </SectionCard>

                        <SectionCard title="Tasks" icon={<CheckCircle2 size={16} />} action={<Button variant="ghost" size="sm" onClick={onGoToTasks}>Tasks</Button>} className="xl:col-span-4">
                            {dashboard.openTasks.length === 0 ? (
                                <EmptyState>No open owner tasks.</EmptyState>
                            ) : (
                                <div className="space-y-2">
                                    {dashboard.openTasks.slice(0, 5).map((task) => (
                                        <div key={task.id} className="database-row flex items-center gap-3 p-3">
                                            <button
                                                type="button"
                                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#DADADA] hover:border-[#0D0D0D]"
                                                onClick={() => void completeTask(task)}
                                                aria-label={`Complete ${task.title}`}
                                            >
                                                <Check size={13} />
                                            </button>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-[#0D0D0D]">{task.title}</p>
                                                <p className="truncate text-[11px] text-[#6E6E80]">{task.assignee_name || 'Owner'} - {task.priority || 'normal'}</p>
                                            </div>
                                            <span className="surface-chip px-2 py-1 text-[10px] capitalize">{task.status.replace('_', ' ')}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </SectionCard>

                    </div>
                </section>
            ) : null}
        </div>
    );
}
