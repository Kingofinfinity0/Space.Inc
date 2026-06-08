import React, { useState } from 'react';
import { Copy, RefreshCw, Trash2 } from 'lucide-react';
import { Button, LoadingScreen, useLoadingScreenGate } from '@/components/UI';
import { usePendingInvitations } from '@/hooks/useInvitationQueries';
import { getInvitationId, InvitationRow } from './inviteTypes';
import { RegenerateConfirmDialog } from './RegenerateConfirmDialog';
import { RevokeConfirmDialog } from './RevokeConfirmDialog';

type InviteListTableProps = {
  spaceId: string;
};

export const InviteListTable: React.FC<InviteListTableProps> = ({ spaceId }) => {
  const { data = [], isLoading, error } = usePendingInvitations(spaceId);
  const [regenerating, setRegenerating] = useState<InvitationRow | null>(null);
  const [revoking, setRevoking] = useState<InvitationRow | null>(null);
  const loadingGate = useLoadingScreenGate(isLoading);

  if (loadingGate.isVisible) {
    return (
      <LoadingScreen
        key={loadingGate.cycleKey}
        message="Loading invitations..."
        isComplete={loadingGate.isComplete}
        onExitComplete={loadingGate.handleExitComplete}
      />
    );
  }

  if (error) {
    return (
      <div className="rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B42318]">
        Failed to load pending invitations.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-[8px] border border-[#E5E5E5] bg-white">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#F7F7F8]">
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Email</th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Type</th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Role</th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Expires</th>
              <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F2]">
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-[#6E6E80]">
                  No pending invitations.
                </td>
              </tr>
            ) : (
              data.map((invite) => (
                <tr key={getInvitationId(invite)} className="hover:bg-[#FAFAFB]">
                  <td className="px-4 py-3 text-sm font-medium text-[#0D0D0D]">{invite.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0D0D0D]">
                      {invite.member_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6E6E80]">{invite.role}</td>
                  <td className="px-4 py-3 text-sm text-[#6E6E80]">
                    {invite.expires_at ? new Date(invite.expires_at).toLocaleString() : 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-[8px]"
                        disabled
                        title="Existing raw tokens cannot be retrieved. Regenerate to show a new copyable link."
                      >
                        <Copy size={14} />
                        Copy link
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="rounded-[8px]" onClick={() => setRegenerating(invite)}>
                        <RefreshCw size={14} />
                        Regenerate
                      </Button>
                      <Button type="button" variant="danger" size="sm" className="rounded-[8px]" onClick={() => setRevoking(invite)}>
                        <Trash2 size={14} />
                        Revoke
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <RegenerateConfirmDialog invitation={regenerating} spaceId={spaceId} onClose={() => setRegenerating(null)} />
      <RevokeConfirmDialog invitation={revoking} spaceId={spaceId} onClose={() => setRevoking(null)} />
    </>
  );
};
