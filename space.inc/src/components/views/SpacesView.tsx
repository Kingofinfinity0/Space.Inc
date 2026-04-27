import React, { useMemo, useState } from 'react';
import { Plus, LayoutGrid, List, Search, Briefcase, Sparkles, FileText, MessageSquare, Calendar } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { GlassCard, Button, Heading, Input, Modal, Checkbox } from '../UI/index';
import { ClientSpace } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/apiService';

const SpacesView = ({ clients, onSelect, onCreate }: { clients: ClientSpace[], onSelect: (id: string) => void, onCreate: (data: any) => void }) => {
    const { showToast } = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
    const [searchQuery, setSearchQuery] = useState('');
    const [newClientName, setNewClientName] = useState('');
    const [newClientContact, setNewClientContact] = useState('');
    const [newClientEmail, setNewClientEmail] = useState('');
    const [selectedModules, setSelectedModules] = useState({
        messages: true,
        chat: true,
        upload: true,
        meetings: true
    });

    const spaces = useMemo(() => clients.filter((client) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return [client.name, client.description, client.status].some((value) => String(value || '').toLowerCase().includes(q));
    }), [clients, searchQuery]);

    const handleSubmit = () => {
        if (!newClientName) {
            showToast('Please enter a space name.', 'info');
            return;
        }

        onCreate({
            name: newClientName,
            contactName: newClientContact,
            email: newClientEmail,
            modules: selectedModules
        });
        setIsModalOpen(false);
        setNewClientName('');
        setNewClientContact('');
        setNewClientEmail('');
    };

    return (
        <div className="space-y-6 page-enter">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                    <div className="surface-chip px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em]">
                        <Briefcase size={12} />
                        Client spaces
                    </div>
                    <Heading level={1}>Spaces</Heading>
                    <p className="max-w-2xl text-sm text-[#6E6E80]">Manage all your client environments from a clean, contextual workspace list.</p>
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
                    {spaces.map((client) => (
                        <GlassCard
                            key={client.id}
                            onClick={() => onSelect(client.id)}
                            className="sheet-panel group relative cursor-pointer overflow-hidden p-6"
                        >
                            <div className="mb-4 flex items-start justify-between">
                                <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] text-lg font-semibold text-[#0D0D0D] transition-colors group-hover:bg-[#0D0D0D] group-hover:text-white">
                                    {client.name ? client.name.substring(0, 2).toUpperCase() : 'SP'}
                                </div>
                                <span className={`surface-chip px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${client.status === 'active' ? 'surface-chip-active' : ''}`}>
                                    {client.status}
                                </span>
                            </div>
                            <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#0D0D0D]">{client.name}</h3>
                            <p className="mt-1 text-sm text-[#6E6E80]">{client.description || 'Verified portal environment'}</p>
                            <div className="mt-6 border-t border-[#E5E5E5] pt-4">
                                <SpaceActivityIndicators spaceId={client.id} />
                            </div>
                        </GlassCard>
                    ))}
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
                            <span className={`surface-chip px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${client.status === 'active' ? 'surface-chip-active' : ''}`}>
                                {client.status}
                            </span>
                        </GlassCard>
                    ))}
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Provision New Space">
                <div className="space-y-4">
                    <div>
                        <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-[#6E6E80]">Space Name</label>
                        <Input placeholder="Client Name or Project" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
                    </div>

                    <div>
                        <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-[#6E6E80]">Invitee Email (Optional)</label>
                        <Input placeholder="client@example.com" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} />
                    </div>

                    <div className="pt-2">
                        <label className="mb-4 block text-[10px] font-semibold uppercase tracking-widest text-[#6E6E80]">Included Features</label>
                        <div className="grid grid-cols-2 gap-4">
                            <Checkbox label="Messages" checked={selectedModules.messages} onChange={(val) => setSelectedModules(prev => ({ ...prev, messages: val }))} />
                            <Checkbox label="Chat" checked={selectedModules.chat} onChange={(val) => setSelectedModules(prev => ({ ...prev, chat: val }))} />
                            <Checkbox label="Upload" checked={selectedModules.upload} onChange={(val) => setSelectedModules(prev => ({ ...prev, upload: val }))} />
                            <Checkbox label="Meetings" checked={selectedModules.meetings} onChange={(val) => setSelectedModules(prev => ({ ...prev, meetings: val }))} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-6">
                        <Button className="w-full" variant="outline" onClick={() => {
                            setIsModalOpen(false);
                            setNewClientName('');
                            setNewClientEmail('');
                        }}>Cancel</Button>
                        <Button className="w-full" onClick={handleSubmit}>Create Space</Button>
                    </div>
                </div>
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
