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
  error_code?: 'INVALID_TOKEN' | 'LINK_EXPIRED' | 'INVITE_FULL';
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

export const errorCodeMessages: Record<string, string> = {
  LINK_EXPIRED: 'This invite link has expired.',
  INVITE_FULL: 'This invite has reached its usage limit.',
  EMAIL_NOT_ALLOWED: "Your email is not on the allowlist for this invite.",
  NOT_AUTHENTICATED: 'You must be signed in to accept this invite.',
  INVALID_TOKEN: 'This invite link is invalid.',
  INVITATION_EXPIRED: 'This invitation has expired.',
  INVITATION_ALREADY_USED: 'This invitation has already been used.',
  EMAIL_MISMATCH: 'This invitation was sent to a different email address.',
};

export const inviteService = {
  /**
   * Resolve a space invite token (public - no auth required)
   * This is for the /join/:token flow
   * Uses edge function action 'resolve_space_link'
   */
  async resolveSpaceToken(token: string): Promise<SpaceInviteTokenResponse> {
    const response = await fetch(`${EDGE_FUNCTION_BASE_URL}/invitations-api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve_space_link', token }),
    });

    if (!response.ok) {
      throw new Error(`Failed to resolve space token: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || result;
  },

  /**
   * Accept a space invite (auth required)
   * This is for the /join/:token flow
   * Uses edge function action 'accept_space_link'
   */
  async acceptSpaceInvite(token: string, accessToken: string): Promise<AcceptSpaceInviteResponse> {
    const response = await fetch(`${EDGE_FUNCTION_BASE_URL}/invitations-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: 'accept_space_link',
        token,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to accept invite: ${response.statusText}`);
    }

    const result = await response.json();
    const data = result.data || result;

    // Map error codes to user-friendly messages
    if (data.error_code && errorCodeMessages[data.error_code]) {
      data.errorMessage = errorCodeMessages[data.error_code];
    }

    return data;
  },

  /**
   * Validate a personal email invite (public - no auth required)
   * This is for the /accept-invite?token=... flow
   */
  async validateEmailInvite(token: string): Promise<EmailInviteValidationResponse> {
    const response = await fetch(`${EDGE_FUNCTION_BASE_URL}/invitations-api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'validate',
        token,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to validate invite: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || result;
  },

  /**
   * Accept a personal email invite (auth required)
   * This is for the /accept-invite flow
   */
  async acceptEmailInvite(token: string, accessToken: string): Promise<AcceptEmailInviteResponse> {
    const response = await fetch(`${EDGE_FUNCTION_BASE_URL}/invitations-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: 'accept',
        token,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to accept invite: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || result;
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
   * Store pending token in localStorage for post-auth retrieval
   */
  storePendingToken(token: string, type: 'email' | 'space' = 'space'): void {
    localStorage.setItem('pending_invite_token', token);
    localStorage.setItem('pending_invite_type', type);
    // Keep legacy key for backward compatibility if needed, but the new code should use the above
    if (type === 'space') {
      localStorage.setItem('pending_space_token', token);
    }
  },

  /**
   * Retrieve and clear pending token from localStorage
   */
  getAndClearPendingToken(): { token: string; type: 'email' | 'space' } | null {
    const token = localStorage.getItem('pending_invite_token');
    const type = localStorage.getItem('pending_invite_type') as 'email' | 'space' | null;

    if (token) {
      localStorage.removeItem('pending_invite_token');
      localStorage.removeItem('pending_invite_type');
      localStorage.removeItem('pending_space_token'); // Clean up legacy
      return { token, type: type || 'space' };
    }

    // Fallback to legacy
    const legacyToken = localStorage.getItem('pending_space_token');
    if (legacyToken) {
      localStorage.removeItem('pending_space_token');
      return { token: legacyToken, type: 'space' };
    }

    return null;
  },

  /**
   * Check if there's a pending token
   */
  hasPendingToken(): boolean {
    return !!localStorage.getItem('pending_invite_token') || !!localStorage.getItem('pending_space_token');
  },
};
