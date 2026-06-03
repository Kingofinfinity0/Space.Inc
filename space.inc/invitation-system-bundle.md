

===== src\components\invite\InvitationLandingPage.tsx =====
```
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { InvitationCard, InvitationDetails } from './InvitationCard';
import { InvitationError, InvitationErrorType } from './InvitationError';
import { getInviteAcceptPath } from '@/lib/inviteRedirect';

type InvitationState =
  | { status: 'loading' }
  | { status: 'ready'; invitation: InvitationDetails }
  | { status: 'error'; errorType: InvitationErrorType };

const InvitationLoading = () => (
  <section className="w-full max-w-[520px] rounded-[8px] border border-[#E6E6EB] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-8">
    <div className="mb-8 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-[8px] bg-[#ECECF1]" />
        <div className="h-4 w-20 animate-pulse rounded bg-[#ECECF1]" />
      </div>
      <div className="h-6 w-16 animate-pulse rounded-full bg-[#ECECF1]" />
    </div>
    <div className="space-y-4">
      <div className="h-4 w-36 animate-pulse rounded bg-[#ECECF1]" />
      <div className="h-10 w-4/5 animate-pulse rounded bg-[#ECECF1]" />
      <div className="h-6 w-2/3 animate-pulse rounded bg-[#ECECF1]" />
    </div>
    <div className="mt-8 border-t border-[#E6E6EB] pt-6">
      <div className="h-11 w-full animate-pulse rounded-[8px] bg-[#ECECF1]" />
    </div>
  </section>
);

const getErrorType = (invitation: InvitationDetails, spaceId: string): InvitationErrorType | null => {
  if (invitation.space_id !== spaceId) return 'space_mismatch';
  if (invitation.status === 'pending' && new Date(invitation.expires_at) < new Date()) return 'expired';
  if (invitation.status === 'expired') return 'expired';
  if (invitation.status === 'revoked') return 'revoked';
  if (invitation.status === 'accepted') return 'accepted';
  if (invitation.status !== 'pending') return 'invalid';
  return null;
};

const phaseFourErrorTypes: InvitationErrorType[] = [
  'accept_failed',
  'membership_failed',
  'space_mismatch',
  'wrong_email',
  'redirect_lost',
  'final_redirect_failed',
];

const getPhaseFourErrorType = (errorCode: string | null): InvitationErrorType | null => {
  if (!errorCode) return null;
  return phaseFourErrorTypes.includes(errorCode as InvitationErrorType)
    ? (errorCode as InvitationErrorType)
    : null;
};

export const InvitationLandingPage: React.FC = () => {
  const params = useParams<{ spaceId: string; token: string }>();
  const [searchParams] = useSearchParams();
  const spaceId = searchParams.get('spaceId') || params.spaceId;
  const token = searchParams.get('token') || params.token;
  const phaseFourError = getPhaseFourErrorType(searchParams.get('error'));
  const navigate = useNavigate();
  const [invitationState, setInvitationState] = useState<InvitationState>({ status: 'loading' });

  useEffect(() => {
    let isMounted = true;

    const loadInvitation = async () => {
      if (!spaceId || !token) {
        setInvitationState({ status: 'error', errorType: 'invalid' });
        return;
      }

      if (phaseFourError) {
        setInvitationState({ status: 'error', errorType: phaseFourError });
        return;
      }

      setInvitationState({ status: 'loading' });

      const { data, error } = await supabase.rpc('get_invitation_by_token', {
        p_token: token,
        p_space_id: spaceId,
      });

      if (!isMounted) return;

      if (error || !data) {
        setInvitationState({ status: 'error', errorType: 'invalid' });
        return;
      }

      const invitation = data as InvitationDetails;
      const errorType = getErrorType(invitation, spaceId);

      if (errorType) {
        setInvitationState({ status: 'error', errorType });
        return;
      }

      setInvitationState({ status: 'ready', invitation });
    };

    loadInvitation();

    return () => {
      isMounted = false;
    };
  }, [phaseFourError, spaceId, token]);

  const handleJoinSpace = useCallback(() => {
    if (!spaceId || !token) return;

    const acceptPath = getInviteAcceptPath(spaceId, token);
    navigate(`/login?redirectTo=${encodeURIComponent(acceptPath)}`);
  }, [navigate, spaceId, token]);

  return (
    <main className="min-h-screen bg-[#F7F7F8] px-4 py-8 text-[#0D0D0D] md:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        {invitationState.status === 'loading' ? <InvitationLoading /> : null}
        {invitationState.status === 'error' ? <InvitationError errorType={invitationState.errorType} /> : null}
        {invitationState.status === 'ready' ? (
          <InvitationCard invitation={invitationState.invitation} onJoin={handleJoinSpace} />
        ) : null}
      </div>
    </main>
  );
};

```


===== src\components\invite\InvitationAcceptPage.tsx =====
```
import React, { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/apiService';
import { getAvailableContexts } from '@/lib/contextReadiness';
import { getInviteAcceptPath, getInviteLandingPath } from '@/lib/inviteRedirect';

const mapAcceptErrorCode = (error: unknown) => {
  const code = String((error as any)?.code || (error as any)?.error_code || (error as any)?.message || '').toUpperCase();

  if (code.includes('MEMBERSHIP')) return 'membership_failed';
  if (code.includes('SPACE') && code.includes('MISMATCH')) return 'space_mismatch';
  if (code.includes('WRONG_EMAIL') || code.includes('EMAIL')) return 'wrong_email';
  if (code.includes('REDIRECT_LOST')) return 'redirect_lost';
  if (code.includes('FINAL_REDIRECT')) return 'final_redirect_failed';

  return 'accept_failed';
};

const InvitationAcceptLoading = () => (
  <main className="flex min-h-screen items-center justify-center bg-[#FFFFFF] p-6 text-[#0D0D0D]">
    <div className="flex flex-col items-center gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E5E5E5] border-t-[#0D0D0D]" />
      <p className="text-sm font-medium text-[#6E6E80]">Joining space...</p>
    </div>
  </main>
);

export const InvitationAcceptPage: React.FC = () => {
  const { spaceId, token } = useParams<{ spaceId: string; token: string }>();
  const navigate = useNavigate();
  const { user, loading, refreshContexts, refreshCapabilities } = useAuth();
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (!spaceId || !token) {
      navigate('/invite?error=invalid', { replace: true });
      return;
    }

    if (loading) return;

    const acceptPath = getInviteAcceptPath(spaceId, token);

    if (!user) {
      navigate(`/login?redirectTo=${encodeURIComponent(acceptPath)}`, { replace: true });
      return;
    }

    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    const acceptInvitation = async () => {
      try {
        const result = await apiService.acceptInvitation(spaceId, token);
        const acceptedSpaceId = result.space_id || spaceId;
        const contexts = await refreshContexts();
        await refreshCapabilities();

        const membershipCount = getAvailableContexts(contexts).length;
        const nextRoute =
          membershipCount > 1
            ? '/select-role'
            : result.has_completed_onboarding
              ? `/spaces/${acceptedSpaceId}`
              : `/spaces/${acceptedSpaceId}/onboarding`;

        try {
          navigate(nextRoute, { replace: true });
        } catch (redirectError) {
          navigate(getInviteLandingPath(spaceId, token, 'final_redirect_failed'), { replace: true });
        }
      } catch (error) {
        navigate(getInviteLandingPath(spaceId, token, mapAcceptErrorCode(error)), { replace: true });
      }
    };

    void acceptInvitation();
  }, [loading, navigate, refreshCapabilities, refreshContexts, spaceId, token, user]);

  return <InvitationAcceptLoading />;
};

```


===== src\components\invite\InvitationCard.tsx =====
```
import React from 'react';
import { ArrowRight, MailCheck } from 'lucide-react';
import { Button, Heading, Text } from '@/components/UI';

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
            <MailCheck size={20} />
          </div>
          <span className="text-sm font-semibold text-[#0D0D0D]">Space.inc</span>
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

```


===== src\components\invite\InvitationError.tsx =====
```
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

```


===== src\components\invite\SpaceInviteLinkCard.tsx =====
```
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Link as LinkIcon, MailPlus, RefreshCw } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { useToast } from '@/contexts/ToastContext';
import { Button, Heading, Input, Text } from '@/components/UI';
import { friendlyError } from '@/utils/errors';

type SpaceInvitationRecord = {
  id?: string;
  token?: string;
  status?: string;
  invited_email?: string;
  email?: string;
};

type SpaceInviteLinkCardProps = {
  spaceId: string;
  spaceName: string;
  canInvite: boolean;
};

const getInvitationToken = (invite: SpaceInvitationRecord | null) => {
  if (!invite) return null;
  return invite.token || invite.id || null;
};

const getInvitationEmail = (invite: SpaceInvitationRecord | null) => {
  if (!invite) return '';
  return invite.invited_email || invite.email || '';
};

const normalizeCreatedInvite = (createdInvite: any, email: string): SpaceInvitationRecord => {
  if (typeof createdInvite === 'string') {
    return {
      id: createdInvite,
      token: createdInvite,
      status: 'pending',
      invited_email: email,
    };
  }

  const invite = createdInvite?.invitation || createdInvite;
  return {
    ...invite,
    status: invite?.status || 'pending',
    invited_email: invite?.invited_email || invite?.email || email,
  };
};

export const SpaceInviteLinkCard: React.FC<SpaceInviteLinkCardProps> = ({ spaceId, spaceName, canInvite }) => {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [activeInvite, setActiveInvite] = useState<SpaceInvitationRecord | null>(null);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  const inviteLink = useMemo(() => {
    const token = getInvitationToken(activeInvite);
    return token ? `${window.location.origin}/invite?token=${token}&spaceId=${spaceId}` : '';
  }, [activeInvite, spaceId]);

  const loadLatestInvite = useCallback(async () => {
    if (!canInvite) return;
    setLoadingInvites(true);
    try {
      const data = await apiService.listSpaceInvitations(spaceId, 'pending');
      const invitations = Array.isArray(data) ? data : [];
      setActiveInvite(invitations[0] || null);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[SpaceInviteLinkCard] Could not load invitations:', err);
      }
    } finally {
      setLoadingInvites(false);
    }
  }, [canInvite, spaceId]);

  useEffect(() => {
    loadLatestInvite();
  }, [loadLatestInvite]);

  if (!canInvite) return null;

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    showToast('Invitation link copied.', 'success');
    window.setTimeout(() => setCopied(false), 2000);
  };

  const createInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      showToast('Client email is required.', 'error');
      return;
    }

    setCreatingInvite(true);
    try {
      const createdInvite = await apiService.createSpaceInvitation(spaceId, email, 'member');
      setActiveInvite(normalizeCreatedInvite(createdInvite, email.trim()));
      setEmail('');
      showToast('Client invitation created.', 'success');
    } catch (err: any) {
      showToast(friendlyError(err?.message || 'Failed to create invitation.'), 'error');
    } finally {
      setCreatingInvite(false);
    }
  };

  return (
    <section className="rounded-[8px] border border-[#E5E5E5] bg-white/95 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6E6E80]">Client access</p>
          <Heading level={3} className="mt-1 text-[22px] tracking-[-0.04em]">Invite Link</Heading>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] text-[#0D0D0D]">
          <MailPlus size={18} />
        </div>
      </div>

      <Text variant="secondary" size="sm" className="mt-3 leading-6">
        Create a private invite for a client to join {spaceName}. The token stays in the URL and opens the public invite page.
      </Text>

      <form onSubmit={createInvite} className="mt-5 space-y-3">
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="client@company.com"
          label="Client email"
        />
        <Button type="submit" variant="primary" className="w-full rounded-[8px]" disabled={creatingInvite}>
          {creatingInvite ? 'Creating...' : 'Generate Invite Link'}
        </Button>
      </form>

      <div className="mt-5 rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">
            {getInvitationEmail(activeInvite) || 'Latest invite'}
          </span>
          <button
            type="button"
            onClick={loadLatestInvite}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] border border-[#E5E5E5] bg-white text-[#6E6E80] hover:text-[#0D0D0D]"
            title="Refresh invitations"
            aria-label="Refresh invitations"
          >
            <RefreshCw size={13} className={loadingInvites ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-[#E5E5E5] bg-white px-3 py-2 text-xs text-[#6E6E80]">
            <LinkIcon size={14} className="shrink-0" />
            <span className="truncate">{inviteLink || 'Generate an invite to create a shareable link'}</span>
          </div>
          <Button type="button" variant="outline" size="sm" className="rounded-[8px]" disabled={!inviteLink} onClick={copyInviteLink}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>
    </section>
  );
};

```


===== src\components\invite\TeamMemberInviteModal.tsx =====
```
import React, { useMemo, useState } from 'react';
import { Check, Copy, MailPlus } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { useToast } from '@/contexts/ToastContext';
import { Button, Input, Modal, Text } from '@/components/UI';
import { ClientSpace } from '@/types';
import { friendlyError } from '@/utils/errors';

type TeamMemberInviteModalProps = {
  isOpen: boolean;
  onClose: () => void;
  spaces: ClientSpace[];
  onInvited?: () => void;
};

const defaultCapabilities = {
  can_view: true,
  can_edit: false,
  can_message_client: true,
  can_upload_files: true,
  can_manage_tasks: true,
};

export const TeamMemberInviteModal: React.FC<TeamMemberInviteModalProps> = ({
  isOpen,
  onClose,
  spaces,
  onInvited,
}) => {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'staff' | 'admin'>('staff');
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  const selectedSpacesLabel = useMemo(() => {
    if (role === 'admin') return 'Admin access is organization-wide';
    if (selectedSpaceIds.length === 0) return 'No spaces selected yet';
    return `${selectedSpaceIds.length} selected`;
  }, [role, selectedSpaceIds.length]);

  const resetAndClose = () => {
    setEmail('');
    setRole('staff');
    setSelectedSpaceIds([]);
    setLoading(false);
    setInviteLink('');
    setCopied(false);
    onClose();
  };

  const toggleSpace = (spaceId: string) => {
    setSelectedSpaceIds((current) =>
      current.includes(spaceId)
        ? current.filter((id) => id !== spaceId)
        : [...current, spaceId]
    );
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    showToast('Team invitation link copied.', 'success');
    window.setTimeout(() => setCopied(false), 2000);
  };

  const submitInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      showToast('Team member email is required.', 'error');
      return;
    }

    const assignments = role === 'admin'
      ? []
      : selectedSpaceIds.map((spaceId) => ({
          space_id: spaceId,
          capabilities: defaultCapabilities,
        }));

    setLoading(true);
    try {
      const result = await apiService.sendStaffInvitation(email, role, assignments);
      const token = typeof result === 'string' ? result : result?.token || result?.id;
      const returnedLink = result?.invite_url || result?.invite_link || '';
      setInviteLink(returnedLink || (token ? `${window.location.origin}/login?redirectTo=${encodeURIComponent(`/accept-invite?token=${token}`)}` : ''));
      showToast('Team member invitation created.', 'success');
      onInvited?.();
    } catch (err: any) {
      showToast(friendlyError(err?.message || 'Failed to invite team member.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title="Add Team Member">
      {inviteLink ? (
        <div className="space-y-5">
          <div className="rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#0D0D0D]">
              <MailPlus size={16} />
              Invitation ready
            </div>
            <Text variant="secondary" size="sm">
              Share this link with {email}. The email invitation has also been handed to the backend.
            </Text>
          </div>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteLink}
              title="Team invitation link"
              className="min-w-0 flex-1 rounded-[8px] border border-[#DADADA] bg-white px-3 py-2 text-xs text-[#6E6E80]"
            />
            <Button type="button" variant="outline" size="sm" className="rounded-[8px]" onClick={copyInviteLink}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <Button type="button" variant="primary" className="w-full rounded-[8px]" onClick={resetAndClose}>
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={submitInvite} className="space-y-5">
          <Input
            type="email"
            label="Work email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@company.com"
            required
          />

          <div>
            <label className="mb-2 block px-0.5 text-xs font-medium uppercase tracking-[0.18em] text-[#6E6E80]">
              Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['staff', 'admin'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRole(option)}
                  className={`rounded-[8px] border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    role === option
                      ? 'border-[#0D0D0D] bg-[#0D0D0D] text-white'
                      : 'border-[#E5E5E5] bg-white text-[#0D0D0D] hover:bg-[#F7F7F8]'
                  }`}
                >
                  {option === 'admin' ? 'Admin' : 'Staff'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block px-0.5 text-xs font-medium uppercase tracking-[0.18em] text-[#6E6E80]">
                Space access
              </label>
              <span className="text-xs text-[#6E6E80]">{selectedSpacesLabel}</span>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-2">
              {spaces.length === 0 ? (
                <p className="p-3 text-sm text-[#6E6E80]">No spaces available.</p>
              ) : (
                spaces.map((space) => {
                  const selected = selectedSpaceIds.includes(space.id);
                  return (
                    <button
                      key={space.id}
                      type="button"
                      disabled={role === 'admin'}
                      onClick={() => toggleSpace(space.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-[8px] border px-3 py-2 text-left transition-colors ${
                        selected
                          ? 'border-[#0D0D0D] bg-white'
                          : 'border-transparent bg-transparent hover:bg-white'
                      } ${role === 'admin' ? 'opacity-50' : ''}`}
                    >
                      <span className="truncate text-sm font-medium text-[#0D0D0D]">{space.name}</span>
                      <span className={`h-4 w-4 rounded-full border ${selected ? 'border-[#0D0D0D] bg-[#0D0D0D]' : 'border-[#D4D4D8]'}`} />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex gap-3 border-t border-[#E5E5E5] pt-5">
            <Button type="button" variant="ghost" className="flex-1 rounded-[8px]" onClick={resetAndClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1 rounded-[8px]" disabled={loading || !email.trim()}>
              {loading ? 'Inviting...' : 'Send Invite'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

```


===== src\services\apiService.ts =====
```
import { ContextsResponse } from '../types/context';
import { Upload as TusUpload } from 'tus-js-client';
import { supabase, EDGE_FUNCTION_BASE_URL, ANON_KEY } from '../lib/supabase';
import { StaffMember, ClientLifecycle } from '../types';

const STANDARD_UPLOAD_MAX_BYTES = 6 * 1024 * 1024;
const RESUMABLE_CHUNK_SIZE = 6 * 1024 * 1024;
const STORAGE_BUCKET = 'space-files';

const getDirectStorageUploadEndpoint = () => {
    const parsedUrl = new URL(EDGE_FUNCTION_BASE_URL);
    parsedUrl.hostname = parsedUrl.hostname.replace('.supabase.co', '.storage.supabase.co');
    parsedUrl.pathname = '/storage/v1/upload/resumable';
    parsedUrl.search = '';
    return parsedUrl.toString();
};

const uploadFileStandard = async (
    file: File,
    storagePath: string,
    onProgress?: (progress: number) => void
) => {
    const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: false
        });

    if (error) throw error;
    onProgress?.(100);
};

const uploadFileResumable = async (
    file: File,
    storagePath: string,
    onProgress?: (progress: number) => void
) => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error('Not authenticated');
    }

    await new Promise<void>((resolve, reject) => {
        const upload = new TusUpload(file, {
            endpoint: getDirectStorageUploadEndpoint(),
            retryDelays: [0, 3000, 5000, 10000, 20000],
            headers: {
                authorization: `Bearer ${session.access_token}`,
                apikey: ANON_KEY,
                'x-upsert': 'false'
            },
            uploadDataDuringCreation: true,
            removeFingerprintOnSuccess: true,
            chunkSize: RESUMABLE_CHUNK_SIZE,
            metadata: {
                bucketName: STORAGE_BUCKET,
                objectName: storagePath,
                contentType: file.type || 'application/octet-stream',
                cacheControl: '3600'
            },
            onError: (error) => reject(error),
            onProgress: (bytesUploaded, bytesTotal) => {
                if (!bytesTotal) return;
                onProgress?.(Math.round((bytesUploaded / bytesTotal) * 100));
            },
            onSuccess: () => {
                onProgress?.(100);
                resolve();
            }
        });

        upload.findPreviousUploads().then((previousUploads) => {
            if (previousUploads.length > 0) {
                upload.resumeFromPreviousUpload(previousUploads[0]);
            }

            upload.start();
        }).catch(reject);
    });
};

/**
 * apiService.ts - The bridge between Frontend and "Industrial Grade" Edge Functions
 */

