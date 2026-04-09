
export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  SPACES = 'SPACES',
  SPACE_DETAIL = 'SPACE_DETAIL',
  INBOX = 'INBOX',
  MEETINGS = 'MEETINGS',
  FILES = 'FILES',
  TASKS = 'TASKS',
  STAFF = 'STAFF',
  SETTINGS = 'SETTINGS',
  ACTIVITY_LEDGER = 'ACTIVITY_LEDGER',
  CLIENTS = 'CLIENTS',
  INVITATIONS = 'INVITATIONS'
}

export interface Invitation {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
  created_at: string;
  invited_by: string;
  token?: string;
  type: 'staff' | 'client';
}

export interface ClientSpace {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'onboarding' | 'archived' | 'closed';
  visibility: 'organization' | 'private';
  role: 'owner' | 'staff' | 'client';
  permission_level: 'principal' | 'contributor' | 'viewer';
  message_count: number;
  file_count: number;
  meeting_count: number;
  member_count: number;
  last_activity_at: string;
  version?: number;
  onboarding_state?: any;
  archive_reason?: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  starts_at: string; // ISO timestamp
  duration_minutes?: number;
  space_id: string;
  organization_id: string;
  daily_room_name?: string;
  daily_room_url?: string;
  status: 'scheduled' | 'active' | 'live' | 'ended' | 'cancelled';
  recording_url?: string;
  recording_status: 'none' | 'processing' | 'available' | 'ready' | 'failed';
  has_recording?: boolean;
  notes?: string;
  created_by?: string;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  updated_at: string;
  deleted_at?: string | null;
  outcome?: 'successful' | 'follow_up_needed' | 'no_show' | 'cancelled' | 'inconclusive' | null;
  outcome_notes?: string | null;
  ended_by?: string | null;
}

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  participant_id?: string;
  participant_name?: string;
  user_id?: string;
  role: 'host' | 'participant' | 'observer';
  joined_at?: string;
  left_at?: string;
  created_at: string;
}

export interface Recording {
  id: string;
  meeting_id: string;
  daily_recording_id: string;
  file_path?: string;
  file_size?: number;
  duration_seconds?: number;
  status: 'processing' | 'ready' | 'error';
  download_url?: string;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  spaceId: string;
  organizationId?: string;
  senderId?: string;
  senderType: 'client' | 'staff';
  senderName?: string;
  senderAvatar?: string;
  content: string;
  channel?: 'general' | 'internal';
  extension?: 'text' | 'file' | 'system' | 'chat';
  payload?: any;
  parentId?: string;
  threadRootId?: string;
  replyCount?: number;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface StaffMember {
  id: string;
  full_name: string;
  role: 'owner' | 'admin' | 'staff';
  email: string;
  assigned_spaces: Array<{
    space_id: string;
    capabilities: string[];
  }>;
  status: 'active' | 'pending';
  is_active: boolean;
}

export interface StaffSpaceCapability {
  staff_id: string;
  space_id: string;
  capability_key: string;
  allowed: boolean;
}

export interface ClientLifecycle {
  id: string;
  org_id: string;
  client_id: string;
  full_name: string;
  avatar_url?: string;
  lifecycle_stage: 'invited' | 'activated' | 'engaged' | 'at_risk' | 'churned';
  onboarding_score: number;
  last_activity_at: string;
  message_count: number;
  file_count: number;
  meeting_count: number;
  is_active: boolean;
}

export interface DataExport {
  id: string;
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'expired';
  requested_at: string;
  processed_at?: string;
  expires_at?: string;
  download_url?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  status: 'pending' | 'in_progress' | 'done';
  space_id: string;
  assignee_id: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface SpaceFile {
  id: string;
  name: string;
  display_name?: string;
  type: string;
  space_id: string;
  organization_id: string;
  mime_type?: string;
  file_size?: number;
  status?: string;
  is_global?: boolean;
  created_at: string;
  deleted_at?: string | null;
  uploaded_by: string;
  parent_id?: string | null;
  version_number?: number;
  // Populated by version-history RPCs / queries for secure downloads.
  storage_path?: string;
  uploaded_by_name?: string;
}

export interface ChartData {
  name: string;
  value: number;
}

