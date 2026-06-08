
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
  CLIENTS = 'CLIENTS'
}

export interface ClientSpace {
  id: string;
  name: string;
  description?: string;
  metadata?: {
    space_type?: 'retainer' | 'project' | string;
    work_model?: 'retainer' | 'project' | string;
    lead_consultant_name?: string;
    [key: string]: any;
  };
  invitation_token?: string;
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
  closed_at?: string | null;
  closed_by?: string | null;
  closure_reason?: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface OrgTeamPolicies {
  organization_id?: string;
  max_spaces_per_member?: number | null;
  messaging_enabled: boolean;
  meetings_enabled: boolean;
  file_uploads_enabled: boolean;
  max_file_size_mb: number;
  custom_roles_enabled: boolean;
  updated_by?: string | null;
  updated_at?: string | null;
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
  storage_path?: string;
  file_size?: number;
  file_size_bytes?: number;
  duration_seconds?: number;
  status: 'processing' | 'ready' | 'error';
  download_url?: string;
  signed_url?: string;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  user_ids?: string[];
  names?: string[];
  reacted_by_me?: boolean;
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
  channel?: string;
  channelId?: string | null;
  extension?: 'text' | 'file' | 'image' | 'system' | 'chat';
  payload?: any;
  parentId?: string;
  threadRootId?: string;
  replyCount?: number;
  reactions?: MessageReaction[];
  readByMe?: boolean;
  isMentioned?: boolean;
  mentionedUserIds?: string[];
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

export interface SpaceTaskMember {
  user_id: string;
  membership_id: string;
  full_name: string;
  email?: string;
  avatar_url?: string;
  role?: string;
  context_role?: string;
  member_type?: 'staff' | 'client' | string;
  status?: string;
  is_active?: boolean;
}

export interface TaskStatusDefinition {
  id: string;
  space_id: string;
  status_key: Task['status'];
  name: string;
  category: 'triage' | 'backlog' | 'unstarted' | 'started' | 'review' | 'completed' | 'canceled';
  color: string;
  position: number;
  is_default: boolean;
  is_terminal: boolean;
  is_actionable: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ClientLifecycle {
  id: string;
  org_id: string;
  organization_id?: string;
  client_id: string;
  full_name: string;
  avatar_url?: string;
  lifecycle_stage: 'invited' | 'activated' | 'engaged' | 'at_risk' | 'churned';
  onboarding_score: number;
  health_score?: number;
  health_label?: 'healthy' | 'warning' | 'at-risk' | 'critical' | 'unknown' | string;
  last_activity_at: string;
  message_count: number;
  file_count: number;
  meeting_count: number;
  is_active: boolean;
  created_at?: string;
  joined_at?: string;
  company_name?: string;
  contact_email?: string;
  lead_consultant_name?: string;
  lead_consultant_email?: string;
  model_type?: 'retainer' | 'project' | 'paused' | 'offboarded' | string;
  active_spaces?: number;
  contract_started_at?: string;
  health_factors?: Array<{
    key?: string;
    label: string;
    weight: number;
    value: number;
  }>;
  audit_events?: Array<{
    title: string;
    body: string;
    category: string;
    created_at?: string;
    actor_name?: string;
  }>;
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
  due_date?: string;
  start_date?: string;
  status: 'todo' | 'pending' | 'in_progress' | 'review' | 'done' | 'canceled';
  space_id?: string;
  assignee_id?: string;
  assignee_name?: string;
  assignee_avatar?: string;
  reviewer_id?: string;
  reviewer_name?: string;
  reviewer_avatar?: string;
  creator_name?: string;
  priority?: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  assigned_group?: string;
  task_number?: number;
  task_key?: string;
  parent_task_id?: string | null;
  estimate_points?: number | null;
  estimate_hours?: number | null;
  archived_at?: string | null;
  archived_by?: string | null;
  deleted_at?: string | null;
  sort_order?: number | null;
  labels?: Array<{ id: string; name: string; color: string }>;
  subtask_count?: number;
  comment_count?: number;
  watcher_count?: number;
  relation_count?: number;
  comments?: any[];
  activity?: any[];
  relations?: any[];
  subtasks?: Task[];
  attachments?: any[];
  watchers?: any[];
  created_by?: string;
  created_at?: string;
  updated_at?: string;
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


export type PermissionMap = {
  view_files?: boolean;
  upload_files?: boolean;
  manage_tasks?: boolean;
  view_task?: boolean;
  create_task?: boolean;
  update_task?: boolean;
  assign_task?: boolean;
  comment_task?: boolean;
  manage_labels?: boolean;
  manage_workflow?: boolean;
  archive_task?: boolean;
  delete_task?: boolean;
  message_clients?: boolean;
  schedule_meetings?: boolean;
  delete_own_files?: boolean;
  download_files?: boolean;
  view_dashboard?: boolean;
  view_history?: boolean;
  view_meetings?: boolean;
  view_tasks?: boolean;
  view_assigned_spaces?: boolean;
  view_all_spaces?: boolean;
  manage_spaces?: boolean;
  manage_team?: boolean;
  can_invite_clients?: boolean;
  can_invite_staff?: boolean;
  _role?: string;
  _space_id?: string;
  _org_id?: string;
}
