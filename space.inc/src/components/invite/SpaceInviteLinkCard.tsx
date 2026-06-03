import React, { useState } from 'react';
import { Link as LinkIcon, RefreshCw } from 'lucide-react';
import { Button, Text } from '@/components/UI';
import { useRotateShareLink, useShareLink } from '@/hooks/useInvitationQueries';
import { CopyableTokenField } from './CopyableTokenField';
import { getInviteErrorCode, inviteErrorMessages } from './inviteTypes';

type SpaceInviteLinkCardProps = {
  spaceId: string;
};

export const SpaceInviteLinkCard: React.FC<SpaceInviteLinkCardProps> = ({ spaceId }) => {
  const { data, isLoading, error } = useShareLink(spaceId);
  const rotate = useRotateShareLink(spaceId);
  const [rawToken, setRawToken] = useState('');

  const errorCode = getInviteErrorCode(error || rotate.error);
  const errorMessage = errorCode ? inviteErrorMessages[errorCode] : null;

  const regenerate = async () => {
    const result = await rotate.mutateAsync();
    setRawToken(result?.raw_token || '');
  };

  return (
    <section className="rounded-[8px] border border-[#E5E5E5] bg-[#FAFAFB] p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-white text-[#0D0D0D]">
            <LinkIcon size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0D0D0D]">Space invite link</p>
            <Text variant="secondary" size="sm" className="mt-1 leading-5">
              Every space has one standing join link. Regenerating it kills the previous link and shows the new one once.
            </Text>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E6E80]">
              <span className="rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1">
                {isLoading ? 'loading' : data?.is_active ? 'enabled' : 'disabled'}
              </span>
              <span className="rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1">
                {data?.default_member_type || 'client'}
              </span>
              <span className="rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1">
                {data?.default_role || 'member'}
              </span>
              <span className="rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1">
                {data?.use_count ?? 0} uses
              </span>
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-[8px] md:shrink-0"
          onClick={regenerate}
          isLoading={rotate.isPending}
          disabled={isLoading}
          title="Invalidate the previous space invite link and show a new copyable link once."
        >
          <RefreshCw size={16} />
          Regenerate link
        </Button>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B42318]">
          {errorMessage}
        </div>
      ) : null}

      {rawToken ? (
        <div className="mt-4 rounded-[8px] border border-[#E5E5E5] bg-white p-4">
          <CopyableTokenField rawToken={rawToken} linkType="join" label="New space invite link" />
        </div>
      ) : null}
    </section>
  );
};
