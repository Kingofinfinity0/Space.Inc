import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Save, Settings, SlidersHorizontal, X } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { Button, LoadingScreen, useLoadingScreenGate } from '../UI';

const PERMISSION_COLUMNS = [
    { key: 'Chat messaging', label: 'Chat' },
    { key: 'File uploads', label: 'Upload Files' },
    { key: 'File viewing', label: 'View Files' },
    { key: 'Meeting creation', label: 'Create Meetings' },
    { key: 'Meeting recording viewing', label: 'View Recordings' },
    { key: 'Task creation', label: 'Create Tasks' },
] as const;

type MatrixMember = {
    user_id: string;
    full_name?: string | null;
    email?: string | null;
    role?: string;
    permissions?: Record<string, boolean>;
    locked_by_policy?: boolean | Record<string, boolean>;
};

export function SpacePermissionsMatrix({ spaceId, compact = false, className = '' }: { spaceId: string; compact?: boolean; className?: string }) {
    const [members, setMembers] = useState<MatrixMember[]>([]);
    const [drafts, setDrafts] = useState<Record<string, Record<string, boolean>>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editorUserId, setEditorUserId] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const loadingGate = useLoadingScreenGate(loading);

    const loadMatrix = async () => {
        setLoading(true);
        setError(null);
        const { data, error: matrixError } = await apiService.getSpacePermissionsMatrix(spaceId);
        if (matrixError) {
            setError(matrixError.message || 'Failed to load permissions');
        } else {
            setMembers(Array.isArray(data) ? data : []);
            setDrafts({});
        }
        setLoading(false);
    };

    useEffect(() => {
        void loadMatrix();
    }, [spaceId]);

    const hasChanges = useMemo(() => Object.keys(drafts).length > 0, [drafts]);

    const getValue = (member: MatrixMember, key: string) => {
        if (drafts[member.user_id]?.[key] !== undefined) return drafts[member.user_id][key];
        return Boolean(member.permissions?.[key]);
    };

    const toggleValue = (member: MatrixMember, key: string) => {
        if (isLocked(member, key)) return;
        setDrafts((current) => ({
            ...current,
            [member.user_id]: {
                ...(current[member.user_id] || {}),
                [key]: !getValue(member, key),
            },
        }));
    };

    const saveChanges = async () => {
        setSaving(true);
        setError(null);
        try {
            for (const [userId, permissions] of Object.entries(drafts)) {
                const { error: saveError } = await apiService.bulkSetSpacePermissions(spaceId, userId, permissions);
                if (saveError) throw saveError;
            }
            await loadMatrix();
        } catch (err: any) {
            setError(err?.message || 'Failed to save permissions');
        } finally {
            setSaving(false);
        }
    };

    const isLocked = (member: MatrixMember, key: string) => {
        if (typeof member.locked_by_policy === 'boolean') return member.locked_by_policy;
        return Boolean(member.locked_by_policy?.[key]);
    };

    const selectedMember = members.find((member) => member.user_id === editorUserId) || null;

    const openEditor = (member?: MatrixMember) => {
        const targetMember = member || members[0];
        if (!targetMember) return;
        setEditorUserId(targetMember.user_id);
    };

    const applyPreset = (role: 'client_view_only' | 'collaborator' | 'full_access') => {
        if (!selectedMember) return;

        const presetValues: Record<typeof PERMISSION_COLUMNS[number]['key'], boolean> = {
            'Chat messaging': role !== 'client_view_only',
            'File uploads': role === 'full_access',
            'File viewing': true,
            'Meeting creation': role === 'full_access',
            'Meeting recording viewing': role !== 'client_view_only',
            'Task creation': role !== 'client_view_only',
        };

        setDrafts((current) => ({
            ...current,
            [selectedMember.user_id]: {
                ...(current[selectedMember.user_id] || {}),
                ...presetValues,
            },
        }));
    };

    if (loadingGate.isVisible) {
        return (
            <LoadingScreen
                key={loadingGate.cycleKey}
                message="Loading permissions..."
                isComplete={loadingGate.isComplete}
                onExitComplete={loadingGate.handleExitComplete}
            />
        );
    }

    return (
        <>
        <section className={`ui-card-lane overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white ${className}`}>
            <div className={`space-dashboard-panel-header flex items-center justify-between gap-3 border-b border-[#E5E5E5] px-4 ${compact ? 'py-3' : 'py-4'}`}>
                <div className="min-w-0">
                    <h3 className="space-dashboard-panel-title text-[#0D0D0D]">Permissions</h3>
                    <p className="space-dashboard-panel-subtitle mt-0.5 text-[#6E6E80]">Set permissions for client and staff.</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#6E6E80] transition hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                        aria-label="Open permission settings"
                        title="Permission settings"
                    >
                        <Settings size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => openEditor()}
                        disabled={members.length === 0}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#0D0D0D] bg-[#0D0D0D] text-white transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:border-[#E5E5E5] disabled:bg-[#F7F7F8] disabled:text-[#B7B7C2]"
                        aria-label="Edit permissions"
                        title="Edit permissions"
                    >
                        <SlidersHorizontal size={14} />
                    </button>
                </div>
            </div>

            {error && <div className="border-b border-[#E5E5E5] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

            {compact ? (
                <div className="ui-card-scroll p-3">
                    {members.length === 0 ? (
                        <p className="rounded-[8px] border border-dashed border-[#E5E5E5] p-4 text-sm text-[#6E6E80]">No client members to configure.</p>
                    ) : (
                        <div>
                            {members.map((member) => {
                                const isExpanded = editorUserId === member.user_id;
                                return (
                                    <div key={member.user_id} className="border-b border-[#EDEDED] last:border-b-0">
                                        <button
                                            type="button"
                                            onClick={() => openEditor(member)}
                                            className="space-dashboard-list-row flex w-full items-center justify-between gap-3 px-1 py-2 text-left transition hover:bg-[#F7F7F8]/70"
                                        >
                                            <div className="min-w-0">
                                                <p className="space-dashboard-list-name truncate text-[#0D0D0D]">{member.full_name || member.email || 'Member'}</p>
                                            </div>
                                            <span className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#E5E5E5] bg-white transition-all hover:border-[#D0D0D5]">
                                                <ChevronDown size={15} className={`text-[#6E6E80] transition-transform duration-200 ${isExpanded ? 'rotate-180 scale-95' : '-rotate-90 scale-90'}`} />
                                            </span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
            <div className="ui-card-scroll ui-card-scroll-x">
                <table className="min-w-full border-collapse text-sm">
                    <thead>
                        <tr className="border-b border-[#E5E5E5] bg-[#F7F7F8] text-left text-[11px] uppercase tracking-[0.14em] text-[#6E6E80]">
                            <th className="min-w-[220px] px-4 py-3 font-medium">Member</th>
                            {PERMISSION_COLUMNS.map((column) => (
                                <th key={column.key} className="min-w-[130px] px-4 py-3 font-medium">{column.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={PERMISSION_COLUMNS.length + 1} className="px-4 py-6 text-[#6E6E80]">Loading permissions...</td>
                            </tr>
                        ) : members.length === 0 ? (
                            <tr>
                                <td colSpan={PERMISSION_COLUMNS.length + 1} className="px-4 py-6 text-[#6E6E80]">No client members to configure.</td>
                            </tr>
                        ) : members.map((member) => (
                            <tr key={member.user_id} className="border-b border-[#E5E5E5] last:border-b-0">
                                <td className="px-4 py-3">
                                    <p className="space-dashboard-list-name text-[#0D0D0D]">{member.full_name || member.email || 'Member'}</p>
                                    <p className="text-xs text-[#6E6E80]">{member.role || 'client'}</p>
                                </td>
                                {PERMISSION_COLUMNS.map((column) => {
                                    const enabled = getValue(member, column.key);
                                    return (
                                        <td key={column.key} className="px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => toggleValue(member, column.key)}
                                                disabled={isLocked(member, column.key)}
                                                title={isLocked(member, column.key) ? 'This setting is controlled by organization policy' : column.label}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                    enabled ? 'bg-black' : 'bg-zinc-300'
                                                } disabled:cursor-not-allowed disabled:opacity-50`}
                                            >
                                                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            )}
        </section>
        {selectedMember && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 py-6 backdrop-blur-[2px]">
                <div className="w-full max-w-[520px] animate-[surface-in_160ms_ease-out] overflow-hidden rounded-[18px] border border-[#E5E5E5] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
                    <div className="flex items-start justify-between gap-4 border-b border-[#E5E5E5] px-5 py-4">
                        <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6E6E80]">Member permissions</p>
                            <h3 className="mt-1 truncate text-xl font-semibold tracking-[-0.03em] text-[#0D0D0D]">{selectedMember.full_name || selectedMember.email || 'Member'}</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setEditorUserId(null)}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#6E6E80] transition hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                            aria-label="Close permissions editor"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="max-h-[68vh] overflow-y-auto px-5 py-4">
                        <div className="mb-4 grid grid-cols-3 gap-2">
                            {[
                                { key: 'client_view_only' as const, label: 'View only' },
                                { key: 'collaborator' as const, label: 'Collaborate' },
                                { key: 'full_access' as const, label: 'Full access' },
                            ].map((preset) => (
                                <button
                                    key={preset.key}
                                    type="button"
                                    onClick={() => applyPreset(preset.key)}
                                    className="rounded-full border border-[#E5E5E5] px-3 py-2 text-[11px] font-semibold text-[#0D0D0D] transition hover:border-[#0D0D0D]"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>

                        <div className="rounded-[14px] border border-[#E5E5E5]">
                            {PERMISSION_COLUMNS.map((column) => {
                                const enabled = getValue(selectedMember, column.key);
                                const locked = isLocked(selectedMember, column.key);
                                return (
                                    <button
                                        key={column.key}
                                        type="button"
                                        onClick={() => toggleValue(selectedMember, column.key)}
                                        disabled={locked}
                                        title={locked ? 'This setting is controlled by organization policy' : column.label}
                                        className="flex w-full items-center justify-between gap-4 border-b border-[#EDEDED] px-4 py-3 text-left last:border-b-0 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <span>
                                            <span className="block text-sm font-semibold text-[#0D0D0D]">{column.label}</span>
                                            {locked && <span className="mt-0.5 block text-[11px] text-[#6E6E80]">Controlled by organization policy</span>}
                                        </span>
                                        <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-black' : 'bg-zinc-300'}`}>
                                            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-[#E5E5E5] bg-[#FAFAFA] px-5 py-4">
                        <p className="text-[11px] text-[#6E6E80]">{hasChanges ? 'Unsaved permission changes' : 'No changes yet'}</p>
                        <Button size="sm" onClick={() => void saveChanges()} disabled={!hasChanges || saving}>
                            <Save size={14} className="mr-2" />
                            {saving ? 'Saving...' : 'Save changes'}
                        </Button>
                    </div>
                </div>
            </div>
        )}
        {settingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 py-6 backdrop-blur-[2px]">
                <div className="w-full max-w-[440px] animate-[surface-in_160ms_ease-out] overflow-hidden rounded-[18px] border border-[#E5E5E5] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
                    <div className="flex items-start justify-between gap-4 border-b border-[#E5E5E5] px-5 py-4">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6E6E80]">Permission settings</p>
                            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#0D0D0D]">Default presets</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSettingsOpen(false)}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#6E6E80] transition hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                            aria-label="Close permission settings"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="divide-y divide-[#EDEDED] px-5 py-2">
                        {[
                            ['Client view only', 'Can view files and recordings, but cannot upload files, create meetings, or create tasks.'],
                            ['Collaborator', 'Can message, view files, view recordings, and create tasks.'],
                            ['Full access', 'Can use all space capabilities unless organization policy locks a control.'],
                        ].map(([title, description]) => (
                            <div key={title} className="py-3">
                                <p className="text-sm font-semibold text-[#0D0D0D]">{title}</p>
                                <p className="mt-1 text-xs leading-relaxed text-[#6E6E80]">{description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
