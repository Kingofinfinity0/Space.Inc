import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import { supabase } from '../../lib/supabase';
import {
  Rocket,
  LogOut,
  Bell,
  Activity,
  Calendar,
  Clock,
  CheckSquare,
  FileText,
  MessageSquare,
  Video,
  ListTodo,
  Star,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { GlassCard, Button, Heading, Input, Modal, SkeletonCard } from '../UI/index';
import { ClientSpace, Meeting, Task } from '../../types';

const ClientPortalView = ({
  client,
  meetings,
  onJoin,
  onLogout,
}: {
  client: ClientSpace;
  meetings: Meeting[];
  onJoin: (id: string) => void;
  onLogout: () => void;
}) => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const loadData = useCallback(async () => {
    const orgId = profile?.organization_id;
    if (!user || !orgId) return;

    try {
      setLoading(true);
      const [notificationsRes, activityRes, tasksRes] = await Promise.all([
        apiService.getUnifiedNotifications(orgId, user.id),
        apiService.getDashboardFeed(orgId, 20),
        apiService.getTasks(orgId, client.id),
      ]);

      setNotifications(notificationsRes.data || []);
      setActivityFeed((activityRes.data || []).filter((log: any) => log.space_id === client.id));
      setTasks(tasksRes.data || []);
    } catch (err) {
      console.error('Failed to load client portal data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, profile?.organization_id, client.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const upcomingMeetings = meetings
    .filter((meeting) => meeting.status === 'scheduled')
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const overviewStats = [
    { label: 'Unread updates', value: notifications.filter((item) => !item.is_read).length, accent: 'text-[#0D0D0D]' },
    { label: 'Upcoming meetings', value: upcomingMeetings.length, accent: 'text-[#0D0D0D]' },
    { label: 'Open tasks', value: tasks.filter((task) => task.status !== 'done').length, accent: 'text-[#0D0D0D]' },
  ];

  return (
    <div className="app-page-shell px-4 pb-28 pt-6 md:px-8 md:pb-32 md:pt-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <GlassCard className="glass-elevated relative overflow-hidden p-6 md:p-8 page-enter">
          <div className="pointer-events-none absolute inset-0 bg-[#F7F7F8]" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-white text-[#0D0D0D] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <Rocket size={22} />
                </div>
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#6E6E80]">Client workspace</div>
                  <div className="text-lg font-semibold tracking-[-0.02em] text-[#0D0D0D]">Space.inc Portal</div>
                </div>
              </div>

              <div className="space-y-3">
                <Heading level={2} className="text-3xl font-semibold tracking-[-0.04em] text-[#0D0D0D] md:text-4xl">
                  Welcome back, {profile?.full_name?.split(' ')[0] || 'Member'}
                </Heading>
                <p className="max-w-2xl text-sm leading-6 text-[#6E6E80] md:text-base">
                  A quieter, sharper workspace for {client.name}. Meetings, files, updates, and action items stay in one living surface.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {overviewStats.map((item, index) => (
                  <div
                    key={item.label}
                    style={{ animationDelay: `${index * 20}ms` }}
                    className="rounded-[8px] border border-[#E5E5E5] bg-white px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] page-enter"
                  >
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E80]">{item.label}</div>
                    <div className={`mt-2 text-2xl font-semibold tracking-[-0.04em] ${item.accent}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <Button variant="outline" size="sm" onClick={() => setIsReviewOpen(true)}>
                Leave a review
              </Button>
                <Button variant="secondary" size="sm" onClick={() => showToast('Help request submitted.', 'info')}>
                  Get help
                </Button>
              <button
                title="Sign Out"
                onClick={onLogout}
                className="interactive-surface flex h-11 w-11 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#6E6E80] hover:text-[#0D0D0D]"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="space-y-6">
            <GlassCard className="p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-[#0D0D0D]">
                    <Bell size={16} className="text-[#6E6E80]" />
                    Inbox
                  </div>
                  <p className="mt-1 text-xs text-[#6E6E80]">Quiet, high-signal updates from your workspace.</p>
                </div>
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id);
                      loadData();
                    }}
                  >
                    Mark all read
                  </Button>
                )}
              </div>

              {loading ? (
                <SkeletonCard className="h-24 rounded-[8px] border-[#E5E5E5] bg-[#F7F7F8]" />
              ) : notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.map((notification, index) => (
                    <div
                      key={notification.id}
                      style={{ animationDelay: `${index * 20}ms` }}
                      className="interactive-surface page-enter flex items-start gap-4 rounded-[8px] border border-[#E5E5E5] bg-white px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] text-[#0D0D0D]">
                        {notification.type === 'file_uploaded' ? (
                          <FileText size={18} />
                        ) : notification.type === 'message_received' ? (
                          <MessageSquare size={18} />
                        ) : (
                          <Calendar size={18} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-6 text-[#0D0D0D]">{notification.message}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#6E6E80]">
                          {formatTime(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[8px] border border-[#E5E5E5] bg-white px-5 py-10 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <CheckSquare size={30} className="mx-auto text-[#6E6E80]" />
                  <p className="mt-3 text-sm text-[#6E6E80]">All caught up.</p>
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-[#0D0D0D]">
                    <Activity size={16} className="text-[#6E6E80]" />
                    Recent activity
                  </div>
                  <p className="mt-1 text-xs text-[#6E6E80]">A dense feed of what changed, without dashboard clutter.</p>
                </div>
                <div className="rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#6E6E80]">
                  Live
                </div>
              </div>

              {loading ? (
                <SkeletonCard className="h-40 rounded-[24px] border-white/8 bg-white/[0.04]" />
              ) : activityFeed.length > 0 ? (
                <div className="divide-y divide-white/6 overflow-hidden rounded-[22px] border border-white/6 bg-white/[0.03]">
                  {activityFeed.map((item, index) => (
                    <div
                      key={item.id}
                      style={{ animationDelay: `${index * 20}ms` }}
                      className="page-enter flex items-center gap-4 px-4 py-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.08] text-slate-300">
                        {item.action_type === 'file_uploaded' ? (
                          <FileText size={18} />
                        ) : item.action_type === 'message_sent' ? (
                          <MessageSquare size={18} />
                        ) : (
                          <Video size={18} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-100">
                          <span className="font-medium">{item.actor_name}</span>{' '}
                          {item.action_type === 'file_uploaded'
                            ? 'shared a file'
                            : item.action_type === 'message_sent'
                              ? 'sent a message'
                              : 'updated the workspace'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Added {formatDate(item.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-muted rounded-[22px] px-5 py-10 text-center text-sm text-slate-400">
                  Activity will appear here as your team works.
                </div>
              )}
            </GlassCard>
          </div>

          <div className="space-y-6">
            <GlassCard className="p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Calendar size={16} className="text-amber-300" />
                    Upcoming meetings
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Ready-to-join sessions with just enough context.</p>
                </div>
              </div>

              {upcomingMeetings.length > 0 ? (
                <div className="space-y-3">
                  {upcomingMeetings.map((meeting, index) => (
                    <div
                      key={meeting.id}
                      style={{ animationDelay: `${index * 20}ms` }}
                      className="glass-muted interactive-surface page-enter rounded-[22px] p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                            {formatDate(meeting.starts_at)}
                          </div>
                          <p className="text-sm font-medium leading-6 text-slate-100">{meeting.title}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Clock size={12} />
                            {formatTime(meeting.starts_at)}
                          </div>
                        </div>
                        <Button variant="primary" size="sm" onClick={() => onJoin(meeting.id)}>
                          Join
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-muted rounded-[22px] px-5 py-10 text-center text-sm text-slate-400">
                  No scheduled meetings yet.
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <ListTodo size={16} className="text-violet-300" />
                    My tasks
                  </div>
                  <p className="mt-1 text-xs text-slate-400">A tighter checklist with status-only color accents.</p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  <Sparkles size={12} />
                  Focused
                </div>
              </div>

              {loading ? (
                <SkeletonCard className="h-40 rounded-[24px] border-white/8 bg-white/[0.04]" />
              ) : tasks.length > 0 ? (
                <div className="divide-y divide-white/6 overflow-hidden rounded-[22px] border border-white/6 bg-white/[0.03]">
                  {tasks.map((task, index) => (
                    <div
                      key={task.id}
                      style={{ animationDelay: `${index * 20}ms` }}
                      className={`page-enter flex items-start gap-3 px-4 py-4 ${task.status === 'done' ? 'opacity-65' : ''}`}
                    >
                      <div
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                          task.status === 'done'
                            ? 'border-emerald-400/35 bg-emerald-400/25 text-emerald-200'
                            : 'border-white/14 bg-white/[0.04] text-slate-500'
                        }`}
                      >
                        {task.status === 'done' && <CheckSquare size={12} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${task.status === 'done' ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                          {task.title}
                        </p>
                        {task.due_date && (
                          <p className="mt-1 text-xs text-slate-500">Due {formatDate(task.due_date)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-muted rounded-[22px] px-5 py-10 text-center text-sm text-slate-400">
                  No pending tasks right now.
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </div>

      <Modal isOpen={isReviewOpen} onClose={() => setIsReviewOpen(false)} title="Feedback & Review">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-slate-300">
            How would you rate your experience with {profile?.organization_name || 'us'} so far?
          </p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`interactive-surface flex h-12 w-12 items-center justify-center rounded-2xl border ${
                  rating >= star
                    ? 'border-amber-300/30 bg-amber-300/18 text-amber-200'
                    : 'border-white/8 bg-white/[0.04] text-slate-500'
                }`}
              >
                <Star size={20} fill={rating >= star ? 'currentColor' : 'none'} strokeWidth={1.6} />
              </button>
            ))}
          </div>
          <Input
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="Tell us what felt smooth and what still needs work."
            label="Additional comments"
          />
          <Button
            className="w-full"
            onClick={async () => {
              if (!profile?.organization_id) return;
              try {
                await apiService.submitClientReview(profile.organization_id, client.id, rating, reviewComment);
                showToast('Thank you for your review!', 'success');
                setIsReviewOpen(false);
              } catch (err: any) {
                showToast(err.message || 'Failed to submit review', 'error');
              }
            }}
          >
            Submit review
            <ArrowRight size={16} />
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default ClientPortalView;
