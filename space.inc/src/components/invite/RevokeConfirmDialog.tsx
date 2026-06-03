import React, { useState } from 'react';
import { Button, Modal, Text } from '@/components/UI';
import { useRevokeInvitation } from '@/hooks/useInvitationQueries';
import { getInvitationId, getInviteErrorCode, inviteErrorMessages, InvitationRow } from './inviteTypes';

type RevokeConfirmDialogProps = {
  invitation: InvitationRow | null;
  spaceId: string;
  onClose: () => void;
};

export const RevokeConfirmDialog: React.FC<RevokeConfirmDialogProps> = ({ invitation, spaceId, onClose }) => {
  const revoke = useRevokeInvitation(spaceId);
  const [error, setError] = useState('');

  const close = () => {
    setError('');
    revoke.reset();
    onClose();
  };

  const confirm = async () => {
    if (!invitation) return;
    setError('');
    try {
      await revoke.mutateAsync(getInvitationId(invitation));
      close();
    } catch (err) {
      const code = getInviteErrorCode(err);
      setError(code ? inviteErrorMessages[code] : 'Failed to revoke invitation.');
    }
  };

  return (
    <Modal isOpen={Boolean(invitation)} onClose={close} title="Revoke invite">
      <div className="space-y-5">
        <Text variant="secondary" className="leading-6">
          This will stop the invitation for {invitation?.email || 'this recipient'} from being accepted.
        </Text>
        {error ? (
          <div className="rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B42318]">
            {error}
          </div>
        ) : null}
        <div className="flex gap-3 border-t border-[#E5E5E5] pt-5">
          <Button type="button" variant="ghost" className="flex-1 rounded-[8px]" onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            className="flex-1 rounded-[8px]"
            isLoading={revoke.isPending}
            onClick={confirm}
          >
            Revoke
          </Button>
        </div>
      </div>
    </Modal>
  );
};