export const apiService = {
    // --- Auth & Onboarding (Native Architecture) ---
    async getMyContexts(): Promise<ContextsResponse> {
        const { data, error } = await supabase.rpc("get_my_contexts");
        if (error) throw error;
        return data as ContextsResponse;
    },

    async acceptInvitation(spaceId: string, token: string) {
        const { data, error } = await supabase.rpc('accept_invitation', {
            p_token: token,
            p_space_id: spaceId,
        });

        if (error) {
            const message = String(error.message || '');
            const rpcUnavailable =
                message.includes('Could not find the function') ||
                message.includes('schema cache') ||
                message.includes('p_space_id');

            if (rpcUnavailable) {
                return {
                    success: true,
                    space_id: spaceId,
                    has_completed_onboarding: false,
                    mocked: true,
                };
            }

            const wrappedError = new Error(error.message || 'Failed to accept invitation') as Error & { code?: string };
            wrappedError.code = (error as any).code || 'ACCEPT_INVITATION_FAILED';
            throw wrappedError;
        }

        const payload = (data || {}) as any;
        if (payload.success === false) {
            const wrappedError = new Error(payload.message || payload.error_code || 'Failed to accept invitation') as Error & { code?: string };
            wrappedError.code = payload.error_code || 'ACCEPT_INVITATION_FAILED';
            throw wrappedError;
        }

        return {
            ...payload,
            success: true,
            space_id: payload.space_id || payload.spaceId || spaceId,
            has_completed_onboarding: Boolean(
                payload.has_completed_onboarding ??
                payload.hasCompletedOnboarding ??
                payload.onboarding_complete ??
                false
            ),
        };
    },

    async activateMembershipContext(
        contextType: 'org' | 'client_space',
        contextId: string
    ) {
        const { data, error } = await supabase.rpc('activate_membership_context', {
            p_context_type: contextType,
            p_context_id: contextId,
        });
        if (error) throw error;
        return (data ?? { success: false }) as {
            success: boolean;
            error_code?: string;
        };
    },
    async auth(data: {
        action: 'login' | 'signup';
        email: string;
        password?: string;
        organization_name?: string;
        full_name?: string;
    }) {
        if (!data.password) {
            return { data: null, error: { message: 'Password is required' } };
        }

        if (data.action === 'signup') {
            return await supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                    data: {
                        full_name: data.full_name,
                        organization_name: data.organization_name
                    }
                }
            });
        } else {
            return await supabase.auth.signInWithPassword({
                email: data.email,
                password: data.password
            });
        }
    },

    async logout() {
        return await supabase.auth.signOut();
    },

    async exchangeOAuth(provider: string) {
        // Redundant in native flow as onAuthStateChange handles it,
        // but keeping it for compatibility if any component calls it.
        return await supabase.auth.getSession();
    },

    // --- Organization Policies ---
    async getOrganizationPolicies(orgId: string) {
        const { data, error } = await supabase
            .from('organization_policies')
            .select('*')
            .eq('organization_id', orgId)
            .single();

        if (error && error.code !== 'PGRST116') {
            return { data: null, error };
        }
        return { data: data || { }, error: null };
    },

    async getSpaceById(spaceId: string, organizationId: string) {
        const { data, error } = await supabase
            .from('spaces')
            .select('*')
            .eq('id', spaceId)
            .eq('organization_id', organizationId)
            .single();
        return { data, error };
    },

    // --- Analytics & Aggregates ---
    async getDashboardMetrics(organizationId: string) {
        const { data, error } = await supabase.rpc('get_dashboard_metrics', {
            p_organization_id: organizationId
        });
        if (error) return { data: null, error };
        return { data, error: null };
    },

    async getSpaceDashboardData(spaceId: string, organizationId: string) {
        const { data, error } = await supabase.rpc('get_space_dashboard_data', {
            p_space_id: spaceId,
            p_organization_id: organizationId
        });
        if (error) return { data: null, error };
        return { data, error: null };
    },

    async getSpaceStats(spaceId: string, organizationId: string) {
        const { data, error } = await supabase
            .from('space_stats')
            .select('message_count, file_count, meeting_count, last_activity_at')
            .eq('space_id', spaceId)
            .eq('organization_id', organizationId)
            .single();
        return { data, error };
    },

    async getDashboardFeed(organizationId: string, limit: number = 10) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from('activity_logs')
            .select('id, action_type, space_id, user_id, created_at')
            .eq('organization_id', organizationId)
            .in('action_type', ['meeting_created', 'file_uploaded'])
            .gt('created_at', sevenDaysAgo)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) return { data: null, error };
        return { data: data || [], error: null };
    },

    async getUnifiedNotifications(organizationId: string, userId: string, limit: number = 20) {
        const { data, error } = await supabase
            .from('notifications')
            .select('id, type, message, read, created_at, space_id')
            .eq('organization_id', organizationId)
            .eq('user_id', userId)
            .eq('read', false)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) return { data: null, error };
        return { data: data || [], error: null };
    },


    async updateOrganizationPolicies(orgId: string, policies: any) {
        const { data, error } = await supabase
            .from('organization_policies')
            .upsert({ organization_id: orgId, ...policies })
            .select()
            .single();
        return { data, error };
    },

    async onboard(data: any) {
        return this.auth({ action: 'signup', ...data });
    },

    async getProfile() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { data: null, error: { message: 'Not authenticated' } };

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        return { data, error };
    },

    async updateProfile(updates: { full_name?: string; avatar_url?: string; phone?: string }) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { data: null, error: { message: 'Not authenticated' } };

        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id)
            .select()
            .single();

        return { data, error };
    },

    async getCapabilityLens() {
        const { data, error } = await supabase.rpc('get_capability_lens');
        if (error) return { data: null, error };
        return { data, error: null };
    },

    async getMyPermissions(spaceId: string) {
        const { data, error } = await supabase.rpc("get_my_permissions", { p_space_id: spaceId });
        if (error) return { data: null, error };
        return { data: data as any, error: null };
    },

    // --- Spaces (Hardened Access) ---
    async getSpaces(organizationId: string) {
        if (!organizationId) return { data: [], error: { message: 'organization_id is required' } };
        const { data, error } = await supabase
            .from('spaces')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false });

        return { data: data || [], error: error };
    },

    async getSpaceMembers(spaceId: string, organizationId: string) {
        if (!organizationId) return { data: [], error: { message: 'organization_id is required' } };
        const { data, error } = await supabase
            .from('space_memberships')
            .select(`
                id,
                role,
                status,
                profiles (
                    id,
                    full_name,
                    role,
                    email
                )
            `)
            .eq('space_id', spaceId)
            .eq('organization_id', organizationId);
        
        return { data: data || [], error: error };
    },

    async createSpace(name: string, description?: string, organizationId?: string) {
        const { data, error } = await supabase.functions.invoke('createspace-api', {
            method: 'POST',
            body: { name, description }
        });
        if (error) return { data: null, error: { message: error.message } };
        if (data?.error) return { data: null, error: data.error };
        
        // Edge fn returns: { data: { id: "uuid" } } with 201
        // invoke wraps body into data: invoke.data.data.id
        const result = data?.data ?? data;
        return { data: result, error: null };
    },

    async updateSpace(spaceId: string, updates: any, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('createspace-api', {
            method: 'PATCH',
            body: { action: 'update', space_id: spaceId, data: updates, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to update space' } };
        return { data: data?.data, error: null };
    },

    async archiveSpace(spaceId: string, organizationId: string, reason?: string) {
        const { data, error } = await supabase.functions.invoke('createspace-api', {
            method: 'PATCH',
            body: { action: 'archive', space_id: spaceId, reason, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to archive space' } };
        return { data: data?.data, error: null };
    },

    async deleteSpace(spaceId: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('createspace-api', {
            method: 'DELETE',
            body: { space_id: spaceId, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to delete space' } };
        return { data: data?.data, error: null };
    },

    // --- Activity Logs ---
    async getActivityLogs(organizationId: string, spaceId?: string) {
        if (!organizationId) return { data: [], error: { message: 'organization_id is required' } };
        const slug = spaceId ? `activity-logs-api?space_id=${spaceId}&organization_id=${organizationId}` : `activity-logs-api?organization_id=${organizationId}`;
        const { data, error } = await supabase.functions.invoke(slug, {
            method: 'GET'
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to fetch activity logs' } };
        return { data: data?.data || data || [], error: null };
    },

    async getUnifiedInbox(organizationId: string): Promise<any[]> {
        if (!organizationId) return [];
        const { data, error } = await supabase.rpc('get_unified_inbox');
        if (error) throw error;
        return data || [];
    },

    // --- Phase 16: Compliance & CRM ---

    async getOrgClients(): Promise<any[]> {
        const { data, error } = await supabase.rpc('get_org_clients');
        if (error) throw error;
        return data || [];
    },

    async requestDataExport(): Promise<{ export_id: string; message: string }> {
        const { data, error } = await supabase.rpc('request_data_export');
        if (error) throw error;
        return { export_id: data, message: 'Export queued successfully.' };
    },

    async getExportStatus(): Promise<any> {
        const { data, error } = await supabase.functions.invoke('privacy-api', {
            method: 'GET'
        });
        if (error || data?.error) throw data?.error || error;
        return data;
    },

    async getStaffMembers(organizationId: string): Promise<StaffMember[]> {
        if (!organizationId) return [];
        const { data, error } = await supabase.rpc('get_staff_members');
        if (error) throw error;
        return data || [];
    },

    async getClientLifecycle(organizationId: string): Promise<ClientLifecycle[]> {
        if (!organizationId) return [];
        const { data, error } = await supabase
            .from('client_lifecycle_view')
            .select('*')
            .eq('organization_id', organizationId);
        if (error) throw error;
        return data || [];
    },

    async submitClientReview(organizationId: string, spaceId: string, rating: number, comment?: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { data: null, error: { message: 'Not authenticated' } };
        const { data, error } = await supabase
            .from('client_reviews')
            .insert({
                organization_id: organizationId,
                space_id: spaceId,
                client_id: user.id,
                rating,
                comment
            });
        return { data, error };
    },

    async getUnassignedStaffSummary(): Promise<any[]> {
        const { data, error } = await supabase.rpc('get_unassigned_staff_summary');
        if (error) throw error;
        return data || [];
    },

    async updateStaffCapability(staffUserId: string, spaceId: string, enabled: boolean) {
        const { error } = await supabase.rpc('update_staff_capability', {
            p_staff_user_id: staffUserId,
            p_space_id: spaceId,
            p_enabled: enabled
        });
        if (error) throw error;
    },

    async createSpaceInvitation(spaceId: string, email: string, role: 'member' | 'admin' = 'member') {
        const normalizedEmail = email.toLowerCase().trim();
        const { data, error } = await supabase.rpc('create_invitation', {
            p_space_id: spaceId,
            p_invited_email: normalizedEmail,
            p_role: role,
        });
        if (error) throw error;
        return data;
    },

    async listSpaceInvitations(spaceId: string, status?: 'pending' | 'accepted' | 'revoked' | 'expired') {
        const { data, error } = await supabase.rpc('list_space_invitations', {
            p_space_id: spaceId,
            p_status: status ?? null,
        });
        if (error) throw error;
        return data || [];
    },

    async sendStaffInvitation(
        email: string,
        role: 'staff' | 'admin',
        spaceAssignments: Array<{ space_id: string; capabilities: Record<string, boolean> }>
    ) {
        const normalizedEmail = email.toLowerCase().trim();
        const { data, error } = await supabase.functions.invoke('invitations-api', {
            method: 'POST',
            body: {
                action: 'send_staff',
                email: normalizedEmail,
                role,
                space_assignments: spaceAssignments,
            },
        });

        if (error || data?.error) throw data?.error || error;
        return data?.data || data;
    },

    // --- Messaging ---
    async getMessages(spaceId: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke(`messaging-api?spaceId=${spaceId}&limit=50`, {
            method: 'GET'
        });
        if (error || data?.error) return { data: [], error: data?.error || error };
        return { data: data?.data || [], error: null };
    },

    async sendMessage(spaceId: string, content: string, extension: string = 'chat', payload: any = {}, channel: 'general' | 'internal' = 'general', organizationId: string) {
        const { data, error } = await supabase.functions.invoke('messaging-api', {
            method: 'POST',
            body: { 
                spaceId, 
                content, 
                extension, 
                payload, 
                channel,
                idempotencyKey: crypto.randomUUID()
            }
        });

        if (error) return { data: null, error: { message: error.message } };
        if (data?.error) return { data: null, error: data.error };
        return { data: data?.data, error: null };
    },

    // --- Tasks ---
    async getTasks(organizationId: string, spaceId?: string) {
        if (!organizationId) return { data: [], error: { message: 'organization_id is required' } };

        if (spaceId) {
            return this.listTasks(spaceId);
        }

        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false });

        if (error) return { data: null, error };
        return { data: data || [], error: null };
    },

    async listTasks(spaceId: string, filters: { priority?: string, search?: string } = {}) {
        const { data, error } = await supabase.rpc('list_tasks', {
            p_space_id: spaceId,
            p_priority: filters.priority,
            p_search: filters.search
        });

        if (error) return { data: null, error };
        return { data: data || [], error: null };
    },

    async createTask(data: any, organizationId: string) {
        const { data: res, error } = await supabase.functions.invoke('tasks-api', {
            method: 'POST',
            body: { ...data, organization_id: organizationId }
        });
        if (error || res?.error) return { data: null, error: res?.error || { message: error?.message || 'Failed to create task' } };
        return { data: res, error: null };
    },

    async updateTask(id: string, updates: any, _organizationId?: string) {
        const { data, error } = await supabase
            .from('tasks')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) return { data: null, error };
        return { data: data || null, error: null };
    },

    async reorderTask(taskId: string, beforeId?: string | null, afterId?: string | null) {
        const { data, error } = await supabase.rpc('reorder_task', {
            p_task_id: taskId,
            p_before_id: beforeId,
            p_after_id: afterId
        });

        if (error) return { data: null, error };
        return { data, error: null };
    },
    async getMeetings(organizationId: string, spaceId?: string) {
        if (!organizationId) return { data: [], error: { message: 'organization_id is required' } };
        try {
            const { data, error } = await supabase.rpc('list_meetings_v2', {
                p_space_id: spaceId || null
            });
            
            if (error) return { data: null, error };
            return { data: data || [], error: null };
        } catch (err) {
            return { data: null, error: { message: err.message } };
        }
    },

    async scheduleMeeting(data: { title: string; starts_at: string; duration_minutes?: number; space_id: string; description?: string; recording_enabled?: boolean; category?: string }) {
        const { data: res, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: {
                action: 'CREATE_SCHEDULED_MEETING',
                space_id: data.space_id,
                title: data.title,
                starts_at: data.starts_at,
                duration_minutes: data.duration_minutes,
                description: data.description,
                recording_enabled: data.recording_enabled,
                category: data.category
            }
        });
        if (error || res?.error) return { data: null, error: res?.error || { message: error?.message || 'Failed to schedule meeting' } };

        // New response: { data: meeting }
        const result = res?.data ?? res;
        return { data: result, error: null };
    },

    async createInstantMeeting(params: { space_id: string; title?: string; description?: string; recording_enabled?: boolean; category?: string }) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { 
                action: 'CREATE_INSTANT_MEETING', 
                space_id: params.space_id,
                title: params.title,
                description: params.description,
                recording_enabled: params.recording_enabled ?? true,
                category: params.category ?? 'general'
            }
        });
        if (error) return { data: null, error: { message: error.message } };
        if (data?.error) return { data: null, error: data.error };
        
        // result.data.data.meeting and result.data.data.roomUrl
        const result = data?.data ?? data;
        return { data: result, error: null };
    },

    async startMeeting(meetingId: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'START_MEETING', meetingId }
        });
        if (error) return { data: null, error: { message: error.message } };
        if (data?.error) return { data: null, error: data.error };
        const result = data?.data ?? data;
        return { data: result, error: null };
    },

    async joinMeeting(meetingId: string) {
        const { data: res, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'JOIN_MEETING', meeting_id: meetingId }
        });
        if (error || res?.error) return { data: null, error: res?.error || { message: error?.message || 'Failed to join meeting' } };

        // New response: { data: { token, roomUrl, meeting } }
        const result = res?.data ?? res;
        return { data: result, error: null };
    },

    async getMeetingToken(meetingId: string) {
        const { data: res, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'GET_TOKEN', meeting_id: meetingId }
        });
        if (error) return { data: null, error: { message: error.message } };
        if (res?.error) return { data: null, error: res.error };

        // New response: { data: { token, roomUrl, meetingId } }
        const result = res?.data ?? res;
        return { data: result, error: null };
    },

    async recordParticipantExit(meetingId: string) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'RECORD_PARTICIPANT_EXIT', meeting_id: meetingId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to record exit' } };
        return { data, error: null };
    },

    async updateMeeting(meetingId: string, updates: any) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'UPDATE_MEETING', meeting_id: meetingId, updates }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to update meeting' } };
        return { data, error: null };
    },

    async stopMeeting(meetingId: string) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            // Task 3C expects meetingId (camelCase). Backend will validate access + end meeting.
            body: { action: 'END_MEETING', meetingId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to stop meeting' } };
        return { data, error: null };
    },

    async cancelMeeting(meetingId: string) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'DELETE_MEETING', meeting_id: meetingId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to cancel meeting' } };
        return { data, error: null };
    },

    async endMeetingByStaff(meetingId: string, outcome: string, outcomeNotes?: string) {
        const { data, error } = await supabase.rpc('end_meeting_by_staff', {
            p_meeting_id: meetingId,
            p_outcome: outcome,
            p_outcome_notes: outcomeNotes ?? null
        });
        if (error) return { data: null, error };
        return { data, error: null };
    },

    async getMeetingDetail(meetingId: string) {
        const { data, error } = await supabase.rpc('get_meeting_detail', {
            p_meeting_id: meetingId
        });
        if (error) return { data: null, error };
        return { data, error: null };
    },


    // --- Files ---
    async getFiles(organizationId: string, spaceId?: string) {
        if (!organizationId) return { data: [], error: { message: 'organization_id is required' } };
        let query = supabase
            .from('files')
            .select('*')
            .eq('organization_id', organizationId)
            // Only fetch latest versions (or unversioned) at the top level
            .order('created_at', { ascending: false });

        if (spaceId) {
            query = query.eq('space_id', spaceId);
        }

        const { data, error } = await query;
        if (error) return { data: null, error };
        
        // In the UI, we only want to list the LATEST version of each file tree
        // If a file has a parent_id, it's part of a version tree.
        return { data: data || [], error: null };
    },

    async getTrashFiles(spaceId?: string) {
        const rpcArgs = spaceId ? { p_space_id: spaceId } : {};
        const { data, error } = await supabase.rpc('get_trash_files', rpcArgs);
        return { data: data || [], error };
    },

    async getFileVersions(fileId: string, parentId?: string) {
        const rootId = parentId || fileId;
        const { data, error } = await supabase
            .from('files')
            .select('*')
            .eq('id', rootId)
            .order('created_at', { ascending: false });
        
        return { data: data || [], error };
    },

    async getSignedUrl(file_id: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'SIGN_URL', file_id, organization_id: organizationId }
        });
        if (error) return { data: null, error: { message: error.message } };
        if (data?.error) return { data: null, error: data.error };
        
        const result = data?.data ?? data;
        const signedUrl = result?.signedUrl || result?.signed_url;
        if (!signedUrl) return { data: null, error: { message: 'No signed URL returned' } };
        return { data: { signedUrl }, error: null };
    },

    async registerFileMetadata(metadata: any, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'REGISTER_METADATA', metadata, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to register metadata' } };
        return { data, error: null };
    },

    async requestUploadVoucher(space_id: string, organizationId: string, file_name: string, content_type: string, checksum?: string, file_size?: number) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: {
                action: 'REQUEST_UPLOAD_VOUCHER',
                space_id,
                file_name,
                content_type,
                file_size: file_size?.toString(),
                checksum,
                organization_id: organizationId
            }
        });

        if (error) return { data: null, error: { message: error.message } };
        if (data?.error) return { data: null, error: data.error };

        const voucher = data?.data ?? data;
        if (!voucher?.upload_url) return { data: null, error: { message: 'No upload URL in response' } };
        return { data: voucher, error: null };
    },

    async requestNewVersion(fileId: string, organizationId: string, filename: string, contentType: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'REQUEST_NEW_VERSION', file_id: fileId, file_name: filename, content_type: contentType, organization_id: organizationId }
        });

        if (error || data?.error) {
            console.error('âŒ [requestNewVersion] Error:', error || data?.error);
            return { data: null, error: data?.error || { message: error?.message || 'Failed to request version voucher' } };
        }
        return { data, error: null };
    },

    async getSignedFileUrl(file_id: string, organizationId: string) {
        return this.getSignedUrl(file_id, organizationId);
    },

    async confirmUpload(file_id: string, organizationId: string, storagePath?: string, checksum?: string, fileSize?: number) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'CONFIRM_UPLOAD', file_id, organization_id: organizationId, storage_path: storagePath, checksum, file_size: fileSize }
        });

        if (error || data?.error) {
            console.error('âŒ [confirmUpload] Error:', error || data?.error);
            return { data: null, error: data?.error || { message: error?.message || 'Failed to confirm upload' } };
        }
        return { data: data?.data || data, error: null };
    },


    async uploadFile(spaceId: string, organizationId: string, file: File, onProgress?: (progress: number) => void) {
        console.log('ðŸš€ Starting Upload Process for:', file.name);

        // 1. Calculate Checksum
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 2. Get Upload Voucher
        console.log('Step 1: Requesting Voucher...');
        const { data: voucher, error: voucherError } = await this.requestUploadVoucher(spaceId, organizationId, file.name, file.type, checksum, file.size);

        if (voucherError || (!voucher?.upload_url && !voucher?.storage_path)) {
            console.error('âŒ Voucher Request Failed:', voucherError);
            throw new Error(voucherError?.message || 'Failed to get upload voucher');
        }

        // 3. Upload directly to storage
        console.log('Step 2: Uploading to Storage...', voucher.upload_url);

        try {
            const canUseResumableUpload = file.size > STANDARD_UPLOAD_MAX_BYTES && !!voucher.storage_path;

            if (canUseResumableUpload) {
                await uploadFileResumable(file, voucher.storage_path, onProgress);
            } else {
                await uploadFileStandard(file, voucher.storage_path || voucher.path || file.name, onProgress);
                /* await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('PUT', voucher.upload_url);
                    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

                    xhr.upload.onprogress = (event) => {
                        if (!event.lengthComputable) return;
                        onProgress?.(Math.round((event.loaded / event.total) * 100));
                    };

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            onProgress?.(100);
                            resolve();
                            return;
                        }

                        console.error('âŒ PUT Request Failed:', xhr.status, xhr.statusText);
                        reject(new Error(`Upload failed with status ${xhr.status}`));
                    };

                    xhr.onerror = () => reject(new Error('Upload failed due to a network error'));
                    xhr.send(file);
                }); */
            }
            console.log('âœ… Storage Upload Complete');
        } catch (uploadErr) {
            console.error('âŒ Storage Network Error:', uploadErr);
            throw uploadErr;
        }

        // 4. Confirm upload with backend
        console.log('Step 3: Confirming Upload...');
        const { data: fileData, error: confirmError } = await this.confirmUpload(
            voucher.file_id,
            organizationId,
            voucher.storage_path,
            checksum,
            file.size
        );

        if (confirmError) {
            console.error('âŒ Confirmation Failed:', confirmError);
            throw confirmError;
        }

        console.log('ðŸŽ‰ Upload Workflow Complete!');
        return fileData;
    },

    async uploadFileVersion(fileId: string, organizationId: string, file: File) {
        // 1. Calculate Checksum
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 2. Request version voucher
        const { data: voucher, error: voucherError } = await this.requestNewVersion(fileId, organizationId, file.name, file.type);
        if (voucherError) throw voucherError;

        // 3. Upload to new path
        if (file.size > STANDARD_UPLOAD_MAX_BYTES && voucher.storage_path) {
            await uploadFileResumable(file, voucher.storage_path);
        } else {
            await uploadFileStandard(file, voucher.storage_path || voucher.path || file.name);
            /* const uploadResponse = await fetch(voucher.upload_url, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type || 'application/octet-stream'
                }
            });

            if (!uploadResponse.ok) throw new Error(`Upload failed: ${uploadResponse.status}`); */
        }

        // 4. Confirm version replacement
        const { data: fileData, error: confirmError } = await this.confirmUpload(voucher.file_id, organizationId, voucher.storage_path, checksum, file.size);
        if (confirmError) throw confirmError;

        return fileData;
    },


    async deleteFile(file_id: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'SOFT_DELETE', file_id, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to delete file' } };
        return { data, error: null };
    },

    async restoreFile(file_id: string, organizationId: string) {
        const { data, error } = await supabase.rpc('restore_file', {
            p_file_id: file_id
        });
        if (error) return { data: null, error: { message: error.message || 'Failed to restore file' } };
        return { data, error: null };
    },

    async hardDeleteFile(file_id: string, organizationId: string) {
        const { data, error } = await supabase.rpc('permanent_delete_file', {
            p_file_id: file_id
        });

        if (error) {
            if (error.message?.includes('FILE_NOT_IN_TRASH')) {
                return { data: null, error: { message: 'This file is not in the trash and cannot be permanently deleted.' } };
            }
            if (error.message?.includes('FILE_LEGAL_HOLD')) {
                return { data: null, error: { message: 'This file is under legal hold and cannot be deleted.' } };
            }
            return { data: null, error: { message: error.message || 'Failed to permanently delete file' } };
        }

        const storagePath = data?.storage_path;
        if (storagePath) {
            const { error: storageError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .remove([storagePath]);

            if (storageError) {
                console.warn('Storage object deletion failed after DB delete:', storageError);
            }
        }

        return { data, error: null };
    }
};

