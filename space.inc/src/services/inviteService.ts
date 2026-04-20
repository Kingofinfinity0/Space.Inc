import { supabase, EDGE_FUNCTION_BASE_URL } from '../lib/supabase';

export interface SpaceInviteTokenResponse {
  valid: boolean;
  space_id?: string;
  space_name?: string;
  space_description?: string;
  organization_id?: string;
  organization_name?: string;
  requires_auth?: boolean;
  config?: {
    max_uses?: number;
    use_count?: number;
    expires_at?: string;
  };
  error_code?: 'INVALID_TOKEN' | 'LINK_EXPIRED' | 'INVITE_FULL' | 'NOT_AUTHENTICATED';
  error?: string;
}

export interface AcceptSpaceInviteResponse {
  success: boolean;
  data?: {
    space_id: string;
    space_name: string;
    organization_id: string;
    role: 'client' | 'staff' | 'admin';
    redirect_path: string;
    already_member?: boolean;
  };
  error_code?: 'LINK_EXPIRED' | 'INVITE_FULL' | 'EMAIL_NOT_ALLOWED' | 'INVALID_TOKEN' | 'NOT_AUTHENTICATED';
}

export interface RegenerateSpaceLinkResponse {
  success: boolean;
  data?: {
    invitation_url: string;
    invitation_token: string;
  };
  error?: string;
}

export interface EmailInviteValidationResponse {
  valid: boolean;
  status: 'pending' | 'expired' | 'accepted' | 'revoked' | 'not_found';
  org_name?: string;
  inviter_name?: string;
  invited_email?: string;
  role?: 'staff' | 'client' | 'admin';
  expires_at?: string;
  invite_type?: 'staff' | 'client';
  error?: string;
  error_code?: 'INVITATION_EXPIRED' | 'INVITATION_ALREADY_USED' | 'EMAIL_MISMATCH' | 'NOT_AUTHENTICATED' | 'INVALID_TOKEN';
}

export interface AcceptEmailInviteResponse {
  success: boolean;
  data?: {
    role: 'staff' | 'admin' | 'client';
    redirect_path: string;
  };
  error_code?: 'INVITATION_EXPIRED' | 'INVITATION_ALREADY_USED' | 'EMAIL_MISMATCH' | 'NOT_AUTHENTICATED';
}

export interface SendInviteResponse {
  success: boolean;
  data?: {
    token: string;
    invite_url: string;
    email: string;
    expires_at: string;
  };
  error?: string;
}

export interface SpaceInviteLinkResponse {
  success: boolean;
  data?: {
    invitation_token: string;
    invitation_url: string;
  };
}

export type ResolvedInviteToken =
  | {
      token: string;
      type: 'space_link';
      data: SpaceInviteTokenResponse;
    }
  | {
      token: string;
      type: 'personal';
      data: EmailInviteValidationResponse;
    };

const pendingInviteKeys = {
  current: 'pending_invite_token',
  legacyCurrent: 'pending_invite_token',
  legacySpace: 'pending_space_token',
  legacyType: 'pending_invite_type',
} as const;

const inviteErrorMessages: Record<string, string> = {
  INVALID_TOKEN: 'This invite link is invalid.',
  LINK_EXPIRED: 'This invite link has expired.',
  INVITE_FULL: 'This invite has reached its limit.',
  NOT_AUTHENTICATED: 'Please sign in to continue.',
  INVITATION_EXPIRED: 'This invitation has expired.',
  INVITATION_ALREADY_USED: 'This invitation has already been used.',
  EMAIL_MISMATCH: 'This invitation was sent to a different email address.',
};

const isBrowserStorageAvailable = () => typeof window !== 'undefined';

const readStorageToken = (storage: Storage | undefined, key: string) => {
  if (!storage) return null;
  return storage.getItem(key);
};

const clearStorageToken = (storage: Storage | undefined, key: string) => {
  if (!storage) return;
  storage.removeItem(key);
};

