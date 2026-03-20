import React, { useState, useEffect } from 'react';
import { GlassCard, Heading, Button, Text } from '../UI';
import { X, Check, Copy, Rocket } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useToast } from '../../contexts/ToastContext';

interface InviteStaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    spaces: any[];
}

export const InviteStaffModal: React.FC<InviteStaffModalProps> = ({ isOpen, onClose, spaces }) => {
    const { showToast } = useToast();
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
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setEmail('');
            setRole('staff');
            setSelectedSpaces({});
            setLoading(false);
            setSent(false);
            setSentEmail('');
            setInviteLink('');
            setCopied(false);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return showToast('Email is required', 'error');

        const spaceAssignments = Object.entries(selectedSpaces).map(([space_id, capabilities]) => ({
            space_id,
            capabilities
        }));

        setLoading(true);
        try {
            const data = await apiService.generateStaffInviteLink(email.trim(), role, spaceAssignments);
            setInviteLink(data.invite_link);
            setSentEmail(email.trim());
            setSent(true);
        } catch (err: any) {
            showToast(err.message || 'Something went wrong.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ── Success state ──────────────────────────────────────────────────────
    if (sent) {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                <GlassCard className="max-w-md w-full p-10 text-center relative">
                    <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Rocket className="text-emerald-500" size={32} />
                    </div>
                    <Heading level={3} className="mb-2 text-zinc-900">Invite Created!</Heading>
                    <p className="text-zinc-500 mb-6 font-light">
                        Staff invite generated for <strong>{sentEmail}</strong>. Share the link below manually.
                    </p>
                    
                    <div className="space-y-4 mb-8">
                        <div className="flex gap-2">
                            <input 
                                readOnly 
                                title="Invitation Link"
                                value={inviteLink} 
                                className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5 text-xs font-mono text-zinc-600 focus:outline-none"
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
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest bg-zinc-50 py-1.5 rounded-full inline-block px-4 border border-zinc-100 italic">
                            Expires in 72 hours
                        </p>
                    </div>

                    <Button variant="primary" className="w-full py-4 text-sm font-black uppercase tracking-widest" onClick={onClose}>Done</Button>
                </GlassCard>
            </div>
        );
    }

    // ── Form state ─────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <GlassCard className="max-w-xl w-full p-8 relative max-h-[90vh] overflow-y-auto">
                <button
                    title="Close"
                    onClick={onClose}
                    className="absolute right-4 top-4 p-2 text-zinc-400 hover:text-zinc-900 rounded-full hover:bg-zinc-100 transition-colors"
                >
                    <X size={18} />
                </button>

                <Heading level={2} className="mb-6 text-zinc-900">Invite Team Member</Heading>

                <form onSubmit={handleSubmit} className="space-y-6">
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
                                    className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${role === r
                                            ? 'bg-emerald-500 border-emerald-500 text-white'
                                            : 'bg-white border-zinc-200 text-zinc-600 hover:border-emerald-300'
                                        }`}
                                >
                                    {r.charAt(0).toUpperCase() + r.slice(1)}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-zinc-400 mt-1.5">
                            {role === 'admin'
                                ? 'Admin can invite others, manage spaces, and view all data.'
                                : 'Staff can work within assigned spaces only.'}
                        </p>
                    </div>

                    {/* Space Assignments */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-3">
                            Assign Spaces & Capabilities
                            <span className="text-zinc-400 font-normal ml-1">(optional)</span>
                        </label>
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
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
                                                        { key: 'can_message_client', label: 'Message Client' },
                                                        { key: 'can_upload_files', label: 'Upload Files' },
                                                        { key: 'can_manage_tasks', label: 'Manage Tasks' },
                                                    ].map(({ key, label }) => (
                                                        <label
                                                            key={key}
                                                            className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer"
                                                        >
                                                            <input
                                                                type="checkbox"
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