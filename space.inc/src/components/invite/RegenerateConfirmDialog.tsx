import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, Modal, Text } from '@/components/UI';
import { useRegenerateInvitation } from '@/hooks/useInvitationQueries';
import { getInvitationId, getInviteErrorCode, inviteErrorMessages, InvitationRow } from './inviteTypes';
import { CopyableTokenField } from './CopyableTokenField';

type RegenerateConfirmDialogProps = {
  invitation: InvitationRow | null;
  spaceId: string;
  onClose: () => void;
};

export const RegenerateConfirmDialog: React.FC<RegenerateConfirmDialogProps> = ({ invitation, spaceId, onClose }) => {
  const regenerate = useRegenerateInvitation(spaceId);
  const [rawToken, setRawToken] = useState('');
  const [error, setError] = useState('');

  const closeAndClear = () => {
    setRawToken('');
    setError('');
    regenerate.reset();
    onClose();
  };

  const confirm = async () => {
    if (!invitation) return;
    setError('');
    try {
      const result = await regenerate.mutateAsync(getInvitationId(invitation));
      setRawToken(result?.raw_token || '');
    } catch (err) {
      const code = getInviteErrorCode(err);
      setError(code ? inviteErrorMessages[code] : 'Failed to regenerate invitation.');
    }
  };

  return (
    <Modal isOpen={Boolean(invitation)} onClose={closeAndClear} title="Regenerate invite">
      {rawToken ? (
        <div className="space-y-5">
          <div className="rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#0D0D0D]">
              <RefreshCw size={16} />
              New link generated
            </div>
            <Text variant="secondary" size="sm">
              The previous link no longer works. Closing this dialog clears the new token from the app.
            </Text>
          </div>
          <CopyableTokenField rawToken={rawToken} />
          <Button type="button" variant="primary" className="w-full rounded-[8px]" onClick={closeAndClear}>
            Done
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <Text variant="secondary" className="leading-6">
            Regenerating this invitation stops the old link from working immediately. The new link will be shown once.
          </Text>
          {error ? (
            <div className="rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B42318]">
              {error}
            </div>
          ) : null}
          <div className="flex gap-3 border-t border-[#E5E5E5] pt-5">
            <Button type="button" variant="ghost" className="flex-1 rounded-[8px]" onClick={closeAndClear}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              className="flex-1 rounded-[8px]"
              isLoading={regenerate.isPending}
              onClick={confirm}
            >
              Regenerate
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
