import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/apiService';
import { useToast } from '../../contexts/ToastContext';
import { Invitation } from '../../types';
import { 
    GlassCard, Heading, Button, Modal, Input, Text as CustomText
} from '../UI/index';
import { 
    Clock, Mail, Shield, User, Trash2, Edit2, 
    CheckCircle, XCircle, AlertCircle, Copy, Link as LinkIcon, Rocket
} from 'lucide-react';

export const InvitationsManagementView: React.FC = () => {
    const { showToast } = useToast();
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Edit Modal State
    const [editingInvite, setEditingInvite] = useState<Invitation | null>(null);
    const [newEmail, setNewEmail] = useState('');
    const [saving, setSaving] = useState(false);
    const [newLink, setNewLink] = useState('');

    const fetchInvitations = async () => {
        setLoading(true);
        try {
            const data = await apiService.listSentInvitations();
            setInvitations(data);
        } catch (err: any) {
            showToast(err.message || 'Failed to fetch invitations', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvitations();
    }, []);

    const handleRevoke = async (token: string) => {
        if (!confirm('Are you sure you want to revoke this invitation? The link will stop working immediately.')) return;
        
        try {
            await apiService.revokeInvitation(token);
            showToast('Invitation revoked', 'success');
            fetchInvitations();
        } catch (err: any) {
            showToast(err.message || 'Failed to revoke invitation', 'error');
        }
    };

    const handleEditEmail = (invite: Invitation) => {
        setEditingInvite(invite);
        setNewEmail(invite.email);
        setNewLink('');
    };

    const handleSaveEmail = async () => {
        if (!editingInvite || !newEmail.trim()) return;
        if (newEmail.trim() === editingInvite.email) {
            setEditingInvite(null);
            return;
        }

        setSaving(true);
        try {
            const data = await apiService.updateInvitationEmail(editingInvite.token || '', newEmail.trim());
            showToast('Email updated successfully', 'success');
            setNewLink(data.invite_link);
            fetchInvitations();
        } catch (err: any) {
            showToast(err.message || 'Failed to update email', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCopy = (link: string) => {
        navigator.clipboard.writeText(link);
        showToast('Link copied to clipboard', 'success');
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'accepted': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'revoked': return 'bg-red-100 text-red-700 border-red-200';
            case 'expired': return 'bg-zinc-100 text-zinc-600 border-zinc-200';
            default: return 'bg-zinc-100 text-zinc-600 border-zinc-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <Clock size={12} />;
            case 'accepted': return <CheckCircle size={12} />;
            case 'revoked': return <XCircle size={12} />;
            case 'expired': return <AlertCircle size={12} />;
            default: return null;
        }
    };

    if (loading && invitations.length === 0) {
        return (
            <div className="space-y-4">
                <Heading level={2}>Invitations Library</Heading>
                {[1, 2, 3].map(i => (
                    <GlassCard key={i} className="h-20 animate-pulse bg-zinc-50">
                        <div className="h-full" />
                    </GlassCard>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-[fadeIn_0.5s_ease-out]">
            <div className="flex items-center justify-between">
                <div>
                    <Heading level={2}>Invitations Library</Heading>
                    <CustomText className="text-zinc-500 font-light">Monitor and manage all sent authority access links</CustomText>
                </div>
                <Button variant="outline" size="sm" onClick={fetchInvitations}><Clock size={16} className="mr-2" /> Refresh</Button>
            </div>

            <GlassCard className="overflow-hidden border-[#E5E5E5] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-zinc-50/50 border-b border-zinc-100">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Email</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Role</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Type</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Expires</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {invitations.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 italic font-light">
                                        No invitations found. Invite someone to see them here.
                                    </td>
                                </tr>
                            ) : (
                                invitations.map((invite) => (
                                    <tr key={invite.id} className="hover:bg-zinc-50/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 group-hover:bg-white group-hover:text-zinc-600 transition-all border border-transparent group-hover:border-zinc-200 shadow-sm">
                                                    <Mail size={14} />
                                                </div>
                                                <span className="text-sm font-medium text-zinc-900">{invite.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Shield size={12} className="text-zinc-400" />
                                                <span className="text-xs font-bold uppercase tracking-tight text-zinc-600">{invite.role}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-[10px] font-black uppercase px-2 py-1 bg-zinc-100 text-zinc-500 rounded border border-zinc-200/50 tracking-tighter">
                                                {invite.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border ${getStatusStyles(invite.status)}`}>
                                                {getStatusIcon(invite.status)}
                                                {invite.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs text-zinc-500 font-light italic">
                                                {new Date(invite.expires_at).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {invite.status === 'pending' ? (
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        title="Copy Link"
                                                        onClick={() => invite.token && handleCopy(`${window.location.origin}/join/${invite.token}`)}
                                                        className="p-1.5 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                                                    >
                                                        <LinkIcon size={16} />
                                                    </button>
                                                    <button 
                                                        title="Edit Email"
                                                        onClick={() => handleEditEmail(invite)}
                                                    className="p-1.5 text-[#6E6E80] hover:text-[#0D0D0D] hover:bg-[#F7F7F8] rounded-lg transition-all"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button 
                                                        title="Revoke"
                                                        onClick={() => invite.token && handleRevoke(invite.token)}
                                                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-zinc-300 italic text-[10px] font-black uppercase tracking-widest px-1">Sealed</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>

            {/* Edit Email Modal */}
            <Modal
                isOpen={!!editingInvite}
                onClose={() => setEditingInvite(null)}
                title="Update Invitation Identity"
            >
                <div className="space-y-6">
                    {newLink ? (
                        <div className="text-center py-6">
                            <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Rocket className="text-emerald-500" size={32} />
                            </div>
                            <Heading level={3} className="mb-2">Identity Updated!</Heading>
                            <CustomText className="text-zinc-500 mb-8">The invitation has been transferred to <strong>{newEmail}</strong>. Provide the new link below.</CustomText>
                            
                            <div className="flex gap-2 mb-8">
                                <input 
                                    readOnly 
                                    title="New Invitation Link"
                                    value={newLink} 
                                    className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5 text-xs font-mono text-zinc-600 focus:outline-none"
                                />
                                <Button 
                                    variant="outline"
                                    size="sm" 
                                    onClick={() => handleCopy(newLink)}
                                >
                                    Copy
                                </Button>
                            </div>
                            
                            <Button variant="primary" className="w-full" onClick={() => setEditingInvite(null)}>Done</Button>
                        </div>
                    ) : (
                        <>
                            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center gap-4">
                                <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center border border-zinc-200 shadow-sm text-zinc-400">
                                    <Mail size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Current Destination</p>
                                    <p className="text-sm font-bold text-zinc-900">{editingInvite?.email}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">New Email Destination</label>
                                <Input 
                                    type="email" 
                                    value={newEmail} 
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder="newemail@destination.com"
                                    className="w-full"
                                />
                                <p className="text-[10px] text-zinc-400 italic">Updating the email will invalidate the previous link and generate a fresh one for the new recipient.</p>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-zinc-100">
                                <Button variant="ghost" className="flex-1" onClick={() => setEditingInvite(null)} disabled={saving}>Cancel</Button>
                                <Button variant="primary" className="flex-1" onClick={handleSaveEmail} disabled={saving || !newEmail.trim() || newEmail === editingInvite?.email}>
                                    {saving ? 'Updating...' : 'Update & Reissue'}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
};
