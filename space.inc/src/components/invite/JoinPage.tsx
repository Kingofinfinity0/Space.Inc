import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Link as LinkIcon, LogOut, ShieldAlert } from 'lucide-react';
import { Button, Heading, Text } from '@/components/UI';
import { useAuth } from '@/contexts/AuthContext';
import { useJoinViaShareLink, useShareLinkByToken } from '@/hooks/useInvitationQueries';
import {
  getInviteErrorCode,
  getShareLinkStatusErrorCode,
  inviteErrorMessages,
  ShareLinkDetails,
} from './inviteTypes';

const JoinShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main className="min-h-screen bg-[#F7F7F8] px-4 py-8 text-[#0D0D0D] md:px-6">
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
      {children}
    </div>
  </main>
);

const JoinCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section className="w-full max-w-[540px] rounded-[8px] border border-[#E6E6EB] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.10)] md:p-8">
    {children}
  </section>
);

const isUuid = (value?: string | null) =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

const JoinLoading = () => (
  <JoinShell>
    <JoinCard>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="h-10 w-10 animate-pulse rounded-[8px] bg-[#ECECF1]" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-[#ECECF1]" />
      </div>
      <div className="space-y-4">
        <div className="h-4 w-36 animate-pulse rounded bg-[#ECECF1]" />
        <div className="h-10 w-4/5 animate-pulse rounded bg-[#ECECF1]" />
        <div className="h-6 w-2/3 animate-pulse rounded bg-[#ECECF1]" />
      </div>
      <div className="mt-8 h-11 w-full animate-pulse rounded-[8px] bg-[#ECECF1]" />
    </JoinCard>
  </JoinShell>
);

const InvalidJoinState: React.FC<{ message: string }> = ({ message }) => (
  <JoinShell>
    <JoinCard>
      <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-[8px] border border-[#E6E6EB] bg-[#F7F7F8] text-[#0D0D0D]">
        <ShieldAlert size={22} />
      </div>
      <div className="text-center">
        <Heading level={1} className="text-2xl md:text-3xl">
          Join link unavailable
        </Heading>
        <Text variant="secondary" className="mt-3 leading-6">
          {message}
        </Text>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#E6E6EB] bg-white px-4 text-sm font-medium text-[#0D0D0D] hover:bg-[#F7F7F8]" href="/login">
            Sign in
          </a>
          <a className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#0D0D0D] bg-[#0D0D0D] px-4 text-sm font-medium text-white" href="/signup">
            Sign up
          </a>
        </div>
      </div>
    </JoinCard>
  </JoinShell>
);

const JoinHeader = () => (
  <div className="mb-8 flex items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#0D0D0D] text-white">
        <LinkIcon size={20} />
      </div>
      <span className="text-sm font-semibold text-[#0D0D0D]">Space.inc</span>
    </div>
    <span className="rounded-full border border-[#E6E6EB] bg-[#F7F7F8] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6E6E80]">
      Join
    </span>
  </div>
);

const SignedOutJoinState: React.FC<{ shareLink: ShareLinkDetails; returnPath: string }> = ({ shareLink, returnPath }) => {
  const navigate = useNavigate();
  const redirectTo = encodeURIComponent(returnPath);

  return (
    <JoinShell>
      <JoinCard>
        <JoinHeader />
        <Text size="sm" variant="secondary" className="font-medium">
          You've been invited to join
        </Text>
        <Heading level={1} className="mt-4 text-[2rem] leading-[1.05] md:text-[2.5rem]">
          {shareLink.space_name}
        </Heading>
        <Text size="lg" variant="secondary" className="mt-5 leading-7">
          Sign in or sign up to join as <span className="font-semibold text-[#0D0D0D]">{shareLink.default_role}</span> ({shareLink.default_member_type}).
        </Text>
        <div className="mt-8 grid gap-3 border-t border-[#E6E6EB] pt-6 sm:grid-cols-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate(`/login?redirectTo=${redirectTo}`)}>
            Sign in
          </Button>
          <Button type="button" variant="primary" className="rounded-full" onClick={() => navigate(`/signup?redirectTo=${redirectTo}`)}>
            Sign up
          </Button>
        </div>
      </JoinCard>
    </JoinShell>
  );
};

const DomainMismatchState: React.FC<{ domain: string; returnPath: string }> = ({ domain, returnPath }) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const switchAccount = async () => {
    await signOut();
    navigate(`/login?redirectTo=${encodeURIComponent(returnPath)}`, { replace: true });
  };

  return (
    <JoinShell>
      <JoinCard>
        <JoinHeader />
        <Heading level={1} className="text-2xl md:text-3xl">
          Email domain required
        </Heading>
        <Text variant="secondary" className="mt-3 leading-6">
          This link only allows @{domain} email addresses.
        </Text>
        <div className="mt-8 border-t border-[#E6E6EB] pt-6">
          <Button type="button" variant="primary" className="w-full rounded-[8px]" onClick={switchAccount}>
            <LogOut size={16} />
            Sign out and switch account
          </Button>
        </div>
      </JoinCard>
    </JoinShell>
  );
};

const ActiveJoinState: React.FC<{ shareLink: ShareLinkDetails; token: string }> = ({ shareLink, token }) => {
  const navigate = useNavigate();
  const { refreshContexts, refreshCapabilities } = useAuth();
  const join = useJoinViaShareLink();
  const errorCode = getInviteErrorCode(join.error);

  const submit = async () => {
    try {
      const result = await join.mutateAsync(token);
      await refreshContexts();
      await refreshCapabilities();
      const targetSpaceId = isUuid(result?.space_id) ? result.space_id : shareLink.space_id;
      navigate(`/spaces/${targetSpaceId}`, { replace: true });
    } catch (error) {
      const code = getInviteErrorCode(error);
      if (code === 'NOT_AUTHENTICATED') {
        navigate(`/login?redirectTo=${encodeURIComponent(`/join/${token}`)}`, { replace: true });
      }
    }
  };

  return (
    <JoinShell>
      <JoinCard>
        <JoinHeader />
        <Text size="sm" variant="secondary" className="font-medium">
          Ready to join
        </Text>
        <Heading level={1} className="mt-4 text-[2rem] leading-[1.05] md:text-[2.5rem]">
          {shareLink.space_name}
        </Heading>
        <Text size="lg" variant="secondary" className="mt-5 leading-7">
          Join as <span className="font-semibold text-[#0D0D0D]">{shareLink.default_role}</span> ({shareLink.default_member_type}).
        </Text>
        {errorCode ? (
          <div className="mt-6 rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B42318]">
            {inviteErrorMessages[errorCode]}
          </div>
        ) : null}
        <div className="mt-8 border-t border-[#E6E6EB] pt-6">
          <Button type="button" variant="primary" size="lg" className="w-full rounded-[8px]" isLoading={join.isPending} onClick={submit}>
            Join space <ArrowRight size={16} />
          </Button>
        </div>
      </JoinCard>
    </JoinShell>
  );
};

export const JoinPage: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const shareLinkQuery = useShareLinkByToken(token);
  const returnPath = useMemo(() => `/join/${encodeURIComponent(token)}`, [token]);

  if (!token) return <InvalidJoinState message={inviteErrorMessages.SHARE_LINK_NOT_FOUND} />;
  if (shareLinkQuery.isLoading || loading) return <JoinLoading />;

  const queryErrorCode = getInviteErrorCode(shareLinkQuery.error);
  if (queryErrorCode) return <InvalidJoinState message={inviteErrorMessages[queryErrorCode]} />;

  const shareLink = shareLinkQuery.data || null;
  const statusErrorCode = getShareLinkStatusErrorCode(shareLink);
  if (statusErrorCode) return <InvalidJoinState message={inviteErrorMessages[statusErrorCode]} />;

  if (!shareLink) return <InvalidJoinState message={inviteErrorMessages.SHARE_LINK_NOT_FOUND} />;
  if (!user) return <SignedOutJoinState shareLink={shareLink} returnPath={returnPath} />;

  const domain = shareLink.allowed_email_domain;
  const currentDomain = (user.email || '').split('@')[1]?.toLowerCase();
  if (domain && currentDomain !== domain.toLowerCase()) {
    return <DomainMismatchState domain={domain} returnPath={returnPath} />;
  }

  return <ActiveJoinState shareLink={shareLink} token={token} />;
};
