import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button, Heading, Text } from '@/components/UI';
import { VeroMark } from '@/components/brand/VeroLogo';

export type InvitationDetails = {
  id: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  role: 'member' | 'admin';
  invited_email: string;
  expires_at: string;
  space_id: string;
  space_name: string;
  invited_by_name: string;
  invited_by_email: string;
};

type InvitationCardProps = {
  invitation: InvitationDetails;
  onJoin: () => void;
};

export const InvitationCard: React.FC<InvitationCardProps> = ({ invitation, onJoin }) => {
  const inviterName = invitation.invited_by_name || invitation.invited_by_email || 'Someone';
  const spaceName = invitation.space_name || 'this space';

  return (
    <section className="w-full max-w-[520px] rounded-[8px] border border-[#E6E6EB] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.10)] md:p-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#0D0D0D] text-white">
            <VeroMark tone="light" className="h-7 w-7" />
          </div>
          <span className="text-sm font-semibold text-[#0D0D0D]">Vero</span>
        </div>
        <span className="rounded-full border border-[#E6E6EB] bg-[#F7F7F8] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6E6E80]">
          Invite
        </span>
      </div>

      <div className="space-y-5">
        <Text size="sm" variant="secondary" className="font-medium">
          You've been invited by
        </Text>
        <Heading level={1} className="text-[2rem] leading-[1.05] md:text-[2.5rem]">
          {inviterName}
        </Heading>
        <Text size="lg" variant="secondary" className="leading-7">
          to join <span className="font-semibold text-[#0D0D0D]">{spaceName}</span>.
        </Text>
      </div>

      <div className="mt-8 border-t border-[#E6E6EB] pt-6">
        <Button type="button" variant="primary" size="lg" className="w-full rounded-[8px]" onClick={onJoin}>
          Join Space <ArrowRight size={16} />
        </Button>
      </div>
    </section>
  );
};
