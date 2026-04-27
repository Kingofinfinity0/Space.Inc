export type WorkspaceRole = 'owner' | 'admin' | 'staff' | 'client';

export type WorkspaceRoleDefinition = {
  label: string;
  summary: string;
  scope: string;
  accent: string;
};

export const WORKSPACE_ROLES: Record<WorkspaceRole, WorkspaceRoleDefinition> = {
  owner: {
    label: 'Owner',
    summary: 'Full business control, analytics, billing, and governance.',
    scope: 'Sees the entire organization and every connected space.',
    accent: 'text-black',
  },
  admin: {
    label: 'Admin',
    summary: 'Operational management, delegation, and workspace coordination.',
    scope: 'Coordinates spaces, staff, invites, and operational workflows.',
    accent: 'text-zinc-700',
  },
  staff: {
    label: 'Staff',
    summary: 'Assigned execution work inside the spaces they are given.',
    scope: 'Works only inside assigned spaces with scoped permissions.',
    accent: 'text-zinc-600',
  },
  client: {
    label: 'Client',
    summary: 'Client portal access for approved spaces and shared work.',
    scope: 'Sees a focused portal experience for their own space.',
    accent: 'text-zinc-500',
  },
};

export const WORKSPACE_ROLE_ORDER: WorkspaceRole[] = ['owner', 'admin', 'staff', 'client'];

export function getWorkspaceRoleLabel(role: string | null | undefined) {
  if (!role) return 'Unknown';
  return WORKSPACE_ROLES[role as WorkspaceRole]?.label || role;
}

export function normalizeWorkspaceRole(role: string | null | undefined): WorkspaceRole | null {
  if (role === 'owner' || role === 'admin' || role === 'staff' || role === 'client') {
    return role;
  }
  return null;
}

export function isOrganizationRole(role: string | null | undefined) {
  return role === 'owner' || role === 'admin' || role === 'staff';
}
