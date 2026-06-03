import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertCircle, BarChart3, ChevronRight, Download, FolderKanban, MoreVertical, Plus, Search, UserPlus, Users, X } from 'lucide-react';
import { Button, GlassCard, Heading, Input, SkeletonLoader } from '../UI/index';
import { ClientLifecycle } from '../../types';

type ClientsTab = 'list' | 'insights';
type StatusFilter = 'all' | 'active' | 'former';
type SortBy = 'joined_desc' | 'joined_asc' | 'name_asc' | 'name_desc' | 'active_first';
type TrendRange = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const ClientsCRMView: React.FC<{
    clients: ClientLifecycle[];
    loading: boolean;
    onCreateSpace?: () => void;
    onInvitePerson?: () => void;
}> = ({ clients, loading, onCreateSpace, onInvitePerson }) => {
    const [activeTab, setActiveTab] = useState<ClientsTab>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [sortBy, setSortBy] = useState<SortBy>('joined_desc');
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [trendRange, setTrendRange] = useState<TrendRange>('monthly');

    const getJoinedAt = (client: ClientLifecycle) => client.joined_at || client.created_at || '';

    const getScore = (client: ClientLifecycle) => {
        const score = Number(client.health_score ?? client.onboarding_score);
        return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null;
    };

    const formatJoinedDate = (client: ClientLifecycle) => {
        const joinedAt = getJoinedAt(client);
        if (!joinedAt) return 'Unavailable';

        const date = new Date(joinedAt);
        if (Number.isNaN(date.getTime())) return 'Unavailable';

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const getClientName = (client: ClientLifecycle) => client.company_name || client.full_name || 'Unnamed client';

    const getInitial = (client: ClientLifecycle) => getClientName(client).trim().charAt(0).toUpperCase() || '?';

    const getLeadName = (client: ClientLifecycle) => client.lead_consultant_name || 'Unassigned';

    const getLeadEmail = (client: ClientLifecycle) => client.lead_consultant_email || client.contact_email || client.client_id || 'No contact email';

    const getModelType = (client: ClientLifecycle) => {
        if (client.model_type) return client.model_type;
        if (!client.is_active || client.lifecycle_stage === 'churned') return 'offboarded';
        if (client.lifecycle_stage === 'at_risk') return 'paused';
        return client.lifecycle_stage === 'engaged' ? 'retainer' : 'project';
    };

    const getModelClasses = (model: string) => {
        const normalized = model.toLowerCase();
        if (normalized.includes('retainer')) return 'border-cyan-200 bg-cyan-50 text-cyan-700';
        if (normalized.includes('project')) return 'border-indigo-200 bg-indigo-50 text-indigo-700';
        if (normalized.includes('paused')) return 'border-amber-200 bg-amber-50 text-amber-700';
        if (normalized.includes('offboard')) return 'border-rose-200 bg-rose-50 text-rose-700';
        return 'border-[#E5E5E5] bg-[#F7F7F8] text-[#6E6E80]';
    };

    const getHealth = (client: ClientLifecycle) => {
        const score = getScore(client);
        const backendLabel = client.health_label?.toLowerCase();
        if (score === null) return { label: 'Unknown', score: null, dot: 'bg-[#9A9AA2]' };
        if (backendLabel === 'healthy' || score >= 80) return { label: 'Healthy', score, dot: 'bg-emerald-500' };
        if (backendLabel === 'warning' || score >= 60) return { label: 'Warning', score, dot: 'bg-amber-500' };
        if (backendLabel === 'critical') return { label: 'Critical', score, dot: 'bg-rose-600' };
        return { label: 'At-risk', score, dot: 'bg-rose-500' };
    };

    const getActiveSpaces = (client: ClientLifecycle) => {
        if (typeof client.active_spaces === 'number') return client.active_spaces;
        return client.is_active ? 1 : 0;
    };

    const getHealthFactors = (client: ClientLifecycle) => {
        if (Array.isArray(client.health_factors) && client.health_factors.length > 0) {
            return client.health_factors.map((factor) => ({
                label: factor.label,
                weight: `${factor.weight}%`,
                value: Math.max(0, Math.min(100, Number(factor.value) || 0)),
                tone: Number(factor.weight) < 0 ? 'bg-rose-500' : 'bg-[#0D0D0D]'
            }));
        }

        const score = getScore(client) ?? 0;
        const login = client.last_activity_at ? Math.max(35, Math.min(95, score + 6)) : 10;
        const tasks = Math.max(20, Math.min(92, score - 5));
        const response = Math.max(15, Math.min(95, 45 + Number(client.message_count || 0) * 8));
        const files = Math.max(10, Math.min(90, 35 + Number(client.file_count || 0) * 10));
        const issues = client.lifecycle_stage === 'at_risk' ? 35 : client.is_active ? 10 : 20;

        return [
            { label: 'Login Activity', weight: '30%', value: login, tone: 'bg-[#0D0D0D]' },
            { label: 'Task Completion', weight: '25%', value: tasks, tone: 'bg-[#0D0D0D]' },
            { label: 'Response Engagement', weight: '20%', value: response, tone: 'bg-[#0D0D0D]' },
            { label: 'Space File Activity', weight: '15%', value: files, tone: 'bg-[#0D0D0D]' },
            { label: 'Issues Outstanding', weight: '-10%', value: issues, tone: 'bg-rose-500' }
        ];
    };

    const getAuditEvents = (client: ClientLifecycle) => {
        if (Array.isArray(client.audit_events) && client.audit_events.length > 0) {
            return client.audit_events.map((event) => ({
                title: event.title,
                body: event.body,
                category: event.category,
                by: event.actor_name || 'Agency Admin',
                date: event.created_at || client.last_activity_at || getJoinedAt(client)
            }));
        }

        return [
            {
                title: client.is_active ? 'Client relationship active' : 'Formal offboarding finalized',
                body: client.is_active ? 'Client account remains open for active workspace operations.' : 'Account officially designated as offboarded. Active integrations severed and contract closed.',
                category: 'Administrative',
                by: 'Agency Admin',
                date: client.last_activity_at || getJoinedAt(client)
            },
            {
                title: `${getClientName(client)} joined`,
                body: 'Client profile and workspace access were created from the invitation flow.',
                category: 'Client',
                by: getLeadName(client),
                date: getJoinedAt(client)
            }
        ];
    };

    const formatAuditDate = (dateString?: string) => {
        if (!dateString) return 'Date unavailable';
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return 'Date unavailable';
        return date.toLocaleString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const visibleClients = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        const filtered = clients.filter((client) => {
            const matchesSearch =
                !query ||
                [getClientName(client), getLeadName(client), getLeadEmail(client), getModelType(client), client.client_id].some((value) =>
                    String(value || '').toLowerCase().includes(query)
                );
            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'active' ? client.is_active : !client.is_active);

            return matchesSearch && matchesStatus;
        });

        return [...filtered].sort((left, right) => {
            if (sortBy === 'name_asc') return getClientName(left).localeCompare(getClientName(right));
            if (sortBy === 'name_desc') return getClientName(right).localeCompare(getClientName(left));
            if (sortBy === 'active_first') return Number(right.is_active) - Number(left.is_active);

            const leftJoined = new Date(getJoinedAt(left) || 0).getTime();
            const rightJoined = new Date(getJoinedAt(right) || 0).getTime();

            return sortBy === 'joined_asc' ? leftJoined - rightJoined : rightJoined - leftJoined;
        });
    }, [clients, searchQuery, statusFilter, sortBy]);

    const insights = useMemo(() => {
        const scoredClients = clients
            .map((client) => getScore(client))
            .filter((score): score is number => score !== null);
        const averageScore = scoredClients.length
            ? Math.round(scoredClients.reduce((total, score) => total + score, 0) / scoredClients.length)
            : null;
        const healthy = scoredClients.filter((score) => score >= 80).length;
        const warning = scoredClients.filter((score) => score >= 60 && score < 80).length;
        const atRisk = clients.filter((client) => client.lifecycle_stage === 'at_risk' || (getScore(client) ?? 100) < 60).length;
        const activeSpaces = clients.reduce((total, client) => total + getActiveSpaces(client), 0);
        const messages = clients.reduce((total, client) => total + Number(client.message_count || 0), 0);
        const files = clients.reduce((total, client) => total + Number(client.file_count || 0), 0);
        const meetings = clients.reduce((total, client) => total + Number(client.meeting_count || 0), 0);
        const modelCounts = clients.reduce(
            (totals, client) => {
                const model = getModelType(client).toLowerCase();
                if (model.includes('retainer')) totals.retainer += 1;
                else if (model.includes('paused')) totals.paused += 1;
                else if (model.includes('offboard')) totals.offboarded += 1;
                else totals.project += 1;
                return totals;
            },
            { retainer: 0, project: 0, paused: 0, offboarded: 0 }
        );
        const now = new Date();
        const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
        const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);
        const monthLabel = (date: Date) => date.toLocaleDateString('en-US', { month: 'short' });
        const joinedDates = clients
            .map((client) => new Date(getJoinedAt(client)))
            .filter((date) => !Number.isNaN(date.getTime()));
        const currentQuarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const trendBuckets = (() => {
            if (trendRange === 'weekly') {
                const today = startOfDay(now);
                const day = today.getDay();
                const mondayOffset = day === 0 ? -6 : 1 - day;
                const monday = addDays(today, mondayOffset);
                return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => {
                    const start = addDays(monday, index);
                    return { label, start, end: addDays(start, 1) };
                });
            }

            if (trendRange === 'monthly') {
                const january = new Date(now.getFullYear(), 0, 1);
                return Array.from({ length: 12 }, (_, index) => {
                    const start = addMonths(january, index);
                    return { label: monthLabel(start), start, end: addMonths(start, 1) };
                });
            }

            if (trendRange === 'quarterly') {
                return Array.from({ length: 8 }, (_, index) => {
                    const start = addMonths(currentQuarterStart, index * 3);
                    const quarter = Math.floor(start.getMonth() / 3) + 1;
                    return { label: `Q${quarter} '${String(start.getFullYear()).slice(-2)}`, start, end: addMonths(start, 3) };
                });
            }

            return Array.from({ length: 4 }, (_, index) => {
                const start = new Date(now.getFullYear() + index, 0, 1);
                return { label: String(start.getFullYear()), start, end: new Date(start.getFullYear() + 1, 0, 1) };
            });
        })();
        const usageTrend = trendBuckets.map((bucket) => ({
            label: bucket.label,
            value: joinedDates.filter((date) => date >= bucket.start && date < bucket.end).length
        }));
        const usagePeak = Math.max(...usageTrend.map((trend) => trend.value), 1);
        const rawUsageStep = usagePeak / 5;
        const stepMagnitude = Math.pow(10, Math.floor(Math.log10(rawUsageStep || 1)));
        const normalizedStep = rawUsageStep / stepMagnitude;
        const niceUsageStep = normalizedStep <= 1
            ? stepMagnitude
            : normalizedStep <= 2
                ? 2 * stepMagnitude
                : normalizedStep <= 5
                    ? 5 * stepMagnitude
                    : 10 * stepMagnitude;
        const usageTickStep = Math.max(1, niceUsageStep);
        const usageScaleMax = Math.max(5, Math.ceil(usagePeak / usageTickStep) * usageTickStep);
        const usageTicks = Array.from(
            { length: Math.floor(usageScaleMax / usageTickStep) + 1 },
            (_, index) => index * usageTickStep
        );
        const healthDistribution = [
            { name: 'Healthy', value: healthy, color: '#10B981' },
            { name: 'Warning', value: warning, color: '#F59E0B' },
            { name: 'At risk', value: atRisk, color: '#F43F5E' }
        ];

        return {
            active: clients.filter((client) => client.is_active).length,
            former: clients.filter((client) => !client.is_active).length,
            activeSpaces,
            averageScore,
            healthy,
            warning,
            atRisk,
            messages,
            files,
            meetings,
            activitySignals: messages + files + meetings,
            modelCounts,
            usageTrend,
            usageScaleMax,
            usageTicks,
            healthDistribution
        };
    }, [clients, trendRange]);

    const resetListTools = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setSortBy('joined_desc');
    };

    const exportVisibleClients = () => {
        const escapeCell = (value: string | number | boolean) => `"${String(value).replace(/"/g, '""')}"`;
        const rows = visibleClients.map((client) => [
            getClientName(client),
            getLeadName(client),
            getLeadEmail(client),
            getHealth(client).score ?? '',
            formatJoinedDate(client)
        ]);
        const csv = [
            ['Client', 'Lead consultant', 'Contact', 'Health score', 'Joined'],
            ...rows
        ].map((row) => row.map(escapeCell).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'clients.csv';
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const hasActiveTools = Boolean(searchQuery.trim() || statusFilter !== 'all' || sortBy !== 'joined_desc');
    const selectedClient = clients.find((client) => client.id === selectedClientId) || null;

    if (loading) return <SkeletonLoader type="dashboard" />;

    return (
        <div className="space-y-6 page-enter">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                    <Heading level={1}>Clients</Heading>
                    <div className="surface-chip !rounded-none p-1">
                        {([
                            ['list', 'Client list'],
                            ['insights', 'Insights']
                        ] as const).map(([value, label]) => (
                            <button
                                key={value}
                                onClick={() => setActiveTab(value)}
                                className={`rounded-none px-3 py-1.5 text-xs font-medium transition-colors ${
                                    activeTab === value ? 'bg-white text-[#0D0D0D] shadow-sm' : 'text-[#6E6E80] hover:text-[#0D0D0D]'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" className="!rounded-none" icon={<Download size={16} />} onClick={exportVisibleClients}>Export CSV</Button>
                </div>
            </header>

            {activeTab === 'list' ? (
                <>
                    <GlassCard className="sheet-panel !rounded-none p-3">
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                <div className="relative w-full lg:max-w-md">
                                    <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6E6E80]" />
                                    <Input
                                        value={searchQuery}
                                        onChange={(event) => setSearchQuery(event.target.value)}
                                        placeholder="Search clients"
                                        className="!rounded-none !py-2 pl-10 pr-4 text-xs"
                                    />
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {(['all', 'active', 'former'] as const).map((filter) => (
                                        <button
                                            key={filter}
                                            onClick={() => setStatusFilter(filter)}
                                            className={`surface-chip !rounded-none px-2.5 py-1.5 text-xs font-medium capitalize ${
                                                statusFilter === filter ? 'surface-chip-active' : ''
                                            }`}
                                        >
                                            {filter === 'former' ? 'Former clients' : filter === 'active' ? 'Current clients' : 'All clients'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 border-t border-[#E5E5E5] pt-3 md:flex-row md:items-center md:justify-between">
                                <p className="text-xs text-[#6E6E80]">
                                    Showing <span className="font-semibold text-[#0D0D0D]">{visibleClients.length}</span> of {clients.length} clients
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <select
                                        value={sortBy}
                                        onChange={(event) => setSortBy(event.target.value as SortBy)}
                                        className="rounded-none border border-[#DADADA] bg-white px-3 py-1.5 text-xs font-medium text-[#0D0D0D] focus:border-black focus:outline-none"
                                        aria-label="Sort clients"
                                    >
                                        <option value="joined_desc">Newest joined</option>
                                        <option value="joined_asc">Oldest joined</option>
                                        <option value="name_asc">Name A-Z</option>
                                        <option value="name_desc">Name Z-A</option>
                                        <option value="active_first">Active first</option>
                                    </select>
                                    {hasActiveTools && (
                                        <button onClick={resetListTools} className="surface-chip !rounded-none px-2.5 py-1.5 text-xs font-medium">
                                            <X size={13} /> Clear
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </GlassCard>

                    <GlassCard className="sheet-panel !rounded-none overflow-hidden">
                        <div className="overflow-x-auto">
                            <div className="min-w-[980px]">
                                <div className="grid grid-cols-[1.4fr_1.15fr_0.8fr_0.7fr_0.95fr_0.8fr] gap-4 border-b border-[#E5E5E5] bg-[#F7F7F8] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">
                                    <span>Client / Corporate Brand</span>
                                    <span>Lead Consultant</span>
                                    <span>Model Type</span>
                                    <span>Active Spaces</span>
                                    <span>Health Indicator</span>
                                    <span>Access Controls</span>
                                </div>

                                <div className="divide-y divide-[#E5E5E5]">
                                    {visibleClients.map((client, index) => {
                                        const model = getModelType(client);
                                        const health = getHealth(client);

                                        return (
                                            <div
                                                key={client.id}
                                                style={{ animationDelay: `${index * 20}ms` }}
                                                className="grid grid-cols-[1.4fr_1.15fr_0.8fr_0.7fr_0.95fr_0.8fr] items-center gap-4 px-4 py-3"
                                            >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#0D0D0D] bg-white text-sm font-semibold text-[#0D0D0D]">
                                                        {getInitial(client)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className="truncate text-sm font-semibold tracking-[-0.01em] text-[#0D0D0D]">{getClientName(client)}</h3>
                                                        <p className="mt-0.5 truncate font-mono text-[11px] text-[#6E6E80]">Joined {formatJoinedDate(client)}</p>
                                                    </div>
                                                </div>

                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-[#0D0D0D]">{getLeadName(client)}</p>
                                                    <p className="mt-0.5 truncate text-xs text-[#6E6E80]">{getLeadEmail(client)}</p>
                                                </div>

                                                <div>
                                                    <span className={`inline-flex border px-2 py-0.5 font-mono text-[10px] font-semibold capitalize ${getModelClasses(model)}`}>
                                                        {model.replace('_', ' ')}
                                                    </span>
                                                </div>

                                                <p className="text-center text-sm text-[#0D0D0D]">{getActiveSpaces(client)}</p>

                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`h-2 w-2 ${health.dot}`} />
                                                        <span className="font-mono text-sm font-semibold text-[#0D0D0D]">
                                                            {health.score === null ? '-' : `${health.score}%`}
                                                        </span>
                                                    </div>
                                                    <p className="mt-0.5 font-mono text-[10px] uppercase text-[#6E6E80]">{health.label}</p>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button className="border border-[#DADADA] bg-white px-3 py-1.5 text-xs font-medium text-[#0D0D0D] hover:bg-[#F7F7F8]">
                                                        Archive
                                                    </button>
                                                    <button
                                                        className="flex h-8 w-8 items-center justify-center text-[#6E6E80] hover:text-[#0D0D0D]"
                                                        aria-label={`Open ${getClientName(client)}`}
                                                        onClick={() => setSelectedClientId(client.id)}
                                                    >
                                                        <ChevronRight size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {visibleClients.length === 0 && (
                                        <div className="p-10 text-center text-sm text-[#6E6E80]">
                                            No clients match the current filters.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </>
            ) : (
                <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                        {[
                            { label: 'Total clients', value: clients.length, note: `${insights.active} active - ${insights.former} former`, icon: Users, tone: 'bg-[#0D0D0D] text-white' },
                            { label: 'Active spaces', value: insights.activeSpaces, note: 'Client portals running', icon: FolderKanban, tone: 'bg-cyan-50 text-cyan-700' },
                            { label: 'Avg health score', value: insights.averageScore === null ? 'N/A' : `${insights.averageScore}%`, note: insights.averageScore === null ? 'Waiting for signals' : insights.averageScore >= 80 ? 'Overall healthy' : insights.averageScore >= 60 ? 'Overall caution' : 'Needs attention', icon: Activity, tone: 'bg-amber-50 text-amber-700' },
                            { label: 'Activity signals', value: insights.activitySignals, note: 'Messages, files, meetings', icon: BarChart3, tone: 'bg-indigo-50 text-indigo-700' },
                            { label: 'At-risk clients', value: insights.atRisk, note: `${insights.atRisk} require attention`, icon: AlertCircle, tone: 'bg-rose-50 text-rose-700' }
                        ].map((metric) => (
                            <GlassCard key={metric.label} className="!rounded-none p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-[#6E6E80]">{metric.label}</p>
                                        <div className="mt-3 text-2xl font-semibold text-[#0D0D0D]">{metric.value}</div>
                                    </div>
                                    <span className={`grid h-8 w-8 place-items-center ${metric.tone}`}>
                                        <metric.icon size={16} />
                                    </span>
                                </div>
                                <p className="mt-1 font-mono text-xs text-[#6E6E80]">{metric.note}</p>
                            </GlassCard>
                        ))}
                    </div>

                    <div className="border border-[#E5E5E5] bg-white p-5 shadow-sm">
                        <div className="mb-5 flex flex-col gap-3 border-b border-[#E5E5E5] pb-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <BarChart3 size={16} className="text-indigo-600" />
                                    <h3 className="text-lg font-semibold tracking-[-0.03em] text-[#0D0D0D]">Portfolio performance analytics</h3>
                                </div>
                                <p className="mt-1 text-sm text-[#6E6E80]">Calculated metrics from current client workspace activity.</p>
                            </div>
                            <div className="grid grid-cols-3 border border-[#E5E5E5] bg-[#F7F7F8] text-center font-mono text-[11px] text-[#6E6E80]">
                                <span className="border-r border-[#E5E5E5] px-3 py-2">Portfolio</span>
                                <span className="border-r border-[#E5E5E5] px-3 py-2">Health</span>
                                <span className="px-3 py-2">Usage</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
                            <section className="flex min-h-[320px] min-w-0 flex-col border border-[#E5E5E5] p-4 xl:col-span-2">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-[#0D0D0D]">Client acquisition trend</p>
                                        <h4 className="mt-1 text-lg font-semibold text-[#0D0D0D]">{clients.length} clients tracked</h4>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                        <span className="bg-emerald-50 px-3 py-1 font-mono text-[11px] font-semibold text-emerald-700">
                                            {insights.active} active
                                        </span>
                                        <div className="flex border border-[#E5E5E5] bg-[#F7F7F8] p-0.5">
                                            {([
                                                ['weekly', 'Weekly'],
                                                ['monthly', 'Monthly'],
                                                ['quarterly', 'Quarterly'],
                                                ['yearly', 'Yearly']
                                            ] as const).map(([value, label]) => (
                                                <button
                                                    key={value}
                                                    onClick={() => setTrendRange(value)}
                                                    className={`px-2 py-1 text-[11px] font-medium ${
                                                        trendRange === value ? 'bg-white text-[#0D0D0D]' : 'text-[#6E6E80] hover:text-[#0D0D0D]'
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 min-h-0 min-w-0 flex-1 border-t border-[#F1F1F1] pt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={insights.usageTrend} margin={{ top: 16, right: 4, left: -8, bottom: 0 }} barCategoryGap="12%" barGap={4}>
                                            <CartesianGrid vertical={false} stroke="#ECECEF" />
                                            <XAxis
                                                dataKey="label"
                                                axisLine={false}
                                                tickLine={false}
                                                interval={0}
                                                height={24}
                                                tickMargin={6}
                                                tick={{ fill: '#9A9AA2', fontSize: 11 }}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#9A9AA2', fontSize: 11 }}
                                                ticks={insights.usageTicks}
                                                domain={[0, insights.usageScaleMax]}
                                                allowDecimals={false}
                                            />
                                            <Tooltip
                                                cursor={{ fill: '#F7F7F8' }}
                                                contentStyle={{ border: '1px solid #DADADA', borderRadius: 0, boxShadow: 'none', fontSize: 12 }}
                                                formatter={(value) => [`${value} clients`, 'Joined']}
                                            />
                                            <Bar dataKey="value" fill="#0891B2" maxBarSize={42} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </section>

                            <section className="min-h-[300px] min-w-0 overflow-visible border border-[#E5E5E5] bg-white p-5 xl:col-span-2">
                                <div className="min-w-0 overflow-visible">
                                    {(() => {
                                        const healthyPercent = clients.length ? Math.round((insights.healthy / clients.length) * 100) : 0;
                                        const warningPercent = clients.length ? Math.round((insights.warning / clients.length) * 100) : 0;
                                        const riskPercent = clients.length ? Math.max(0, 100 - healthyPercent - warningPercent) : 0;
                                        const visibleSlices = insights.healthDistribution.filter((item) => item.value > 0);
                                        const chartData = clients.length && visibleSlices.length > 0 ? visibleSlices : [{ name: 'No data', value: 1, color: '#ECECEF' }];
                                        const healthScore = insights.averageScore === null ? 'N/A' : `${insights.averageScore}%`;
                                        const healthStats = [
                                            { label: 'Healthy', value: `${healthyPercent}%`, count: insights.healthy, color: '#22C55E' },
                                            { label: 'Warning', value: `${warningPercent}%`, count: insights.warning, color: '#F59E0B' },
                                            { label: 'At risk', value: `${riskPercent}%`, count: insights.atRisk, color: '#F43F5E' }
                                        ];
                                        return (
                                            <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2">
                                                <div className="grid min-h-[260px] min-w-0 items-end justify-items-center overflow-visible pb-3 pt-8">
                                                    <div className="aspect-square h-[236px] min-h-0 w-[236px] min-w-0 overflow-visible">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <PieChart margin={{ top: 14, right: 14, bottom: 14, left: 14 }}>
                                                                <Pie
                                                                    data={chartData}
                                                                    dataKey="value"
                                                                    nameKey="name"
                                                                    cx="50%"
                                                                    cy="50%"
                                                                    innerRadius={58}
                                                                    outerRadius={82}
                                                                    paddingAngle={chartData.length > 1 ? 2 : 0}
                                                                    stroke="none"
                                                                    startAngle={90}
                                                                    endAngle={-270}
                                                                    isAnimationActive={false}
                                                                >
                                                                    {chartData.map((item) => (
                                                                        <Cell key={item.name} fill={item.color} />
                                                                    ))}
                                                                </Pie>
                                                                <Tooltip
                                                                    contentStyle={{ border: '1px solid #DADADA', borderRadius: 0, boxShadow: 'none', fontSize: 12 }}
                                                                    formatter={(value, name) => [`${value} clients`, name]}
                                                                />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>

                                                <div className="min-w-0 self-center">
                                                    <div className="mb-6 flex items-start justify-between gap-4">
                                                        <p className="text-base font-medium text-[#0D0D0D]">Health overview</p>
                                                        <button className="grid h-7 w-7 place-items-center text-[#6E6E80] hover:text-[#0D0D0D]" aria-label="Health overview options">
                                                            <MoreVertical size={16} />
                                                        </button>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-start gap-3">
                                                            <span className="grid h-9 w-9 place-items-center bg-green-100 text-green-700">
                                                                <Activity size={16} />
                                                            </span>
                                                            <div>
                                                                <p className="text-xs text-[#6E6E80]">Average health score</p>
                                                                <p className="mt-1 text-2xl font-semibold text-[#0D0D0D]">{healthScore}</p>
                                                            </div>
                                                        </div>
                                                        <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                                                            {healthStats.map((item) => (
                                                                <div key={item.label}>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="h-2.5 w-2.5" style={{ backgroundColor: item.color }} />
                                                                        <span className="text-sm text-[#525260]">{item.label}</span>
                                                                    </div>
                                                                    <p className="mt-1 font-mono text-sm font-semibold text-[#0D0D0D]">
                                                                        {item.value} ({item.count})
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </section>

                            <section className="min-h-[300px] min-w-0 border border-[#E5E5E5] bg-white p-4 xl:col-span-1">
                                <div className="flex h-full flex-col">
                                    <div>
                                        <p className="text-base font-medium text-[#0D0D0D]">Client actions</p>
                                        <p className="mt-1 text-sm text-[#6E6E80]">Quick portfolio tools</p>
                                    </div>
                                    <div className="mt-5 flex flex-1 flex-col gap-3">
                                        <button
                                            className="flex items-center gap-3 border border-[#DADADA] bg-white px-3 py-3 text-left text-sm font-medium text-[#0D0D0D] hover:border-[#0D0D0D]"
                                            onClick={exportVisibleClients}
                                        >
                                            <Download size={16} className="text-green-700" />
                                            Export CSV list
                                        </button>
                                        <button
                                            className="flex items-center gap-3 border border-[#DADADA] bg-white px-3 py-3 text-left text-sm font-medium text-[#0D0D0D] hover:border-[#0D0D0D]"
                                            onClick={onInvitePerson}
                                            disabled={!onInvitePerson}
                                        >
                                            <UserPlus size={16} className="text-green-700" />
                                            Invite person
                                        </button>
                                        <button
                                            className="flex items-center gap-3 border border-[#DADADA] bg-white px-3 py-3 text-left text-sm font-medium text-[#0D0D0D] hover:border-[#0D0D0D]"
                                            onClick={onCreateSpace}
                                            disabled={!onCreateSpace}
                                        >
                                            <Plus size={16} className="text-green-700" />
                                            Create space
                                        </button>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_0.7fr]">
                            <section className="h-full border border-[#E5E5E5] p-4">
                                <p className="text-sm font-medium text-[#0D0D0D]">Engagement allocation & status breakdown</p>
                                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {[
                                        { label: 'Retainer', value: insights.modelCounts.retainer, note: 'Active accounts', tone: 'text-cyan-700' },
                                        { label: 'Project', value: insights.modelCounts.project, note: 'Development phases', tone: 'text-indigo-700' },
                                        { label: 'Paused / hold', value: insights.modelCounts.paused, note: 'Preserved spaces', tone: 'text-amber-700' },
                                        { label: 'Offboarded', value: insights.modelCounts.offboarded, note: 'Closed accounts', tone: 'text-rose-700' }
                                    ].map((item) => (
                                        <div key={item.label} className="border border-[#E5E5E5] bg-[#F7F7F8] p-4 text-center">
                                            <p className="font-mono text-xs font-semibold text-[#6E6E80]">{item.label}</p>
                                            <p className={`mt-2 text-3xl font-semibold ${item.tone}`}>{item.value}</p>
                                            <p className="mt-1 font-mono text-[11px] text-[#6E6E80]">{item.note}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="h-full border border-[#E5E5E5] p-4">
                                <p className="text-sm font-medium text-[#0D0D0D]">Client usage signals</p>
                                <div className="mt-4 grid grid-cols-1 gap-3">
                                    {[
                                        { label: 'Messages', value: insights.messages },
                                        { label: 'Files', value: insights.files },
                                        { label: 'Meetings', value: insights.meetings }
                                ].map((item) => (
                                    <div key={item.label} className="border border-[#E5E5E5] bg-[#F7F7F8] p-4">
                                        <p className="text-sm font-medium text-[#6E6E80]">{item.label}</p>
                                        <p className="mt-2 text-2xl font-semibold text-[#0D0D0D]">{item.value}</p>
                                    </div>
                                ))}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            )}

            {selectedClient && typeof document !== 'undefined' ? createPortal(
                <div className="fixed inset-0 z-[1000] bg-black/20" onClick={() => setSelectedClientId(null)}>
                    <aside
                        className="ml-auto flex h-dvh min-h-dvh w-full max-w-[560px] flex-col overflow-y-auto border-l border-[#DADADA] bg-white shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="border-b border-[#E5E5E5] p-5">
                            <div className="mb-3 flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        {(() => {
                                            const health = getHealth(selectedClient);
                                            return (
                                                <span className="border border-emerald-500 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-700">
                                                    Score: {health.score ?? '-'} / {health.label}
                                                </span>
                                            );
                                        })()}
                                        <span className={`border px-2 py-0.5 font-mono text-[11px] capitalize ${getModelClasses(getModelType(selectedClient))}`}>
                                            {getModelType(selectedClient)}
                                        </span>
                                    </div>
                                    <h2 className="truncate text-2xl font-semibold tracking-[-0.04em] text-[#0D0D0D]">{getClientName(selectedClient)}</h2>
                                    <p className="mt-1 truncate text-sm text-[#6E6E80]">
                                        Contact: {getLeadName(selectedClient)} - {getLeadEmail(selectedClient)}
                                    </p>
                                </div>
                                <button className="text-[#6E6E80] hover:text-[#0D0D0D]" onClick={() => setSelectedClientId(null)} aria-label="Close client details">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-6 p-5">
                            <div className="grid grid-cols-2 border border-[#E5E5E5] bg-[#F7F7F8]">
                                {[
                                    { label: 'Created Spaces', value: `${getActiveSpaces(selectedClient)} Active Spaces` },
                                    { label: 'Contract Initiated', value: selectedClient.contract_started_at ? formatJoinedDate({ ...selectedClient, joined_at: selectedClient.contract_started_at }) : formatJoinedDate(selectedClient) }
                                ].map((item) => (
                                    <div key={item.label} className="border-r border-[#E5E5E5] p-3 last:border-r-0">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">{item.label}</p>
                                        <p className="mt-1 font-mono text-sm font-semibold text-[#0D0D0D]">{item.value}</p>
                                    </div>
                                ))}
                            </div>

                            <section className="border border-[#E5E5E5] p-4">
                                <div className="mb-5 flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-sm font-semibold text-[#0D0D0D]">Live Health Score Engineering</h3>
                                        <p className="mt-1 text-xs text-[#6E6E80]">Formula-weighted variables. Controllers are derived from current workspace signals.</p>
                                    </div>
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center border-4 border-emerald-500 text-lg font-semibold text-emerald-700">
                                        {getHealth(selectedClient).score ?? '-'}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {getHealthFactors(selectedClient).map((factor, index) => (
                                        <div key={factor.label}>
                                            <div className="mb-2 flex items-center justify-between font-mono text-xs">
                                                <span className="font-semibold text-[#0D0D0D]">
                                                    {index + 1}. {factor.label} <span className={factor.weight.startsWith('-') ? 'text-rose-500' : 'text-[#9A9AA2]'}>({factor.weight})</span>
                                                </span>
                                                <span className="text-[#0D0D0D]">{factor.value}%</span>
                                            </div>
                                            <div className="h-1.5 bg-[#E5E5E5]">
                                                <div className={`h-full ${factor.tone}`} style={{ width: `${factor.value}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="border border-[#E5E5E5] bg-[#F7F7F8] p-4">
                                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0D0D0D]">Operational Shortcuts</h3>
                                <div className="flex flex-wrap gap-2">
                                    <button className="border border-[#DADADA] bg-white px-3 py-2 text-xs text-[#0D0D0D]">Archive (Pause Relationship)</button>
                                    <button className="border border-[#DADADA] bg-white px-3 py-2 text-xs text-[#0D0D0D]">Change Model to: Retainer</button>
                                </div>
                            </section>

                            <section>
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <h3 className="text-base font-semibold text-[#0D0D0D]">Client Activity Audit Trail</h3>
                                    <span className="bg-[#F7F7F8] px-2 py-1 font-mono text-[10px] text-[#6E6E80]">{getAuditEvents(selectedClient).length} Recorded Triggers</span>
                                </div>
                                <div className="mb-4 grid grid-cols-[96px_minmax(0,1fr)_36px] gap-2 border border-[#E5E5E5] bg-[#F7F7F8] p-2">
                                    <select className="border border-[#DADADA] bg-white px-2 py-1.5 text-xs" aria-label="Activity category">
                                        <option>Client</option>
                                        <option>Space</option>
                                        <option>Administrative</option>
                                    </select>
                                    <input className="border border-[#DADADA] bg-white px-3 py-1.5 text-xs outline-none" placeholder="Record brief team comment or workspace action..." />
                                    <button className="bg-[#0D0D0D] text-white">+</button>
                                </div>
                                <div className="space-y-5 border-l border-[#DADADA] pl-5">
                                    {getAuditEvents(selectedClient).map((event) => (
                                        <div key={`${event.title}-${event.category}`} className="relative">
                                            <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 bg-[#DADADA]" />
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h4 className="text-sm font-semibold text-[#0D0D0D]">{event.title}</h4>
                                                    <p className="mt-1 text-xs leading-5 text-[#6E6E80]">{event.body}</p>
                                                    <p className="mt-1 font-mono text-[11px] text-[#9A9AA2]">{formatAuditDate(event.date)} - By: {event.by}</p>
                                                </div>
                                                <span className="border border-[#DADADA] bg-[#F7F7F8] px-2 py-1 font-mono text-[10px] text-[#6E6E80]">{event.category}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </aside>
                </div>,
                document.body
            ) : null}
        </div>
    );
};

export default ClientsCRMView;