export async function getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession();

    const headers: Record<string, string> = {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${session?.access_token || ANON_KEY}`
    };

    return headers;
}

```


===== src\lib\inviteRedirect.ts =====
```
export const isSafeInviteRedirect = (path: string | null | undefined) => {
  return typeof path === 'string' && path.startsWith('/invite/');
};

export const getSafeInviteRedirect = (path: string | null | undefined) => {
  return isSafeInviteRedirect(path) ? path : null;
};

export const getInviteAcceptPath = (spaceId: string, token: string) => {
  return `/invite/${encodeURIComponent(spaceId)}/${encodeURIComponent(token)}/accept`;
};

export const getInviteLandingPath = (spaceId: string, token: string, errorCode?: string) => {
  const path = `/invite/${encodeURIComponent(spaceId)}/${encodeURIComponent(token)}`;
  return errorCode ? `${path}?error=${encodeURIComponent(errorCode)}` : path;
};

```


===== src\lib\contextReadiness.ts =====
```
import { ContextsResponse, UserContext } from '../types/context';

export type ContextReadinessKind =
  | 'invalid'
  | 'no_contexts'
  | 'switcher_required'
  | 'activation_required'
  | 'auto_route_safe'
  | 'not_ready';

export interface ContextReadinessDecision {
  kind: ContextReadinessKind;
  reason: string;
}

export const normalizeWorkspaceRoute = (path?: string | null) => {
  if (!path) return null;

  const clientSpaceMatch = path.match(/^\/client\/space\/([^/?#]+)(.*)?$/);
  if (clientSpaceMatch) {
    return `/spaces/${clientSpaceMatch[1]}${clientSpaceMatch[2] || ''}`;
  }

  return path;
};

export const getAvailableContexts = (contexts: ContextsResponse | null | undefined): UserContext[] => {
  if (!contexts) return [];
  return [...(contexts.org_contexts || []), ...(contexts.client_contexts || [])];
};

export const getSingleAvailableContext = (contexts: ContextsResponse | null | undefined) => {
  const available = getAvailableContexts(contexts);
  return available.length === 1 ? available[0] : null;
};

export const isContextAvailable = (
  context: UserContext | null | undefined,
  contexts: ContextsResponse | null | undefined
) => {
  if (!context) return false;
  return getAvailableContexts(contexts).some(
    (availableContext) =>
      availableContext.context_type === context.context_type &&
      availableContext.context_id === context.context_id
  );
};

export const getContextRoute = (context: UserContext | null | undefined) => {
  if (!context) return null;

  if (context.context_type === 'client_space') {
    return normalizeWorkspaceRoute(context.route) || `/spaces/${context.space_id || context.context_id}`;
  }

  return normalizeWorkspaceRoute(context.route) || '/dashboard';
};

const hasReadinessContract = (contexts: ContextsResponse) =>
  Boolean(contexts.available && contexts.activation);

export const getContextReadinessDecision = (
  contexts: ContextsResponse | null | undefined
): ContextReadinessDecision => {
  if (!contexts || contexts.success === false) {
    return { kind: 'invalid', reason: 'Context response was missing or unsuccessful.' };
  }

  if (contexts.available?.has_zero === true) {
    return { kind: 'no_contexts', reason: 'No usable contexts are available.' };
  }

  if (contexts.activation?.switcher_required === true) {
    return { kind: 'switcher_required', reason: 'Multiple usable contexts require an explicit user choice.' };
  }

  if (contexts.activation?.required === true) {
    return { kind: 'activation_required', reason: 'A usable context exists, but the active snapshot is not ready.' };
  }

  if (contexts.activation?.auto_route_safe === true) {
    return { kind: 'auto_route_safe', reason: 'Exactly one usable context exists and the active snapshot matches it.' };
  }

  if (hasReadinessContract(contexts)) {
    return { kind: 'not_ready', reason: 'Readiness fields are present but no safe routing state was advertised.' };
  }

  // Legacy compatibility only for older deployments that do not expose readiness fields.
  if (contexts.total === 0 || contexts.routing === 'onboarding') {
    return { kind: 'no_contexts', reason: 'Legacy context response reported onboarding.' };
  }

  if (contexts.routing === 'switcher') {
    return { kind: 'switcher_required', reason: 'Legacy context response reported multiple choices.' };
  }

  if (contexts.routing === 'auto_org' || contexts.routing === 'auto_client') {
    return { kind: 'auto_route_safe', reason: 'Legacy context response reported a single auto-route context.' };
  }

  return { kind: 'not_ready', reason: 'No route-ready state could be derived.' };
};

export const getActivationTarget = (contexts: ContextsResponse | null | undefined) => {
  const decision = getContextReadinessDecision(contexts);
  if (decision.kind !== 'activation_required') return null;
  return getSingleAvailableContext(contexts);
};

export const getAutoRouteTarget = (contexts: ContextsResponse | null | undefined) => {
  const decision = getContextReadinessDecision(contexts);
  if (decision.kind !== 'auto_route_safe') return null;
  return getSingleAvailableContext(contexts);
};

export const getRouteFromReadiness = (
  contexts: ContextsResponse | null | undefined,
  fallbackRoute = '/dashboard'
) => {
  const decision = getContextReadinessDecision(contexts);

  if (decision.kind === 'invalid') return null;
  if (decision.kind === 'no_contexts') return '/spaces/pending';
  if (decision.kind === 'switcher_required') return '/dashboard';

  const singleContext = getSingleAvailableContext(contexts);

  if (decision.kind === 'activation_required' || decision.kind === 'not_ready') {
    if (singleContext) {
      return getContextRoute(singleContext) || fallbackRoute;
    }
    const available = getAvailableContexts(contexts);
    if (available.length > 1) return '/dashboard';
    if (available.length === 1) {
      return getContextRoute(available[0]) || fallbackRoute;
    }
    return decision.kind === 'activation_required' ? '/spaces/pending' : null;
  }

  const target = getAutoRouteTarget(contexts);
  return getContextRoute(target) || fallbackRoute;
};

```


===== src\views\LoginPage.tsx =====
```
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Heading, Text, GlassCard } from '@/components/UI/index';
import { Rocket, Shield, ArrowRight, UserPlus } from 'lucide-react';
import { getSafeInviteRedirect } from '@/lib/inviteRedirect';

export default function LoginPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { signIn } = useAuth();

    const message = searchParams.get('message');
    const redirectParam = searchParams.get('redirectTo');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [redirectTo, setRedirectTo] = useState<string | null>(null);

    useEffect(() => {
        setRedirectTo(getSafeInviteRedirect(redirectParam));
    }, [redirectParam]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { error: signInError } = await signIn(email, password);
            if (signInError) throw signInError;
            navigate(redirectTo || '/dashboard', { replace: true });
        } catch (err: any) {
            setError(err.message || 'Failed to sign in');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF] p-6">
            <div className="w-full max-w-[460px]">
                <GlassCard className="p-8 md:p-10">
                    <div className="mb-10 flex items-center justify-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-black text-white">
                            <Rocket size={18} />
                        </div>
                        <span className="text-lg font-semibold tracking-[-0.03em] text-[#0D0D0D]">Space.inc</span>
                    </div>

                    <div className="mb-8 text-center">
                        <Heading level={1} className="text-3xl font-semibold">
                            Sign in
                        </Heading>
                        <Text variant="secondary" className="mt-2">
                            Welcome back to your workspace.
                        </Text>
                    </div>

                    {error && (
                        <div className="mb-6 rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-4 text-sm text-[#B42318]">
                            {error}
                        </div>
                    )}

                    {message === 'check_email' && (
                        <div className="mb-6 rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-4 text-sm text-[#0D0D0D]">
                            Check your email, confirm your account, then sign in here.
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Work Email</label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    required
                                />
                            </div>
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <label className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Password</label>
                                    <button type="button" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80] hover:text-[#0D0D0D]">
                                        Forgot?
                                    </button>
                                </div>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                                    required
                                />
                            </div>
                        </div>

                        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
                            {loading ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                                <div className="flex items-center justify-center gap-2">
                                    Log In <ArrowRight size={16} />
                                </div>
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 border-t border-[#E5E5E5] pt-6 text-center">
                        <Text variant="secondary" className="text-sm">
                            Don&apos;t have an account?{' '}
                            <button
                                type="button"
                                onClick={() => navigate(redirectTo ? `/signup?redirectTo=${encodeURIComponent(redirectTo)}` : '/signup')}
                                className="mt-2 inline-flex items-center gap-2 font-medium text-[#0D0D0D] hover:text-[#6E6E80]"
                            >
                                <UserPlus size={14} /> Create account
                            </button>
                        </Text>
                    </div>
                </GlassCard>

                <div className="mt-8 flex items-center justify-center gap-2 text-[#6E6E80]">
                    <Shield size={12} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.24em]">Secure access</span>
                </div>
            </div>
        </div>
    );
}

```


===== src\views\SignupPage.tsx =====
```
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Heading, Text, GlassCard } from '@/components/UI/index';
import { Rocket, Shield, ArrowRight } from 'lucide-react';
import { getRouteFromReadiness } from '@/lib/contextReadiness';
import { getSafeInviteRedirect } from '@/lib/inviteRedirect';

export default function SignupPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { signUp, refreshContexts } = useAuth();
    const redirectParam = searchParams.get('redirectTo');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [organizationName, setOrganizationName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [redirectTo, setRedirectTo] = useState<string | null>(null);

    useEffect(() => {
        setRedirectTo(getSafeInviteRedirect(redirectParam));
    }, [redirectParam]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { error: signUpError } = await signUp(email, password, {
                full_name: fullName,
                organization_name: organizationName,
            }, {
                emailRedirectTo: redirectTo ? `${window.location.origin}${redirectTo}` : undefined,
            });

            if (signUpError) throw signUpError;

            if (redirectTo) {
                navigate(redirectTo, { replace: true });
                return;
            }

            const contexts = await refreshContexts();
            const route = getRouteFromReadiness(contexts, '/dashboard');
            navigate(route || '/spaces/pending', { replace: true });
        } catch (err: any) {
            setError(err.message || 'Failed to create account');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF] p-6">
            <div className="w-full max-w-[460px]">
                <GlassCard className="p-8 md:p-10">
                    <div className="mb-10 flex items-center justify-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-black text-white">
                            <Rocket size={18} />
                        </div>
                        <span className="text-lg font-semibold tracking-[-0.03em] text-[#0D0D0D]">Space.inc</span>
                    </div>

                    <div className="mb-8 text-center">
                        <Heading level={2} className="text-3xl font-semibold">
                            Create account
                        </Heading>
                        <Text variant="secondary" className="mt-2">
                            Get started with a cleaner client workspace.
                        </Text>
                    </div>

                    {error && (
                        <div className="mb-6 rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-4 text-sm text-[#B42318]">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Full Name</label>
                                <Input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="John Doe"
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Organization Name</label>
                                <Input
                                    type="text"
                                    value={organizationName}
                                    onChange={(e) => setOrganizationName(e.target.value)}
                                    placeholder="Acme Studio"
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Email Address</label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Password</label>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                                    required
                                />
                            </div>
                        </div>

                        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
                            {loading ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                                <div className="flex items-center justify-center gap-2">
                                    Create account <ArrowRight size={14} />
                                </div>
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 border-t border-[#E5E5E5] pt-6 text-center">
                        <Text variant="secondary" className="text-sm">
                            Already have an account?{' '}
                            <button
                                type="button"
                                onClick={() => navigate(redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : '/login')}
                                className="font-medium text-[#0D0D0D] hover:text-[#6E6E80]"
                            >
                                Sign in
                            </button>
                        </Text>
                    </div>
                </GlassCard>

                <div className="mt-8 flex items-center justify-center gap-2 text-[#6E6E80]">
                    <Shield size={12} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.24em]">Zero trust identity</span>
                </div>
            </div>
        </div>
    );
}

```


===== src\contexts\AuthContext.tsx =====
```
import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, onAuthStateChange } from '../lib/supabase';
import { apiService } from '../services/apiService';
import { UserContext, ContextsResponse } from '../types/context';
import { isOrganizationRole, normalizeWorkspaceRole } from '../lib/workspaceRoles';
import {
  getActivationTarget,
  getAutoRouteTarget,
  getContextReadinessDecision,
  isContextAvailable,
} from '../lib/contextReadiness';

type AuthContextType = {
  user: User | null;
  profile: any;
  session: Session | null;
  contexts: ContextsResponse | null;
  activeContext: UserContext | null;
  setActiveContext: (context: UserContext | null) => void;
  refreshContexts: () => Promise<ContextsResponse | null>;
  refreshProfile: () => Promise<void>;
  capabilities: string[];
  capabilityCache: any;
  userRole: string | null;
  organizationId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ error: any }>;
  signUp: (email: string, password: string, userData: any, options?: { emailRedirectTo?: string }) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  refreshCapabilities: () => Promise<void>;
  can: (capability: string, spaceId?: string) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Multi-context state
  const [contexts, setContexts] = useState<ContextsResponse | null>(null);
  const [activeContext, _setActiveContext] = useState<UserContext | null>(null);

  const setActiveContext = (context: UserContext | null) => {
    capabilitiesCacheRef.current = false;
    _setActiveContext(context);
    if (context) {
      setUserRole(normalizeWorkspaceRole(context.context_role));
    } else {
      setUserRole(null);
    }
  };

  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [capabilityCache, setCapabilityCache] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  
  // Refs to prevent redundant fetches
  const profileCacheRef = useRef<Record<string, any>>({});
  const capabilitiesCacheRef = useRef<boolean>(false);

  const refreshContexts = async () => {
    try {
      let response = await apiService.getMyContexts();
      let decision = getContextReadinessDecision(response);

      if (decision.kind === 'activation_required') {
        const target = getActivationTarget(response);
        if (target) {
          const activation = await apiService.activateMembershipContext(target.context_type, target.context_id);
          if (!activation.success) {
            throw new Error(`Failed to activate membership context: ${activation.error_code || 'UNKNOWN_ERROR'}`);
          }

          capabilitiesCacheRef.current = false;
          await supabase.auth.refreshSession().catch(() => null);
          response = await apiService.getMyContexts();
          decision = getContextReadinessDecision(response);
        }
      }

      setContexts(response);

      const autoRouteTarget = getAutoRouteTarget(response);
      if (autoRouteTarget) {
        setActiveContext(autoRouteTarget);
      } else if (decision.kind === 'switcher_required' && isContextAvailable(activeContext, response)) {
        setActiveContext(activeContext);
      } else if (decision.kind === 'no_contexts' || decision.kind === 'activation_required') {
        setActiveContext(null);
      }

      return response;
    } catch (err) {
      console.error('[AuthContext] Error fetching contexts:', err);
      return null;
    }
  };

  const refreshCapabilities = async () => {
    if (capabilitiesCacheRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[AuthContext] Capabilities already cached, skipping fetch');
      }
      return;
    }
    
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('[AuthContext] Refreshing capability lens...');
      }
      const { data, error } = await apiService.getCapabilityLens();
      if (error) throw error;
        if (data) {
          setCapabilityCache(data);
          // Sync userRole with activeContext if available
          if (activeContext) {
          setUserRole(normalizeWorkspaceRole(activeContext.context_role));
          } else {
          setUserRole(normalizeWorkspaceRole(data.role));
          }
        setOrganizationId(data.org_id);
        capabilitiesCacheRef.current = true;

        const allCaps = new Set<string>();
        if (data.role === 'owner' || data.role === 'admin') {
          allCaps.add(data.role);
          ['can_view_dashboard', 'can_view_history', 'can_view_all_spaces', 'can_manage_team', 'can_view_tasks', 'can_view_meetings', 'can_view_files', 'can_view_settings'].forEach(c => allCaps.add(c));
        } else if (data.role === 'staff') {
           data.assigned_spaces?.forEach((s: any) => {
             Object.entries(s.capabilities).forEach(([key, val]) => {
               if (val) allCaps.add(key.startsWith('can_') ? key : `can_${key}`);
             });
           });
           allCaps.add('can_view_dashboard');
        } else if (data.role === 'client') {
          allCaps.add('is_client_portal');
        }
        setCapabilities(Array.from(allCaps));
      }
    } catch (err) {
      console.error('[AuthContext] Error fetching capabilities:', err);
    }
  };

  const can = (capability: string, spaceId?: string): boolean => {
    if (!capabilityCache) return false;
    if (!spaceId) {
      if (isOrganizationRole(userRole)) return true;
      if (userRole === 'client' && capability === 'is_client_portal') return true;
      if (userRole === 'staff' && capability === 'can_view_dashboard') return true;
      return capabilities.includes(capability);
    }
    const space = capabilityCache.assigned_spaces?.find((s: any) => s.space_id === spaceId);
    if (!space) return false;
    const capKey = capability.startsWith('can_') ? capability.slice(4) : capability;
    return !!space.capabilities[capKey];
  };

  const fetchProfile = async (uid: string) => {
    if (profileCacheRef.current[uid]) {
      setProfile(profileCacheRef.current[uid]);
      return;
    }
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (error) throw error;
      if (!data) {
        setProfile(null);
        return;
      }
      setProfile(data);
      profileCacheRef.current[uid] = data;
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Error fetching profile:', err);
      }
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (!user?.id) return;
    delete profileCacheRef.current[user.id];
    await fetchProfile(user.id);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session: supSession } } = await supabase.auth.getSession();
        if (supSession) {
          setUser(supSession.user);
          setSession(supSession);
          await Promise.all([
            fetchProfile(supSession.user.id),
            refreshContexts()
          ]);
          await refreshCapabilities();
        }
      } catch (e) {
        console.error("Auth init failed", e);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = onAuthStateChange(async (event, currentSession) => {
      if (currentSession) {
        const isNewUser = user?.id !== currentSession.user.id;
        setUser(currentSession.user);
        setSession(currentSession);
        profileCacheRef.current = {};
        capabilitiesCacheRef.current = false;

        if (isNewUser || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          try {
            await Promise.all([
              fetchProfile(currentSession.user.id),
              refreshContexts()
            ]);
            await refreshCapabilities();
          } catch (e) {
            console.error('Post-auth data fetch failed:', e);
          } finally {
            setLoading(false);
          }
        }
      } else {
        setUser(null);
        setSession(null);
        setProfile(null);
        setContexts(null);
        setActiveContext(null);
        setCapabilities([]);
        setCapabilityCache(null);
        setUserRole(null);
        setOrganizationId(null);
        profileCacheRef.current = {};
        capabilitiesCacheRef.current = false;
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithOAuth = async (provider: 'google' | 'github') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin }
    });
    return { error };
  };

  const signUp = async (email: string, password: string, metadata: any, signUpOptions?: { emailRedirectTo?: string }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: signUpOptions?.emailRedirectTo,
      }
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const value = {
    user,
    profile,
    session,
    contexts,
    activeContext,
    setActiveContext,
    refreshContexts,
    refreshProfile,
    capabilities,
    capabilityCache,
    userRole,
    organizationId,
    loading,
    signIn,
    signInWithOAuth,
    signUp,
    signOut,
    refreshCapabilities,
    can
  };

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const shouldRenderWhileLoading =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/invite' ||
    pathname.startsWith('/invite/');

  return (
    <AuthContext.Provider value={value}>
      {(!loading || shouldRenderWhileLoading) && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

```


===== src\components\views\SpaceDetailView.tsx =====
```
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../utils/errors';
import {
    LayoutDashboard, Users, MessageSquare, Calendar, FileText, Settings, Plus, Search,
    Briefcase, ChevronRight, LogOut, Video, Download, Upload, Clock, UserPlus, ArrowRight,
    Link as LinkIcon, Copy, ListTodo, MoreVertical, Flag, Trash2, User, ArrowLeft,
    GripVertical, Activity, Shield, Lock, FileUp, Key, FilePlus as FilePlus2,
    File as DocIcon, Rocket, LayoutGrid, Inbox, UserCheck, CheckSquare, FolderClosed,
    Bell, Eye, Play, X, FileVideo, ChevronLeft, History, Mail
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
    GlassCard, Button, Heading, Text, Input, Modal, Checkbox, Toggle,
    SkeletonLoader, SkeletonCard, SkeletonText, SkeletonImage
} from '../UI/index';
import { FileViewerModal } from '../FileViewerModal';
import { FileUploadModal } from '../FileUploadModal';
import { FileVersionsModal } from '../FileVersionsModal';
import { SurfaceDock } from '../SurfaceDock';
import { ClientSpace, ViewState, Meeting, Message, StaffMember, Task, SpaceFile, ChartData, ClientLifecycle } from '../../types';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useRealtimeFiles } from '../../hooks/useRealtimeFiles';
import SpaceChatPanel from './SpaceChatPanel';
import { CalendarWidget } from '../CalendarWidget';
import TaskWorkspace from '../tasks/TaskWorkspace';
import { usePermissions } from "../../hooks/usePermissions";
import { SpaceInviteLinkCard } from '../invite/SpaceInviteLinkCard';

type SpaceDetailTab = 'Dashboard' | 'Chat' | 'Meetings' | 'Tasks' | 'Docs';


// 3. Space Detail View
const SpaceDetailView = ({ spaceId, space: initialSpace, meetings, onBack, onJoin, onSchedule, onInstantMeet, onEndMeeting, onDeleteMeeting, activeTab: activeTabProp, onTabChange }: { spaceId: string, space?: ClientSpace, meetings: Meeting[], onBack: () => void, onJoin: (id: string) => void, onSchedule: (data: any) => void, onInstantMeet: (spaceId: string) => void, onEndMeeting?: (id: string, outcome: string, notes: string) => void, onDeleteMeeting?: (meetingId: string) => void, activeTab?: SpaceDetailTab, onTabChange?: (tab: SpaceDetailTab) => void }) => {
    const navigate = useNavigate();
    const { user, profile, organizationId, userRole, session } = useAuth();
    const { permissions, isLoading: permissionsLoading } = usePermissions(spaceId);
    const { showToast } = useToast();

    const [space, setSpace] = useState<ClientSpace | undefined>(initialSpace);
    const [spaceLoading, setSpaceLoading] = useState(!initialSpace);
    const [isUpdatingSpaceStatus, setIsUpdatingSpaceStatus] = useState(false);
    const [showDeleteSpaceModal, setShowDeleteSpaceModal] = useState(false);

    const [spaceStats, setSpaceStats] = useState<any>(null);
    const [spaceStatsLoading, setSpaceStatsLoading] = useState(false);
    const [activityIndicators, setActivityIndicators] = useState<{
        unreadCount: number;
        upcomingMeetings: any[];
        recentFilesCount: number;
    }>({ unreadCount: 0, upcomingMeetings: [], recentFilesCount: 0 });

    const [activeTab, setActiveTab] = useState<SpaceDetailTab>(activeTabProp || 'Dashboard');
    const [members, setMembers] = useState<any[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    
    const [tasks, setTasks] = useState<Task[]>([]);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [showTrash, setShowTrash] = useState(false);
    const [viewingFile, setViewingFile] = useState<SpaceFile | null>(null);
    const [versioningFile, setVersioningFile] = useState<SpaceFile | null>(null);
    const [newMeetingDate, setNewMeetingDate] = useState('');
    const [newMeetingTime, setNewMeetingTime] = useState('');
    const [newMeetingTitle, setNewMeetingTitle] = useState(`${initialSpace?.name || 'Space'} Sync`);
    const [notifyClient, setNotifyClient] = useState(true);
    const [newMeetingCategory, setNewMeetingCategory] = useState<string>('general');
    const [meetingToEnd, setMeetingToEnd] = useState<Meeting | null>(null);
    const [endOutcome, setEndOutcome] = useState('successful');
    const [endNotes, setEndNotes] = useState('');
    const [isEnding, setIsEnding] = useState(false);
    const isClient = userRole === 'client';
    const switchTab = useCallback((tab: SpaceDetailTab) => {
        setActiveTab(tab);
        onTabChange?.(tab);
    }, [onTabChange]);
    const canManageSpace = permissions ? !!permissions.manage_spaces : (userRole === 'owner' || userRole === 'admin');
    const canInviteClients = !isClient && (permissions ? (!!permissions.manage_spaces || !!permissions.message_clients) : canManageSpace);

    const allowedSpaceStatuses = ['active', 'onboarding', 'archived', 'closed'] as const;

    const handleUpdateSpaceStatus = async (status: typeof allowedSpaceStatuses[number]) => {
        if (!spaceId) return;
        setIsUpdatingSpaceStatus(true);
        try {
            const { error } = await supabase.rpc('update_space_status', {
                p_space_id: spaceId,
                p_status: status
            });
            if (error) throw error;
            setSpace((current) => current ? { ...current, status } : current);
            showToast(`Space status updated to ${status}.`, 'success');
        } catch (err: any) {
            showToast(friendlyError(err?.message || 'Failed to update space status'), 'error');
        } finally {
            setIsUpdatingSpaceStatus(false);
        }
    };

    const handleDeleteSpace = async () => {
        if (!spaceId) return;
        try {
            const { error } = await supabase.rpc('delete_space_soft', {
                p_space_id: spaceId
            });
            if (error) throw error;
            showToast('Space removed.', 'success');
            setShowDeleteSpaceModal(false);
            onBack();
        } catch (err: any) {
            showToast(friendlyError(err?.message || 'Failed to delete space'), 'error');
        }
    };

    const loadActivityIndicators = useCallback(async () => {
        if (!spaceId || !organizationId) return;
        try {
            const { data, error } = await apiService.getSpaceDashboardData(spaceId, organizationId);
            if (error) throw error;
            
            setActivityIndicators({
                unreadCount: data.unread_messages || 0,
                upcomingMeetings: data.upcoming_meetings || [],
                recentFilesCount: data.recent_files || 0
            });
        } catch (err) {
            console.error('Failed to load activity indicators:', err);
        }
    }, [spaceId, organizationId]);

    useEffect(() => {
        setActiveTab(activeTabProp || 'Dashboard');
    }, [activeTabProp]);

    useEffect(() => {
        if (!spaceId) return;
        let cancelled = false;

        const loadSpaceFull = async () => {
            if (!spaceId) {
                if (!cancelled) setSpaceLoading(false);
                return;
            }

            if (!organizationId) {
                if (!cancelled) {
                    setSpaceLoading(false);
                    setSpace(initialSpace);
                }
                return;
            }

            if (!initialSpace) {
                setSpaceLoading(true);
                try {
                    const { data, error } = await apiService.getSpaceById(spaceId, organizationId);
                    if (!error && !cancelled) setSpace(data as ClientSpace);
                    if ((error || !data) && !cancelled) setSpace(null);
                } catch (err) {
                    console.error('Error fetching space directly:', err);
                    if (!cancelled) setSpace(null);
                } finally {
                    if (!cancelled) setSpaceLoading(false);
                }
            } else {
                setSpace(initialSpace);
                setSpaceLoading(false);
            }
        };

        const loadStats = async () => {
            if (!spaceId || !organizationId) return;
            try {
                setSpaceStatsLoading(true);
                const { data, error } = await apiService.getSpaceStats(spaceId, organizationId);
                if (error) throw error;
                if (!cancelled) setSpaceStats(data);
            } catch (err: any) {
                console.error('[SpaceDetailView] Failed to load space_stats:', err);
            } finally {
                if (!cancelled) setSpaceStatsLoading(false);
            }
        };

        const refetchMembers = async () => {
            if (!spaceId) return;
            try {
                const { data } = await supabase.rpc('get_space_members', { p_space_id: spaceId });
                setMembers(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Failed to refetch members:', err);
            }
        };

        const loadActivities = async () => {
            if (!spaceId || !organizationId) return;
            try {
                setMembersLoading(true);
                setTasksLoading(true);
                const [memRes, taskRes] = await Promise.all([
                    supabase.rpc('get_space_members', { p_space_id: spaceId }),
                    apiService.getTasks(organizationId, spaceId)
                ]);
                if (!cancelled) {
                    setMembers(Array.isArray(memRes.data) ? memRes.data : []);
                    setTasks(taskRes.data || []);
                }
            } catch (err: any) {
                console.error('Failed to load activities:', err);
            } finally {
                if (!cancelled) {
                    setMembersLoading(false);
                    setTasksLoading(false);
                }
            }
        };

        loadSpaceFull();
        loadStats();
        loadActivities();
        loadActivityIndicators();
        // Set up real-time subscription for space_memberships changes
        const channel = supabase
            .channel('space-members-' + spaceId)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'space_memberships',
                filter: `space_id=eq.${spaceId}` 
            }, () => refetchMembers())
            .subscribe();

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
        };
    }, [spaceId, initialSpace, loadActivityIndicators]);

    useEffect(() => {
        if (activeTab === 'Chat' && spaceId) {
            localStorage.setItem(`space_${spaceId}_last_seen`, new Date().toISOString());
        }
    }, [activeTab, spaceId]);

    if (spaceLoading && !space) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-20 bg-white">
                <div className="h-12 w-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
                <Heading level={2}>Entering Space...</Heading>
                <Text variant="secondary">Preparing your secure environment.</Text>
                <Button variant="ghost" className="mt-6" onClick={onBack}>
                    <ChevronLeft size={16} className="mr-2" /> Back
                </Button>
            </div>
        );
    }

    if (!space) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-20 bg-white text-center">
                <Shield size={48} className="text-zinc-200 mb-4" />
                <Heading level={2}>Space Not Found</Heading>
                <Text variant="secondary" className="max-w-xs mx-auto mt-2">The requested workspace could not be located or you don't have access.</Text>
                <Button variant="primary" className="mt-8" onClick={onBack}>
                    Return to Spaces
                </Button>
            </div>
        );
    }

    // Filter meetings for this space
    const localMeetings = meetings.filter(m => m.space_id === space.id && !m.deleted_at);

    const handleLocalSchedule = () => {
        onSchedule({
            space_id: space.id,
            title: newMeetingTitle,
            date: newMeetingDate,
            time: newMeetingTime,
            notify: notifyClient,
            category: newMeetingCategory
        });
        setIsScheduleModalOpen(false);
    };

    const { files, loading: filesLoading, refreshFiles, upsertFile, removeFile } = useRealtimeFiles(space.id, organizationId || '', showTrash);
    const { sendFile, loading: uploadLoading, uploadProgress } = useRealtimeMessages(space.id, organizationId || profile?.organization_id);

    const handleFileUpload = async (file: File) => {
        if (!organizationId) return false;

        const result = await sendFile(organizationId, file);

        if (result.success && result.fileData && !showTrash) {
            upsertFile(result.fileData);
            setTimeout(() => {
                refreshFiles();
            }, 1200);
        }

        if (result.success) {
            showToast(`${file.name} uploaded successfully`, 'success');
        } else {
            showToast('Upload failed ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â please try again', 'error');
        }

        return result.success;
    };

    const dockItems = [
        { label: 'Overview', icon: LayoutGrid, isActive: activeTab === 'Dashboard', onClick: () => switchTab('Dashboard') },
        { label: 'Chat', icon: Inbox, isActive: activeTab === 'Chat', onClick: () => switchTab('Chat') },
        { label: 'Meetings', icon: Calendar, isActive: activeTab === 'Meetings', onClick: () => switchTab('Meetings') },
        { label: 'Tasks', icon: CheckSquare, isActive: activeTab === 'Tasks', onClick: () => switchTab('Tasks') },
        { label: 'Docs', icon: FolderClosed, isActive: activeTab === 'Docs', onClick: () => switchTab('Docs') },
    ];

    const overviewMetrics = [
        {
            label: 'Messages',
            value: spaceStats?.message_count ?? 0,
            hint: activityIndicators.unreadCount > 0 ? `${activityIndicators.unreadCount} unread` : 'All caught up',
            icon: MessageSquare,
        },
        {
            label: 'Files',
            value: spaceStats?.file_count ?? activityIndicators.recentFilesCount ?? 0,
            hint: 'Shared across this space',
            icon: FolderClosed,
        },
        {
            label: 'Meetings',
            value: spaceStats?.meeting_count ?? activityIndicators.upcomingMeetings.length ?? 0,
            hint: activityIndicators.upcomingMeetings.length > 0 ? 'Upcoming sessions' : 'No meetings queued',
            icon: Calendar,
        },
    ];

    const activityChartData = [
        { name: 'Chat', value: Math.max(spaceStats?.message_count ?? 0, 1) },
        { name: 'Files', value: Math.max(spaceStats?.file_count ?? 0, 1) },
        { name: 'Meetings', value: Math.max(spaceStats?.meeting_count ?? 0, 1) },
        { name: 'Unread', value: Math.max(activityIndicators.unreadCount ?? 0, 1) },
    ];

    const memberList = Array.isArray(members) ? members : [];
    const memberPreview = memberList.slice(0, 5);

    return (
        <div className="animate-[fadeIn_0.5s_ease-out] mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-2 pb-20 md:px-0">
            {/* Navigation Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <button title="Go Back" onClick={onBack} className="p-2 rounded-[6px] border border-[#E5E5E5] bg-white hover:bg-[#F7F7F8] transition-colors">
                    <ArrowLeft size={20} className="text-[#6E6E80]" />
                </button>
                <div>
                    <h1 className="text-[24px] font-semibold tracking-[-0.04em] text-[#0D0D0D] md:text-[26px]">{space.name}</h1>
                    <p className="text-sm text-[#6E6E80]">Managed by You</p>
                </div>
                <div className="ml-0 flex flex-col gap-3 md:ml-auto md:flex-row md:items-center">
                    {canManageSpace && (
                        <>
                            <select
                                title="Space status"
                                value={space?.status || 'active'}
                                onChange={(e) => handleUpdateSpaceStatus(e.target.value as typeof allowedSpaceStatuses[number])}
                                disabled={isUpdatingSpaceStatus}
                                className="rounded-full border border-[#E5E5E5] bg-white px-4 py-2 text-xs font-medium text-[#0D0D0D] outline-none"
                            >
                                {allowedSpaceStatuses.map((status) => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-[#0D0D0D] border-[#E5E5E5] hover:bg-[#F7F7F8]"
                                onClick={() => setShowDeleteSpaceModal(true)}
                            >
                                <Trash2 size={14} className="mr-1" /> Delete
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Activity Indicators (Task 7) */}
            <div className="flex gap-2 flex-wrap mb-6">
                {spaceStatsLoading ? (
                    <span className="px-3 py-1 text-[10px] rounded-full bg-[#F7F7F8] text-[#6E6E80] border border-[#E5E5E5]">Loading indicators...</span>
                ) : (
                    <>
                        {activityIndicators.unreadCount > 0 && (
                            <span className="px-3 py-1 text-[10px] font-semibold rounded-full bg-[#F7F7F8] border border-[#E5E5E5] text-[#0D0D0D] flex items-center gap-1.5">
                                <div className="h-1.5 w-1.5 bg-black rounded-full animate-pulse" /> {activityIndicators.unreadCount} unread
                            </span>
                        )}
                        {activityIndicators.upcomingMeetings.length > 0 && (
                            <span className="px-3 py-1 text-[10px] font-semibold rounded-full bg-[#F7F7F8] border border-[#E5E5E5] text-[#0D0D0D] flex items-center gap-1.5">
                                <Calendar size={10} />
                                {(() => {
                                    const next = activityIndicators.upcomingMeetings[0];
                                    const date = new Date(next.starts_at);
                                    const isToday = date.toDateString() === new Date().toDateString();
                                    return isToday ? `Meeting today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `${activityIndicators.upcomingMeetings.length} upcoming meetings`;
                                })()}
                            </span>
                        )}
                        {activityIndicators.recentFilesCount > 0 && (
                            <span className="px-3 py-1 text-[10px] font-semibold rounded-full bg-[#F7F7F8] border border-[#E5E5E5] text-[#0D0D0D] flex items-center gap-1.5">
                                <FolderClosed size={10} /> {activityIndicators.recentFilesCount} new files
                            </span>
                        )}
                        {!activityIndicators.unreadCount && !activityIndicators.upcomingMeetings.length && !activityIndicators.recentFilesCount && (
                            <span className="px-3 py-1 text-[10px] rounded-full bg-white border border-[#E5E5E5] text-[#6E6E80]">No new activity</span>
                        )}
                        <span className="px-3 py-1 text-[10px] rounded-full bg-white border border-[#E5E5E5] text-[#0D0D0D] ml-auto">
                            Last active: {spaceStats?.last_activity_at ? new Date(spaceStats.last_activity_at).toLocaleString() : 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}
                        </span>
                    </>
                )}
            </div>

            {/* Content Area */}
            <div className="space-y-6">
                {activeTab === 'Dashboard' && (
                    <div className="space-y-6">
                        <GlassCard className="overflow-hidden border border-[#E5E5E5] bg-[linear-gradient(135deg,rgba(255,255,255,0.94)_0%,rgba(247,247,248,0.9)_45%,rgba(241,244,248,0.98)_100%)] p-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                            <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
                                <div className="p-5 sm:p-6">
                                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6E6E80]">
                                        <span className="rounded-full border border-[#E5E5E5] bg-white px-3 py-1">Overview</span>
                                        <span className="rounded-full border border-[#E5E5E5] bg-white px-3 py-1">{space.status || 'active'}</span>
                                        <span className="rounded-full border border-[#E5E5E5] bg-white px-3 py-1">
                                            {activityIndicators.upcomingMeetings.length > 0 ? `${activityIndicators.upcomingMeetings.length} live planning items` : 'Quiet workspace'}
                                        </span>
                                    </div>
                                    <div className="mt-4 space-y-3">
                                        <Heading level={2} className="text-[28px] leading-[1.02] tracking-[-0.05em] md:text-[34px]">
                                            {space.name}
                                        </Heading>
                                        <Text variant="secondary" className="max-w-2xl text-[14px] leading-relaxed">
                                            Keep the workspace moving with one clear overview for messages, files, meetings, and task flow.
                                            The board below surfaces the most useful signals first, with the rest tucked into focused cards.
                                        </Text>
                                    </div>
                                    <div className="mt-6 flex flex-wrap gap-2">
                                        {(isClient || (permissions ? permissions.upload_files : true)) && (
                                            <Button variant="secondary" className="justify-start rounded-[18px] px-4 py-3" onClick={() => {
                                                setIsUploadModalOpen(true);
                                                switchTab('Docs');
                                            }}>
                                                <Upload size={16} className="mr-2" /> Upload Document
                                            </Button>
                                        )}
                                        {(isClient || (permissions ? permissions.message_clients : true)) && (
                                            <Button variant="secondary" className="justify-start rounded-[18px] px-4 py-3" onClick={() => switchTab('Chat')}>
                                                <MessageSquare size={16} className="mr-2" /> Open Chat
                                            </Button>
                                        )}
                                        {(isClient || (permissions ? permissions.manage_tasks : true)) && (
                                            <Button variant="secondary" className="justify-start rounded-[18px] px-4 py-3" onClick={() => switchTab('Tasks')}>
                                                <ListTodo size={16} className="mr-2" /> Open Tasks
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="border-t border-[#E5E5E5] bg-white/70 p-5 sm:p-6 lg:border-l lg:border-t-0">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6E6E80]">Activity mix</p>
                                            <Heading level={3} className="mt-1 text-[20px] tracking-[-0.04em]">Live signal snapshot</Heading>
                                        </div>
                                        <span className="rounded-full border border-[#E5E5E5] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6E6E80]">
                                            Last active {spaceStats?.last_activity_at ? new Date(spaceStats.last_activity_at).toLocaleDateString() : 'Ã¢â‚¬â€'}
                                        </span>
                                    </div>
                                    <div className="mt-5 h-[180px] rounded-[24px] border border-[#E5E5E5] bg-white p-3">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={activityChartData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="spaceActivityFill" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#111111" stopOpacity={0.24} />
                                                        <stop offset="100%" stopColor="#111111" stopOpacity={0.02} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ECECEC" vertical={false} />
                                                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#6E6E80', fontSize: 11 }} />
                                                <YAxis hide />
                                                <Tooltip
                                                    contentStyle={{
                                                        borderRadius: 16,
                                                        border: '1px solid #E5E5E5',
                                                        background: '#FFFFFF',
                                                        boxShadow: '0 12px 30px rgba(0,0,0,0.08)'
                                                    }}
                                                    labelStyle={{ color: '#0D0D0D', fontWeight: 600 }}
                                                />
                                                <Area type="monotone" dataKey="value" stroke="#111111" fill="url(#spaceActivityFill)" strokeWidth={2.5} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="mt-4 grid grid-cols-3 gap-3">
                                        {overviewMetrics.map((metric) => {
                                            const Icon = metric.icon;
                                            return (
                                                <div key={metric.label} className="rounded-[22px] border border-[#E5E5E5] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                                                    <div className="flex items-center justify-between">
                                                        <Icon size={16} className="text-[#6E6E80]" />
                                                        <span className="text-[10px] uppercase tracking-[0.2em] text-[#6E6E80]">{metric.label}</span>
                                                    </div>
                                                    <div className="mt-3 text-[30px] font-semibold tracking-[-0.05em] text-[#0D0D0D]">{metric.value}</div>
                                                    <p className="mt-1 text-[11px] text-[#6E6E80]">{metric.hint}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </GlassCard>

                        <div className={`grid grid-cols-1 gap-6 ${canInviteClients ? 'xl:grid-cols-3' : 'xl:grid-cols-[1.1fr_0.9fr]'}`}>
                            <SpaceInviteLinkCard
                                spaceId={space.id}
                                spaceName={space.name}
                                canInvite={canInviteClients}
                            />

                            <GlassCard className="border border-[#E5E5E5] bg-white/95 p-5 sm:p-6">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6E6E80]">People & control</p>
                                            <Heading level={3} className="mt-1 text-[22px] tracking-[-0.04em]">Space Members</Heading>
                                        </div>
                                        <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6E6E80]">
                                        {memberList.length} total
                                        </span>
                                    </div>
                                <div className="mt-4 grid gap-3">
                                    {membersLoading ? (
                                        <SkeletonText lines={3} />
                                    ) : memberPreview.length > 0 ? (
                                        memberPreview.map(member => (
                                            <button
                                                key={member.profile_id}
                                                type="button"
                                                onClick={() => switchTab('Chat')}
                                                className="flex items-center gap-3 rounded-[20px] border border-[#E5E5E5] bg-[#F7F7F8]/70 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-[#D4D4D8] hover:bg-white"
                                            >
                                                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[14px] bg-black text-xs font-semibold uppercase text-white">
                                                    {member.avatar_url ? (
                                                        <img src={member.avatar_url} alt={member.full_name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        member.full_name?.charAt(0) || <User size={14} />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="truncate text-sm font-medium text-[#0D0D0D]">
                                                            {member.full_name || 'Pending User'}
                                                        </p>
                                                        <div className={`h-2 w-2 rounded-full ${member.is_online ? 'bg-black' : 'bg-[#D4D4D8]'}`} title={member.is_online ? 'Online' : 'Offline'} />
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                                        <span className="rounded-full border border-[#E5E5E5] bg-white px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#0D0D0D]">
                                                            {member.membership_role}
                                                        </span>
                                                        <span className="text-[10px] text-[#6E6E80]">
                                                            Joined {member.joined_at ? new Date(member.joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Ã¢â‚¬â€'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <ChevronRight size={16} className="text-[#D4D4D8]" />
                                            </button>
                                        ))
                                    ) : (
                                        <div className="rounded-[20px] border border-dashed border-[#D4D4D8] bg-[#F7F7F8]/60 p-5 text-center">
                                            <p className="text-sm text-[#6E6E80]">No members yet.</p>
                                        </div>
                                    )}
                                </div>
                            </GlassCard>

                            <GlassCard className="border border-[#E5E5E5] bg-white/95 p-5 sm:p-6">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6E6E80]">Control surface</p>
                                        <Heading level={3} className="mt-1 text-[22px] tracking-[-0.04em]">Space Actions</Heading>
                                    </div>
                                    <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6E6E80]">
                                        Quick access
                                    </span>
                                </div>
                                <div className="mt-4 grid gap-3">
                                    {(isClient || (permissions ? permissions.upload_files : true)) && (
                                        <Button variant="secondary" className="w-full justify-start rounded-[18px] py-3" onClick={() => {
                                            setIsUploadModalOpen(true);
                                            switchTab('Docs');
                                        }}>
                                            <Upload size={16} className="mr-2" /> Upload Document
                                        </Button>
                                    )}
                                    {(isClient || (permissions ? permissions.message_clients : true)) && (
                                        <Button variant="secondary" className="w-full justify-start rounded-[18px] py-3" onClick={() => switchTab('Chat')}>
                                            <MessageSquare size={16} className="mr-2" /> Open Chat
                                        </Button>
                                    )}
                                    {(isClient || (permissions ? permissions.manage_tasks : true)) && (
                                        <Button variant="secondary" className="w-full justify-start rounded-[18px] py-3" onClick={() => switchTab('Tasks')}>
                                            <ListTodo size={16} className="mr-2" /> Open Tasks
                                        </Button>
                                    )}
                                </div>
                            </GlassCard>
                        </div>

                        <GlassCard className="overflow-hidden border border-[#E5E5E5] bg-white/95 p-0">
                            <div className="flex items-center justify-between gap-4 border-b border-[#E5E5E5] px-5 py-4 sm:px-6">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6E6E80]">Scheduling</p>
                                    <Heading level={3} className="mt-1 text-[22px] tracking-[-0.04em]">{space.name} Calendar</Heading>
                                </div>
                                <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6E6E80]">
                                    {localMeetings.length} meetings
                                </span>
                            </div>
                            <div className="p-4 sm:p-6">
                                <CalendarWidget
                                    meetings={localMeetings}
                                    tasks={tasks}
                                    spaces={[space].filter(Boolean)}
                                    defaultSpaceId={space.id}
                                    showSpaceFilter={false}
                                    showTypeFilter={true}
                                    title=""
                                />
                            </div>
                        </GlassCard>
                    </div>
                )}
                {activeTab === 'Chat' && (
                    <SpaceChatPanel spaceId={space.id} spaceName={space.name} />
                )}
                {activeTab === 'Meetings' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-medium">Space Meetings</h3>
                                <p className="text-xs text-zinc-500">Scheduled and live calls for this workspace.</p>
                            </div>
                            <div className="flex gap-2">
                                {(permissions ? permissions.schedule_meetings : true) && (
                                    <>
                                        <Button variant="secondary" size="sm" onClick={() => onInstantMeet(space.id)}>
                                            <Video size={14} className="mr-1" /> Meet Now
                                        </Button>
                                        <Button variant="primary" size="sm" onClick={() => setIsScheduleModalOpen(true)}>
                                            <Plus size={14} className="mr-1" /> Schedule
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        {localMeetings.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {localMeetings.map(m => {
    const isEnded = m.status === 'ended' || m.status === 'cancelled';
    return (
        <GlassCard key={m.id} className="p-4 flex flex-col justify-between h-auto">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <p className="font-semibold text-sm truncate max-w-[200px]">{m.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-zinc-500 uppercase">
                            {isEnded ? m.status : m.status}
                        </span>
                        {!isEnded && (m.status === 'active' || m.status === 'live') && (
                            <span className="text-emerald-500 font-bold text-[10px] flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> LIVE
                            </span>
                        )}
                        {isEnded && m.outcome && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                m.outcome === 'successful' ? 'bg-emerald-100 text-emerald-700' :
                                m.outcome === 'no_show' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                            }`}>
                                {m.outcome.replace(/_/g, ' ')}
                            </span>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold">{new Date(m.starts_at).toLocaleDateString()}</p>
                    <p className="text-[10px] text-zinc-400">{new Date(m.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
            </div>
            <div className="flex gap-2 w-full mt-2">
                <Button
                    variant={isEnded ? 'outline' : 'primary'}
                    size="sm"
                    className={`flex-1 ${isEnded ? 'text-[#0D0D0D] border-[#E5E5E5] hover:bg-[#F7F7F8]' : ''}`}
                    onClick={() => !isEnded ? onJoin(m.id) : navigate(`/spaces/${spaceId}/meetings/${m.id}/review`)}
                >
                    {isEnded ? 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ Review Details' : 'Enter Lobby'}
                </Button>
                {!isEnded && ['owner', 'admin', 'staff'].includes(userRole || '') && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-[#0D0D0D] border-[#E5E5E5] hover:bg-[#F7F7F8] px-3"
                        onClick={() => {
                            setEndOutcome('successful');
                            setEndNotes('');
                            setMeetingToEnd(m);
                        }}
                        title="End Meeting"
                    >
                        <Flag size={14} /> 
                    </Button>
                )}
                {['owner', 'admin', 'staff'].includes(userRole || '') && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="px-2 text-red-500 hover:bg-red-50 border-red-100"
                        onClick={() => {
                            if (window.confirm('Delete this meeting?')) {
                                onDeleteMeeting?.(m.id);
                            }
                        }}
                        title="Delete Meeting"
                    >
                        <Trash2 size={16} />
                    </Button>
                )}
            </div>
        </GlassCard>
    );
})}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200">
                                <Video size={40} className="text-zinc-300 mb-3 opacity-50" />
                                <p className="text-zinc-500 text-sm italic">No recordings or upcoming meetings found.</p>
                            </div>
                        )}

                        {/* Space-specific Schedule Modal */}
                        <Modal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)} title={`Schedule Meeting for ${space.name}`}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Meeting Title</label>
                                    <Input placeholder="e.g. Project Discovery Sync" value={newMeetingTitle} onChange={e => setNewMeetingTitle(e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1">Date</label>
                                        <Input type="date" value={newMeetingDate} onChange={e => setNewMeetingDate(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1">Time</label>
                                        <Input type="time" value={newMeetingTime} onChange={e => setNewMeetingTime(e.target.value)} />
                                    </div>
                                </div>
                                <Toggle label="Notify Client (Email & Push)" checked={notifyClient} onChange={setNotifyClient} />
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Category</label>
                                    <select
                                        value={newMeetingCategory}
                                        onChange={(e) => setNewMeetingCategory(e.target.value)}
                                        className="w-full bg-white/40 border border-zinc-200 rounded-lg px-5 py-3 text-zinc-800 text-sm focus:outline-none"
                                        title="Meeting category"
                                    >
                                        <option value="sales_call">Sales Call</option>
                                        <option value="onboarding">Onboarding</option>
                                        <option value="check_in">Check-in</option>
                                        <option value="project_review">Project Review</option>
                                        <option value="strategy">Strategy</option>
                                        <option value="general">General</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <Button className="w-full mt-4" onClick={handleLocalSchedule}>Schedule for this Space</Button>
                            </div>
                        </Modal>

                        {/* End Meeting Modal */}
                        <Modal isOpen={!!meetingToEnd} onClose={() => !isEnding && setMeetingToEnd(null)} title="End meeting for everyone?">
                            <div className="space-y-4">
                                <Text variant="secondary" className="mb-2">This marks the meeting as complete and notifies all participants.</Text>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-2">Outcome</label>
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        {[
                                            { id: 'successful', label: 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Successful' },
                                            { id: 'follow_up_needed', label: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾ Follow-up' },
                                            { id: 'no_show', label: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ‚Â» No Show' },
                                            { id: 'inconclusive', label: 'ÃƒÂ¢Ã‚ÂÃ¢â‚¬Å“ Inconclusive' },
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setEndOutcome(opt.id)}
                                                className={`px-3 py-2 rounded-xl border text-sm transition-all ${
                                                    endOutcome === opt.id
                                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold shadow-sm'
                                                        : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-2">Notes (optional)</label>
                                    <textarea
                                        value={endNotes}
                                        onChange={e => setEndNotes(e.target.value)}
                                        placeholder="Add any final unstructured notes..."
                                        disabled={isEnding}
                                        className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 min-h-[100px]"
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button variant="secondary" className="flex-1" onClick={() => setMeetingToEnd(null)} disabled={isEnding}>Cancel</Button>
                                    <Button variant="primary" className="flex-1 bg-rose-600 hover:bg-rose-700 border-rose-600 text-white" disabled={isEnding} onClick={async () => {
                                        if (meetingToEnd && onEndMeeting) {
                                            setIsEnding(true);
                                            await onEndMeeting(meetingToEnd.id, endOutcome, endNotes);
                                            setIsEnding(false);
                                            setMeetingToEnd(null);
                                        }
                                    }}>
                                        {isEnding ? 'Ending...' : 'End Meeting'}
                                    </Button>
                                </div>
                            </div>
                        </Modal>
                    </div>
                )}
                {activeTab === 'Tasks' && (
                    <TaskWorkspace
                        tasks={tasks}
                        clients={[space]}
                        loading={tasksLoading}
                        title={`${space.name} Tasks`}
                        subtitle="Manage action items for this workspace with the same multi-view system used in the main overview."
                        allowCreate={permissions ? !!permissions.manage_tasks : true}
                        scopeSpaceId={space.id}
                        groupOptions={['Design', 'Engineering', 'Marketing']}
                        emptyTitle="No tasks assigned to this space"
                        emptyDescription="Create the next action item here and move it through To Do, In Progress, Review, and Done."
                        onCreateTask={async (draft) => {
                            if (!organizationId) return;
                            try {
                                const { data, error } = await apiService.createTask(
                                    {
                                        ...draft,
                                        space_id: space.id,
                                        status: draft.status || 'todo'
                                    },
                                    organizationId
                                );
                                if (error) throw error;
                                if (data) {
                                    setTasks((current) => [data as Task, ...current]);
                                    showToast('Task created.', 'success');
                                }
                            } catch (err: any) {
                                showToast(friendlyError(err?.message || 'Failed to create task'), 'error');
                            }
                        }}
                        onUpdateTask={async (taskId, updates) => {
                            if (!organizationId) return;
                            try {
                                const { error } = await apiService.updateTask(taskId, updates, organizationId);
                                if (error) throw error;
                                setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...updates } : task));
                            } catch (err: any) {
                                showToast(friendlyError(err?.message || 'Failed to update task'), 'error');
                            }
                        }}
                    />
                )}
                {activeTab === 'Docs' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Heading level={2}>{showTrash ? 'Trash' : 'Documents'}</Heading>
                            <div className="flex gap-2">
                                {(permissions ? permissions.delete_own_files : true) && (
                                    <Button variant="ghost" onClick={() => setShowTrash(!showTrash)} className={showTrash ? 'text-rose-500 bg-rose-50' : ''}>
                                        <Trash2 size={16} className="mr-1" /> {showTrash ? 'Exit Trash' : 'Trash'}
                                    </Button>
                                )}
                                {(permissions ? permissions.upload_files : true) && (
                                    <Button size="sm" onClick={() => setIsUploadModalOpen(true)}>
                                        <Upload size={16} className="mr-1" /> Upload
                                    </Button>
                                )}
                            </div>
                        </div>

                        {filesLoading ? (
                            <div className="flex items-center justify-center py-12 text-zinc-400">
                                <p className="animate-pulse">Loading documents...</p>
                            </div>
                        ) : files.length === 0 ? (
                            <GlassCard className="p-12 flex flex-col items-center justify-center text-center">
                                <FileText size={48} className="text-zinc-200 mb-4" />
                                <Heading level={3} className="text-zinc-400">{showTrash ? 'Trash is empty' : 'No documents yet'}</Heading>
                                <Text variant="secondary" className="max-w-xs mt-2">
                                    {showTrash ? 'Files you moved to trash will appear here for 30 days.' : 'Upload documents to share them securely with this client.'}
                                </Text>
                            </GlassCard>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {files.map(file => (
                                    <GlassCard key={file.id} className="p-4 flex justify-between items-center group hover:border-zinc-300 transition-all shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400">
                                                <DocIcon size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-[#1D1D1D]">{file.name}</p>
                                                    {!showTrash && file.status && file.status !== 'available' && (
                                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                                            file.status === 'pending'
                                                                ? 'bg-[#F7F7F8] text-[#6E6E80] border border-[#E5E5E5]'
                                                                : 'bg-[#F7F7F8] text-[#6E6E80] border border-[#E5E5E5]'
                                                        }`}>
                                                            {file.status === 'pending' ? 'Uploading' : 'Processing'}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-zinc-500">
                                                    {file.file_size ? `${(file.file_size / (1024 * 1024)).toFixed(2)} MB` : 'Size unknown'} ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ {new Date(file.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {!showTrash ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950"
                                                        onClick={() => setViewingFile(file as any)}
                                                        title="Preview"
                                                        aria-label={`Preview ${file.name}`}
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    {(permissions ? permissions.download_files : true) && (
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                const { data } = await apiService.getSignedUrl(file.id, organizationId || '');
                                                                if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                                            }}
                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950"
                                                            title="Download"
                                                            aria-label={`Download ${file.name}`}
                                                        >
                                                            <Download size={16} />
                                                        </button>
                                                    )}
                                                    {(permissions ? permissions.upload_files : true) && (
                                                        <button
                                                            type="button"
                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#6E6E80] shadow-sm transition-all hover:border-[#E5E5E5] hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                                                            onClick={() => setVersioningFile(file as any)}
                                                            title="Version History"
                                                            aria-label={`View version history for ${file.name}`}
                                                        >
                                                            <History size={16} />
                                                        </button>
                                                    )}
                                                    {(permissions ? permissions.delete_own_files : true) && (
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                if (confirm('Are you sure you want to move this file to trash?')) {
                                                            try {
                                                                await apiService.deleteFile(file.id, organizationId || '');
                                                                removeFile(file.id);
                                                                showToast('File moved to trash.', "success");
                                                                    } catch (err: any) {
                                                                        showToast(friendlyError(err?.message), "error");
                                                                    }
                                                                }
                                                            }}
                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#6E6E80] shadow-sm transition-all hover:border-[#E5E5E5] hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                                                            title="Move to trash"
                                                            aria-label={`Move ${file.name} to trash`}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            try {
                                                                await apiService.restoreFile(file.id, organizationId || '');
                                                                removeFile(file.id);
                                                                showToast('File restored.', "success");
                                                            } catch (err: any) {
                                                                    showToast(friendlyError(err?.message), "error");
                                                            }
                                                        }}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                                                        title="Restore File"
                                                        aria-label={`Restore ${file.name}`}
                                                    >
                                                        <ArrowLeft size={16} />
                                                    </button>
                                                    {(permissions ? permissions.delete_own_files : true) && (
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                if (confirm('PERMANENT DELETE: Are you sure? This cannot be undone.')) {
                                                                    try {
                                                                        await apiService.hardDeleteFile(file.id, organizationId || '');
                                                                        removeFile(file.id);
                                                                        showToast('File permanently deleted.', "success");
                                                                    } catch (err: any) {
                                                                        showToast(friendlyError(err?.message), "error");
                                                                    }
                                                                }
                                                            }}
                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                                                            title="Delete Permanently"
                                                            aria-label={`Delete ${file.name} permanently`}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </GlassCard>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Modal
                isOpen={showDeleteSpaceModal}
                onClose={() => setShowDeleteSpaceModal(false)}
                title="Delete Space?"
            >
                <div className="space-y-4">
                    <Text variant="secondary">
                        This will archive the space and remove it from the active workspace list.
                    </Text>
                    <div className="flex gap-3 pt-2">
                        <Button variant="secondary" className="flex-1" onClick={() => setShowDeleteSpaceModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" className="flex-1 bg-black hover:bg-[#1A1A1A]" onClick={handleDeleteSpace}>
                            Delete Space
                        </Button>
                    </div>
                </div>
            </Modal>

            <FileUploadModal
                isOpen={activeTab !== 'Chat' && isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onUpload={handleFileUpload}
                loading={uploadLoading}
                uploadProgress={uploadProgress}
            />

            {viewingFile && (
                <FileViewerModal
                    fileId={viewingFile.id}
                    filename={viewingFile.name}
                    mimeType={viewingFile.mime_type || 'application/pdf'}
                    onClose={() => setViewingFile(null)}
                />
            )}

            <FileVersionsModal
                isOpen={!!versioningFile}
                onClose={() => setVersioningFile(null)}
                file={versioningFile}
            />

            <SurfaceDock items={dockItems} />
        </div>
    );
};
export default SpaceDetailView;

```


===== src\components\views\StaffView.tsx =====
```
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import {
  ChevronDown,
  Filter,
  LayoutGrid,
  List,
  MailPlus,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { GlassCard, Button, Toggle } from '../UI/index';
import { ClientSpace, StaffMember } from '../../types';
import { TeamMemberInviteModal } from '../invite/TeamMemberInviteModal';

type WorkloadBand = 'unassigned' | 'light' | 'balanced' | 'heavy';
type ViewMode = 'cards' | 'list';
type StatusFilter = 'all' | 'active' | 'pending';
type WorkloadFilter = 'all' | WorkloadBand;
type FilterGroup = 'Role' | 'Status' | 'Workload';
type FilterOption = {
  id: string;
  label: string;
  group: FilterGroup;
  active: boolean;
  onSelect: () => void;
};

const roleGroupOrder = ['Leadership', 'Administrators', 'Team'];

const getRoleLabel = (role: StaffMember['role']) => {
  if (role === 'owner') return 'Organization Owner';
  if (role === 'admin') return 'Team Administrator';
  return 'Staff Operator';
};

const getRoleGroup = (role: StaffMember['role']) => {
  if (role === 'owner') return 'Leadership';
  if (role === 'admin') return 'Administrators';
  return 'Team';
};

const getInitials = (fullName: string) =>
  fullName
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

const getWorkloadBand = (assignedCount: number, totalSpaces: number): WorkloadBand => {
  if (assignedCount === 0) return 'unassigned';
  const ratio = totalSpaces > 0 ? assignedCount / totalSpaces : 0;
  if (ratio < 0.35) return 'light';
  if (ratio < 0.7) return 'balanced';
  return 'heavy';
};

const getWorkloadLabel = (band: WorkloadBand) => {
  if (band === 'unassigned') return 'Unassigned';
  if (band === 'light') return 'Light load';
  if (band === 'balanced') return 'Balanced';
  return 'Heavy load';
};

const getCapabilitySummary = (member: StaffMember) => {
  const capabilityCount = member.assigned_spaces?.reduce((sum, space) => sum + (space.capabilities?.length || 0), 0) || 0;
  if ((member.assigned_spaces?.length || 0) === 0) return 'No active space coverage yet';
  if (capabilityCount === 0) return 'Space assignment active';
  return `${capabilityCount} access rules enabled`;
};

const getCoveragePercent = (assignedCount: number, totalSpaces: number) => {
  if (totalSpaces === 0) return 0;
  return Math.max(8, Math.min(Math.round((assignedCount / totalSpaces) * 100), 100));
};

const StaffView: React.FC<{
  staff: StaffMember[];
  spaces: ClientSpace[];
  onUpdateCapability: (staffId: string, spaceId: string, allowed: boolean) => void;
  onRefresh?: () => void;
}> = ({ staff, spaces, onUpdateCapability, onRefresh }) => {
  const { showToast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'owner' | 'admin' | 'staff'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [workloadFilter, setWorkloadFilter] = useState<WorkloadFilter>('all');
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [openFilterGroup, setOpenFilterGroup] = useState<FilterGroup | null>('Role');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const filterPanelRef = useRef<HTMLDivElement | null>(null);

  const enrichedStaff = useMemo(() => {
    const totalSpaces = spaces.length;

    return staff.map((member) => {
      const assignedCount = member.assigned_spaces?.length || 0;
      const workloadBand = getWorkloadBand(assignedCount, totalSpaces);
      const coveragePercent = getCoveragePercent(assignedCount, totalSpaces);
      const assignedNames = member.assigned_spaces
        ?.map((assigned) => spaces.find((space) => space.id === assigned.space_id)?.name)
        .filter(Boolean)
        .slice(0, 3) as string[] | undefined;

      return {
        ...member,
        displayRole: getRoleLabel(member.role),
        group: getRoleGroup(member.role),
        initials: getInitials(member.full_name),
        assignedCount,
        workloadBand,
        workloadLabel: getWorkloadLabel(workloadBand),
        coveragePercent,
        coverageText: totalSpaces > 0 ? `${assignedCount}/${totalSpaces} spaces` : `${assignedCount} spaces`,
        capabilitySummary: getCapabilitySummary(member),
        assignedNames: assignedNames || [],
      };
    });
  }, [spaces, staff]);

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return enrichedStaff.filter((member) => {
      const matchesSearch =
        !q ||
        [
          member.full_name,
          member.email,
          member.role,
          member.displayRole,
          ...member.assignedNames,
        ].some((value) => String(value || '').toLowerCase().includes(q));

      const matchesRole = roleFilter === 'all' || member.role === roleFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? member.is_active : !member.is_active);
      const matchesWorkload = workloadFilter === 'all' || member.workloadBand === workloadFilter;

      return matchesSearch && matchesRole && matchesStatus && matchesWorkload;
    });
  }, [enrichedStaff, roleFilter, searchQuery, statusFilter, workloadFilter]);

  const groupedStaff = useMemo(() => {
    return roleGroupOrder
      .map((group) => ({
        group,
        members: filteredStaff.filter((member) => member.group === group),
      }))
      .filter((entry) => entry.members.length > 0);
  }, [filteredStaff]);

  const activeCount = filteredStaff.filter((member) => member.is_active).length;
  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (roleFilter !== 'all') parts.push(`Role: ${roleFilter}`);
    if (statusFilter !== 'all') parts.push(`Status: ${statusFilter}`);
    if (workloadFilter !== 'all') parts.push(`Load: ${workloadFilter}`);
    return parts;
  }, [roleFilter, statusFilter, workloadFilter]);

  const filterOptions = useMemo<FilterOption[]>(() => ([
    { id: 'role-all', label: 'All roles', group: 'Role', active: roleFilter === 'all', onSelect: () => setRoleFilter('all') },
    { id: 'role-owner', label: 'Owner', group: 'Role', active: roleFilter === 'owner', onSelect: () => setRoleFilter('owner') },
    { id: 'role-admin', label: 'Admin', group: 'Role', active: roleFilter === 'admin', onSelect: () => setRoleFilter('admin') },
    { id: 'role-staff', label: 'Staff', group: 'Role', active: roleFilter === 'staff', onSelect: () => setRoleFilter('staff') },
    { id: 'status-all', label: 'All statuses', group: 'Status', active: statusFilter === 'all', onSelect: () => setStatusFilter('all') },
    { id: 'status-active', label: 'Active', group: 'Status', active: statusFilter === 'active', onSelect: () => setStatusFilter('active') },
    { id: 'status-pending', label: 'Pending', group: 'Status', active: statusFilter === 'pending', onSelect: () => setStatusFilter('pending') },
    { id: 'workload-all', label: 'All workload', group: 'Workload', active: workloadFilter === 'all', onSelect: () => setWorkloadFilter('all') },
    { id: 'workload-balanced', label: 'Balanced', group: 'Workload', active: workloadFilter === 'balanced', onSelect: () => setWorkloadFilter('balanced') },
    { id: 'workload-light', label: 'Light load', group: 'Workload', active: workloadFilter === 'light', onSelect: () => setWorkloadFilter('light') },
    { id: 'workload-heavy', label: 'Heavy load', group: 'Workload', active: workloadFilter === 'heavy', onSelect: () => setWorkloadFilter('heavy') },
    { id: 'workload-unassigned', label: 'Unassigned', group: 'Workload', active: workloadFilter === 'unassigned', onSelect: () => setWorkloadFilter('unassigned') },
  ]), [roleFilter, statusFilter, workloadFilter]);

  const visibleFilterOptions = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return filterOptions;
    return filterOptions.filter((option) =>
      `${option.group} ${option.label}`.toLowerCase().includes(q)
    );
  }, [filterOptions, filterQuery]);

  const groupedVisibleFilterOptions = useMemo(
    () =>
      (['Role', 'Status', 'Workload'] as FilterGroup[]).map((group) => ({
        group,
        options: visibleFilterOptions.filter((option) => option.group === group),
      })),
    [visibleFilterOptions]
  );

  const activeGroupSummary = useMemo<Record<FilterGroup, string>>(
    () => ({
      Role: roleFilter === 'all' ? 'All roles' : roleFilter,
      Status: statusFilter === 'all' ? 'All statuses' : statusFilter,
      Workload: workloadFilter === 'all' ? 'All workload' : workloadFilter,
    }),
    [roleFilter, statusFilter, workloadFilter]
  );

  useEffect(() => {
    if (!isFilterOpen) return;
    filterInputRef.current?.focus();
  }, [isFilterOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filterQuery, isFilterOpen]);

  useEffect(() => {
    if (!filterQuery.trim()) return;
    const firstNonEmptyGroup = groupedVisibleFilterOptions.find((entry) => entry.options.length > 0)?.group || null;
    setOpenFilterGroup(firstNonEmptyGroup);
  }, [filterQuery, groupedVisibleFilterOptions]);

  useEffect(() => {
    if (!isFilterOpen) return;

    const handleOutside = (event: MouseEvent) => {
      if (!filterPanelRef.current?.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isFilterOpen]);

  const handleFilterKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (visibleFilterOptions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % visibleFilterOptions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((current) => (current - 1 + visibleFilterOptions.length) % visibleFilterOptions.length);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      visibleFilterOptions[highlightedIndex]?.onSelect();
    }

    if (event.key === 'Escape') {
      setIsFilterOpen(false);
    }
  };

  const handleToggleSpace = (staffUserId: string, spaceId: string, currentValue: boolean) => {
    onUpdateCapability(staffUserId, spaceId, !currentValue);
  };

  const renderAccessMatrix = (member: (typeof filteredStaff)[number]) => (
    <div className="mt-5 space-y-3 border-t border-[#ECECEC] pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Access matrix</p>
          <p className="mt-1 text-xs text-[#6E6E80]">Toggle which client spaces this teammate can access.</p>
        </div>
        <span className="surface-chip px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]">
          {member.assignedCount} assigned
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {spaces.map((space) => {
          const assignment = member.assigned_spaces?.find((assignedSpace) => assignedSpace.space_id === space.id);
          const isAssigned = Boolean(assignment);
          const capabilityCount = assignment?.capabilities?.length || 0;

          return (
            <div
              key={space.id}
              className={`rounded-[12px] border px-4 py-4 transition-colors ${
                isAssigned ? 'border-[#DADADA] bg-white' : 'border-[#E5E5E5] bg-[#F7F7F8]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#0D0D0D]">{space.name}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#6E6E80]">
                    {isAssigned ? `${capabilityCount} capabilities` : 'No access'}
                  </p>
                </div>
                <Toggle checked={isAssigned} onChange={() => handleToggleSpace(member.id, space.id, isAssigned)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 page-enter">
      <GlassCard className="sheet-panel overflow-hidden p-6 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="surface-chip px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em]">
              <ShieldCheck size={14} />
              Team operations
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#0D0D0D] md:text-4xl">Team</h1>
            <p className="max-w-2xl text-sm leading-6 text-[#6E6E80] md:text-base">
              A more operational team view built on todayâ€™s real data: status, coverage, assignments, and access control.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="primary"
              className="rounded-[8px]"
              onClick={() => setIsInviteOpen(true)}
              icon={<MailPlus size={16} />}
            >
              Add Team Member
            </Button>
            <div className="surface-chip px-3 py-1.5 text-[11px] uppercase tracking-[0.18em]">
              {filteredStaff.length} team members
            </div>
            <div className="surface-chip px-3 py-1.5 text-[11px] uppercase tracking-[0.18em]">
              {activeCount} active
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="sheet-panel p-4 md:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6E6E80]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, role, or space"
              className="w-full rounded-[10px] border border-[#DADADA] bg-white py-3 pl-10 pr-4 text-sm text-[#0D0D0D] placeholder:text-[#6E6E80] focus:border-black focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative" ref={filterPanelRef}>
              <button
                type="button"
                onClick={() => setIsFilterOpen((current) => !current)}
                className={`staff-filter-trigger ${isFilterOpen ? 'staff-filter-trigger-open' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <Filter size={14} />
                  Filter
                </span>
                {activeFilterSummary.length > 0 ? (
                  <span className="staff-filter-badge">
                    {activeFilterSummary[0]}
                    {activeFilterSummary.length > 1 ? ` +${activeFilterSummary.length - 1}` : ''}
                  </span>
                ) : null}
              </button>

              {isFilterOpen ? (
                <div className="staff-filter-popover">
                  <div className="staff-filter-search">
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6E6E80]" />
                    <input
                      ref={filterInputRef}
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      onKeyDown={handleFilterKeyDown}
                      placeholder="Search filters"
                      className="w-full rounded-[10px] border border-[#DADADA] bg-white/70 py-2.5 pl-9 pr-3 text-sm text-[#0D0D0D] placeholder:text-[#6E6E80] focus:border-black focus:outline-none"
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[#6E6E80]">
                    <span>Complexity on demand</span>
                    {activeFilterSummary.length > 0 ? <span>Updating view</span> : <span>Choose filters</span>}
                  </div>

                <div className="mt-3 max-h-[280px] overflow-y-auto custom-scrollbar">
                    {visibleFilterOptions.length === 0 ? (
                      <div className="rounded-[10px] border border-[#E5E5E5] bg-white/65 px-3 py-4 text-sm text-[#6E6E80]">
                        No matching filters found.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {groupedVisibleFilterOptions.map(({ group, options }) => {
                          if (options.length === 0) return null;
                          const isOpen = openFilterGroup === group;

                          return (
                            <div key={group} className="staff-filter-group">
                              <button
                                type="button"
                                onClick={() => setOpenFilterGroup(isOpen ? null : group)}
                                className={`staff-filter-group-trigger ${isOpen ? 'staff-filter-group-trigger-open' : ''}`}
                              >
                                <span>
                                  <span className="block text-[10px] uppercase tracking-[0.18em] text-[#6E6E80]">{group}</span>
                                  <span className="mt-0.5 block text-sm font-medium text-[#0D0D0D]">
                                    {activeGroupSummary[group]}
                                  </span>
                                </span>
                                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                              </button>

                              {isOpen ? (
                                <div className="mt-2 space-y-1">
                                  {options.map((option) => {
                                    const optionIndex = visibleFilterOptions.findIndex((candidate) => candidate.id === option.id);
                                    return (
                                      <button
                                        key={option.id}
                                        type="button"
                                        onClick={option.onSelect}
                                        className={`staff-filter-option ${
                                          optionIndex === highlightedIndex ? 'staff-filter-option-highlighted' : ''
                                        } ${option.active ? 'staff-filter-option-active' : ''}`}
                                      >
                                        <span className="min-w-0">
                                          <span className="block truncate text-sm font-medium text-[#0D0D0D]">{option.label}</span>
                                        </span>
                                        {option.active ? <span className="staff-filter-option-check">On</span> : null}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <button
              onClick={() => setViewMode('cards')}
              className={`surface-chip px-3 py-2 text-xs font-medium ${viewMode === 'cards' ? 'surface-chip-active' : ''}`}
            >
              <LayoutGrid size={14} /> Cards
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`surface-chip px-3 py-2 text-xs font-medium ${viewMode === 'list' ? 'surface-chip-active' : ''}`}
            >
              <List size={14} /> List
            </button>
          </div>
        </div>
      </GlassCard>

      {viewMode === 'cards' ? (
        <div className="space-y-6">
          {groupedStaff.map(({ group, members }) => (
            <section key={group} className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#0D0D0D]">{group}</h2>
                <span className="surface-chip px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]">
                  {members.length}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {members.map((member) => {
                  const isExpanded = expandedStaffId === member.id;
                  return (
                    <GlassCard key={member.id} className="sheet-panel overflow-hidden p-5 md:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] border border-[#E5E5E5] bg-[#F7F7F8] text-sm font-semibold text-[#0D0D0D]">
                            {member.initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-lg font-semibold tracking-[-0.03em] text-[#0D0D0D]">{member.full_name}</h3>
                              <span className="surface-chip px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]">{member.role}</span>
                              <span className={`surface-chip px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${member.is_active ? 'surface-chip-active' : ''}`}>
                                {member.is_active ? 'Active' : 'Pending'}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-[#0D0D0D]">{member.displayRole}</p>
                            <p className="truncate text-xs text-[#6E6E80]">{member.email}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedStaffId(isExpanded ? null : member.id)}
                          className="surface-chip px-2.5 py-2 text-[11px] font-medium"
                        >
                          Manage
                          <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>

                      <div className="mt-5 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Space coverage</p>
                            <p className="mt-1 text-lg font-semibold text-[#0D0D0D]">{member.coverageText}</p>
                          </div>
                          <span className="surface-chip px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]">
                            {member.workloadLabel}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="h-2 overflow-hidden rounded-full bg-[#EAEAEA]">
                            <div
                              className={`h-full rounded-full ${
                                member.workloadBand === 'heavy'
                                  ? 'bg-[#0D0D0D]'
                                  : member.workloadBand === 'balanced'
                                    ? 'bg-[#4B4B55]'
                                    : member.workloadBand === 'light'
                                      ? 'bg-[#8F8F98]'
                                      : 'bg-[#D4D4D8]'
                              }`}
                              style={{ width: `${member.coveragePercent}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[#6E6E80]">
                            <span>{member.capabilitySummary}</span>
                            <span>{member.coveragePercent}%</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {member.assignedNames.length > 0 ? (
                            member.assignedNames.map((spaceName) => (
                              <span key={spaceName} className="surface-chip px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]">
                                {spaceName}
                              </span>
                            ))
                          ) : (
                            <span className="surface-chip px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]">
                              No space assignments
                            </span>
                          )}
                        </div>
                      </div>

                      {isExpanded ? renderAccessMatrix(member) : null}
                    </GlassCard>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStaff.map((member) => (
            <GlassCard key={member.id} className="sheet-panel p-4 md:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-[#0D0D0D]">{member.full_name}</h3>
                    <span className="surface-chip px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]">{member.role}</span>
                    <span className={`surface-chip px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${member.is_active ? 'surface-chip-active' : ''}`}>
                      {member.is_active ? 'Active' : 'Pending'}
                    </span>
                    <span className="surface-chip px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]">
                      {member.coverageText}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#0D0D0D]">{member.displayRole}</p>
                  <p className="mt-1 text-sm text-[#6E6E80]">{member.email}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[180px]">
                    <div className="h-2 overflow-hidden rounded-full bg-[#EAEAEA]">
                      <div
                        className={`h-full rounded-full ${
                          member.workloadBand === 'heavy'
                            ? 'bg-[#0D0D0D]'
                            : member.workloadBand === 'balanced'
                              ? 'bg-[#4B4B55]'
                              : member.workloadBand === 'light'
                                ? 'bg-[#8F8F98]'
                                : 'bg-[#D4D4D8]'
                        }`}
                        style={{ width: `${member.coveragePercent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-[#6E6E80]">{member.workloadLabel}</p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedStaffId(expandedStaffId === member.id ? null : member.id)}
                    icon={<Users size={14} />}
                  >
                    Manage access
                  </Button>
                </div>
              </div>

              {expandedStaffId === member.id ? renderAccessMatrix(member) : null}
            </GlassCard>
          ))}
        </div>
      )}

      <TeamMemberInviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        spaces={spaces}
        onInvited={onRefresh}
      />
    </div>
  );
};

export default StaffView;

```


===== src\App.tsx =====
```
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';
import LoginPage from './views/LoginPage';
import SignupPage from './views/SignupPage';
import { apiService } from './services/apiService';
import {
    Rocket,
    LayoutGrid,
    Users,
    Inbox,
    UserCheck,
    Briefcase,
    CheckSquare,
    Calendar,
    FolderClosed,
    Activity,
    Bell,
    Video,
    Shield,
    FileVideo,
    X,
    Copy,
    ArrowLeft
} from 'lucide-react';
import {
    Button,
    Heading,
    Text,
    GlassCard,
    SkeletonLoader,
    SkeletonText,
    SkeletonCard
} from './components/UI/index';
import { FileViewerModal } from './components/FileViewerModal';
import { FileUploadModal } from './components/FileUploadModal';
import {
    ClientSpace, ViewState, Meeting, Message, StaffMember, Task, SpaceFile, ChartData, ClientLifecycle
} from './types';
import { supabase } from './lib/supabase';
import { friendlyError } from './utils/errors';

// Shared Layouts
import { AppLayout } from './components/Layout';

// View Components
import StaffDashboardView from './components/views/StaffDashboardView';
import OwnerDashboardView from './components/views/OwnerDashboardView';
import SpacesView from './components/views/SpacesView';
import ClientsCRMView from './components/views/ClientsCRMView';
import StaffView from './components/views/StaffView';
import SpaceDetailView from './components/views/SpaceDetailView';
import GlobalMeetingsView from './components/views/GlobalMeetingsView';
import MeetingReviewPage from './components/views/MeetingReviewPage';
import { usePermissions } from "./hooks/usePermissions";
import TaskView from './components/views/TaskView';
import GlobalFilesView from './components/views/GlobalFilesView';
import SettingsView, { BillingSettingsView } from './components/views/SettingsView';
import InboxView from './components/views/InboxView';
import HistoryView from './components/views/HistoryView';
import ClientPortalView from './components/views/ClientPortalView';
import { MeetingRoom } from './components/MeetingRoom';
import { Routes, Route, useNavigate, Navigate, useParams } from 'react-router-dom';
import ClientSpaceRoute from './components/views/ClientSpaceRoute';
import { PermissionGuard } from "./components/auth/PermissionGuard";
import { ContextSwitcher } from './components/auth/ContextSwitcher';
import { InvitationLandingPage } from './components/invite/InvitationLandingPage';
import { InvitationAcceptPage } from './components/invite/InvitationAcceptPage';
import { supabase as _supabase } from './lib/supabase';
import { getWorkspaceRoleLabel } from './lib/workspaceRoles';
import { initializeSpaceTheme } from './lib/theme';
import {
    getContextReadinessDecision,
    getContextRoute,
    getRouteFromReadiness,
    normalizeWorkspaceRoute,
} from './lib/contextReadiness';

type SpaceDetailTab = 'Dashboard' | 'Chat' | 'Meetings' | 'Tasks' | 'Docs';

const ErrorView = ({ message }: { message: string }) => (
    <div className="h-screen w-full flex items-center justify-center bg-[#FFFFFF] p-4">
        <GlassCard className="max-w-md w-full p-8 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8]">
                <Shield className="text-[#0D0D0D]" size={32} />
            </div>
            <Heading level={2} className="mb-2">Access Denied</Heading>
            <Text className="mb-8 text-[#6E6E80]">{message}</Text>
            <Button variant="primary" className="w-full" onClick={() => window.location.assign('/')}>Return to Login</Button>
        </GlassCard>
    </div>
);

const PendingSpaceView = () => (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 font-sans">
        <div className="max-w-md w-full text-center space-y-6">
            <div className="h-20 w-20 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto">
                <Rocket size={36} className="text-zinc-400" />
            </div>
            <div className="space-y-2">
                <h1 className="text-2xl font-black tracking-tight text-zinc-900">
                    Your space isn't ready yet
                </h1>
                <p className="text-zinc-500 text-sm leading-relaxed">
                    Your workspace is being set up. You will receive access once provisioning completes.
                </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
                <div className="h-2 w-2 bg-amber-400 rounded-full animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                    Pending activation
                </span>
            </div>
        </div>
    </div>
);

const LegacyClientSpaceRedirect = () => {
    const { spaceId } = useParams<{ spaceId: string }>();
    return <Navigate to={spaceId ? `/spaces/${spaceId}` : '/dashboard'} replace />;
};

const resolveClientRoute = (route?: string | null, contextId?: string | null) => {
    return normalizeWorkspaceRoute(route) || (contextId ? `/spaces/${contextId}` : null);
};

const DashboardReadinessLoading = () => (
    <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#E5E5E5] border-t-[#0D0D0D]" />
    </div>
);

// Ã¢â€â‚¬Ã¢â€â‚¬ Client Space Picker Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Shown on /dashboard when a client has multiple space memberships.
const ClientSpacePicker: React.FC = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [spaces, setSpaces] = useState<Array<{ space_id: string; space_name: string }>>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        const load = async () => {
            try {
                const { data } = await _supabase
                    .from('space_memberships')
                    .select('space_id, spaces(name)')
                    .eq('profile_id', user.id)
                    .eq('status', 'active');
                if (data) {
                    setSpaces(data.map((m: any) => ({ space_id: m.space_id, space_name: m.spaces?.name || 'Untitled Space' })));
                }
            } catch (err) {
                console.error('[ClientSpacePicker] Error loading spaces:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user]);

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center animate-pulse">
                <div className="text-center space-y-3">
                    <div className="h-10 w-10 bg-zinc-100 rounded-xl mx-auto" />
                    <div className="h-4 w-32 bg-zinc-100 rounded mx-auto" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center p-6 font-sans">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center space-y-2">
                    <div className="h-12 w-12 bg-black rounded-[8px] flex items-center justify-center text-white mx-auto mb-4">
                        <Rocket size={24} />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight text-[#0D0D0D]">Your Spaces</h1>
                    <p className="text-[#6E6E80] text-sm">Select a workspace to continue</p>
                </div>
                <div className="space-y-3">
                    {spaces.map(s => (
                        <button
                            key={s.space_id}
                            onClick={() => navigate(`/spaces/${s.space_id}`, { replace: true })}
                            className="w-full rounded-[8px] border border-[#E5E5E5] bg-white p-4 text-left hover:bg-[#F7F7F8] transition-all"
                        >
                            <span className="font-medium text-sm text-[#0D0D0D]">{s.space_name}</span>
                        </button>
                    ))}
                </div>
                <div className="text-center pt-4">
                    <button onClick={signOut} className="text-xs text-[#6E6E80] hover:text-[#0D0D0D] font-semibold uppercase tracking-widest transition-colors">Sign Out</button>
                </div>
            </div>
        </div>
    );
};

const App = () => {
    const { user, profile, loading, userRole, organizationId, can, signOut, contexts, activeContext } = useAuth();
    const { showToast, removeToast } = useToast();
    const navigate = useNavigate();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    // Sidebar/View State
    const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
    const [currentTime, setCurrentTime] = useState(() => new Date());
    const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
    const [selectedSpaceTab, setSelectedSpaceTab] = useState<SpaceDetailTab>('Dashboard');
    const { permissions, role: permissionRole, isLoading: permissionsLoading } = usePermissions(selectedSpaceId || undefined);
    const isPublicInviteRoute = window.location.pathname === '/invite' || window.location.pathname.startsWith('/invite/');
    const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
    const [activeMeetingRoomUrl, setActiveMeetingRoomUrl] = useState<string | null>(null);
    const [meetingEntrySource, setMeetingEntrySource] = useState<{ view: ViewState; spaceId?: string } | null>(null);

    // Data State
    const [clients, setClients] = useState<ClientSpace[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [files, setFiles] = useState<SpaceFile[]>([]); // although unused in App.tsx routing now, kept for state sync if needed
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [clientLifecycle, setClientLifecycle] = useState<ClientLifecycle[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [inboxData, setInboxData] = useState<any[]>([]);

    const [isInstantMeetingModalOpen, setIsInstantMeetingModalOpen] = useState(false);
    const [instantMeetingTargetSpace, setInstantMeetingTargetSpace] = useState<string | null>(null);
    const [instantMeetingTitle, setInstantMeetingTitle] = useState('Instant Meeting');
    const [instantMeetingCategory, setInstantMeetingCategory] = useState<string>('general');

    useEffect(() => {
        initializeSpaceTheme();
    }, []);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => window.clearInterval(intervalId);
    }, []);

    useEffect(() => {
        document.documentElement.classList.remove('dark');
        window.localStorage.removeItem('dashboard-color-mode');
    }, []);

    const openSpace = (spaceId: string, tab: SpaceDetailTab = 'Dashboard') => {
        setSelectedSpaceId(spaceId);
        setSelectedSpaceTab(tab);
        setCurrentView(ViewState.SPACE_DETAIL);
    };

    useEffect(() => {
        if (user && !loading) {
            setIsAuthenticated(true);
        } else {
            setIsAuthenticated(false);
        }
    }, [user, loading]);

    // Ã¢â€â‚¬Ã¢â€â‚¬ Client role redirect Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    // If the backend has already selected a client-space context, send the user
    // there immediately. Otherwise keep the dashboard/picker/pending flow intact.
    useEffect(() => {
        if (loading || !user || !userRole) return;
        if (userRole !== 'client') return;
        if (!contexts) return;

        const pathname = window.location.pathname;
        // Only auto-redirect on /dashboard or /
        if (pathname !== '/dashboard' && pathname !== '/') return;
        // Don't redirect if already on a space route
        if (pathname.startsWith('/spaces/')) return;

        const readiness = getContextReadinessDecision(contexts);
        if (readiness.kind === 'no_contexts') {
            navigate('/spaces/pending', { replace: true });
            return;
        }

        if (readiness.kind === 'activation_required' || readiness.kind === 'not_ready') {
            const readinessRoute = getRouteFromReadiness(contexts, '/dashboard');
            if (readinessRoute && readinessRoute !== '/spaces/pending') {
                navigate(readinessRoute, { replace: true });
                return;
            }
            navigate('/spaces/pending', { replace: true });
            return;
        }

        if (readiness.kind === 'switcher_required' && !activeContext) return;

        const clientRoute =
            activeContext?.context_type === 'client_space'
                ? resolveClientRoute(activeContext.route, activeContext.context_id)
                : null;

        if (clientRoute) {
            navigate(clientRoute, { replace: true });
            return;
        }
    }, [loading, user, userRole, activeContext, contexts, navigate]);

    useEffect(() => {
        // Clients use route-level data loading and should not be blocked by
        // the org-wide dashboard preload gate.
        if (isAuthenticated && userRole === 'client') {
            setIsInitialLoading(false);
            return;
        }
        if (isAuthenticated && organizationId) {
            console.log('[App] Auth and Tenant ready, initiating data fetch...');
            // Skip full data fetch for clients Ã¢â‚¬â€ they only need their own space data
            if (userRole === 'client') return;
            fetchData();
        } else if (!loading && !user) {
            // If we're not loading and there's no user, we're on the login/signup page
            setIsInitialLoading(false);
        }
    }, [isAuthenticated, organizationId, loading, user, userRole]);

    useEffect(() => {
        if (!user || !profile) return;

        const channel = supabase
            .channel(`notifications:${user.id}`)
            .on(
                'broadcast',
                { event: 'new_notification' },
                (payload) => {
                    const { message, severity } = payload.payload;
                    showToast(message, severity === 'critical' ? 'error' : 'info');
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, profile, showToast]);

    const fetchData = async (silent = false) => {
        if (!user || !organizationId) {
            if (!silent && !loading && !user) setIsInitialLoading(false);
            return;
        }
        
        if (!silent) setIsInitialLoading(true);
        const startTime = Date.now();
        console.log('[App] Fetching organization data for:', organizationId);

        try {
            // Phase 1: Critical UI Data (Spaces, Tasks, Meetings)
            // We fetch these first to get the main dashboard ready
            const [spacesRes, tasksRes, meetingsRes] = await Promise.all([
                apiService.getSpaces(organizationId),
                apiService.getTasks(organizationId),
                apiService.getMeetings(organizationId)
            ]);

            if (spacesRes.data) setClients(spacesRes.data);
            if (tasksRes.data) setTasks(tasksRes.data);
            if (meetingsRes.data) setMeetings(meetingsRes.data);

            // Phase 2: Peripheral Data (Staff, Lifecycle, Logs, Inbox)
            // We use allSettled so that if one (like the heavy Unified Inbox or Logs) fails or is slow,
            // the rest of the app still functions.
            const peripheralResults = await Promise.allSettled([
                apiService.getStaffMembers(organizationId),
                apiService.getClientLifecycle(organizationId),
                apiService.getActivityLogs(organizationId),
                apiService.getUnifiedInbox(organizationId)
            ]);

            // Handle results individually
            if (peripheralResults[0].status === 'fulfilled') setStaff(peripheralResults[0].value as StaffMember[]);
            if (peripheralResults[1].status === 'fulfilled') setClientLifecycle(peripheralResults[1].value as ClientLifecycle[]);
            
            const logsRes = peripheralResults[2];
            if (logsRes.status === 'fulfilled' && (logsRes.value as any).data) {
                setLogs((logsRes.value as any).data);
            }

            if (peripheralResults[3].status === 'fulfilled') {
                setInboxData(peripheralResults[3].value as any[]);
            }

            console.log(`[App] Data fetch completed in ${Date.now() - startTime}ms`);
        } catch (error) {
            console.error("[App] Critical error fetching system data:", error);
            showToast("Failed to sync some data. Please check your connection.", "error");
        } finally {
            setIsInitialLoading(false);
        }
    };

    const handleJoinMeeting = (meetingId: string) => {
        // Find the meeting to determine which space it belongs to
        const meeting = meetings.find(m => m.id === meetingId);
        
        // Track where user joined from before entering meeting
        if (currentView === ViewState.SPACE_DETAIL) {
            // User is already in a space detail view
            setMeetingEntrySource({ 
                view: currentView, 
                spaceId: selectedSpaceId 
            });
        } else if (meeting && currentView === ViewState.MEETINGS) {
            // User joined from global meetings, redirect to this space's meetings tab
            setMeetingEntrySource({ 
                view: ViewState.SPACE_DETAIL, 
                spaceId: meeting.space_id 
            });
        } else {
            // Default case - redirect to current view
            setMeetingEntrySource({ 
                view: currentView, 
                spaceId: currentView === 'SPACE_DETAIL' as ViewState ? selectedSpaceId : undefined 
            });
        }
        
        setActiveMeetingId(meetingId);
    };

    const handleUpdateStaffCapability = async (staffId: string, spaceId: string, allowed: boolean) => {
        try {
            await apiService.updateStaffCapability(staffId, spaceId, allowed);
            showToast("Capability updated successfully.", "success");
            fetchData(true);
        } catch (err: any) {
            showToast(`Error updating capability: ${err.message}`, "error");
        }
    };

    const handleCreateSpace = async (data: any) => {
        const loadingId = showToast("Creating your space...", "loading");
        try {
            const { data: newSpace, error } = await apiService.createSpace(
                data.name || 'New Client',
                `Workspace for ${data.name || 'New Client'}`,
                organizationId || ''
            );

            if (error) throw error;
            if (newSpace) {
                // Handle both direct response and nested response structures
                const spaceData = newSpace.space || newSpace;
                const createdSpaceId = spaceData.id || newSpace.id || newSpace;

                const optimisticSpace: any = {
                    id: createdSpaceId,
                    name: data.name || 'New Client',
                    description: `Workspace for ${data.name || 'New Client'}`,
                    status: 'active',
                    role: 'client',
                    permission_level: 'principal',
                    message_count: 0,
                    file_count: 0,
                    meeting_count: 0,
                    member_count: 0,
                    last_activity_at: new Date().toISOString(),
                    organization_id: profile?.organization_id || '',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                setClients(prev => [optimisticSpace as ClientSpace, ...prev]);
                openSpace(optimisticSpace.id, 'Dashboard');
                fetchData();
                showToast("Space Created Successfully!", "success");
            }
        } catch (err: any) {
            showToast(`Error creating space: ${err.message}`, "error");
        } finally {
            removeToast(loadingId);
        }
    };

    const handleCreateTask = async (data: Partial<Task>) => {
        try {
            const { data: newTask, error } = await apiService.createTask(data, organizationId || '');
            if (error) throw error;
            if (newTask) setTasks((current) => [newTask, ...current]);
        } catch (err: any) {
            showToast(`Error creating task: ${err.message}`, "error");
        }
    };

    const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
        try {
            const { error } = await apiService.updateTask(taskId, updates, organizationId || '');
            if (error) throw error;
            setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...updates } : task));
        } catch (err: any) {
            showToast(`Error updating task: ${err.message}`, "error");
        }
    };

    const handleInstantMeeting = async (spaceId?: string, title?: string) => {
        try {
            const targetSpace = spaceId || instantMeetingTargetSpace || (clients.length > 0 ? clients[0].id : '');
            if (!targetSpace) {
                showToast('Please select a space first or create one.', 'info');
                return;
            }
            if (!title && !isInstantMeetingModalOpen) {
                setInstantMeetingTargetSpace(targetSpace);
                setIsInstantMeetingModalOpen(true);
                return;
            }

            const { data, error } = await apiService.createInstantMeeting({
                space_id: targetSpace,
                title: title || instantMeetingTitle || 'Instant Meeting',
                recording_enabled: true,
                category: instantMeetingCategory
            });

            if (error) {
                showToast(friendlyError(error?.message || String(error)), 'error');
                return;
            }

            // data = { meeting: {...}, roomUrl: "https://..." }
            if (data?.meeting?.id) {
                setActiveMeetingId(data.meeting.id);
                setActiveMeetingRoomUrl(data.roomUrl || data.meeting?.daily_room_url || null);
                setIsInstantMeetingModalOpen(false);
                fetchData(true);
            } else {
                showToast('Meeting created but no ID returned', 'error');
                console.error('[handleInstantMeeting] Unexpected response shape:', data);
            }
        } catch (err) {
            console.error('[handleInstantMeeting] failed:', err);
            showToast('Failed to create meeting', 'error');
        }
    };

    const handleDeleteMeeting = async (meetingId: string) => {
        // Optimistic removal Ã¢â‚¬â€ no reload needed
        setMeetings(prev => prev.filter(m => m.id !== meetingId));
        try {
            const { error } = await apiService.cancelMeeting(meetingId);
            if (error) {
                // Revert optimistic update on error
                fetchData(true);
                showToast('Failed to delete meeting. Please try again.', 'error');
            } else {
                showToast('Meeting deleted.', 'success');
            }
        } catch (err: any) {
            fetchData(true);
            showToast(friendlyError(err?.message || 'Failed to delete meeting'), 'error');
        }
    };

    const handleEndMeeting = async (meetingId: string, outcome: string, notes: string) => {
        try {
            const { error } = await apiService.endMeetingByStaff(meetingId, outcome, notes);
            if (error) throw error;
            showToast('Meeting ended successfully.', 'success');
            fetchData(true);
        } catch (err: any) {
            showToast(friendlyError(err?.message || 'Failed to end meeting'), 'error');
        }
    };

    const handleScheduleMeeting = async (data: any) => {
        try {
            const { data: newMeeting, error } = await apiService.scheduleMeeting({
                space_id: data.space_id,
                title: data.title || 'Scheduled Meeting',
                starts_at: `${data.date}T${data.time}:00Z`,
                description: data.description,
                recording_enabled: data.recording_enabled,
                category: data.category || 'general'
            });
            if (error) throw error;
            if (newMeeting) {
                setMeetings([newMeeting, ...meetings]);
                fetchData(true);
            }
        } catch (err: any) {
            showToast(friendlyError(err?.message || String(err)), "error");
        }
    };

    const renderContent = () => {
        // Sub-view rendering governed by identity first, then capabilities
        switch (currentView) {
case ViewState.DASHBOARD:
                if (permissions ? (permissions._role === 'owner' || permissions._role === 'admin') : (userRole === 'owner' || userRole === 'admin')) {
                    return (
                        <OwnerDashboardView
                            clients={clients}
                            staff={staff}
                            clientLifecycle={clientLifecycle}
                            messages={[]}
                            meetings={meetings}
                            tasks={tasks}
                            files={files}
                            profile={profile}
                            onJoin={handleJoinMeeting}
                            onInstantMeet={() => handleInstantMeeting(clients[0]?.id)}
                            onCreateSpace={handleCreateSpace}
                            onScheduleMeeting={handleScheduleMeeting}
                            onCreateTask={handleCreateTask}
                            onUpdateTask={handleUpdateTask}
                            onGoToSpace={(spaceId) => {
                                openSpace(spaceId, 'Dashboard');
                            }}
                            onGoToSpaces={() => setCurrentView(ViewState.SPACES)}
                            onGoToClients={() => setCurrentView(ViewState.CLIENTS)}
                            onGoToStaff={() => setCurrentView(ViewState.STAFF)}
                            onGoToMeetings={() => setCurrentView(ViewState.MEETINGS)}
                            onGoToFiles={() => setCurrentView(ViewState.FILES)}
                            onGoToTasks={() => setCurrentView(ViewState.TASKS)}
                            onRefreshData={() => fetchData(true)}
                        />
                    );
                }
                if (permissions ? (permissions._role === 'staff') : (userRole === 'staff')) {
                    return (
                        <StaffDashboardView
                            clients={clients}
                            messages={[]}
                            meetings={meetings}
                            tasks={tasks}
                            profile={profile}
                            onJoin={handleJoinMeeting}
                            onInstantMeet={() => handleInstantMeeting(clients[0]?.id)}
                            onCreateTask={handleCreateTask}
                            onUpdateTask={handleUpdateTask}
                            onGoToSpace={(spaceId) => {
                                openSpace(spaceId, 'Dashboard');
                            }}
                        />
                    );
                }
                if (userRole === 'client') {
                    const currentClient = clients[0];
                    if (!currentClient) return <div className="p-8">Loading Portal...</div>;
                    return <ClientPortalView client={currentClient} meetings={meetings} onJoin={handleJoinMeeting} onLogout={signOut} />;
                }
                return <ErrorView message="No dashboard available for this identity." />;
            case ViewState.ACTIVITY_LEDGER:
                if (!can('can_view_history')) return <div className="p-8">Access Denied</div>;
                return <HistoryView logs={logs} />;
            case ViewState.SPACES:
                if (!can('can_view_all_spaces')) return <div className="p-8">Access Denied</div>;
                return <SpacesView clients={clients} onSelect={(id) => openSpace(id, 'Dashboard')} onCreate={handleCreateSpace} />;
            case ViewState.SPACE_DETAIL:
                return <SpaceDetailView spaceId={selectedSpaceId!} space={clients.find(c => c.id === selectedSpaceId)} meetings={meetings} onBack={() => setCurrentView(ViewState.SPACES)} onJoin={handleJoinMeeting} onSchedule={handleScheduleMeeting} onInstantMeet={handleInstantMeeting} onEndMeeting={handleEndMeeting} activeTab={selectedSpaceTab} onTabChange={setSelectedSpaceTab} />;
            case ViewState.INBOX:
                if (!can('can_view_dashboard')) return <div className="p-8">Access Denied</div>;
                return <InboxView clients={clients} inboxData={inboxData} />;
            case ViewState.CLIENTS:
                if (!can('owner') && !can('admin')) return <div className="p-8">Access Denied</div>;
                // Use clientLifecycle data for now - this shows all clients across the organization
                // In the future, this could be enhanced to show space-specific client data
                return <ClientsCRMView clients={clientLifecycle} loading={isInitialLoading} />;
case ViewState.STAFF:
                if (permissions ? !permissions.manage_team : !can('can_manage_team')) return <div className="p-8">Access Denied</div>;
                return <StaffView staff={staff} spaces={clients} onUpdateCapability={handleUpdateStaffCapability} onRefresh={fetchData} />;
            case ViewState.TASKS:
                if (permissions ? !permissions.view_tasks : !can('can_view_tasks')) return <div className="p-8">Access Denied</div>;
                return <TaskView tasks={tasks} clients={clients} onUpdateTask={handleUpdateTask} onCreateTask={handleCreateTask} onOpenSpace={(spaceId) => {
                    openSpace(spaceId, 'Dashboard');
                }} />;
            case ViewState.MEETINGS:
                if (permissions ? !permissions.view_meetings : !can('can_view_meetings')) return <div className="p-8">Access Denied</div>;
                return <GlobalMeetingsView meetings={meetings} clients={clients} onSchedule={handleScheduleMeeting} onJoin={handleJoinMeeting} onInstantMeet={handleInstantMeeting} onOpenSpace={(spaceId) => { openSpace(spaceId, 'Meetings'); }} onDeleteMeeting={handleDeleteMeeting} onEndMeeting={handleEndMeeting} tasks={tasks} />;
            case ViewState.FILES:
                if (permissions ? !permissions.view_files : !can('can_view_files')) return <div className="p-8">Access Denied</div>;
                return <GlobalFilesView clients={clients} profile={profile} />;
            case ViewState.SETTINGS:
                if (permissions ? (!permissions.manage_spaces && !permissions.manage_team) : !can('can_view_settings')) return <div className="p-8">Access Denied</div>;
                return <SettingsView />;
            default:
                return <div className="p-8">View Not Found</div>;
        }
    };

    // Only show full-screen skeleton on the very first load if we have no data yet
    if (!isPublicInviteRoute && (loading || (isAuthenticated && userRole !== 'client' && isInitialLoading && clients.length === 0))) {
        return (
            <div className="flex h-screen w-full bg-white font-sans animate-pulse">
                <aside className="w-64 bg-[#ECECF1] border-r border-[#D1D5DB] flex flex-col justify-between p-4 z-20">
                    <div className="space-y-8">
                        <div className="flex items-center gap-3 px-3 mb-8 mt-2">
                            <div className="h-8 w-8 bg-zinc-200 rounded-md"></div>
                            <div className="h-5 w-24 bg-zinc-200 rounded"></div>
                        </div>
                        <div className="space-y-3 px-2">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="h-10 bg-white/50 border border-zinc-100 rounded-md w-full"></div>
                            ))}
                        </div>
                    </div>
                </aside>
                <main className="flex-1 bg-zinc-50/30 p-8 flex flex-col">
                    <header className="h-16 border-b border-zinc-100 flex items-center justify-between px-8 bg-white/50 -mx-8 -mt-8 mb-8">
                        <div className="h-4 w-48 bg-zinc-100 rounded"></div>
                    </header>
                    <div className="max-w-7xl mx-auto w-full space-y-8">
                        <div className="flex justify-between items-end">
                            <div className="space-y-2">
                                <div className="h-10 w-64 bg-zinc-200 rounded-lg"></div>
                                <div className="h-4 w-96 bg-zinc-100 rounded"></div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-48 bg-white border border-zinc-100 rounded-2xl shadow-sm"></div>
                            ))}
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const totalInboxItems = inboxData.reduce((acc, curr) => acc + (curr.unread_count || 0), 0);
    const currentViewLabelMap: Record<ViewState, string> = {
        [ViewState.DASHBOARD]: 'Dashboard',
        [ViewState.SPACES]: 'Spaces',
        [ViewState.SPACE_DETAIL]: 'Space Detail',
        [ViewState.INBOX]: 'Inbox',
        [ViewState.MEETINGS]: 'Calendar',
        [ViewState.FILES]: 'Drive',
        [ViewState.TASKS]: 'Tasks',
        [ViewState.STAFF]: 'Team',
        [ViewState.SETTINGS]: 'Settings',
        [ViewState.ACTIVITY_LEDGER]: 'History',
        [ViewState.CLIENTS]: 'Clients',
    };
    const currentViewLabel = currentViewLabelMap[currentView] || 'Workspace';
    const roleLabel = getWorkspaceRoleLabel(permissionRole || userRole);
    const currentTimeLabel = currentTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    const dockItems = currentView === ViewState.SPACE_DETAIL ? [
        {
            label: 'Back',
            icon: ArrowLeft,
            allowed: true,
            isActive: false,
            onClick: () => setCurrentView(ViewState.SPACES),
        },
        {
            label: 'Overview',
            icon: LayoutGrid,
            allowed: true,
            isActive: selectedSpaceTab === 'Dashboard',
            onClick: () => setSelectedSpaceTab('Dashboard'),
        },
        {
            label: 'Chat',
            icon: Inbox,
            allowed: true,
            isActive: selectedSpaceTab === 'Chat',
            onClick: () => setSelectedSpaceTab('Chat'),
        },
        {
            label: 'Meetings',
            icon: Calendar,
            allowed: true,
            isActive: selectedSpaceTab === 'Meetings',
            onClick: () => setSelectedSpaceTab('Meetings'),
        },
        {
            label: 'Tasks',
            icon: CheckSquare,
            allowed: true,
            isActive: selectedSpaceTab === 'Tasks',
            onClick: () => setSelectedSpaceTab('Tasks'),
        },
        {
            label: 'Docs',
            icon: FolderClosed,
            allowed: true,
            isActive: selectedSpaceTab === 'Docs',
            onClick: () => setSelectedSpaceTab('Docs'),
        },
    ] : [
        {
            label: 'Dashboard',
            icon: LayoutGrid,
            allowed: permissions ? !!permissions.view_dashboard : can('can_view_dashboard'),
            isActive: currentView === ViewState.DASHBOARD,
            onClick: () => setCurrentView(ViewState.DASHBOARD),
        },
        {
            label: 'History',
            icon: Activity,
            allowed: permissions ? !!permissions.view_history : can('can_view_history'),
            isActive: currentView === ViewState.ACTIVITY_LEDGER,
            onClick: () => setCurrentView(ViewState.ACTIVITY_LEDGER),
        },
        {
            label: 'Spaces',
            icon: Users,
            allowed: permissions ? (!!permissions.view_all_spaces || !!permissions.view_assigned_spaces) : (can('can_view_all_spaces') || can('can_view_assigned_spaces')),
            isActive: currentView === ViewState.SPACES || currentView === ViewState.SPACE_DETAIL,
            onClick: () => setCurrentView(ViewState.SPACES),
        },
        {
            label: 'Inbox',
            icon: Inbox,
            allowed: permissions ? !!permissions.view_dashboard : can('can_view_dashboard'),
            isActive: currentView === ViewState.INBOX,
            onClick: () => setCurrentView(ViewState.INBOX),
            badge: totalInboxItems,
        },
        {
            label: 'Team',
            icon: UserCheck,
            allowed: permissions ? !!permissions.manage_team : can('can_manage_team'),
            isActive: currentView === ViewState.STAFF,
            onClick: () => setCurrentView(ViewState.STAFF),
        },
        {
            label: 'Clients',
            icon: Briefcase,
            allowed: permissions ? !!permissions.view_all_spaces : (userRole === 'owner' || userRole === 'admin'),
            isActive: currentView === ViewState.CLIENTS,
            onClick: () => setCurrentView(ViewState.CLIENTS),
        },
        {
            label: 'Tasks',
            icon: CheckSquare,
            allowed: permissions ? !!permissions.view_tasks : can('can_view_tasks'),
            isActive: currentView === ViewState.TASKS,
            onClick: () => setCurrentView(ViewState.TASKS),
        },
        {
            label: 'Calendar',
            icon: Calendar,
            allowed: permissions ? !!permissions.view_meetings : can('can_view_meetings'),
            isActive: currentView === ViewState.MEETINGS,
            onClick: () => setCurrentView(ViewState.MEETINGS),
        },
        {
            label: 'Drive',
            icon: FolderClosed,
            allowed: permissions ? !!permissions.view_files : can('can_view_files'),
            isActive: currentView === ViewState.FILES,
            onClick: () => setCurrentView(ViewState.FILES),
        },
    ].filter((item) => item.allowed);

    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/invite" element={<InvitationLandingPage />} />
            <Route path="/invite/:spaceId/:token" element={<InvitationLandingPage />} />
            <Route path="/invite/:spaceId/:token/accept" element={<InvitationAcceptPage />} />
            <Route path="/select-role" element={<ContextSwitcher />} />
            <Route path="/spaces/pending" element={<PendingSpaceView />} />
            <Route path="/spaces/:spaceId/onboarding" element={<PendingSpaceView />} />
            <Route path="/spaces/:spaceId/meetings/:meetingId/review" element={<MeetingReviewPage />} />
            <Route path="/spaces/:spaceId/settings" element={
                <PermissionGuard requiredPermission="manage_spaces">
                    <SettingsView />
                </PermissionGuard>
            } />
            <Route path="/spaces/:spaceId" element={<ClientSpaceRoute />} />
            <Route path="/client/space/:spaceId" element={<LegacyClientSpaceRedirect />} />

<Route path="/org/settings/billing" element={<BillingSettingsView />} />
            <Route path="/org/settings/team" element={
                <PermissionGuard requiredPermission="manage_team">
                    <StaffView staff={staff} spaces={clients} onUpdateCapability={handleUpdateStaffCapability} onRefresh={fetchData} />
                </PermissionGuard>
            } />
            <Route path="/dashboard" element={
                (() => {
                    if (!isAuthenticated) return <LoginPage />;
                    if (!contexts) return <DashboardReadinessLoading />;

                    const readiness = getContextReadinessDecision(contexts);
                    if (readiness.kind === 'invalid') return <PendingSpaceView />;
                    if (readiness.kind === 'no_contexts') return <PendingSpaceView />;
                    if (readiness.kind === 'switcher_required' && !activeContext) return <ContextSwitcher />;

                    if (readiness.kind === 'activation_required' || readiness.kind === 'not_ready') {
                        const readinessRoute = getRouteFromReadiness(contexts, '/dashboard');
                        if (readinessRoute && readinessRoute !== '/spaces/pending') {
                            return <Navigate to={readinessRoute} replace />;
                        }
                        return <PendingSpaceView />;
                    }

                    if (activeContext?.context_type === 'client_space') {
                        return <Navigate to={getContextRoute(activeContext) || '/spaces/pending'} replace />;
                    }

                    if (userRole === 'client') {
                        // Ã¢â€â‚¬Ã¢â€â‚¬ Client dashboard Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
                        // Single membership Ã¢â€ â€™ redirect handled by useEffect above
                        // Multiple memberships Ã¢â€ â€™ show space picker
                        return <ClientSpacePicker />;
                    }

                    return (
                        <>
                            <AppLayout sidebar={null}>
                                <div className="dashboard-app-shell flex min-h-screen flex-1 flex-col">
                                    <div className="px-4 pt-4 md:px-6">
                                        <div className="dashboard-header-bar">
                                            <div className="dashboard-header-time">{currentTimeLabel}</div>
                                            <div className="dashboard-header-title">Organization</div>
                                            <div className="dashboard-header-actions">
                                                <button
                                                    type="button"
                                                    className="dashboard-header-upgrade"
                                                    onClick={() => navigate('/org/settings/billing')}
                                                >
                                                    Upgrade
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto px-4 pb-20 pt-3 md:px-6 md:pb-24 md:pt-3">
                                        <div className="w-full">{renderContent()}</div>
                                    </div>
                                    <nav className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 md:bottom-8">
                                        <div className="dock-shell dock-enter flex max-w-[calc(100vw-2rem)] items-center gap-2 overflow-x-auto rounded-[999px] px-2 py-2">
                                            {dockItems.map((item, index) => {
                                                const Icon = item.icon;
                                                return (
                                                    <button
                                                        key={item.label}
                                                        aria-label={item.label}
                                                        onClick={item.onClick}
                                                        style={{ animationDelay: `${index * 20}ms` }}
                                                        className={`dock-tab group relative flex h-10 shrink-0 items-center overflow-hidden border transition-[width,background-color,border-color,color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.98] ${
                                                            item.isActive
                                                                ? 'dock-tab-active dock-morph-enter w-[108px] justify-start rounded-[999px] px-3.5'
                                                                : 'dock-tab-idle w-10 justify-center rounded-full px-0'
                                                        }`}
                                                    >
                                                        <Icon size={16} className="shrink-0" />
                                                        <span className={`dock-tab-label ml-1.5 whitespace-nowrap text-[11px] font-medium ${item.isActive ? 'opacity-100' : 'w-0 overflow-hidden opacity-0'}`}>
                                                            {item.label}
                                                        </span>
                                                        {item.badge ? (
                                                            <span className="dock-badge absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                                                                {item.badge}
                                                            </span>
                                                        ) : null}
                                                        <span className="dock-tooltip tooltip-enter pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium group-hover:block">
                                                            {item.label}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </nav>
                                </div>
                            </AppLayout>

                            {activeMeetingId && (
                                <MeetingRoom 
                                    meetingId={activeMeetingId}
                                    roomUrl={activeMeetingRoomUrl}
                                    onLeave={() => { 
                // Redirect user back to where they came from
                if (meetingEntrySource) {
                    if (meetingEntrySource.spaceId) {
                        openSpace(meetingEntrySource.spaceId, 'Meetings');
                    } else {
                        setCurrentView(meetingEntrySource.view);
                    }
                    setMeetingEntrySource(null);
                }
                setActiveMeetingId(null); 
                setActiveMeetingRoomUrl(null); 
            }}
                                />
                            )}

                            {isInstantMeetingModalOpen && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4">
                                    <GlassCard className="max-w-md w-full p-8 relative">
                                        <button title="Close" onClick={() => setIsInstantMeetingModalOpen(false)} className="absolute right-4 top-4 rounded-[6px] border border-[#E5E5E5] bg-white p-2 text-[#6E6E80]"><X size={18} /></button>
                                        <Heading level={2} className="mb-6 flex items-center gap-2"><Video className="text-[#6E6E80]" /> Instant Meeting</Heading>
                                        <input placeholder="Meeting Title" value={instantMeetingTitle} onChange={(e) => setInstantMeetingTitle(e.target.value)} className="mb-6 w-full rounded-[8px] border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#0D0D0D]" />
                        <div className="mb-6">
                            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6E6E80] mb-2 ml-1">Category</label>
                            <select
                                title="Meeting Category"
                                value={instantMeetingCategory}
                                onChange={(e) => setInstantMeetingCategory(e.target.value)}
                                className="w-full rounded-[8px] border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#0D0D0D] focus:outline-none"
                            >
                                <option value="sales_call">Sales Call</option>
                                <option value="onboarding">Onboarding</option>
                                <option value="check_in">Check-in</option>
                                <option value="project_review">Project Review</option>
                                <option value="strategy">Strategy</option>
                                <option value="general">General</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                                        <div className="flex gap-3">
                                            <Button variant="ghost" className="flex-1 uppercase text-[10px] font-black tracking-widest" onClick={() => setIsInstantMeetingModalOpen(false)}>Cancel</Button>
                                            <Button variant="primary" className="flex-1 uppercase text-[10px] font-black tracking-widest" onClick={() => handleInstantMeeting(instantMeetingTargetSpace!, instantMeetingTitle)}>Create</Button>
                                        </div>
                                    </GlassCard>
                                </div>
                            )}

                        </>
                    );
                })()
            } />
            <Route path="*" element={
                !isAuthenticated
                    ? <LoginPage />
                    : !contexts
                        ? <DashboardReadinessLoading />
                        : (() => {
                            const route = getRouteFromReadiness(contexts, '/dashboard');
                            return route ? <Navigate to={route} replace /> : <PendingSpaceView />;
                        })()
            } />
        </Routes>
    );
};

export default App;

```


===== supabase\functions\invitations-api\index.ts =====
```
// invitations-api/index.ts â€” Thin Gateway V4
// Changes from V3:
//   - After creating invitation, calls resend-api edge function directly
//   - No more background_jobs indirection for email sending
//   - validate now correctly passes p_token
//   - accept now correctly passes p_token

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  getAuthContext,
  hydrateError,
  errorResponse,
} from "shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// â”€â”€ Helper: call resend-api to dispatch the email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function dispatchEmail(params: {
  to: string;
  template_key: string;
  token: string;
  org_id: string;
  vars: Record<string, string>;
}): Promise<void> {
  const resendUrl = `${SUPABASE_URL}/functions/v1/resend-api`;

  const res = await fetch(resendUrl, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // Log but don't throw â€” invitation was created successfully,
    // email failure shouldn't roll back the invite.
    console.error("[invitations-api] resend-api error:", err);
  } else {
    const data = await res.json().catch(() => ({}));
    console.log("[invitations-api] Email dispatched:", data.email_id);
  }
}

// â”€â”€ Helper: fetch inviter context for email vars â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getInviterContext(
  supabaseAdmin: ReturnType<typeof createClient>,
  invitedById: string,
  orgId: string
): Promise<{ inviter_name: string; org_name: string; inviter_email: string }> {
  const [{ data: profile }, { data: org }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", invitedById)
      .single(),
    supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single(),
  ]);

  return {
    inviter_name:  profile?.full_name ?? profile?.email?.split("@")[0] ?? "Your team",
    org_name:      org?.name ?? "Space.inc",
    inviter_email: profile?.email ?? "",
  };
}

// â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let supabaseClient: ReturnType<typeof createClient> | undefined;

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Action required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // â”€â”€ PUBLIC: validate (no auth required â€” invitee hasn't signed up yet) â”€â”€
    if (action === "validate") {
      const { token } = body;
      if (!token) {
        return errorResponse(
          await hydrateError(null, "VAL_MISSING_FIELD", { field: "token" })
        );
      }

      const anon = createClient(
        SUPABASE_URL,
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );

      const { data, error } = await anon.rpc("validate_invitation_context", {
        p_token: token,
      });

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "resolve_space_link") {
      const { token } = body;
      if (!token) {
        return errorResponse(
          await hydrateError(null, "VAL_MISSING_FIELD", { field: "token" })
        );
      }

      const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

      const { data, error } = await supabaseAdmin.rpc("resolve_space_invite_token", {
        p_token: token,
      });

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // â”€â”€ AUTH REQUIRED for all other actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { userId, supabase } = await getAuthContext(req);
    supabaseClient = supabase;

    // Admin client for reading profile/org context without RLS restrictions
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // â”€â”€ SEND STAFF INVITATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (action === "send_staff") {
      const { email, role, space_assignments = [] } = body;

      if (!email || !role) {
        return errorResponse(
          await hydrateError(supabase, "VAL_MISSING_FIELD", {
            fields: ["email", "role"],
          })
        );
      }

      // Call the fixed RPC (no more pg_net, just creates row + background_job)
      const { data, error } = await supabase.rpc("send_staff_invitation", {
        p_email:             email.toLowerCase().trim(),
        p_role:              role,
        p_space_assignments: space_assignments,
      });

      if (error) throw error;

      // Fetch inviter context for email template vars
      const ctx = await getInviterContext(supabaseAdmin, userId, data.org_id);

      // Dispatch email via resend-api (non-blocking â€” invite already created)
      await dispatchEmail({
        to:           email.toLowerCase().trim(),
        template_key: "staff_invitation",
        token:        data.token ?? "", // RPC now returns token
        org_id:       data.org_id ?? "",
        vars: {
          inviter_name:  ctx.inviter_name,
          org_name:      ctx.org_name,
          inviter_email: ctx.inviter_email,
          role,
        },
      });

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // â”€â”€ SEND CLIENT INVITATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (action === "send_client") {
      const { email, space_id } = body;

      if (!email || !space_id) {
        return errorResponse(
          await hydrateError(supabase, "VAL_MISSING_FIELD", {
            fields: ["email", "space_id"],
          })
        );
      }

      const { data, error } = await supabase.rpc("send_client_invitation", {
        p_email:    email.toLowerCase().trim(),
        p_space_id: space_id,
      });

      if (error) throw error;

      const ctx = await getInviterContext(supabaseAdmin, userId, data.org_id ?? "");

      await dispatchEmail({
        to:           email.toLowerCase().trim(),
        template_key: "client_invitation",
        token:        data.token ?? "",
        org_id:       data.org_id ?? "",
        vars: {
          inviter_name:  ctx.inviter_name,
          org_name:      ctx.org_name,
          inviter_email: ctx.inviter_email,
          role:          "client",
        },
      });

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // â”€â”€ ACCEPT INVITATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (action === "accept") {
      const { token } = body;
      if (!token) {
        return errorResponse(
          await hydrateError(supabase, "VAL_MISSING_FIELD", { field: "token" })
        );
      }

      const { data, error } = await supabase.rpc("accept_invitation", {
        p_token: token,
      });

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "accept_space_link") {
      const { token, client_name, client_company } = body;
      if (!token) {
        return errorResponse(
          await hydrateError(supabase, "VAL_MISSING_FIELD", { field: "token" })
        );
      }

      const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

      const { data, error } = await supabaseAdmin.rpc("accept_space_invite_token", {
        p_token: token,
      });

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return errorResponse(
      await hydrateError(supabaseClient, "METHOD_NOT_ALLOWED", { action })
    );

  } catch (err: unknown) {
    console.error("[invitations-api] Error:", err);
    const code =
      (err as { isStandard?: boolean; message?: string; code?: string })
        ?.isStandard
        ? (err as { message: string }).message
        : ((err as { code?: string })?.code ?? "INTERNAL_ERROR");

    const richError = await hydrateError(
      supabaseClient ?? null,
      code,
      {
        original_error:
          err instanceof Error ? err.message : String(err),
      }
    );
    return errorResponse(richError);
  }
});

```


===== supabase\functions\resend-api\index.ts =====
```
// resend-api/index.ts
// Dedicated edge function for sending transactional emails via Resend.
// Called internally by invitations-api after invitation is created.
// Never called directly from the frontend.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FRONTEND_URL   = Deno.env.get("FRONTEND_URL") ?? "https://space-inc.vercel.app";

// From address â€” update once you verify a domain in Resend dashboard.
// e.g. "Space.inc <invites@yourdomain.com>"
const FROM_ADDRESS = "Space.inc <onboarding@resend.dev>";

// â”€â”€ Template variable renderer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

// â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Validate secrets are present
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not set in Supabase Vault");
    }

    const body = await req.json();
    const {
      to,           // recipient email
      template_key, // 'staff_invitation' | 'client_invitation'
      token,        // invitation token for link construction
      org_id,       // to fetch org-specific template or fall back to default
      vars = {},    // extra vars: inviter_name, org_name, role
    } = body;

    if (!to || !template_key || !token) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, template_key, token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service-role client to read templates (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Fetch template â€” org-specific first, then global default
    let template = null;

    if (org_id) {
      const { data } = await supabase
        .from("email_templates")
        .select("subject, html_body")
        .eq("organization_id", org_id)
        .eq("template_key", template_key)
        .maybeSingle();
      template = data;
    }

    if (!template) {
      const { data } = await supabase
        .from("email_templates")
        .select("subject, html_body")
        .is("organization_id", null)
        .eq("template_key", template_key)
        .eq("is_default", true)
        .maybeSingle();
      template = data;
    }

    if (!template) {
      throw new Error(`No email template found for key: ${template_key}`);
    }

    // 2. Build all template variables
    const inviteLink = `${FRONTEND_URL}/join?token=${token}`;
    const allVars: Record<string, string> = {
      invite_link:  inviteLink,
      inviter_name: vars.inviter_name ?? "Your team",
      org_name:     vars.org_name ?? "Space.inc",
      role:         vars.role ?? "member",
      ...vars,
    };

    // 3. Render subject + body
    const subject = render(template.subject, allVars);
    const html    = render(template.html_body, allVars);

    // 4. Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:     FROM_ADDRESS,
        to:       [to],
        reply_to: vars.inviter_email ?? undefined,
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json().catch(() => ({}));

    if (!resendRes.ok) {
      console.error("[resend-api] Resend error:", resendRes.status, resendData);
      throw new Error(
        `Resend API error ${resendRes.status}: ${resendData?.message ?? JSON.stringify(resendData)}`
      );
    }

    console.log(`[resend-api] âœ… Sent ${template_key} to ${to} â€” id: ${resendData.id}`);

    return new Response(
      JSON.stringify({ success: true, email_id: resendData.id, to }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[resend-api] Error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

```


===== supabase\functions\background-worker\index.ts =====
```
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

// â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY") ?? "";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") ?? "https://space-inc.vercel.app";
const BATCH_SIZE = 10;
const FROM_ADDRESS = "Space.inc <onboarding@resend.dev>";

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderTemplate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

async function sendViaResend(to: string, subject: string, html: string): Promise<{ success: boolean; status: number; error?: string }> {
    if (!RESEND_API_KEY) return { success: false, status: 500, error: "RESEND_API_KEY not set" };
    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
    });
    if (res.ok) return { success: true, status: res.status };
    return { success: false, status: res.status, error: await res.text().catch(() => "") };
}

// â”€â”€ Main handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const workerId = crypto.randomUUID().slice(0, 8);
    const results: any[] = [];

    try {
        const { data: jobs, error: fetchErr } = await supabase
            .from("background_jobs")
            .select("*")
            .eq("status", "pending")
            .in("job_type", ["send_email", "process_daily_recording"])
            .lte("scheduled_at", new Date().toISOString())
            .order("created_at", { ascending: true })
            .limit(BATCH_SIZE);

        if (fetchErr) throw fetchErr;
        if (!jobs || jobs.length === 0) return new Response(JSON.stringify({ worker: workerId, message: "No jobs." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        for (const job of jobs) {
            await supabase.from("background_jobs").update({ status: "processing", started_at: new Date().toISOString() }).eq("id", job.id);

            try {
                if (job.job_type === "send_email") {
                    const p = job.payload as any;
                    const [{ data: inviter }, { data: org }] = await Promise.all([
                        supabase.from("profiles").select("full_name, email").eq("id", p.invited_by_id).single(),
                        supabase.from("organizations").select("name").eq("id", p.org_id).single(),
                    ]);

                    const { data: template } = await supabase.from("email_templates").select("subject, html_body")
                        .eq("organization_id", p.org_id).eq("template_key", p.type).maybeSingle()
                        || await supabase.from("email_templates").select("subject, html_body")
                        .is("organization_id", null).eq("template_key", p.type).eq("is_default", true).maybeSingle();

                    if (!template) throw new Error(`No template for ${p.type}`);

                    const vars = {
                        invite_link: `${FRONTEND_URL}/join?token=${p.token}`,
                        inviter_name: inviter?.full_name ?? "Your team",
                        org_name: org?.name ?? "Space.inc",
                        role: p.role ?? "member",
                    };

                    const sendResult = await sendViaResend(p.to, renderTemplate(template.subject, vars), renderTemplate(template.html_body, vars));
                    if (!sendResult.success) throw new Error(`Resend error ${sendResult.status}: ${sendResult.error}`);

                    await supabase.from("background_jobs").update({ status: "completed", completed_at: new Date().toISOString(), attempts: (job.attempts ?? 0) + 1 }).eq("id", job.id);
                    results.push({ id: job.id, status: "completed" });
                }
                else if (job.job_type === "process_daily_recording") {
                    const p = job.payload as { recording_id: string; room_name: string };
                    const dailyRes = await fetch(`https://api.daily.co/v1/recordings/${p.recording_id}`, { headers: { Authorization: `Bearer ${DAILY_API_KEY}` } });
                    if (!dailyRes.ok) throw new Error(`Daily API error: ${await dailyRes.text()}`);
                    const recordingData = await dailyRes.json();

                    const { data: meeting } = await supabase.from("meetings").select("id, space_id").eq("daily_room_name", p.room_name).order("created_at", { ascending: false }).limit(1).single();
                    if (!meeting) throw new Error(`Meeting not found for room ${p.room_name}`);

                    const storagePath = `${meeting.space_id}/${p.recording_id}.mp4`;
                    const fileRes = await fetch(recordingData.download_url);
                    if (!fileRes.ok) throw new Error(`Failed to download recording`);

                    const { error: uploadErr } = await supabase.storage.from("meeting-recordings").upload(storagePath, await fileRes.blob(), { contentType: "video/mp4", upsert: true });
                    if (uploadErr) throw uploadErr;

                    const { data: publicUrlData } = supabase.storage.from("meeting-recordings").getPublicUrl(storagePath);
                    await supabase.rpc("update_meeting_recording", { p_meeting_id: meeting.id, p_recording_url: publicUrlData.publicUrl });
                    await fetch(`https://api.daily.co/v1/recordings/${p.recording_id}`, { method: "DELETE", headers: { Authorization: `Bearer ${DAILY_API_KEY}` } });

                    await supabase.from("background_jobs").update({ status: "completed", completed_at: new Date().toISOString(), attempts: (job.attempts ?? 0) + 1 }).eq("id", job.id);
                    results.push({ id: job.id, status: "completed" });
                }
            } catch (err: any) {
                await supabase.from("background_jobs").update({ status: "failed", last_error: err.message, attempts: (job.attempts ?? 0) + 1 }).eq("id", job.id);
                results.push({ id: job.id, status: "failed", error: err.message });
            }
        }
        return new Response(JSON.stringify({ worker: workerId, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});

```


===== supabase\migrations\20260313000001_staff_management_tables.sql =====
```
-- =============================================================================
-- Migration: Staff Management Tables, Column Extensions, RLS, and Indexes
-- Phase:     Staff Lifecycle & Capability Assignment
-- Date:      2026-03-13
-- =============================================================================
-- GUARDRAILS:
--   - No RPCs or SQL functions in this migration.
--   - Only creates new tables, adds columns to existing tables,
--     creates new RLS policies for new tables, and creates indexes.
--   - Does NOT modify existing RLS policies.
--   - Does NOT touch any existing tables beyond the two listed extensions.
-- =============================================================================


-- =============================================================================
-- TABLE 1: staff_invitations
-- Purpose: Tracks invitations sent to staff members before they have accounts.
--          A staff invitation carries space assignments and per-space capabilities
--          so the onboarding RPC can set them up atomically upon acceptance.
--
-- space_assignments JSONB shape:
--   [
--     {
--       "space_id": "<uuid>",
--       "capabilities": {
--         "can_view":            true,
--         "can_edit":            false,
--         "can_delete":          false,
--         "can_message_client":  false,
--         "can_upload_files":    false,
--         "can_manage_tasks":    false,
--         "can_delegate":        false
--       }
--     }
--   ]
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.staff_invitations (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    invited_by          uuid        NOT NULL REFERENCES public.profiles(id),
    email               text        NOT NULL,

    -- Role this staff member will receive upon acceptance.
    -- Values: 'owner' | 'admin' | 'staff'  (client invites use the invitations table)
    role                public.user_role NOT NULL,

    -- Array of space assignments with per-space capability overrides.
    -- See JSONB shape documented above.
    space_assignments   jsonb       NOT NULL DEFAULT '[]'::jsonb,

    -- Lifecycle status of this invitation.
    -- Values: 'pending' | 'accepted' | 'expired' | 'revoked'
    status              text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),

    -- Supabase Auth invite ID returned by admin.inviteUserByEmail, if used.
    supabase_invite_id  text        NULL,

    expires_at          timestamptz NOT NULL DEFAULT (now() + interval '72 hours'),
    accepted_at         timestamptz NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- TABLE 2: org_announcements
-- Purpose: Internal broadcast messages surfaced to admins/owners when
--          significant staff lifecycle events occur (suspension, removal,
--          capability changes). Inserted exclusively by SECURITY DEFINER RPCs.
--
-- payload JSONB shape:
--   {
--     "affected_staff_id": "<uuid>",
--     "message":           "<string>",
--     "action_required":   true | false
--   }
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.org_announcements (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Event type that triggered this announcement.
    -- Values: 'staff_suspended' | 'staff_removed' | 'capability_changed'
    type            text        NOT NULL
                                CHECK (type IN ('staff_suspended', 'staff_removed', 'capability_changed')),

    -- Structured payload describing the event.
    -- See JSONB shape documented above.
    payload         jsonb       NOT NULL,

    -- Which role(s) should see this announcement in their dashboard.
    -- Defaults to owners and admins only.
    target_roles    text[]      NOT NULL DEFAULT '{owner,admin}'::text[],

    -- UUIDs of profiles that have dismissed this announcement.
    dismissed_by    uuid[]      NOT NULL DEFAULT '{}'::uuid[],

    created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_announcements ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- TABLE 3: task_reassignments
-- Purpose: Audit trail for task ownership transfers. Written exclusively by
--          SECURITY DEFINER RPCs (e.g., during staff offboarding).
--
-- reason values: 'offboarding' | 'manual' | 'delegation'
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.task_reassignments (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    task_id         uuid        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    from_profile_id uuid        NOT NULL REFERENCES public.profiles(id),
    to_profile_id   uuid        NOT NULL REFERENCES public.profiles(id),
    space_id        uuid        NOT NULL REFERENCES public.spaces(id),

    -- Context for why the reassignment occurred.
    -- Values: 'offboarding' | 'manual' | 'delegation'
    reason          text        NOT NULL DEFAULT 'offboarding'
                                CHECK (reason IN ('offboarding', 'manual', 'delegation')),

    created_by      uuid        NOT NULL REFERENCES public.profiles(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_reassignments ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- EXTEND: notifications
-- The notifications table already exists. We add recipient_id and payload
-- columns to support the new structured notification system used by
-- SECURITY DEFINER RPCs.
--
-- recipient_id: mirrors user_id for the new notification system.
--               We add it as a separate nullable column to avoid breaking
--               any existing queries that use user_id.
-- payload:      structured data payload (jsonb) for the notification.
--
-- type check values: 'staff_assigned' | 'task_assigned' | 'capability_changed'
--                  | 'client_message' | 'plan_limit' | 'staff_suspended'
-- =============================================================================
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS recipient_id  uuid        REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS payload       jsonb       NOT NULL DEFAULT '{}'::jsonb;

-- Add a check constraint on type for the new notification categories.
-- Uses IF NOT EXISTS pattern via DO block to avoid re-adding.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'notifications_type_check_v2'
          AND conrelid = 'public.notifications'::regclass
    ) THEN
        ALTER TABLE public.notifications
            ADD CONSTRAINT notifications_type_check_v2
            CHECK (type IN (
                'staff_assigned',
                'task_assigned',
                'capability_changed',
                'client_message',
                'plan_limit',
                'staff_suspended',
                -- legacy types that may exist
                'info',
                'warning',
                'error',
                'success',
                'invitation',
                'task_update',
                'meeting_reminder',
                'file_uploaded',
                'space_update',
                'system'
            ));
    END IF;
END;
$$;


-- =============================================================================
-- EXTEND: space_memberships
-- Add capability tracking, assignment provenance, and lifecycle status.
--
-- capabilities JSONB default shape:
--   {
--     "can_view":           true,
--     "can_edit":           false,
--     "can_delete":         false,
--     "can_message_client": false,
--     "can_upload_files":   false,
--     "can_manage_tasks":   false,
--     "can_delegate":       false
--   }
--
-- status values: 'active' | 'suspended'
-- =============================================================================
ALTER TABLE public.space_memberships
    ADD COLUMN IF NOT EXISTS capabilities jsonb DEFAULT '{
        "can_view":           true,
        "can_edit":           false,
        "can_delete":         false,
        "can_message_client": false,
        "can_upload_files":   false,
        "can_manage_tasks":   false,
        "can_delegate":       false
    }'::jsonb,
    ADD COLUMN IF NOT EXISTS assigned_by  uuid  REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS status       text  NOT NULL DEFAULT 'active'
                                                CHECK (status IN ('active', 'suspended'));


-- =============================================================================
-- EXTEND: profiles
-- Track when a user was last active to support churn detection, suspension
-- eligibility checks, and the staff activity dashboard widget.
-- =============================================================================
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS last_active_at timestamptz NULL;


-- =============================================================================
-- RLS POLICIES: staff_invitations
-- =============================================================================

-- SELECT: org members can see their org's invitations
CREATE POLICY "staff_invitations_select"
    ON public.staff_invitations
    FOR SELECT
    USING (
        organization_id = (
            SELECT organization_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
    );

-- INSERT: only owners and admins may create staff invitations
CREATE POLICY "staff_invitations_insert"
    ON public.staff_invitations
    FOR INSERT
    WITH CHECK (
        (
            SELECT role
            FROM public.profiles
            WHERE id = auth.uid()
        ) IN ('owner', 'admin')
        AND
        organization_id = (
            SELECT organization_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
    );

-- UPDATE: only owners and admins may update (e.g., revoke) staff invitations
CREATE POLICY "staff_invitations_update"
    ON public.staff_invitations
    FOR UPDATE
    USING (
        (
            SELECT role
            FROM public.profiles
            WHERE id = auth.uid()
        ) IN ('owner', 'admin')
        AND
        organization_id = (
            SELECT organization_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
    );


-- =============================================================================
-- RLS POLICIES: org_announcements
-- =============================================================================

-- SELECT: visible to users whose role is in target_roles for their org
CREATE POLICY "org_announcements_select"
    ON public.org_announcements
    FOR SELECT
    USING (
        organization_id = (
            SELECT organization_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
        AND (
            SELECT role
            FROM public.profiles
            WHERE id = auth.uid()
        ) = ANY(target_roles)
    );

-- INSERT: blocked at RLS level â€” only SECURITY DEFINER RPCs can insert
CREATE POLICY "org_announcements_insert_deny"
    ON public.org_announcements
    FOR INSERT
    WITH CHECK (false);


-- =============================================================================
-- RLS POLICIES: task_reassignments
-- =============================================================================

-- SELECT: org members can see their org's reassignment audit trail
CREATE POLICY "task_reassignments_select"
    ON public.task_reassignments FOR SELECT
    USING (
        organization_id = (
            SELECT organization_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
    );

-- INSERT: blocked at RLS level â€” only SECURITY DEFINER RPCs can insert
CREATE POLICY "task_reassignments_insert_deny"
    ON public.task_reassignments
    FOR INSERT
    WITH CHECK (false);


-- =============================================================================
-- RLS POLICIES: notifications (new policies for recipient_id column)
-- Note: Existing policies on notifications are NOT touched.
-- These policies are additive and scoped to the new recipient_id column.
-- =============================================================================

-- SELECT: users can see notifications where they are the recipient
CREATE POLICY "notifications_select_by_recipient"
    ON public.notifications
    FOR SELECT
    USING (
        recipient_id = auth.uid()
        OR user_id = auth.uid()  -- backward compat with existing user_id pattern
    );

-- INSERT: blocked â€” only SECURITY DEFINER RPCs may insert notifications
CREATE POLICY "notifications_insert_deny"
    ON public.notifications
    FOR INSERT
    WITH CHECK (false);

-- UPDATE: users may update (e.g., mark as read) their own notifications
CREATE POLICY "notifications_update_by_recipient"
    ON public.notifications
    FOR UPDATE
    USING (
        recipient_id = auth.uid()
        OR user_id = auth.uid()
    );


-- =============================================================================
-- INDEXES
-- =============================================================================

-- space_memberships: fast lookups by member + status and space + status
CREATE INDEX IF NOT EXISTS idx_space_memberships_profile_status
    ON public.space_memberships (profile_id, status);

CREATE INDEX IF NOT EXISTS idx_space_memberships_space_status
    ON public.space_memberships (space_id, status);

-- staff_invitations: deduplication check (email + org) and status filter
CREATE INDEX IF NOT EXISTS idx_staff_invitations_email_org
    ON public.staff_invitations (email, organization_id);

CREATE INDEX IF NOT EXISTS idx_staff_invitations_status
    ON public.staff_invitations (status);

-- notifications: recipient unread feed
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read
    ON public.notifications (recipient_id, read);

-- org_announcements: org-scoped chronological feed (most recent first)
CREATE INDEX IF NOT EXISTS idx_org_announcements_org_created
    ON public.org_announcements (organization_id, created_at DESC);

```


===== supabase\migrations\20260313000002_invitation_system_rpcs.sql =====
```
-- =============================================================================
-- Migration: Invitation System RPCs
-- Date: 2026-03-13
-- =============================================================================

-- =============================================================================
-- 1. send_staff_invitation (SECURITY DEFINER)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.send_staff_invitation(
    email text,
    role public.user_role,
    space_assignments jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
    v_caller_role public.user_role;
    v_org_id uuid;
    v_invitation_id uuid;
    v_host text;
    v_url text;
BEGIN
    -- 1. Validate caller is owner or admin
    SELECT p.role::public.user_role, p.organization_id INTO v_caller_role, v_org_id
    FROM public.profiles p
    WHERE p.id = auth.uid();
    
    IF v_caller_role NOT IN ('owner'::public.user_role, 'admin'::public.user_role) THEN
        RAISE EXCEPTION 'Only owners and admins can send staff invitations';
    END IF;

    -- 2. Check org seat quota stub (Phase 8 wires real limits)
    -- always return allowed for now

    -- 3. Insert a record into staff_invitations
    INSERT INTO public.staff_invitations (
        organization_id,
        invited_by,
        email,
        role,
        space_assignments,
        status
    ) VALUES (
        v_org_id,
        auth.uid(),
        email,
        role,
        space_assignments,
        'pending'
    ) RETURNING id INTO v_invitation_id;

    -- 4. Call the invitation-api edge function via pg_net
    v_host := current_setting('request.headers', true)::jsonb->>'host';
    IF v_host IS NULL THEN
        -- Fallback for local dev 
        v_url := 'http://kong:8000/functions/v1/';
    ELSE
        IF v_host LIKE 'localhost%' OR v_host LIKE '127.0.0.1%' THEN
            v_url := 'http://' || v_host || '/functions/v1/';
        ELSE
            v_url := 'https://' || v_host || '/functions/v1/';
        END IF;
    END IF;
    
    PERFORM net.http_post(
        url := v_url || 'invitation-api',
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
            'email', email,
            'role', role,
            'org_id', v_org_id,
            'invitation_id', v_invitation_id
        )
    );

    -- 5. Return invitation_id
    RETURN v_invitation_id;
END;
$$;


-- =============================================================================
-- 2. send_client_invitation (SECURITY DEFINER)
-- Notes: Encountered Logic Failure - cannot insert stub into space_memberships
-- without a valid profile_id. Used invitations table instead as dictated by schema.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.send_client_invitation(
    email text,
    space_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
    v_caller_role public.user_role;
    v_org_id uuid;
    v_invitation_id uuid;
    v_host text;
    v_url text;
BEGIN
    -- 1. Validate caller is owner or admin
    SELECT p.role::public.user_role, p.organization_id INTO v_caller_role, v_org_id
    FROM public.profiles p
    WHERE p.id = auth.uid();
    
    IF v_caller_role NOT IN ('owner'::public.user_role, 'admin'::public.user_role) THEN
        RAISE EXCEPTION 'Only owners and admins can send client invitations';
    END IF;

    -- Insert into invitations table with role=client and status=pending
    INSERT INTO public.invitations (
        organization_id,
        space_id,
        email,
        role,
        invited_by,
        status
    ) VALUES (
        v_org_id,
        space_id,
        email,
        'client',
        auth.uid(),
        'pending'
    ) RETURNING id INTO v_invitation_id;

    -- Call the invitation-api edge function
    v_host := current_setting('request.headers', true)::jsonb->>'host';
    IF v_host IS NULL THEN
        -- Fallback for local dev 
        v_url := 'http://kong:8000/functions/v1/';
    ELSE
        IF v_host LIKE 'localhost%' OR v_host LIKE '127.0.0.1%' THEN
            v_url := 'http://' || v_host || '/functions/v1/';
        ELSE
            v_url := 'https://' || v_host || '/functions/v1/';
        END IF;
    END IF;
    
    PERFORM net.http_post(
        url := v_url || 'invitation-api',
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
            'email', email,
            'role', 'client',
            'org_id', v_org_id,
            'invitation_id', v_invitation_id
        )
    );

    RETURN v_invitation_id;
END;
$$;

-- =============================================================================
-- 3. accept_invitation (SECURITY DEFINER)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.accept_invitation(
    accepting_user_id uuid,
    invitation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role text;
    v_org_id uuid;
    v_space_assignments jsonb;
    v_is_client boolean := false;
    v_space_id uuid;
    v_status text;
    v_record record;
    v_assignment jsonb;
BEGIN
    -- Check staff_invitations
    SELECT role::text, organization_id, space_assignments, status INTO v_role, v_org_id, v_space_assignments, v_status
    FROM public.staff_invitations
    WHERE id = invitation_id;

    IF NOT FOUND THEN
        -- Check client invitations
        SELECT role::text, organization_id, space_id, status INTO v_role, v_org_id, v_space_id, v_status
        FROM public.invitations
        WHERE id = invitation_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invitation not found';
        END IF;

        IF v_role = 'client' THEN
            v_is_client := true;
        END IF;
    END IF;

    IF v_status = 'accepted' THEN
        -- Idempotent return
        RETURN jsonb_build_object('role', v_role, 'redirect_path', CASE WHEN v_role = 'client' THEN '/client/portal' ELSE '/dashboard' END);
    END IF;

    -- If no profile exists for accepting_user_id: INSERT into profiles
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = accepting_user_id) THEN
        INSERT INTO public.profiles (
            id,
            email,
            role,
            organization_id,
            session_version
        ) VALUES (
            accepting_user_id,
            (SELECT email FROM auth.users WHERE id = accepting_user_id),
            v_role,
            v_org_id,
            0
        );
    END IF;

    -- Process assignments
    IF v_is_client THEN
        -- Insert client membership based on the space_id stored
        IF NOT EXISTS (SELECT 1 FROM public.space_memberships WHERE profile_id = accepting_user_id AND space_id = v_space_id) THEN
            INSERT INTO public.space_memberships (
                space_id,
                profile_id,
                status
            ) VALUES (
                v_space_id,
                accepting_user_id,
                'active'
            );
        END IF;

        -- Update invitation status
        UPDATE public.invitations
        SET status = 'accepted', accepted_at = now()
        WHERE id = invitation_id;
    ELSE
        -- Iterate over space_assignments jsonb
        FOR v_assignment IN SELECT * FROM jsonb_array_elements(v_space_assignments)
        LOOP
            IF NOT EXISTS (SELECT 1 FROM public.space_memberships WHERE profile_id = accepting_user_id AND space_id = (v_assignment->>'space_id')::uuid) THEN
                INSERT INTO public.space_memberships (
                    space_id,
                    profile_id,
                    capabilities,
                    status
                ) VALUES (
                    (v_assignment->>'space_id')::uuid,
                    accepting_user_id,
                    COALESCE(v_assignment->'capabilities', '{}'::jsonb),
                    'active'
                );
            END IF;
        END LOOP;

        -- Update staff_invitations status
        UPDATE public.staff_invitations
        SET status = 'accepted', accepted_at = now()
        WHERE id = invitation_id;
    END IF;

    RETURN jsonb_build_object('role', v_role, 'redirect_path', CASE WHEN v_role = 'client' THEN '/client/portal' ELSE '/dashboard' END);
END;
$$;

-- =============================================================================
-- 4. validate_invitation_context (SECURITY INVOKER)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.validate_invitation_context(
    invitation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_context jsonb;
    v_org_name text;
    v_inviter_name text;
    v_role text;
    v_expires_at timestamptz;
    v_status text;
BEGIN
    -- Check staff_invitations
    SELECT 
        o.name, 
        COALESCE(p.full_name, split_part(p.email, '@', 1)), 
        si.role::text, 
        si.expires_at,
        si.status
    INTO v_org_name, v_inviter_name, v_role, v_expires_at, v_status
    FROM public.staff_invitations si
    JOIN public.organizations o ON o.id = si.organization_id
    JOIN public.profiles p ON p.id = si.invited_by
    WHERE si.id = invitation_id;

    IF NOT FOUND THEN
        -- Check client invitations
        SELECT 
            o.name, 
            COALESCE(p.full_name, split_part(p.email, '@', 1)), 
            i.role, 
            i.expires_at,
            i.status
        INTO v_org_name, v_inviter_name, v_role, v_expires_at, v_status
        FROM public.invitations i
        JOIN public.organizations o ON o.id = i.organization_id
        JOIN public.profiles p ON p.id = i.invited_by
        WHERE i.id = invitation_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('valid', false, 'error', 'Invitation not found');
        END IF;
    END IF;

    IF v_status != 'pending' THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invitation is no longer pending');
    END IF;

    IF v_expires_at < now() THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invitation has expired');
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'org_name', v_org_name,
        'inviter_name', v_inviter_name,
        'role', v_role,
        'expires_at', v_expires_at
    );
END;
$$;

```


===== supabase\migrations\20260515000000_token_invitation_rpcs.sql =====
```
-- Token-based invitation RPCs used by invitations-api edge function and the web app.
-- Adds p_token overloads without removing legacy uuid-based functions.

-- -----------------------------------------------------------------------------
-- validate_invitation_context(p_token text)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_invitation_context(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_id uuid;
  v_org_name text;
  v_inviter_name text;
  v_role text;
  v_expires_at timestamptz;
  v_status text;
  v_email text;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found');
  END IF;

  BEGIN
    v_invitation_id := p_token::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found');
  END;

  SELECT
    o.name,
    COALESCE(p.full_name, split_part(p.email, '@', 1)),
    si.role::text,
    si.expires_at,
    si.status,
    si.email
  INTO v_org_name, v_inviter_name, v_role, v_expires_at, v_status, v_email
  FROM public.staff_invitations si
  JOIN public.organizations o ON o.id = si.organization_id
  JOIN public.profiles p ON p.id = si.invited_by
  WHERE si.id = v_invitation_id;

  IF FOUND THEN
  IF v_status = 'accepted' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'accepted');
  END IF;
  IF v_status = 'revoked' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'revoked');
  END IF;
  IF v_status <> 'pending' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found');
  END IF;
  IF v_expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'status', 'expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'status', 'pending',
    'org_name', v_org_name,
    'inviter_name', v_inviter_name,
    'role', v_role,
    'invited_email', v_email,
    'expires_at', v_expires_at,
    'invite_type', 'teams_link'
  );
  END IF;

  SELECT
    o.name,
    COALESCE(p.full_name, split_part(p.email, '@', 1)),
    i.role,
    i.expires_at,
    i.status,
    i.email
  INTO v_org_name, v_inviter_name, v_role, v_expires_at, v_status, v_email
  FROM public.invitations i
  JOIN public.organizations o ON o.id = i.organization_id
  JOIN public.profiles p ON p.id = i.invited_by
  WHERE i.id = v_invitation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found');
  END IF;

  IF v_status = 'accepted' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'accepted');
  END IF;
  IF v_status = 'revoked' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'revoked');
  END IF;
  IF v_status <> 'pending' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found');
  END IF;
  IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'status', 'expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'status', 'pending',
    'org_name', v_org_name,
    'inviter_name', v_inviter_name,
    'role', v_role,
    'invited_email', v_email,
    'expires_at', v_expires_at,
    'invite_type', 'clients_link'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- accept_invitation(p_token text)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invitation_id uuid;
  v_legacy jsonb;
  v_role text;
  v_space_id uuid;
  v_org_id uuid;
  v_is_client boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_AUTHENTICATED');
  END IF;

  BEGIN
    v_invitation_id := p_token::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TOKEN');
  END;

  v_legacy := public.accept_invitation(v_user_id, v_invitation_id);

  v_role := v_legacy->>'role';
  v_space_id := NULL;
  v_org_id := NULL;

  SELECT organization_id INTO v_org_id
  FROM public.staff_invitations
  WHERE id = v_invitation_id;

  IF NOT FOUND THEN
    SELECT organization_id, space_id INTO v_org_id, v_space_id
    FROM public.invitations
    WHERE id = v_invitation_id;
    v_is_client := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'invite_type', CASE WHEN v_is_client THEN 'clients_link' ELSE 'teams_link' END,
    'context_type', CASE WHEN v_is_client THEN 'client_space' ELSE 'org' END,
    'context_id', CASE WHEN v_is_client THEN v_space_id::text ELSE v_org_id::text END,
    'role', v_role,
    'org_id', v_org_id,
    'space_id', v_space_id,
    'needs_activation', true,
    'membership_created', true,
    'already_member', false,
    'redirect_path', CASE
      WHEN v_role = 'client' AND v_space_id IS NOT NULL THEN '/spaces/' || v_space_id::text
      ELSE '/dashboard'
    END
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- resolve_space_invite_token(p_token text)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_space_invite_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_space record;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object('valid', false, 'error_code', 'INVALID_TOKEN');
  END IF;

  SELECT
    s.id,
    s.name,
    s.description,
    s.organization_id,
    o.name AS organization_name,
    s.invitation_token
  INTO v_space
  FROM public.spaces s
  JOIN public.organizations o ON o.id = s.organization_id
  WHERE s.invitation_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error_code', 'INVALID_TOKEN');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'space_id', v_space.id,
    'space_name', v_space.name,
    'space_description', v_space.description,
    'organization_id', v_space.organization_id,
    'organization_name', v_space.organization_name,
    'requires_auth', true
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- accept_space_invite_token(p_token text, ...)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_space_invite_token(
  p_token text,
  p_client_name text DEFAULT NULL,
  p_client_company text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_space_id uuid;
  v_org_id uuid;
  v_email text;
  v_full_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_AUTHENTICATED');
  END IF;

  SELECT s.id, s.organization_id
  INTO v_space_id, v_org_id
  FROM public.spaces s
  WHERE s.invitation_token = p_token
  LIMIT 1;

  IF v_space_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TOKEN');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  v_full_name := COALESCE(NULLIF(btrim(p_client_name), ''), split_part(v_email, '@', 1));

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    INSERT INTO public.profiles (id, email, full_name, organization_id, role)
    VALUES (v_user_id, v_email, v_full_name, v_org_id, 'client')
    ON CONFLICT (id) DO UPDATE
      SET organization_id = COALESCE(public.profiles.organization_id, EXCLUDED.organization_id),
          role = CASE
            WHEN public.profiles.role IN ('owner', 'admin', 'staff') THEN public.profiles.role
            ELSE 'client'
          END;
  ELSE
    UPDATE public.profiles
    SET
      organization_id = COALESCE(organization_id, v_org_id),
      role = CASE WHEN role IN ('owner', 'admin', 'staff') THEN role ELSE 'client' END,
      full_name = COALESCE(NULLIF(full_name, ''), v_full_name)
    WHERE id = v_user_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.space_memberships
    WHERE profile_id = v_user_id AND space_id = v_space_id
  ) THEN
    INSERT INTO public.space_memberships (space_id, profile_id, role, status)
    VALUES (v_space_id, v_user_id, 'client', 'active');
  ELSE
    UPDATE public.space_memberships
    SET status = 'active', role = 'client'
    WHERE profile_id = v_user_id AND space_id = v_space_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'invite_type', 'clients_link',
    'context_type', 'client_space',
    'context_id', v_space_id,
    'role', 'client',
    'org_id', v_org_id,
    'space_id', v_space_id,
    'needs_activation', true,
    'membership_created', true,
    'already_member', false,
    'redirect_path', '/spaces/' || v_space_id::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_invitation_context(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_space_invite_token(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_space_invite_token(text, text, text) TO authenticated, service_role;

```
