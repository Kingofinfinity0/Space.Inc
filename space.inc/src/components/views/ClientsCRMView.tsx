import React, { useMemo, useState } from 'react';
import { Download, Search, LayoutGrid, List, Filter, Mail, Phone, Calendar, MessageSquare, FileText, Activity, Sparkles } from 'lucide-react';
import { Button, GlassCard, Heading, Input, SkeletonLoader } from '../UI/index';
import { ClientLifecycle } from '../../types';

const ClientsCRMView: React.FC<{
    clients: ClientLifecycle[];
    loading: boolean;
}> = ({ clients, loading }) => {
    const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'former'>('all');
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

    const filteredClients = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return clients.filter((client) => {
            const matchesSearch =
                !q ||
                [client.full_name, client.client_id, client.lifecycle_stage].some((value) =>
                    String(value || '').toLowerCase().includes(q)
                );
            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'active' ? client.is_active : !client.is_active);
            return matchesSearch && matchesStatus;
        });
    }, [clients, searchQuery, statusFilter]);

    const selectedClient = useMemo(() => filteredClients.find((client) => client.id === selectedClientId) || filteredClients[0] || null, [filteredClients, selectedClientId]);

    const metrics = useMemo(() => ([
        { label: 'Total Clients', value: clients.length, tone: 'blue' },
        { label: 'Active', value: clients.filter((client) => client.is_active).length, tone: 'green' },
        { label: 'At Risk', value: clients.filter((client) => client.lifecycle_stage === 'at_risk').length, tone: 'yellow' },
        { label: 'Churned', value: clients.filter((client) => client.lifecycle_stage === 'churned').length, tone: 'rose' }
    ]), [clients]);

    const detail = useMemo(() => {
        if (!selectedClient) return null;
        return [
            { label: 'Onboarding score', value: `${selectedClient.onboarding_score}%` },
            { label: 'Messages', value: selectedClient.message_count },
            { label: 'Files', value: selectedClient.file_count },
            { label: 'Meetings', value: selectedClient.meeting_count }
        ];
    }, [selectedClient]);

    if (loading) return <SkeletonLoader type="dashboard" />;

    return (
        <div className="space-y-6 page-enter">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                    <div className="surface-chip px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em]">
                        <Sparkles size={12} />
                        Client intelligence
                    </div>
                    <Heading level={1}>Clients</Heading>
                    <p className="max-w-2xl text-sm text-[#6E6E80]">
                        Owner-only analytics with current, former, and at-risk views so you can understand the health of every account.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" icon={<Download size={16} />}>Export Report</Button>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {metrics.map((metric) => (
                    <GlassCard key={metric.label} className="p-4">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">{metric.label}</p>
                            <span className="indicator-dot" data-tone={metric.tone} />
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-[#0D0D0D]">{metric.value}</div>
                    </GlassCard>
                ))}
            </div>

            <GlassCard className="sheet-panel p-4 md:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative w-full lg:max-w-md">
                        <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6E6E80]" />
                        <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by client, lifecycle, or ID" className="rounded-[8px] pl-10 pr-4" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => setViewMode('board')} className={`surface-chip px-3 py-2 text-xs font-medium ${viewMode === 'board' ? 'surface-chip-active' : ''}`}>
                            <LayoutGrid size={14} /> Board
                        </button>
                        <button onClick={() => setViewMode('table')} className={`surface-chip px-3 py-2 text-xs font-medium ${viewMode === 'table' ? 'surface-chip-active' : ''}`}>
                            <List size={14} /> Table
                        </button>
                        <button className="surface-chip px-3 py-2 text-xs font-medium">
                            <Filter size={14} /> Filters
                        </button>
                        {(['all', 'active', 'former'] as const).map((filter) => (
                            <button key={filter} onClick={() => setStatusFilter(filter)} className={`surface-chip px-3 py-2 text-xs font-medium capitalize ${statusFilter === filter ? 'surface-chip-active' : ''}`}>
                                {filter === 'former' ? 'Former clients' : filter === 'active' ? 'Current clients' : 'All clients'}
                            </button>
                        ))}
                    </div>
                </div>
            </GlassCard>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)]">
                {viewMode === 'board' ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                        {filteredClients.map((client, index) => (
                            <GlassCard key={client.id} onClick={() => setSelectedClientId(client.id)} style={{ animationDelay: `${index * 20}ms` }} className={`sheet-panel cursor-pointer p-5 transition-all ${selectedClient?.id === client.id ? 'border-[#DADADA] bg-[#F7F7F8]' : ''}`}>
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h3 className="truncate text-lg font-semibold tracking-[-0.03em] text-[#0D0D0D]">{client.full_name}</h3>
                                        <p className="truncate text-sm text-[#6E6E80]">{client.client_id}</p>
                                    </div>
                                    <span className="surface-chip px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]">
                                        {client.lifecycle_stage}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="surface-chip px-3 py-2 text-[11px] font-medium"><MessageSquare size={12} /> {client.message_count} messages</div>
                                    <div className="surface-chip px-3 py-2 text-[11px] font-medium"><FileText size={12} /> {client.file_count} files</div>
                                    <div className="surface-chip px-3 py-2 text-[11px] font-medium"><Calendar size={12} /> {client.meeting_count} meetings</div>
                                    <div className="surface-chip px-3 py-2 text-[11px] font-medium"><Activity size={12} /> {client.is_active ? 'Active' : 'Inactive'}</div>
                                </div>
                                <div className="mt-4 flex items-center justify-between">
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#6E6E80]">Onboarding</p>
                                    <div className="h-2 w-28 overflow-hidden rounded-full bg-[#F7F7F8]">
                                        <div
                                            className={`h-full rounded-full ${
                                                client.onboarding_score > 70 ? 'bg-black' : client.onboarding_score > 30 ? 'bg-[#6E6E80]' : 'bg-[#D4D4D8]'
                                            }`}
                                            style={{ width: `${client.onboarding_score}%` }}
                                        />
                                    </div>
                                </div>
                            </GlassCard>
                        ))}
                        {filteredClients.length === 0 && (
                            <GlassCard className="sheet-panel p-10 text-center text-sm text-[#6E6E80]">
                                No clients match the current filters.
                            </GlassCard>
                        )}
                    </div>
                ) : (
                    <GlassCard className="sheet-panel overflow-hidden">
                        <div className="border-b border-[#E5E5E5] bg-[#F7F7F8] px-4 py-3">
                            <div className="grid grid-cols-[minmax(0,1.6fr)_120px_120px_120px_160px] gap-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">
                                <span>Name</span>
                                <span>Stage</span>
                                <span>Messages</span>
                                <span>Files</span>
                                <span>Last activity</span>
                            </div>
                        </div>
                        <div className="divide-y divide-[#E5E5E5]">
                            {filteredClients.map((client) => (
                                <button
                                    key={client.id}
                                    onClick={() => setSelectedClientId(client.id)}
                                    className={`grid w-full grid-cols-1 gap-4 px-4 py-4 text-left transition-colors hover:bg-[#F7F7F8] md:grid-cols-[minmax(0,1.6fr)_120px_120px_120px_160px] md:items-center ${selectedClient?.id === client.id ? 'bg-[#F7F7F8]' : ''}`}
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-[#0D0D0D]">{client.full_name}</p>
                                        <p className="truncate text-xs text-[#6E6E80]">{client.client_id}</p>
                                    </div>
                                    <div className="surface-chip px-3 py-1.5 text-[11px] font-medium capitalize">{client.lifecycle_stage}</div>
                                    <div className="text-sm text-[#6E6E80]">{client.message_count}</div>
                                    <div className="text-sm text-[#6E6E80]">{client.file_count}</div>
                                    <div className="text-sm text-[#6E6E80]">
                                        {client.last_activity_at ? new Date(client.last_activity_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                    </div>
                                </button>
                            ))}
                            {filteredClients.length === 0 && (
                                <div className="p-10 text-center text-sm text-[#6E6E80]">No clients match the current filters.</div>
                            )}
                        </div>
                    </GlassCard>
                )}

                <div className="space-y-4">
                    <GlassCard className="sheet-panel p-5">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Client profile</p>
                                <h3 className="text-lg font-semibold tracking-[-0.03em] text-[#0D0D0D]">{selectedClient?.full_name || 'Select a client'}</h3>
                            </div>
                            <span className="surface-chip px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]">{selectedClient?.lifecycle_stage || '—'}</span>
                        </div>
                        {selectedClient ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    {detail?.map((item) => (
                                        <div key={item.label} className="rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-3">
                                            <p className="text-[10px] uppercase tracking-[0.18em] text-[#6E6E80]">{item.label}</p>
                                            <p className="mt-1 text-lg font-semibold text-[#0D0D0D]">{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-3 rounded-[8px] border border-[#E5E5E5] bg-white p-4">
                                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#6E6E80]">
                                        <Mail size={12} />
                                        Contact
                                    </div>
                                    <p className="truncate text-sm text-[#0D0D0D]">{selectedClient.client_id}</p>
                                    <p className="text-sm text-[#6E6E80]">
                                        Last activity: {selectedClient.last_activity_at ? new Date(selectedClient.last_activity_at).toLocaleString() : 'No activity yet'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-[#6E6E80]">Choose a client to see health and activity details.</p>
                        )}
                    </GlassCard>

                    <GlassCard className="sheet-panel p-5">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h3 className="text-lg font-semibold tracking-[-0.03em] text-[#0D0D0D]">Portfolio health</h3>
                            <span className="surface-chip px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]">Owner only</span>
                        </div>
                        <div className="space-y-3">
                            {[
                                { label: 'Current clients', value: clients.filter((client) => client.is_active).length },
                                { label: 'Former clients', value: clients.filter((client) => !client.is_active).length },
                                { label: 'At risk', value: clients.filter((client) => client.lifecycle_stage === 'at_risk').length }
                            ].map((row) => (
                                <div key={row.label} className="flex items-center justify-between rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] px-3 py-3">
                                    <p className="text-sm text-[#0D0D0D]">{row.label}</p>
                                    <p className="text-sm font-semibold text-[#0D0D0D]">{row.value}</p>
                                </div>
                            ))}
                        </div>
                    </GlassCard>
                </div>
            </div>
        </div>
    );
};

export default ClientsCRMView;
