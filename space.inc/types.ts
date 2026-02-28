
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
  CRM = 'CRM'
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
  recording_status: 'none' | 'processing' | 'available' | 'failed';
  has_recording?: boolean;
  notes?: string;
  created_by?: string;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  updated_at: string;
  deleted_at?: string | null;
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
  sender: string;
  senderType: 'client' | 'staff';
  content: string;
  timestamp: string;
  isUnread: boolean;
  clientSpaceId: string;
}

export interface StaffMember {
  id: string;
  full_name?: string; // Standardize with DB
  name?: string;      // Legacy compatibility
  role: 'owner' | 'admin' | 'staff';
  email: string;
  assignedSpaces?: number;
  assigned_spaces?: Array<{
    space_id: string;
    capabilities: string[];
  }>;
  status: 'Active' | 'Pending Invite' | 'active' | 'pending';
  inviteLink?: string;
  is_active?: boolean;
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
  dueDate: string;
  status: 'Pending' | 'In Progress' | 'Done' | 'pending' | 'in_progress' | 'done';
  clientSpaceId?: string; // Legacy
  space_id?: string;      // Standard
  assigneeId: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface SpaceFile {
  id: string;
  name: string;
  display_name?: string;
  type: string;
  uploadDate: string;
  clientSpaceId?: string;
  space_id: string;
  organization_id: string;
  mime_type?: string;
  file_size?: number;
  status?: string;
  is_global?: boolean;
  created_at: string;
  deleted_at?: string | null;
  uploaded_by: string;
}

export interface ChartData {
  name: string;
  value: number;
}
