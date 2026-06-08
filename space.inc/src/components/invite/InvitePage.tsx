import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, LogOut, ShieldAlert } from 'lucide-react';
import { Button, Heading, LoadingScreen, Text, useLoadingScreenGate } from '@/components/UI';
import { useAuth } from '@/contexts/AuthContext';
import { useAcceptInvitation, useInvitationByToken } from '@/hooks/useInvitationQueries';
import { VeroMark } from '@/components/brand/VeroLogo';
import {
  getInviteErrorCode,
  getInviteStatusErrorCode,
  inviteErrorMessages,
  InvitationDetails,
} from './inviteTypes';

const InviteShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main className="min-h-screen bg-[#F7F7F8] px-4 py-8 text-[#0D0D0D] md:px-6">
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
      {children}
    </div>
  </main>
);

const InviteCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section className="w-full max-w-[540px] rounded-[8px] border border-[#E6E6EB] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.10)] md:p-8">
    {children}
  </section>
);

const isUuid = (value?: string | null) =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

const getInviteTargetName = (invitation: InvitationDetails) =>
  invitation.member_type === 'staff'
    ? invitation.organization_name || invitation.space_name
    : invitation.space_name;

const getInviteRoleLabel = (invitation: InvitationDetails) => {
  if (invitation.member_type === 'staff') {
    if (invitation.role === 'admin') return 'admin';
    if (invitation.role === 'owner') return 'owner';
    return 'staff member';
  }

  if (invitation.role === 'viewer') return 'viewer';
  return 'member';
};

const InvalidInviteState: React.FC<{ message: string; accepted?: boolean }> = ({ message, accepted }) => (
  <InviteShell>
    <InviteCard>
      <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-[8px] border border-[#E6E6EB] bg-[#F7F7F8] text-[#0D0D0D]">
        <ShieldAlert size={22} />
      </div>
      <div className="text-center">
        <Heading level={1} className="text-2xl md:text-3xl">
          Invitation unavailable
        </Heading>
        <Text variant="secondary" className="mt-3 leading-6">
          {message}
        </Text>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#E6E6EB] bg-white px-4 text-sm font-medium text-[#0D0D0D] hover:bg-[#F7F7F8]" href="/login">
            Sign in
          </a>
          {!accepted ? (
          <a className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#0D0D0D] bg-[#0D0D0D] px-4 text-sm font-medium text-white" href="/signup">
              Sign up
            </a>
          ) : null}
        </div>
      </div>
    </InviteCard>
  </InviteShell>
);

const InviteHeader: React.FC = () => (
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
);

const SignedOutInviteState: React.FC<{ invitation: InvitationDetails; returnPath: string }> = ({ invitation, returnPath }) => {
  const navigate = useNavigate();
  const encodedReturnPath = encodeURIComponent(returnPath);
  const targetName = getInviteTargetName(invitation);
  const roleLabel = getInviteRoleLabel(invitation);

  return (
    <InviteShell>
      <InviteCard>
        <InviteHeader />
        <div className="space-y-5">
          <Text size="sm" variant="secondary" className="font-medium">
            You've been invited to
          </Text>
          <Heading level={1} className="text-[2rem] leading-[1.05] md:text-[2.5rem]">
            {targetName}
          </Heading>
          <Text size="lg" variant="secondary" className="leading-7">
            Sign in or sign up to accept as <span className="font-semibold text-[#0D0D0D]">{roleLabel}</span>.
          </Text>
        </div>
        <div className="mt-8 grid gap-3 border-t border-[#E6E6EB] pt-6 sm:grid-cols-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate(`/login?redirectTo=${encodedReturnPath}`)}>
            Sign in
          </Button>
          <Button type="button" variant="primary" className="rounded-full" onClick={() => navigate(`/signup?redirectTo=${encodedReturnPath}`)}>
            Sign up
          </Button>
        </div>
      </InviteCard>
    </InviteShell>
  );
};

const WrongAccountState: React.FC<{ returnPath: string }> = ({ returnPath }) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const switchAccount = async () => {
    await signOut();
    navigate(`/login?redirectTo=${encodeURIComponent(returnPath)}`, { replace: true });
  };

  return (
    <InviteShell>
      <InviteCard>
        <InviteHeader />
        <Heading level={1} className="text-2xl md:text-3xl">
          Wrong account
        </Heading>
        <Text variant="secondary" className="mt-3 leading-6">
          This invitation is for a different account. Sign out and switch accounts to continue.
        </Text>
        <div className="mt-8 border-t border-[#E6E6EB] pt-6">
          <Button type="button" variant="primary" className="w-full rounded-[8px]" onClick={switchAccount}>
            <LogOut size={16} />
            Sign out and switch account
          </Button>
        </div>
      </InviteCard>
    </InviteShell>
  );
};

