import React, { useEffect, useState } from 'react';
import { Shield, Save, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';

interface PolicyConfig {
    allow_client_invites: boolean;
    allow_staff_invites: boolean;
    client_can_upload: boolean;
    client_can_delete_own: boolean;
    client_can_create_tasks: boolean;
    require_2fa: boolean;
    auto_archive_months: number;
}

export const PolicySettings: React.FC = () => {
    const { profile } = useAuth();
    const [policies, setPolicies] = useState<PolicyConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fetchPolicies = async () => {
        if (!profile?.organization_id) return;
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await apiService.getOrganizationPolicies(profile.organization_id);
            if (error) throw error;
            setPolicies(data);
        } catch (err: any) {
            console.error("Failed to fetch policies:", err);
            setError(err.message || "Failed to load policies");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPolicies();
    }, [profile?.organization_id]);

    const handleToggle = (key: keyof PolicyConfig) => {
        if (!policies) return;
        setPolicies(prev => prev ? { ...prev, [key]: !prev[key] } : null);
    };

    const handleSave = async () => {
        if (!policies || !profile?.organization_id) return;
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const { error } = await apiService.updateOrganizationPolicies(profile.organization_id, policies);
            if (error) throw error;
            setSuccess("Policies updated successfully");
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            console.error("Failed to save policies:", err);
            // Revert or show error
            setError(err.message || "Failed to save policies");
            fetchPolicies(); // Revert to server state
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-zinc-500">Loading policies...</div>;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-[#1D1D1D] flex items-center gap-2">
                        <Shield className="text-[#10A37F]" /> Organization Policies
                    </h2>
                    <p className="text-zinc-500 mt-1">Configure global rules for your workspace.</p>
                </div>
                <button
                    onClick={fetchPolicies}
                    className="p-2 text-zinc-400 hover:text-[#10A37F] transition-colors"
                    title="Refresh Policies"
                >
                    <RefreshCw size={20} />
                </button>
            </div>

            {error && (
                <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-6 bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-2">
                    <Check size={20} />
                    {success}
                </div>
            )}

            <div className="bg-white rounded-xl border border-[#D1D5DB] overflow-hidden shadow-sm">
                <div className="p-6 border-b border-[#D1D5DB] bg-[#F7F7F8]">
                    <h3 className="font-semibold text-zinc-800">Client Permissions</h3>
                </div>
                <div className="p-6 space-y-6">
                    <PolicyToggle
                        label="Allow Clients to Upload Files"
                        description="If disabled, clients can only view files shared by staff."
                        enabled={policies?.client_can_upload ?? true}
                        onChange={() => handleToggle('client_can_upload')}
                    />
                    <PolicyToggle
                        label="Allow Clients to Delete Own Files"
                        description="Clients can remove files they uploaded."
                        enabled={policies?.client_can_delete_own ?? true}
                        onChange={() => handleToggle('client_can_delete_own')}
                    />
                    <PolicyToggle
                        label="Allow Clients to Create Tasks"
                        description="Enable clients to assign tasks to themselves or staff."
                        enabled={policies?.client_can_create_tasks ?? false}
                        onChange={() => handleToggle('client_can_create_tasks')}
                    />
                    <PolicyToggle
                        label="Allow Clients to Invite Users"
                        description="Permit clients to add new members to their organization."
                        enabled={policies?.allow_client_invites ?? false}
                        onChange={() => handleToggle('allow_client_invites')}
                    />
                </div>

                <div className="p-6 border-t border-b border-[#D1D5DB] bg-[#F7F7F8]">
                    <h3 className="font-semibold text-zinc-800">Security & Governance</h3>
                </div>
                <div className="p-6 space-y-6">
                    <PolicyToggle
                        label="Require 2FA for All Staff"
                        description="Force two-factor authentication for staff accounts."
                        enabled={policies?.require_2fa ?? false}
                        onChange={() => handleToggle('require_2fa')}
                    />
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-[#1D1D1D]">Auto-Archive Inactive Spaces</h4>
                            <p className="text-sm text-zinc-500">Months of inactivity before auto-archiving.</p>
                        </div>
                        <select
                            value={policies?.auto_archive_months ?? 6}
                            onChange={(e) => setPolicies(p => p ? { ...p, auto_archive_months: parseInt(e.target.value) } : null)}
                            className="border border-[#D1D5DB] rounded-md px-3 py-1.5 text-sm focus:ring-[#10A37F] focus:border-[#10A37F]"
                        >
                            <option value={3}>3 Months</option>
                            <option value={6}>6 Months</option>
                            <option value={12}>12 Months</option>
                            <option value={0}>Disabled</option>
                        </select>
                    </div>
                </div>

                <div className="p-6 border-t border-[#D1D5DB] bg-[#F7F7F8] flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-[#10A37F] text-white px-6 py-2.5 rounded-lg hover:bg-[#0E8A6B] disabled:opacity-50 transition-colors font-medium shadow-sm"
                    >
                        {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

const PolicyToggle: React.FC<{ label: string, description: string, enabled: boolean, onChange: () => void }> = ({ label, description, enabled, onChange }) => (
    <div className="flex items-center justify-between">
        <div>
            <h4 className="font-medium text-[#1D1D1D]">{label}</h4>
            <p className="text-sm text-zinc-500">{description}</p>
        </div>
        <button
            onClick={onChange}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#10A37F] focus:ring-offset-2 ${enabled ? 'bg-[#10A37F]' : 'bg-zinc-200'}`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
            />
        </button>
    </div>
);
