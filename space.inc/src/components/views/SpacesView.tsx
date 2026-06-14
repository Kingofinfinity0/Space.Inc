import React, { useMemo, useState } from 'react';
import { Plus, LayoutGrid, List, Search, Sparkles, FileText, MessageSquare, Calendar, User, Target, HeartPulse, ExternalLink, ChevronRight, Trash2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { GlassCard, Button, Heading, Input, Modal } from '../UI/index';
import { ClientSpace } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/apiService';
import { useUrlParamState } from '../../hooks/useUrlParamState';
import { usePersistentState } from '../../lib/persistence';

type SpaceModel = 'retainer' | 'project';

const SpacesView = ({ clients, onSelect, onCreate, onDelete }: { clients: ClientSpace[], onSelect: (id: string) => void, onCreate: (data: any) => void, onDelete?: (id: string) => Promise<void> | void }) => {
    const { showToast } = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [createStep, setCreateStep] = useState<'model' | 'setup'>('model');
    const [storedViewMode, setStoredViewMode] = usePersistentState<'board' | 'list'>('spaces.viewMode', 'board', {
        validate: (value): value is 'board' | 'list' => value === 'board' || value === 'list'
    });
    const [viewMode, setViewMode] = useUrlParamState<'board' | 'list'>('spaces_view', storedViewMode, {
        allowedValues: ['board', 'list'] as const,
        removeWhenDefault: false,
        replace: true
    });
    const [searchQuery, setSearchQuery] = useUrlParamState('spaces_q', '', {
        replace: true
    });
    const [newClientName, setNewClientName] = useState('');
    const [selectedModel, setSelectedModel] = useState<SpaceModel | null>(null);
    const defaultModules = {
        messages: true,
        chat: true,
        upload: true,
        meetings: true
    };

    const spaces = useMemo(() => clients.filter((client) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return [client.name, client.description, client.status].some((value) => String(value || '').toLowerCase().includes(q));
    }), [clients, searchQuery]);

    React.useEffect(() => {
        setStoredViewMode(viewMode);
    }, [setStoredViewMode, viewMode]);

    const closeCreateModal = () => {
        setIsModalOpen(false);
        setCreateStep('model');
        setSelectedModel(null);
        setNewClientName('');
    };

    const getSpaceModel = (space: ClientSpace): SpaceModel => {
        const value = String(space.metadata?.space_type || space.metadata?.work_model || '').toLowerCase();
        return value === 'retainer' ? 'retainer' : 'project';
    };

    const getLeadConsultant = (space: ClientSpace) => space.metadata?.lead_consultant_name || 'Lead consultant pending';

    const getModelLabel = (model: SpaceModel) => model === 'retainer' ? 'Retainer' : 'One-Time Project';

    const getActivityTotal = (space: ClientSpace) => Number(space.message_count || 0) + Number(space.file_count || 0) + Number(space.meeting_count || 0);

    const getAccountHealth = (space: ClientSpace) => Math.min(98, Math.max(42, 64 + getActivityTotal(space) * 4));

    const getProjectProgress = (space: ClientSpace) => {
        const done = Math.min(4, Math.max(0, Math.floor(getActivityTotal(space) / 3)));
        const total = Math.max(4, done || 4);
        return { done, total, percent: Math.round((done / total) * 100) };
    };

    const handleSubmit = () => {
        if (!selectedModel) {
            showToast('Please select a space type.', 'info');
            return;
        }

        if (!newClientName) {
            showToast('Please enter a company name.', 'info');
            return;
        }

        onCreate({
            name: newClientName,
            modules: defaultModules,
            metadata: {
                space_type: selectedModel,
                work_model: selectedModel,
                create_flow: 'model_first'
            }
        });
        closeCreateModal();
    };

    const handleDeleteSpace = (event: React.MouseEvent, client: ClientSpace) => {
        event.stopPropagation();
        if (!onDelete) return;
        if (window.confirm(`Delete ${client.name || 'this space'}?`)) {
            void onDelete(client.id);
        }
    };

    return (
        <div className="space-y-4 page-enter">
            <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <Heading level={1}>Spaces</Heading>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setViewMode('board')} className={`surface-chip px-3 py-2 text-xs font-medium ${viewMode === 'board' ? 'surface-chip-active' : ''}`}>
                        <LayoutGrid size={14} /> Board
                    </button>
                    <button onClick={() => setViewMode('list')} className={`surface-chip px-3 py-2 text-xs font-medium ${viewMode === 'list' ? 'surface-chip-active' : ''}`}>
                        <List size={14} /> List
                    </button>
                    <Button onClick={() => setIsModalOpen(true)}>
                        <Plus size={18} /> New Space
                    </Button>
                </div>
            </header>

            <GlassCard className="sheet-panel p-4 md:p-5">
                <div className="relative max-w-md">
                    <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6E6E80]" />
                    <Input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search spaces"
                        className="rounded-[8px] pl-10 pr-4"
                    />
                </div>
            </GlassCard>

            {viewMode === 'board' ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {spaces.map((client) => {
                        const model = getSpaceModel(client);
                        const isRetainer = model === 'retainer';
                        const progress = getProjectProgress(client);
                        const health = getAccountHealth(client);
                        return (
                            <GlassCard
                                key={client.id}
                                onClick={() => onSelect(client.id)}
                                className="group flex cursor-pointer flex-col overflow-hidden !rounded-none p-5"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <span className={`border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                        client.status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
                                    }`}>
                                        {client.status}
                                    </span>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <span className={`inline-flex items-center gap-1 border px-2.5 py-1 text-[10px] font-semibold ${
                                            isRetainer ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                        }`}>
                                            {isRetainer ? <HeartPulse size={11} /> : <Target size={11} />}
                                            {getModelLabel(model)}
                                        </span>
                                        {onDelete && (
                                            <button
                                                type="button"
                                                onClick={(event) => handleDeleteSpace(event, client)}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#F2D4D1] bg-white text-[#B42318] transition-colors hover:bg-[#FFF4F2]"
                                                title="Delete space"
                                                aria-label={`Delete ${client.name}`}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4 border-b border-[#F1F1F1] pb-3">
                                    <h3 className="truncate text-xl font-semibold tracking-[-0.03em] text-[#0D0D0D]">{client.name}</h3>
                                    <p className="mt-2 flex items-center gap-2 truncate text-sm text-[#6E6E80]">
                                        <User size={13} />
                                        {getLeadConsultant(client)}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 border-b border-[#F1F1F1] py-3">
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8A9A]">Start date</p>
                                        <p className="mt-1 text-sm font-medium text-[#0D0D0D]">
                                            {new Date(client.created_at).toLocaleDateString('en-CA')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8A9A]">Consultant lead</p>
                                        <p className="mt-1 truncate text-sm font-medium text-[#0D0D0D]">{getLeadConsultant(client)}</p>
                                    </div>
                                </div>

                                <div className="py-3">
                                    {isRetainer ? (
                                        <div>
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8A9A]">
                                                    <HeartPulse size={12} className="text-rose-500" />
                                                    Account health score
                                                </p>
                                                <span className="bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{health}%</span>
                                            </div>
                                            <div className="mt-3 h-2 bg-[#ECECEF]">
                                                <div className="h-full bg-emerald-500" style={{ width: `${health}%` }} />
                                            </div>
                                            <p className="mt-3 text-xs text-[#6E6E80]">Activity signals tracked: {getActivityTotal(client)}</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8A9A]">
                                                    <Target size={12} className="text-emerald-600" />
                                                    Project progress
                                                </p>
                                                <span className="text-xs font-semibold text-[#0D0D0D]">{progress.percent}%</span>
                                            </div>
                                            <div className="mt-3 h-2 bg-[#ECECEF]">
                                                <div className="h-full bg-emerald-500" style={{ width: `${progress.percent}%` }} />
                                            </div>
                                            <p className="mt-3 text-xs text-[#6E6E80]">Milestones tracked: {progress.done} of {progress.total} done</p>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-2 flex items-center justify-between border-t border-[#F1F1F1] pt-4">
                                    <span className="flex items-center gap-2 text-xs font-semibold text-[#0D0D0D]">
                                        <ExternalLink size={13} />
                                        Client Sandbox Portal
                                    </span>
                                    <button className="flex items-center gap-1 border border-[#0D0D0D] px-3 py-2 text-xs font-medium text-[#0D0D0D]">
                                        Manage Workspace
                                        <ChevronRight size={13} />
                                    </button>
                                </div>
                            </GlassCard>
                        );
                    })}
                </div>
            ) : (
                <div className="space-y-3">
                    {spaces.map((client) => (
                        <GlassCard key={client.id} onClick={() => onSelect(client.id)} className="database-row flex cursor-pointer items-center justify-between p-4">
                            <div className="flex min-w-0 items-center gap-4">
                                <div className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] text-sm font-semibold text-[#0D0D0D]">
                                    {client.name ? client.name.substring(0, 2).toUpperCase() : 'SP'}
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-[#0D0D0D]">{client.name}</div>
                                    <div className="truncate text-xs text-[#6E6E80]">{client.description || 'Verified portal environment'}</div>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <span className={`surface-chip px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${client.status === 'active' ? 'surface-chip-active' : ''}`}>
                                    {client.status}
                                </span>
                                {onDelete && (
                                    <button
                                        type="button"
                                        onClick={(event) => handleDeleteSpace(event, client)}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#F2D4D1] bg-white text-[#B42318] transition-colors hover:bg-[#FFF4F2]"
                                        title="Delete space"
                                        aria-label={`Delete ${client.name}`}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={closeCreateModal} title="Create Client Space">
                {createStep === 'model' ? (
                    <div className="space-y-5">
                        <div>
                            <p className="text-sm text-[#6E6E80]">Choose the relationship model before setting up the workspace.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {([
                                {
                                    id: 'retainer',
                                    title: 'Retainer',
                                    icon: HeartPulse,
                                    body: 'Ongoing account space for recurring work, check-ins, activity health, and long-term client operations.',
                                    bullets: ['Account health', 'Recurring meetings', 'Monthly check-ins']
                                },
                                {
                                    id: 'project',
                                    title: 'One-Time Project',
                                    icon: Target,
                                    body: 'Scoped delivery room for milestones, approvals, files, and final handoff.',
                                    bullets: ['Milestone progress', 'Deliverable tracking', 'Project handoff']
                                }
                            ] as const).map((option) => (
                                <button
                                    key={option.id}
                                    className={`border p-4 text-left transition-colors ${
                                        selectedModel === option.id ? 'border-emerald-500 bg-emerald-50' : 'border-[#DADADA] bg-white hover:border-[#0D0D0D]'
                                    }`}
                                    onClick={() => setSelectedModel(option.id)}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="grid h-9 w-9 place-items-center bg-[#F7F7F8] text-[#0D0D0D]">
                                            <option.icon size={17} />
                                        </span>
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                                            {option.id === 'retainer' ? 'Ongoing' : 'Scoped'}
                                        </span>
                                    </div>
                                    <h3 className="mt-4 text-lg font-semibold text-[#0D0D0D]">{option.title}</h3>
                                    <p className="mt-2 text-sm leading-5 text-[#6E6E80]">{option.body}</p>
                                    <div className="mt-4 space-y-2">
                                        {option.bullets.map((bullet) => (
                                            <p key={bullet} className="text-xs text-[#0D0D0D]">- {bullet}</p>
                                        ))}
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <Button className="w-full" variant="outline" onClick={closeCreateModal}>Cancel</Button>
                            <Button className="w-full" onClick={() => {
                                if (!selectedModel) {
                                    showToast('Please select a space type.', 'info');
                                    return;
                                }
                                setCreateStep('setup');
                            }}>Continue</Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div className="border border-[#E5E5E5] bg-[#F7F7F8] p-3">
                            <p className="text-xs text-[#6E6E80]">Space type</p>
                            <p className="mt-1 text-sm font-semibold text-[#0D0D0D]">{selectedModel ? getModelLabel(selectedModel) : 'Not selected'}</p>
                        </div>
                        <div>
                            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-[#6E6E80]">Company / Client Name</label>
                            <Input placeholder="Acme Enterprises" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-4">
                            <Button className="w-full" variant="outline" onClick={() => setCreateStep('model')}>Back</Button>
                            <Button className="w-full" onClick={handleSubmit}>Create Space</Button>
                        </div>
                    </div>
                )}
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

    React.useEffect(() => {
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

    if (loading) return <div className="flex h-10 items-center justify-center"><div className="h-4 w-4 animate-spin rounded-full border-2 border-[#E5E5E5] border-t-black" /></div>;

    return (
        <div className="flex flex-wrap gap-2">
            {indicators.unreadCount > 0 && (
                <span className="surface-chip px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em]">
                    <MessageSquare size={10} />
                    {indicators.unreadCount} unread
                </span>
            )}
            {indicators.upcomingMeetingsCount > 0 && (
                <span className="surface-chip px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em]">
                    <Calendar size={10} />
                    {indicators.upcomingMeetingsCount} meeting{indicators.upcomingMeetingsCount > 1 ? 's' : ''}
                </span>
            )}
            {indicators.recentFilesCount > 0 && (
                <span className="surface-chip px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em]">
                    <FileText size={10} />
                    {indicators.recentFilesCount} file{indicators.recentFilesCount > 1 ? 's' : ''}
                </span>
            )}
            {!indicators.unreadCount && !indicators.upcomingMeetingsCount && !indicators.recentFilesCount && (
                <span className="text-[10px] text-[#6E6E80] italic">No new activity</span>
            )}
        </div>
    );
};

export default SpacesView;
