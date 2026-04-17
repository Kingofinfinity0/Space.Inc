import React, { useState, useEffect } from 'react';
import { GlassCard, Heading, Button, Text } from '../UI';
import { X, Check, Copy, Rocket, Calendar } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { inviteService } from '../../services/inviteService';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

interface InviteStaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    organizationId: string;
    spaces: any[];
}

type ExpiryOption = '1' | '3' | '7' | '14' | '30' | 'custom';

export const InviteStaffModal: React.FC<InviteStaffModalProps> = ({ isOpen, onClose, organizationId, spaces }) => {
    const { showToast } = useToast();
    const { session } = useAuth();
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'staff' | 'admin'>('staff');
    const [selectedSpaces, setSelectedSpaces] = useState<Record<string, {
        can_view: boolean;
        can_edit: boolean;
        can_message_client: boolean;
        can_upload_files: boolean;
        can_manage_tasks: boolean;
    }>>({});
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [sentEmail, setSentEmail] = useState('');
    const [inviteLink, setInviteLink] = useState('');
    const [expiryDate, setExpiryDate] = useState<string>('');
    const [copied, setCopied] = useState(false);
    
    const [expiryOption, setExpiryOption] = useState<ExpiryOption>('3');
    const [customDate, setCustomDate] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            setEmail('');
            setRole('staff');
            setSelectedSpaces({});
            setLoading(false);
            setSent(false);
            setSentEmail('');
            setInviteLink('');
            setExpiryDate('');
            setCopied(false);
            setExpiryOption('3');
            setCustomDate('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const toggleSpace = (spaceId: string) => {
        const next = { ...selectedSpaces };
        if (next[spaceId]) {
            delete next[spaceId];
        } else {
            next[spaceId] = {
                can_view: true,
                can_edit: false,
                can_message_client: false,
                can_upload_files: false,
                can_manage_tasks: false,
            };
        }
        setSelectedSpaces(next);
    };

    const toggleCap = (spaceId: string, cap: string, val: boolean) => {
        setSelectedSpaces(prev => ({
            ...prev,
            [spaceId]: { ...prev[spaceId], [cap]: val }
        }));
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getExpiresAt = () => {
        if (expiryOption === 'custom') {
            return customDate ? new Date(customDate).toISOString() : undefined;
        }
        const date = new Date();
        date.setDate(date.getDate() + parseInt(expiryOption));
        return date.toISOString();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const access_token = session?.access_token;
        if (!email.trim()) return showToast('Email is required', 'error');
        if (expiryOption === 'custom' && !customDate) return showToast('Please select an expiry date', 'error');
        if (!access_token) return showToast('You must be logged in', 'error');

        const spaceAssignments = Object.entries(selectedSpaces).map(([space_id, capabilities]) => ({
            space_id,
            capabilities
        }));

        const expiresAt = getExpiresAt();

        setLoading(true);
        try {
            const res = await inviteService.sendStaffInvite(
                email.trim(), 
                role, 
                spaceAssignments, 
                expiresAt, 
                access_token
            );

            if (res.success && res.data) {
                setInviteLink(res.data.invite_url);
                setSentEmail(res.data.email);
                // Format nice date for display
                const d = new Date(res.data.expires_at || '');
                setExpiryDate(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
                setSent(true);
            } else {
                showToast(res.error || 'Failed to create staff invite', 'error');
            }
        } catch (err: any) {
            console.error('[InviteStaffModal] Failure:', err);
            showToast(err.message || 'Something went wrong.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ── Success state ──────────────────────────────────────────────────────
    if (sent) {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30">
                <GlassCard className="max-w-md w-full p-10 text-center relative border border-[#E5E5E5] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                    <div className="h-16 w-16 bg-[#F7F7F8] rounded-full flex items-center justify-center mx-auto mb-6 border border-[#E5E5E5]">
                        <Rocket className="text-[#0D0D0D]" size={32} />
                    </div>
                    <Heading level={3} className="mb-2 text-[#0D0D0D]">Invite Created!</Heading>
                    <p className="text-[#6E6E80] mb-6 font-light">
                        Staff invite generated for <strong>{sentEmail}</strong>. Share the link below manually.
                    </p>
                    
                    <div className="space-y-4 mb-8">
                        <div className="flex gap-2">
                            <input 
                                readOnly 
                                title="Invitation Link"
                                value={inviteLink} 
                                className="flex-1 bg-[#F7F7F8] border border-[#E5E5E5] rounded-[6px] px-4 py-2.5 text-xs font-mono text-[#6E6E80] focus:outline-none"
                            />
                            <Button 
                                variant={copied ? "primary" : "outline"}
                                size="sm" 
                                onClick={handleCopy}
                                className="min-w-[90px] text-xs font-bold uppercase transition-all"
                            >
                                {copied ? 'Copied!' : 'Copy'}
                            </Button>
                        </div>
                        <p className="text-[10px] text-[#6E6E80] font-bold uppercase tracking-widest bg-[#F7F7F8] py-1.5 rounded-full inline-block px-4 border border-[#E5E5E5] italic">
                            Expires {expiryDate}
                        </p>
                    </div>

                    <Button variant="primary" className="w-full py-4 text-sm font-black uppercase tracking-widest" onClick={onClose}>Done</Button>
                </GlassCard>
            </div>
        );
    }

    // ── Form state ─────────────────────────────────────────────────────────
    return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30">
            <GlassCard className="max-w-2xl w-full p-8 relative max-h-[90vh] overflow-y-auto border border-[#E5E5E5] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <button
                    title="Close"
                    onClick={onClose}
                    className="absolute right-4 top-4 p-2 text-[#6E6E80] hover:text-[#0D0D0D] rounded-full hover:bg-[#F7F7F8] transition-colors"
                >
                    <X size={18} />
                </button>

                <Heading level={2} className="mb-6 text-[#0D0D0D]">Invite Team Member</Heading>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-6">
                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="colleague@company.com"
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                />
                            </div>

                            {/* Role */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Role</label>
                                <div className="flex gap-3">
                                    {(['staff', 'admin'] as const).map(r => (
                                        <button
                                            key={r}
                                            type="button"
                                            onClick={() => setRole(r)}
                                            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${role === r
                                                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                                                    : 'bg-white border-zinc-200 text-zinc-600 hover:border-emerald-300'
                                                }`}
                                        >
                                            {r.charAt(0).toUpperCase() + r.slice(1)}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                                    {role === 'admin'
                                        ? 'Admin can invite others, manage spaces, and view all data.'
                                        : 'Staff can work within assigned spaces only.'}
                                </p>
                            </div>

                            {/* Expiry Picker */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Link Expiration</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { val: '1', label: '1 Day' },
                                        { val: '3', label: '3 Days' },
                                        { val: '7', label: '7 Days' },
                                        { val: '14', label: '14 Days' },
                                        { val: '30', label: '30 Days' },
                                        { val: 'custom', label: 'Custom' },
                                    ].map(opt => (
                                        <button
                                            key={opt.val}
                                            type="button"
                                            onClick={() => setExpiryOption(opt.val as ExpiryOption)}
                                            className={`py-1.5 rounded-md border text-[11px] font-semibold transition-all ${expiryOption === opt.val
                                                ? 'bg-zinc-800 border-zinc-800 text-white shadow-sm'
                                                : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                {expiryOption === 'custom' && (
                                    <div className="mt-2 relative">
                                        <Calendar className="absolute left-3 top-2.5 text-zinc-400" size={14} />
                                        <input 
                                            type="date" 
                                            title="Custom Expiry Date"
                                            value={customDate}
                                            onChange={e => setCustomDate(e.target.value)}
                                            min={new Date().toISOString().split('T')[0]}
                                            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Space Assignments */}
                        <div className="flex flex-col h-full">
                            <label className="block text-sm font-medium text-zinc-700 mb-3">
                                Assign Spaces & Capabilities
                                <span className="text-zinc-400 font-normal ml-1">(optional)</span>
                            </label>
                            <div className="space-y-2 flex-1 overflow-y-auto pr-1 min-h-[200px] max-h-[300px]">
                                {spaces.length === 0 ? (
                                    <p className="text-sm text-zinc-400 italic">No spaces available.</p>
                                ) : (
                                    spaces.map(space => {
                                        const isSelected = !!selectedSpaces[space.id];
                                        return (
                                            <div
                                                key={space.id}
                                                className={`border rounded-xl p-3 transition-all ${isSelected
                                                        ? 'border-emerald-400 bg-emerald-50/40'
                                                        : 'border-zinc-200 bg-white'
                                                    }`}
                                            >
                                                <div
                                                    className="flex items-center justify-between cursor-pointer"
                                                    onClick={() => toggleSpace(space.id)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected
                                                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                                                : 'border-zinc-300'
                                                            }`}>
                                                            {isSelected && <Check size={12} strokeWidth={3} />}
                                                        </div>
                                                        <span className="text-sm font-medium text-zinc-900">{space.name}</span>
                                                    </div>
                                                </div>

                                                {isSelected && (
                                                    <div className="mt-3 pt-3 border-t border-emerald-100 grid grid-cols-2 gap-2 pl-8">
                                                        {[
                                                            { key: 'can_view', label: 'View' },
                                                            { key: 'can_edit', label: 'Edit' },
                                                            { key: 'can_message_client', label: 'Message' },
                                                            { key: 'can_upload_files', label: 'Upload' },
                                                            { key: 'can_manage_tasks', label: 'Tasks' },
                                                        ].map(({ key, label }) => (
                                                            <label
                                                                key={key}
                                                                className="flex items-center gap-2 text-[11px] text-zinc-600 cursor-pointer"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    title={`Toggle ${label} capability`}
                                                                    checked={(selectedSpaces[space.id] as any)[key] ?? false}
                                                                    onChange={e => toggleCap(space.id, key, e.target.checked)}
                                                                    className="rounded text-emerald-500 focus:ring-emerald-500"
                                                                />
                                                                {label}
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-zinc-100">
                        <Button
                            type="button"
                            variant="ghost"
                            className="flex-1"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="flex-1"
                            disabled={loading || !email.trim()}
                        >
                            {loading ? 'Generating...' : 'Generate Invite Link'}
                        </Button>
                    </div>
                </form>
            </GlassCard>
        </div>
    );
};