const AcceptInviteState: React.FC<{ invitation: InvitationDetails; token: string }> = ({ invitation, token }) => {
  const navigate = useNavigate();
  const { refreshContexts, refreshCapabilities } = useAuth();
  const acceptInvitation = useAcceptInvitation();
  const errorCode = getInviteErrorCode(acceptInvitation.error);
  const targetName = getInviteTargetName(invitation);
  const roleLabel = getInviteRoleLabel(invitation);

  const accept = async () => {
    try {
      const result = await acceptInvitation.mutateAsync(token);
      await refreshContexts();
      await refreshCapabilities();
      const targetSpaceId = isUuid(result.space_id) ? result.space_id : invitation.space_id;
      navigate(invitation.member_type === 'staff' ? '/dashboard' : `/spaces/${targetSpaceId}`, { replace: true });
    } catch (error) {
      const code = getInviteErrorCode(error);
      if (code === 'NOT_AUTHENTICATED') {
        navigate(`/login?redirectTo=${encodeURIComponent(`/invite/${token}`)}`, { replace: true });
      }
    }
  };

  if (errorCode === 'ALREADY_MEMBER') {
    return (
      <InvalidInviteState message={inviteErrorMessages.ALREADY_MEMBER} />
    );
  }

  return (
    <InviteShell>
      <InviteCard>
        <InviteHeader />
        <div className="space-y-5">
          <Text size="sm" variant="secondary" className="font-medium">
            Ready to join
          </Text>
          <Heading level={1} className="text-[2rem] leading-[1.05] md:text-[2.5rem]">
            {targetName}
          </Heading>
          <Text size="lg" variant="secondary" className="leading-7">
            Accept this invitation as <span className="font-semibold text-[#0D0D0D]">{roleLabel}</span>.
          </Text>
        </div>
        {errorCode && errorCode !== 'NOT_AUTHENTICATED' ? (
          <div className="mt-6 rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B42318]">
            {inviteErrorMessages[errorCode]}
          </div>
        ) : null}
        <div className="mt-8 border-t border-[#E6E6EB] pt-6">
          <Button type="button" variant="primary" size="lg" className="w-full rounded-[8px]" isLoading={acceptInvitation.isPending} onClick={accept}>
            Accept invitation <ArrowRight size={16} />
          </Button>
        </div>
      </InviteCard>
    </InviteShell>
  );
};

export const InvitePage: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const inviteQuery = useInvitationByToken(token);
  const returnPath = useMemo(() => `/invite/${encodeURIComponent(token)}`, [token]);
  const loadingGate = useLoadingScreenGate(inviteQuery.isLoading || loading);

  if (!token) {
    return <InvalidInviteState message={inviteErrorMessages.INVITE_NOT_FOUND} />;
  }

  if (loadingGate.isVisible) {
    return (
      <LoadingScreen
        key={loadingGate.cycleKey}
        message="Loading invitation..."
        isComplete={loadingGate.isComplete}
        onExitComplete={loadingGate.handleExitComplete}
      />
    );
  }

  const queryErrorCode = getInviteErrorCode(inviteQuery.error);
  if (queryErrorCode) {
    return <InvalidInviteState message={inviteErrorMessages[queryErrorCode]} accepted={queryErrorCode === 'INVITE_ALREADY_ACCEPTED'} />;
  }

  const invitation = inviteQuery.data || null;
  const statusErrorCode = getInviteStatusErrorCode(invitation);
  if (statusErrorCode) {
    return <InvalidInviteState message={inviteErrorMessages[statusErrorCode]} accepted={statusErrorCode === 'INVITE_ALREADY_ACCEPTED'} />;
  }

  if (!invitation) {
    return <InvalidInviteState message={inviteErrorMessages.INVITE_NOT_FOUND} />;
  }

  if (!user) {
    return <SignedOutInviteState invitation={invitation} returnPath={returnPath} />;
  }

  const currentEmail = user.email || '';
  if (currentEmail.toLowerCase() !== invitation.email.toLowerCase()) {
    return <WrongAccountState returnPath={returnPath} />;
  }

  return <AcceptInviteState invitation={invitation} token={token} />;
};
