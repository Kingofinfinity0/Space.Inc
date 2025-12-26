
export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  SPACES = 'SPACES',
  SPACE_DETAIL = 'SPACE_DETAIL',
  INBOX = 'INBOX',
  MEETINGS = 'MEETINGS',
  FILES = 'FILES',
  TASKS = 'TASKS',
  STAFF = 'STAFF',
  SETTINGS = 'SETTINGS'
}

export interface ClientSpace {
  id: string;
  name: string;
  status: 'Active' | 'Onboarding' | 'Archived';
  onboardingComplete: boolean;
  modules: {
    messaging: boolean;
    meetings: boolean;
    calendar: boolean;
    onboarding: boolean;
    files: boolean;
    referral: boolean;
  };
  clientData?: {
    contactName?: string;
    role?: string;
    email?: string;
  };
  analytics: {
    totalMeetings: number;
    totalDocs: number;
    lastActive: string;
  };
  assignedStaffId?: string;
  notifications?: number;
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
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  recording_url?: string;
  recording_status: 'none' | 'processing' | 'available' | 'failed';
  has_recording?: boolean;
  notes?: string;
  created_by?: string;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  updated_at: string;
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
  name: string;
  role: 'User' | 'Manager' | 'Staff'; 
  email: string;
  assignedSpaces: number;
  status: 'Active' | 'Pending Invite';
  inviteLink?: string;
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  status: 'Pending' | 'In Progress' | 'Done';
  clientSpaceId?: string;
  assigneeId: string;
}

export interface SpaceFile {
  id: string;
  name: string;
  type: string; // 'pdf', 'mp4', 'doc', 'zip'
  uploadDate: string;
  clientSpaceId: string; // 'global' if shared with all
  isGlobal?: boolean;
}

export interface ChartData {
  name: string;
  value: number;
}
