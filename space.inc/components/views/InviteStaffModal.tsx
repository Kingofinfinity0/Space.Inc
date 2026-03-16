import React, { useState, useEffect } from 'react';
import { GlassCard, Heading, Button, Text } from '../UI';
import { X, Check } from 'lucide-react';
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
    const [selectedSpaces, setSelectedSpaces] = useState<Record<string, { can_view: boolean; can_edit: boolean; is_client_portal: boolean }>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setEmail('');
            setRole('staff');
            setSelectedSpaces({});
            setLoading(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const toggleSpace = (spaceId: string) => {
        const next = { ...selectedSpaces };
        if (next[spaceId]) {
            delete next[spaceId];
        } else {
            next[spaceId] = { can_view: true, can_edit: false, is_client_portal: false };
        }
        setSelectedSpaces(next);
    };

    const updateCapability = (spaceId: string, cap: 'can_view' | 'can_edit' | 'is_client_portal', value: boolean) => {
        setSelectedSpaces(prev => ({
            ...prev,
            [spaceId]: { ...prev[spaceId], [cap]: value }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return showToast("Email is required", "error");

        setLoading(true);
        try {
            const spaceAssignments = Object.entries(selectedSpaces).map(([space_id, capabilities]) => ({
                space_id,
                capabilities
            }));

            const { data, error } = await apiService.sendStaffInvitation(email, role, spaceAssignments);
            
            if (error) {
                // Check quota stub
                if (error.message?.includes('quota') || error.message?.includes('Plan limit')) {
                    showToast("Plan limit reached — upgrade coming soon", "error");
                } else {
                    showToast(`Failed to send invite: ${error.message}`, "error");
                }
            } else {
                showToast(`Invite sent to ${email}`, "success");
                onClose();
            }
        } catch (err: any) {
            showToast("Plan limit reached — upgrade coming soon", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <GlassCard className="max-w-xl w-full p-8 relative max-h-[90vh] overflow-y-auto">
                <button title="Close" onClick={onClose} className="absolute right-4 top-4 p-2 text-zinc-500 hover:text-zinc-900 rounded-full hover:bg-zinc-100 transition-colors">
                    <X size={18} />
                </button>
                <Heading level={2} className="mb-6 text-zinc-900">Invite Team Member</Heading>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Email Address</label>
                        <input 
                            title="Email"
                            type="email" 
                            required 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            placeholder="colleague@company.com"
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Role</label>
                        <select 
                            title="Role"
                            value={role} 
                            onChange={e => setRole(e.target.value as any)}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        >
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-3">Assign Spaces & Capabilities</label>
                        <div className="space-y-3">
                            {spaces.map(space => {
                                const isSelected = !!selectedSpaces[space.id];
                                return (
                                    <div key={space.id} className={`border rounded-xl p-4 transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50/30' : 'border-zinc-200 bg-white'}`}>
                                        <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSpace(space.id)}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-300'}`}>
                                                    {isSelected && <Check size={14} />}
                                                </div>
                                                <Text className="font-medium text-zinc-900">{space.name}</Text>
                                            </div>
                                        </div>

                                        {isSelected && (
                                            <div className="mt-4 pt-4 border-t border-emerald-100 flex flex-wrap gap-4 pl-8">
                                                <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                                                    <input type="checkbox" checked={selectedSpaces[space.id].can_view} onChange={e => updateCapability(space.id, 'can_view', e.target.checked)} className="rounded text-emerald-500 focus:ring-emerald-500" />
                                                    Can View
                                                </label>
                                                <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                                                    <input type="checkbox" checked={selectedSpaces[space.id].can_edit} onChange={e => updateCapability(space.id, 'can_edit', e.target.checked)} className="rounded text-emerald-500 focus:ring-emerald-500" />
                                                    Can Edit
                                                </label>
                                                <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                                                    <input type="checkbox" checked={selectedSpaces[space.id].is_client_portal} onChange={e => updateCapability(space.id, 'is_client_portal', e.target.checked)} className="rounded text-emerald-500 focus:ring-emerald-500" />
                                                    Is Client Portal
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {spaces.length === 0 && <Text className="text-zinc-500 italic">No spaces available to assign.</Text>}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-zinc-100">
                        <Button variant="ghost" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
                        <Button variant="primary" className="flex-1" type="submit" disabled={loading || !email}>
                            {loading ? 'Sending...' : 'Send Invitation'}
                        </Button>
                    </div>
                </form>
            </GlassCard>
        </div>
    );
};
