import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MeetingDetailsPanel } from './MeetingDetailsPanel';

const MeetingReviewPage: React.FC = () => {
    const { meetingId } = useParams();
    const navigate = useNavigate();

    if (!meetingId) return null;

    return (
        <div className="min-h-screen bg-[#FFFFFF] p-4 md:p-6">
            <div className="mx-auto max-w-3xl">
                <MeetingDetailsPanel meetingId={meetingId} onClose={() => navigate(-1)} />
            </div>
        </div>
    );
};

export default MeetingReviewPage;
