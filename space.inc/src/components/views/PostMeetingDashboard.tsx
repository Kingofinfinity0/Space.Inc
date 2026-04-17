import React from 'react';
import { MeetingDetailsPanel } from './MeetingDetailsPanel';

interface PostMeetingDashboardProps {
  meeting: any;
  onClose: () => void;
}

export const PostMeetingDashboard: React.FC<PostMeetingDashboardProps> = ({ meeting }) => {
  return <MeetingDetailsPanel meetingId={meeting.id} />;
};
