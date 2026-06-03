import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/apiService';
import { InvitationDetails, InviteMemberType, InvitationRow, ShareLinkDetails, ShareLinkMetadata, SpaceMemberRow } from '@/components/invite/inviteTypes';

export const invitationKeys = {
  detail: (token: string) => ['invitation', token] as const,
  invitations: (spaceId: string) => ['invitations', spaceId] as const,
  shareLink: (spaceId: string) => ['share-link', spaceId] as const,
  shareLinkDetail: (token: string) => ['share-link-token', token] as const,
  members: (spaceId: string) => ['members', spaceId] as const,
  spaces: ['spaces'] as const,
};

export const useInvitationByToken = (token?: string) =>
  useQuery({
    queryKey: invitationKeys.detail(token || ''),
    queryFn: async () => apiService.getInvitationByToken(token!) as Promise<InvitationDetails>,
    enabled: Boolean(token),
  });

export const useSpaceMembers = (spaceId?: string) =>
  useQuery({
    queryKey: invitationKeys.members(spaceId || ''),
    queryFn: async () => apiService.listSpaceMembers(spaceId!) as Promise<SpaceMemberRow[]>,
    enabled: Boolean(spaceId),
  });

export const usePendingInvitations = (spaceId?: string) =>
  useQuery({
    queryKey: invitationKeys.invitations(spaceId || ''),
    queryFn: async () => apiService.listSpaceInvitations(spaceId!, 'pending') as Promise<InvitationRow[]>,
    enabled: Boolean(spaceId),
  });

export const useShareLink = (spaceId?: string) =>
  useQuery({
    queryKey: invitationKeys.shareLink(spaceId || ''),
    queryFn: async () => apiService.getShareLink(spaceId!) as Promise<ShareLinkMetadata>,
    enabled: Boolean(spaceId),
  });

export const useShareLinkByToken = (token?: string) =>
  useQuery({
    queryKey: invitationKeys.shareLinkDetail(token || ''),
    queryFn: async () => apiService.getShareLinkByToken(token!) as Promise<ShareLinkDetails>,
    enabled: Boolean(token),
  });

export const useCreateInvitation = (spaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; memberType: InviteMemberType; role: string }) =>
      apiService.createInvitation(spaceId, input.email, input.memberType, input.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.invitations(spaceId) });
      queryClient.invalidateQueries({ queryKey: invitationKeys.members(spaceId) });
    },
  });
};

export const useRegenerateInvitation = (spaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => apiService.regenerateInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.invitations(spaceId) });
      queryClient.invalidateQueries({ queryKey: invitationKeys.members(spaceId) });
    },
  });
};

export const useRevokeInvitation = (spaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => apiService.revokeInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.invitations(spaceId) });
      queryClient.invalidateQueries({ queryKey: invitationKeys.members(spaceId) });
    },
  });
};

export const useRotateShareLink = (spaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiService.rotateShareLink(spaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.shareLink(spaceId) });
    },
  });
};

export const useUpdateShareLinkConfig = (spaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      default_member_type?: InviteMemberType | null;
      default_role?: 'owner' | 'admin' | 'manager' | 'member' | 'viewer' | null;
      allowed_email_domain?: string | null;
      max_uses?: number | null;
      expires_at?: string | null;
    }) => apiService.updateShareLinkConfig(spaceId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.shareLink(spaceId) });
    },
  });
};

export const useSetShareLinkEnabled = (spaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => apiService.setShareLinkEnabled(spaceId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.shareLink(spaceId) });
    },
  });
};

export const useJoinViaShareLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rawToken: string) => apiService.joinViaShareLink(rawToken),
    onSuccess: (result: any) => {
      const spaceId = result?.space_id;
      if (spaceId) {
        queryClient.invalidateQueries({ queryKey: invitationKeys.members(spaceId) });
      }
      queryClient.invalidateQueries({ queryKey: invitationKeys.spaces });
    },
  });
};

export const useAcceptInvitation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rawToken: string) => apiService.acceptInvitation(rawToken),
    onSuccess: (result: any) => {
      const spaceId = result?.space_id;
      if (spaceId) {
        queryClient.invalidateQueries({ queryKey: invitationKeys.invitations(spaceId) });
        queryClient.invalidateQueries({ queryKey: invitationKeys.members(spaceId) });
      }
      queryClient.invalidateQueries({ queryKey: invitationKeys.spaces });
    },
  });
};
