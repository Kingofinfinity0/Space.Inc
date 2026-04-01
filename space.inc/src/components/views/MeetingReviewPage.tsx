import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import { supabase } from '../../lib/supabase';
import {
    ArrowLeft, Download, Play, Pause, Volume2, Maximize2, 
    Clock, Users, FileText, Calendar, Loader2, AlertCircle
} from 'lucide-react';
import {
    GlassCard, Button, Heading, Text, Modal
} from '../UI/index';

interface MeetingDetail {
    id: string;
    title: string;
    description?: string;
    starts_at: string;
    ended_at?: string;
    duration_minutes?: number;
    space_id: string;
    space_name?: string;
    outcome?: string;
    outcome_notes?: string;
    ended_by_name?: string;
    recording_url?: string;
    recording_status: 'none' | 'processing' | 'ready' | 'failed';
    participants?: Array<{
        name: string;
        role: string;
        joined_at: string;
        left_at?: string;
    }>;
}

interface MeetingNote {
    id: string;
    meeting_id: string;
    user_id: string;
    content: string;
    created_at: string;
    updated_at: string;
    user_name?: string;
}

const MeetingReviewPage: React.FC = () => {
    const { spaceId, meetingId } = useParams<{ spaceId: string; meetingId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
    const [notes, setNotes] = useState<MeetingNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [videoLoading, setVideoLoading] = useState(false);
    const [signedUrl, setSignedUrl] = useState<string | null>(null);

    // Load meeting details and notes
    useEffect(() => {
        if (!meetingId) return;

        const loadData = async () => {
            try {
                setLoading(true);

                // Load meeting details
                const meetingRes = await apiService.getMeetingDetail(meetingId);
                if (meetingRes.data) {
                    setMeeting(meetingRes.data);

                    // Get signed URL for recording if available
                    if (meetingRes.data.recording_url && meetingRes.data.recording_status === 'ready') {
                        await getSignedUrl(meetingRes.data.recording_url);
                    }
                }

                // Load meeting notes
                await loadNotes();

            } catch (error) {
                console.error('Failed to load meeting data:', error);
                showToast('Failed to load meeting details', 'error');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [meetingId, showToast]);

    const loadNotes = async () => {
        if (!meetingId) return;

        try {
            const { data, error } = await supabase
                .from('meeting_notes')
                .select('*')
                .eq('meeting_id', meetingId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setNotes(data || []);
        } catch (error) {
            console.error('Failed to load notes:', error);
        }
    };

    const getSignedUrl = async (recordingPath: string) => {
        try {
            setVideoLoading(true);
            const { data, error } = await supabase.storage
                .from('meeting-recordings')
                .createSignedUrl(recordingPath, 3600); // 1 hour expiry

            if (error) throw error;
            setSignedUrl(data.signedUrl);
        } catch (error) {
            console.error('Failed to get signed URL:', error);
            showToast('Failed to load recording', 'error');
        } finally {
            setVideoLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!meeting?.recording_url || !signedUrl) return;

        try {
            const response = await fetch(signedUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${meeting.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_recording.mp4`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download failed:', error);
            showToast('Failed to download recording', 'error');
        }
    };

    const getOutcomeColor = (outcome?: string) => {
        if (!outcome) return 'bg-gray-100 text-gray-600';
        const colors = {
            successful: 'bg-green-100 text-green-700',
            follow_up_needed: 'bg-yellow-100 text-yellow-700',
            no_show: 'bg-red-100 text-red-700',
            cancelled: 'bg-gray-100 text-gray-600',
            inconclusive: 'bg-blue-100 text-blue-700'
        };
        return colors[outcome as keyof typeof colors] || 'bg-gray-100 text-gray-600';
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading meeting details...</p>
                </div>
            </div>
        );
    }

    if (!meeting) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Meeting not found</p>
                    <Button className="mt-4" onClick={() => navigate(-1)}>
                        Go Back
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(-1)}
                                className="mr-4"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back
                            </Button>
                            <div>
                                <Heading level={1} className="text-xl">{meeting.title}</Heading>
                                <Text variant="secondary" className="text-sm">
                                    {new Date(meeting.starts_at).toLocaleDateString()} • 
                                    {meeting.duration_minutes ? ` ${meeting.duration_minutes} min` : ''}
                                </Text>
                            </div>
                        </div>
                        {meeting.outcome && (
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getOutcomeColor(meeting.outcome)}`}>
                                {meeting.outcome.replace(/_/g, ' ')}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Video Section */}
                    <div className="lg:col-span-2">
                        <GlassCard className="overflow-hidden">
                            <div className="aspect-video bg-black">
                                {videoLoading ? (
                                    <div className="h-full flex items-center justify-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                                    </div>
                                ) : signedUrl ? (
                                    <video
                                        controls
                                        className="w-full h-full"
                                        preload="metadata"
                                    >
                                        <source src={signedUrl} type="video/mp4" />
                                        Your browser does not support the video tag.
                                    </video>
                                ) : meeting.recording_status === 'processing' ? (
                                    <div className="h-full flex items-center justify-center text-white">
                                        <div className="text-center">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                                            <p>Processing recording...</p>
                                        </div>
                                    </div>
                                ) : meeting.recording_status === 'failed' ? (
                                    <div className="h-full flex items-center justify-center text-white">
                                        <div className="text-center">
                                            <AlertCircle className="h-8 w-8 mx-auto mb-4" />
                                            <p>Recording failed</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-white">
                                        <div className="text-center">
                                            <FileText className="h-8 w-8 mx-auto mb-4" />
                                            <p>No recording available</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Video Controls */}
                            {signedUrl && (
                                <div className="p-4 bg-gray-50 border-t border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-4">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleDownload}
                                                className="flex items-center"
                                            >
                                                <Download className="h-4 w-4 mr-2" />
                                                Download
                                            </Button>
                                        </div>
                                        <Text variant="secondary" className="text-xs">
                                            Recording available for download
                                        </Text>
                                    </div>
                                </div>
                            )}
                        </GlassCard>

                        {/* Meeting Info */}
                        <GlassCard className="mt-6">
                            <div className="p-6">
                                <Heading level={2} className="text-lg mb-4">Meeting Details</Heading>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center space-x-3">
                                        <Calendar className="h-5 w-5 text-gray-400" />
                                        <div>
                                            <p className="text-sm font-medium">Date</p>
                                            <p className="text-sm text-gray-600">
                                                {new Date(meeting.starts_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <Clock className="h-5 w-5 text-gray-400" />
                                        <div>
                                            <p className="text-sm font-medium">Duration</p>
                                            <p className="text-sm text-gray-600">
                                                {meeting.duration_minutes ? `${meeting.duration_minutes} minutes` : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <Users className="h-5 w-5 text-gray-400" />
                                        <div>
                                            <p className="text-sm font-medium">Participants</p>
                                            <p className="text-sm text-gray-600">
                                                {meeting.participants?.length || 0} attendees
                                            </p>
                                        </div>
                                    </div>
                                    {meeting.ended_by_name && (
                                        <div className="flex items-center space-x-3">
                                            <FileText className="h-5 w-5 text-gray-400" />
                                            <div>
                                                <p className="text-sm font-medium">Ended by</p>
                                                <p className="text-sm text-gray-600">{meeting.ended_by_name}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {meeting.outcome_notes && (
                                    <div className="mt-6">
                                        <Heading level={3} className="text-md font-medium mb-2">Outcome Notes</Heading>
                                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                                            {meeting.outcome_notes}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    </div>

                    {/* Notes Section */}
                    <div className="lg:col-span-1">
                        <GlassCard>
                            <div className="p-6">
                                <Heading level={2} className="text-lg mb-4">Meeting Notes</Heading>
                                
                                {notes.length > 0 ? (
                                    <div className="space-y-4 max-h-96 overflow-y-auto">
                                        {notes.map((note) => (
                                            <div key={note.id} className="border-b border-gray-100 pb-3 last:border-b-0">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-medium text-gray-900">
                                                        {note.user_name || 'Anonymous'}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {new Date(note.created_at).toLocaleTimeString([], { 
                                                            hour: '2-digit', 
                                                            minute: '2-digit' 
                                                        })}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                                                    {note.content}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-sm text-gray-500">No notes were taken during this meeting</p>
                                    </div>
                                )}
                            </div>
                        </GlassCard>

                        {/* Participants List */}
                        {meeting.participants && meeting.participants.length > 0 && (
                            <GlassCard className="mt-6">
                                <div className="p-6">
                                    <Heading level={2} className="text-lg mb-4">Participants</Heading>
                                    <div className="space-y-3">
                                        {meeting.participants.map((participant, index) => (
                                            <div key={index} className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                                                        <span className="text-xs font-medium text-blue-600">
                                                            {participant.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium">{participant.name}</p>
                                                        <p className="text-xs text-gray-500 capitalize">{participant.role}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-500">
                                                        {new Date(participant.joined_at).toLocaleTimeString([], { 
                                                            hour: '2-digit', 
                                                            minute: '2-digit' 
                                                        })}
                                                    </p>
                                                    {participant.left_at && (
                                                        <p className="text-xs text-gray-400">
                                                            → {new Date(participant.left_at).toLocaleTimeString([], { 
                                                                hour: '2-digit', 
                                                                minute: '2-digit' 
                                                            })}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </GlassCard>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MeetingReviewPage;
