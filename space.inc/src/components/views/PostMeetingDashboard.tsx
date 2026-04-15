import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Download, FileText, Clock, ArrowRight, Users, CheckCircle2 } from 'lucide-react';
import { Button, GlassCard, Heading, Text } from '../UI';

interface PostMeetingDashboardProps {
  meeting: any;
  onClose: () => void;
}

export const PostMeetingDashboard: React.FC<PostMeetingDashboardProps> = ({ meeting }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <GlassCard className="glass-elevated overflow-hidden p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <Heading level={3} className="flex items-center gap-2 text-lg font-semibold text-white">
                <Video size={18} className="text-emerald-300" />
                Recording status
              </Heading>
              <p className="mt-1 text-sm text-slate-400">Review the session artifact without leaving the workspace rhythm.</p>
            </div>
            <div className="rounded-full border border-white/8 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
              Session asset
            </div>
          </div>

          {meeting.recording_url ? (
            <div className="space-y-4">
              <div className="group relative aspect-video overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(135deg,rgba(11,14,19,0.96),rgba(22,27,36,0.92))]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.16),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(96,165,250,0.12),_transparent_24%)]" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-white shadow-[0_18px_40px_rgba(0,0,0,0.3)]">
                    <Video size={24} />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-white">Recording ready</div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Hover to open review</div>
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <Button
                    variant="primary"
                    onClick={() => navigate(`/spaces/${meeting.space_id}/meetings/${meeting.id}/review`)}
                  >
                    Watch recording
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(meeting.recording_url, '_blank')}
                >
                  <Download size={16} />
                  Download MP4
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => navigate(`/spaces/${meeting.space_id}/meetings/${meeting.id}/review`)}
                >
                  <ArrowRight size={16} />
                  Open review room
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center rounded-[26px] border border-white/8 bg-white/[0.03] text-center">
              <Clock size={30} className="mb-3 text-slate-500" />
              <Text variant="secondary" className="text-slate-300">Processing recording...</Text>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">We will surface it here automatically</p>
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <Heading level={3} className="flex items-center gap-2 text-lg font-semibold text-white">
                <FileText size={18} className="text-blue-300" />
                Meeting summary
              </Heading>
              <p className="mt-1 text-sm text-slate-400">Outcome, attendance, and notes arranged like a focused briefing.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="glass-muted rounded-[22px] px-4 py-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <CheckCircle2 size={12} className="text-emerald-300" />
                  Outcome
                </div>
                <div className="mt-2 text-base font-semibold capitalize text-emerald-200">
                  {meeting.outcome || 'Success'}
                </div>
              </div>
              <div className="glass-muted rounded-[22px] px-4 py-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <Users size={12} className="text-blue-300" />
                  Attendees
                </div>
                <div className="mt-2 text-base font-semibold text-white">{meeting.attendees_count || 0}</div>
              </div>
            </div>

            <div className="glass-muted rounded-[22px] px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Notes excerpt</div>
              <div className="mt-3 text-sm leading-6 text-slate-300">
                {meeting.outcome_notes || 'No detailed outcome notes provided.'}
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => navigate(`/spaces/${meeting.space_id}/meetings/${meeting.id}/review`)}
            >
              View full transcript & notes
              <ArrowRight size={16} />
            </Button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
