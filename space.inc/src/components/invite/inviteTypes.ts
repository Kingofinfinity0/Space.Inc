export type InviteMemberType = 'staff' | 'client';
export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type ShareLinkStatus = 'active' | 'inactive' | 'expired' | 'exhausted' | 'not_found';

export type InviteErrorCode =
  | 'INVITE_NOT_FOUND'
  | 'INVITE_EXPIRED'
  | 'INVITE_REVOKED'
  | 'INVITE_ALREADY_ACCEPTED'
  | 'INVITE_ALREADY_PENDING'
  | 'EMAIL_MISMATCH'
  | 'NOT_AUTHENTICATED'
  | 'NOT_AUTHORIZED'
  | 'ALREADY_MEMBER'
  | 'SHARE_LINK_NOT_FOUND'
  | 'SHARE_LINK_INACTIVE'
  | 'SHARE_LINK_EXPIRED'
  | 'SHARE_LINK_EXHAUSTED'
  | 'EMAIL_DOMAIN_NOT_ALLOWED';

export type InvitationDetails = {
  space_id: string;
  space_name: string;
  organization_name?: string | null;
  email: string;
  member_type: InviteMemberType;
  role: string;
  status: InviteStatus;
  expires_at: string;
};

export type InvitationRow = {
  invitation_id: string;
  id?: string;
  email: string;
  member_type: InviteMemberType;
  role: string;
  status: InviteStatus;
  expires_at: string;
};

export type SpaceMemberRow = {
  id?: string;
  profile_id?: string;
  member_id?: string;
  full_name?: string;
  email?: string;
  role?: string;
  membership_role?: string;
  member_type?: InviteMemberType;
  joined_at?: string;
  profiles?: {
    id?: string;
    full_name?: string;
    email?: string;
    role?: string;
  };
};

export type ShareLinkMetadata = {
  id: string;
  default_member_type: InviteMemberType;
  default_role: string;
  allowed_email_domain: string | null;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  rotated_at: string | null;
};

export type ShareLinkDetails = {
  space_id: string | null;
  space_name: string | null;
  default_member_type: InviteMemberType | null;
  default_role: string | null;
  allowed_email_domain: string | null;
  status: ShareLinkStatus;
};

export const inviteErrorMessages: Record<InviteErrorCode, string> = {
  INVITE_NOT_FOUND: 'This invitation link is not valid.',
  INVITE_EXPIRED: 'This invitation has expired. Ask the sender to regenerate it.',
  INVITE_REVOKED: 'This invitation has been revoked.',
  INVITE_ALREADY_ACCEPTED: 'This invitation has already been used.',
  INVITE_ALREADY_PENDING: 'This person already has a pending invitation.',
  EMAIL_MISMATCH: 'This invite is for a different email address.',
  NOT_AUTHENTICATED: 'Please sign in to accept this invitation.',
  NOT_AUTHORIZED: 'You are not authorized to manage invitations for this space.',
  ALREADY_MEMBER: "You're already a member of this space.",
  SHARE_LINK_NOT_FOUND: 'This join link is not valid.',
  SHARE_LINK_INACTIVE: 'This join link has been disabled.',
  SHARE_LINK_EXPIRED: 'This join link has expired.',
  SHARE_LINK_EXHAUSTED: 'This join link has reached its usage limit.',
  EMAIL_DOMAIN_NOT_ALLOWED: 'This join link is restricted to a different email domain.',
};

const inviteErrorCodes = new Set(Object.keys(inviteErrorMessages));

export const getInviteErrorCode = (error: unknown): InviteErrorCode | null => {
  const raw = [
    (error as any)?.code,
    (error as any)?.error_code,
    (error as any)?.message,
    (error as any)?.details,
  ]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  for (const code of inviteErrorCodes) {
    if (raw.includes(code)) return code as InviteErrorCode;
  }

  return null;
};

export const getInviteStatusErrorCode = (invitation?: InvitationDetails | null): InviteErrorCode | null => {
  if (!invitation) return 'INVITE_NOT_FOUND';
  if (invitation.status === 'accepted') return 'INVITE_ALREADY_ACCEPTED';
  if (invitation.status === 'revoked') return 'INVITE_REVOKED';
  if (invitation.status === 'expired') return 'INVITE_EXPIRED';
  if (invitation.status === 'pending' && new Date(invitation.expires_at) < new Date()) return 'INVITE_EXPIRED';
  return null;
};

export const getInvitationId = (row: InvitationRow) => row.invitation_id || row.id || '';

export const getInviteUrl = (rawToken: string) => `${window.location.origin}/invite/${encodeURIComponent(rawToken)}`;

export const getJoinUrl = (rawToken: string) => `${window.location.origin}/join/${encodeURIComponent(rawToken)}`;

export const getShareLinkStatusErrorCode = (shareLink?: ShareLinkDetails | null): InviteErrorCode | null => {
  if (!shareLink || shareLink.status === 'not_found') return 'SHARE_LINK_NOT_FOUND';
  if (shareLink.status === 'inactive') return 'SHARE_LINK_INACTIVE';
  if (shareLink.status === 'expired') return 'SHARE_LINK_EXPIRED';
  if (shareLink.status === 'exhausted') return 'SHARE_LINK_EXHAUSTED';
  return null;
};
