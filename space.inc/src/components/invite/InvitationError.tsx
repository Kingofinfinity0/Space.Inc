import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Heading, Text } from '@/components/UI';

export type InvitationErrorType =
  | 'invalid'
  | 'expired'
  | 'revoked'
  | 'accepted'
  | 'space_mismatch'
  | 'accept_failed'
  | 'membership_failed'
  | 'wrong_email'
  | 'redirect_lost'
  | 'final_redirect_failed';

const invitationErrorMessages: Record<InvitationErrorType, string> = {
  invalid: 'This invitation link is not valid.',
  expired: 'This invitation has expired. Ask for a new invite link.',
  revoked: 'This invitation was revoked by the sender.',
  accepted: 'This invitation has already been accepted.',
  space_mismatch: 'This invitation does not belong to the selected space.',
  accept_failed: 'We couldn\'t accept this invitation right now. Please try again.',
  membership_failed: 'Your account was verified, but we couldn\'t add you to the space.',
  wrong_email: 'You\'re signed in with the wrong email address for this invitation.',
  redirect_lost: 'We couldn\'t resume your invitation after sign-in. Please reopen the invite link.',
  final_redirect_failed: 'Your invitation was accepted, but we couldn\'t open the space.',
};

type InvitationErrorProps = {
  errorType: InvitationErrorType;
};

export const InvitationError: React.FC<InvitationErrorProps> = ({ errorType }) => {
  return (
    <section className="w-full max-w-[480px] rounded-[8px] border border-[#E6E6EB] bg-white p-6 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-8">
      <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-[8px] border border-[#E6E6EB] bg-[#F7F7F8] text-[#0D0D0D]">
        <AlertCircle size={22} />
      </div>
      <Heading level={1} className="text-2xl md:text-3xl">
        Invitation unavailable
      </Heading>
      <Text variant="secondary" className="mt-3 leading-6">
        {invitationErrorMessages[errorType]}
      </Text>
      <Link
        to="/login"
        className="mt-7 inline-flex h-10 items-center justify-center rounded-[8px] border border-[#E6E6EB] bg-white px-4 text-sm font-medium text-[#0D0D0D] transition-colors hover:bg-[#F7F7F8]"
      >
        Go to login
      </Link>
    </section>
  );
};
