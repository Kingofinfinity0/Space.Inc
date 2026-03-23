const ERRORS: Record<string, string> = {
  'NOT_AUTHENTICATED': 'You need to be signed in to do that.',
  'PROFILE_NOT_FOUND': 'Your account setup is incomplete. Please sign out and back in.',
  'NOT_MESSAGE_OWNER': 'You can only edit or delete your own messages.',
  'EMPTY_MESSAGE': 'Message cannot be blank.',
  'FILE_NOT_FOUND': 'This file is no longer available.',
  'ACCESS_DENIED': 'You do not have permission to access this file.',
  'MEETING_NOT_FOUND': 'This meeting no longer exists.',
  'MEETING_ALREADY_ENDED': 'This meeting has already ended.',
  'SPACE_NOT_FOUND': 'This space no longer exists.',
  'INVITATION_NOT_FOUND': 'This invitation link is invalid or has already been used.',
  'INVITATION_EXPIRED': 'This invitation has expired. Ask the sender to resend.',
  'INVITATION_ALREADY_USED': 'This invitation has already been accepted.',
  'EMAIL_MISMATCH': 'You are signed in with a different email than this invitation was sent to.',
  'PERMISSION_DENIED': 'You do not have permission to do that.',
  'INSUFFICIENT_PERMISSIONS': 'You do not have permission to do that.',
  'QUOTA_EXCEEDED': 'You have reached the limit for your current plan. Upgrade to continue.',
  'INVALID_CATEGORY': 'Please select a valid meeting type.',
};

export function friendlyError(raw: string | undefined | null): string {
  if (!raw) return 'Something went wrong. Please try again.';
  const code = raw.split(':')[0].trim();
  return ERRORS[code] || 'Something went wrong. Please try again.';
}