const clearPendingInviteVariants = () => {
  if (!isBrowserStorageAvailable()) return;

  [sessionStorage, localStorage].forEach((storage) => {
    clearStorageToken(storage, pendingInviteKeys.current);
    clearStorageToken(storage, pendingInviteKeys.legacyCurrent);
    clearStorageToken(storage, pendingInviteKeys.legacySpace);
    clearStorageToken(storage, pendingInviteKeys.legacyType);
  });
};

const peekPendingInviteToken = () => {
  if (!isBrowserStorageAvailable()) return null;

  return (
    readStorageToken(sessionStorage, pendingInviteKeys.current) ||
    readStorageToken(localStorage, pendingInviteKeys.current) ||
    readStorageToken(localStorage, pendingInviteKeys.legacySpace)
  );
};

const consumePendingInviteToken = () => {
  const token = peekPendingInviteToken();
  if (token) {
    clearPendingInviteVariants();
  }
  return token;
};

const postInvitationAction = async <T>(
  action: string,
  payload: Record<string, unknown>,
  accessToken?: string
): Promise<T> => {
  const response = await fetch(`${EDGE_FUNCTION_BASE_URL}/invitations-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const result = await response.json().catch(() => ({}));
  const data = result?.data ?? result;

  if (!response.ok) {
    const errorCode =
      result?.error_code ??
      result?.error?.code ??
      result?.error?.error_code ??
      result?.code ??
      data?.error_code ??
      data?.code;
    const message =
      inviteErrorMessages[String(errorCode)] ||
      result?.error?.message ||
      result?.message ||
      `Failed to ${action.replace(/_/g, ' ')}`;
    throw new Error(message);
  }

  return data as T;
};

const getInviteStatusMessage = (invite: { error_code?: string; error?: string } | null, fallback: string) => {
  const code = invite?.error_code || invite?.error;
  if (code && inviteErrorMessages[code]) return inviteErrorMessages[code];
  return fallback;
};

export const inviteService = {
  /**
   * Resolve a space invite token (public - no auth required)
   * This is for the /join/:token flow
   */
  async resolveSpaceToken(token: string): Promise<SpaceInviteTokenResponse> {
    return await postInvitationAction<SpaceInviteTokenResponse>('resolve_space_link', { token });
  },

  /**
   * Accept a space invite (auth required)
   * This is for the /join/:token flow
   */
  async acceptSpaceInvite(
    token: string,
    accessToken: string,
    clientName?: string,
    clientCompany?: string | null
  ): Promise<AcceptSpaceInviteResponse['data']> {
    return await postInvitationAction<AcceptSpaceInviteResponse['data']>(
      'accept_space_link',
      {
        token,
        client_name: clientName,
        client_company: clientCompany ?? null,
      },
      accessToken
    );
  },

  /**
   * Validate a personal email invite (public - no auth required)
   * This is for the /accept-invite?token=... flow
   */
  async validateEmailInvite(token: string): Promise<EmailInviteValidationResponse> {
    return await postInvitationAction<EmailInviteValidationResponse>('validate', { token });
  },

  /**
   * Accept a personal email invite (auth required)
   * This is for the /accept-invite flow
   */
  async acceptEmailInvite(token: string, accessToken: string): Promise<AcceptEmailInviteResponse['data']> {
    return await postInvitationAction<AcceptEmailInviteResponse['data']>('accept', { token }, accessToken);
  },

  /**
   * Send a personal client invite (auth required)
   */
  async sendClientInvite(email: string, spaceId: string, accessToken: string, expiresAt?: string): Promise<SendInviteResponse> {
    const response = await fetch(`${EDGE_FUNCTION_BASE_URL}/invitations-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: 'send_client',
        email,
        space_id: spaceId,
        expires_at: expiresAt,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send client invite: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || result;
  },

  /**
   * Send a personal staff invite (auth required)
   */
  async sendStaffInvite(
    email: string,
    role: 'staff' | 'admin',
    spaceAssignments: any[],
    expiresAt: string | undefined,
    accessToken: string
  ): Promise<SendInviteResponse> {
    const response = await fetch(`${EDGE_FUNCTION_BASE_URL}/invitations-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: 'send_staff',
        email,
        role,
        space_assignments: spaceAssignments,
        expires_at: expiresAt,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send staff invite: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || result;
  },

  /**
   * Get current space invite link (auth required)
   */
  async getSpaceInviteLink(spaceId: string, accessToken: string): Promise<SpaceInviteLinkResponse> {
    const response = await fetch(`${EDGE_FUNCTION_BASE_URL}/invitations-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: 'get_space_invite_link',
        space_id: spaceId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get space invite link: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || result;
  },

  /**
   * Regenerate a space invite link (auth required)
   */
  async regenerateSpaceLink(
    spaceId: string,
    accessToken: string,
    options: {
      invite_role?: 'client' | 'staff' | 'admin';
      max_uses?: number | null;
      expires_at?: string | null;
      allowed_emails?: string[] | null;
    } = {}
  ): Promise<RegenerateSpaceLinkResponse> {
    const { data, error } = await supabase.rpc('regenerate_space_invite_link', { p_space_id: spaceId });
    if (error) return { success: false, error: error.message };
    // RPC returns: data.data.invitation_url and data.data.invitation_token
    const payload = (data as any)?.data ?? data;
    return {
      success: true,
      data: {
        invitation_url: payload?.invitation_url,
        invitation_token: payload?.invitation_token,
      },
    };
  },

  /**
   * Resolve a token to its invite type.
   */
  async resolveInviteToken(token: string): Promise<ResolvedInviteToken> {
    const spaceInvite = await this.resolveSpaceToken(token);

    if (spaceInvite.valid) {
      return {
        token,
        type: 'space_link',
        data: spaceInvite,
      };
    }

    const personalInvite = await this.validateEmailInvite(token);
    if (personalInvite.valid) {
      return {
        token,
        type: 'personal',
        data: personalInvite,
      };
    }

    throw new Error(
      getInviteStatusMessage(
        spaceInvite,
        getInviteStatusMessage(
          personalInvite,
          'This invitation is no longer valid.'
        )
      )
    );
  },

  /**
   * Accept a resolved invite using the correct edge function action.
   */
  async acceptResolvedInvite(
    invite: ResolvedInviteToken,
    accessToken: string,
    options?: {
      clientName?: string;
      clientCompany?: string | null;
    }
  ): Promise<AcceptSpaceInviteResponse['data'] | AcceptEmailInviteResponse['data']> {
    if (invite.type === 'space_link') {
      return await this.acceptSpaceInvite(
        invite.token,
        accessToken,
        options?.clientName,
        options?.clientCompany
      );
    }

    return await this.acceptEmailInvite(invite.token, accessToken);
  },

  /**
   * Store pending token in sessionStorage for post-auth retrieval.
   */
  storePendingToken(token: string): void {
    if (!isBrowserStorageAvailable()) return;

    sessionStorage.setItem('pending_invite_token', token);
    localStorage.removeItem('pending_invite_token');
    localStorage.removeItem('pending_space_token');
    localStorage.removeItem('pending_invite_type');
  },

  /**
   * Peek at the current pending token without clearing it.
   */
  peekPendingToken(): string | null {
    return peekPendingInviteToken();
  },

  /**
   * Retrieve and clear pending token from sessionStorage/localStorage.
   */
  getAndClearPendingToken(): { token: string; type: 'email' | 'space' } | null {
    const token = consumePendingInviteToken();
    if (!token) return null;
    return { token, type: 'space' };
  },

  /**
   * Check if there's a pending token.
   */
  hasPendingToken(): boolean {
    return !!peekPendingInviteToken();
  },
};
