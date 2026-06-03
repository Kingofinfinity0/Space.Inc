import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, LockKeyhole, Plus, RefreshCw, Save, Shield } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { OrgTeamPolicies } from '../../types';

type SaveSection = 'features' | 'limits' | 'roles';

const DEFAULT_POLICIES: OrgTeamPolicies = {
    messaging_enabled: true,
    meetings_enabled: true,
    file_uploads_enabled: true,
    max_spaces_per_member: null,
    max_file_size_mb: 100,
    custom_roles_enabled: false
};

export const PolicySettings: React.FC = () => {
    const { userRole } = useAuth();
    const [policies, setPolicies] = useState<OrgTeamPolicies>(DEFAULT_POLICIES);
    const [loading, setLoading] = useState(true);
    const [savingSection, setSavingSection] = useState<SaveSection | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [customRoleName, setCustomRoleName] = useState('');
    const [customRolePermissions, setCustomRolePermissions] = useState('{"base_role":"client"}');

    const canManage = userRole === 'owner' || userRole === 'admin';

    const disabledFeatures = useMemo(() => {
        const names: string[] = [];
        if (!policies.messaging_enabled) names.push('messaging');
        if (!policies.meetings_enabled) names.push('meetings');
        if (!policies.file_uploads_enabled) names.push('file uploads');
        return names;
    }, [policies.file_uploads_enabled, policies.meetings_enabled, policies.messaging_enabled]);

    const fetchPolicies = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await apiService.getOrgTeamPolicies();
            if (error) throw error;
            setPolicies({ ...DEFAULT_POLICIES, ...(data || {}) });
        } catch (err: any) {
            console.error('Failed to fetch org team policies:', err);
            setError(err.message || 'Failed to load org team policies');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPolicies();
    }, []);

    const saveSection = async (section: SaveSection, updates: Record<string, any>) => {
        setSavingSection(section);
        setError(null);
        setSuccess(null);
        try {
            const { data, error } = await apiService.updateOrgTeamPolicies(updates);
            if (error) throw error;
            setPolicies({ ...DEFAULT_POLICIES, ...(data || policies), ...updates });
            setSuccess('Org team policies updated');
            setTimeout(() => setSuccess(null), 2500);
        } catch (err: any) {
            console.error('Failed to save org team policies:', err);
            setError(err.message || 'Failed to save org team policies');
            fetchPolicies();
        } finally {
            setSavingSection(null);
        }
    };

    const createRole = async () => {
        if (!customRoleName.trim()) return;
        setSavingSection('roles');
        setError(null);
        try {
            const parsed = JSON.parse(customRolePermissions || '{}');
            const { error } = await apiService.createCustomRole(customRoleName.trim(), parsed);
            if (error) throw error;
            setCustomRoleName('');
            setCustomRolePermissions('{"base_role":"client"}');
            setSuccess('Custom role created');
            setTimeout(() => setSuccess(null), 2500);
        } catch (err: any) {
            setError(err.message || 'Failed to create custom role');
        } finally {
            setSavingSection(null);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-zinc-500">Loading org team policies...</div>;
    }

    if (!canManage) {
        return (
            <div className="mx-auto max-w-4xl p-6">
                <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-6 text-[#6E6E80]">
                    <Shield className="mb-4 text-[#0D0D0D]" />
                    <p className="font-medium text-[#0D0D0D]">Owner or Admin access required</p>
                    <p className="mt-1 text-sm">Org team policies control global defaults across all spaces.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.03em] text-[#0D0D0D]">
                        <Shield size={24} />
                        Org Team Policies
                    </h2>
                    <p className="mt-1 text-sm text-[#6E6E80]">Global defaults for members, limits, permissions, and role controls.</p>
                </div>
                <button
                    type="button"
                    onClick={fetchPolicies}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-white text-[#6E6E80] hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                    title="Refresh policies"
                    aria-label="Refresh policies"
                >
                    <RefreshCw size={18} />
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            {success && (
                <div className="flex items-center gap-2 rounded-[8px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                    <Check size={18} />
                    {success}
                </div>
            )}

            <section className="rounded-[8px] border border-[#E5E5E5] bg-white">
                <SectionHeader title="Feature Controls" subtitle="Disable major surfaces across every space." />
                <div className="space-y-5 p-5">
                    <PolicyToggle
                        label="Enable Messaging"
                        enabled={policies.messaging_enabled}
                        onChange={() => setPolicies((current) => ({ ...current, messaging_enabled: !current.messaging_enabled }))}
                    />
                    <PolicyToggle
                        label="Enable Meetings"
                        enabled={policies.meetings_enabled}
                        onChange={() => setPolicies((current) => ({ ...current, meetings_enabled: !current.meetings_enabled }))}
                    />
                    <PolicyToggle
                        label="Enable File Uploads"
                        enabled={policies.file_uploads_enabled}
                        onChange={() => setPolicies((current) => ({ ...current, file_uploads_enabled: !current.file_uploads_enabled }))}
                    />

                    {disabledFeatures.length > 0 && (
                        <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            This will disable {disabledFeatures.join(', ')} for all members across all spaces.
                        </div>
                    )}

                    <SectionSaveButton
                        loading={savingSection === 'features'}
                        onClick={() => saveSection('features', {
                            messaging_enabled: policies.messaging_enabled,
                            meetings_enabled: policies.meetings_enabled,
                            file_uploads_enabled: policies.file_uploads_enabled
                        })}
                    />
                </div>
            </section>

            <section className="rounded-[8px] border border-[#E5E5E5] bg-white">
                <SectionHeader title="Limits" subtitle="Organization-wide ceilings and safety checks." />
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                    <label className="space-y-2">
                        <span className="text-sm font-medium text-[#0D0D0D]">Max spaces per team member</span>
                        <input
                            type="number"
                            min={0}
                            value={policies.max_spaces_per_member ?? ''}
                            onChange={(event) => setPolicies((current) => ({
                                ...current,
                                max_spaces_per_member: event.target.value === '' ? null : Number(event.target.value)
                            }))}
                            placeholder="Unlimited"
                            className="w-full rounded-[8px] border border-[#DADADA] bg-white px-3 py-2 text-sm outline-none focus:border-black"
                        />
                    </label>
                    <label className="space-y-2">
                        <span className="text-sm font-medium text-[#0D0D0D]">Max file size (MB)</span>
                        <input
                            type="number"
                            min={1}
                            value={policies.max_file_size_mb}
                            onChange={(event) => setPolicies((current) => ({
                                ...current,
                                max_file_size_mb: Number(event.target.value || 1)
                            }))}
                            className="w-full rounded-[8px] border border-[#DADADA] bg-white px-3 py-2 text-sm outline-none focus:border-black"
                        />
                    </label>
                    <div className="sm:col-span-2">
                        <SectionSaveButton
                            loading={savingSection === 'limits'}
                            onClick={() => saveSection('limits', {
                                max_spaces_per_member: policies.max_spaces_per_member,
                                max_file_size_mb: policies.max_file_size_mb
                            })}
                        />
                    </div>
                </div>
            </section>

            <section className="rounded-[8px] border border-[#E5E5E5] bg-white">
                <SectionHeader title="Roles" subtitle="Custom roles build on base permissions when enabled." />
                <div className="space-y-5 p-5">
                    <PolicyToggle
                        label="Enable Custom Roles"
                        enabled={policies.custom_roles_enabled}
                        onChange={() => setPolicies((current) => ({ ...current, custom_roles_enabled: !current.custom_roles_enabled }))}
                    />
                    <SectionSaveButton
                        loading={savingSection === 'roles'}
                        onClick={() => saveSection('roles', { custom_roles_enabled: policies.custom_roles_enabled })}
                    />

                    {policies.custom_roles_enabled ? (
                        <div className="grid gap-3 rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-4">
                            <input
                                value={customRoleName}
                                onChange={(event) => setCustomRoleName(event.target.value)}
                                placeholder="Role name"
                                className="rounded-[8px] border border-[#DADADA] bg-white px-3 py-2 text-sm outline-none focus:border-black"
                            />
                            <textarea
                                value={customRolePermissions}
                                onChange={(event) => setCustomRolePermissions(event.target.value)}
                                className="min-h-[96px] rounded-[8px] border border-[#DADADA] bg-white px-3 py-2 font-mono text-xs outline-none focus:border-black"
                            />
                            <button
                                type="button"
                                onClick={createRole}
                                disabled={savingSection === 'roles' || !customRoleName.trim()}
                                className="inline-flex w-fit items-center gap-2 rounded-[8px] border border-[#0D0D0D] bg-[#0D0D0D] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                            >
                                <Plus size={16} />
                                Create Role
                            </button>
                        </div>
                    ) : (
                        <p className="rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-4 text-sm text-[#6E6E80]">
                            Custom roles are off. Base owner, admin, staff, and client roles remain active.
                        </p>
                    )}
                </div>
            </section>

            <section className="rounded-[8px] border border-red-200 bg-white">
                <SectionHeader title="Danger Zone" subtitle="Ownership changes affect every space and member." tone="danger" />
                <div className="p-5">
                    <button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-2 rounded-[8px] border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 opacity-70"
                        title="Transfer ownership flow is not yet connected"
                    >
                        <LockKeyhole size={16} />
                        Transfer ownership
                    </button>
                </div>
            </section>
        </div>
    );
};

const SectionHeader = ({ title, subtitle, tone = 'default' }: { title: string; subtitle: string; tone?: 'default' | 'danger' }) => (
    <div className={`border-b px-5 py-4 ${tone === 'danger' ? 'border-red-200 bg-red-50' : 'border-[#E5E5E5] bg-[#F7F7F8]'}`}>
        <h3 className={`text-base font-semibold ${tone === 'danger' ? 'text-red-700' : 'text-[#0D0D0D]'}`}>{title}</h3>
        <p className={`mt-1 text-sm ${tone === 'danger' ? 'text-red-600' : 'text-[#6E6E80]'}`}>{subtitle}</p>
    </div>
);

const PolicyToggle = ({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: () => void }) => (
    <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-[#0D0D0D]">{label}</span>
        <button
            type="button"
            onClick={onChange}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 ${enabled ? 'bg-black' : 'bg-[#D4D4D8]'}`}
            aria-pressed={enabled}
        >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </div>
);

const SectionSaveButton = ({ loading, onClick }: { loading: boolean; onClick: () => void }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-[8px] border border-[#0D0D0D] bg-[#0D0D0D] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
    >
        {loading ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
        Save Changes
    </button>
);
