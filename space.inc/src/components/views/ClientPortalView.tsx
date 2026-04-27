import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useRealtimeFiles } from '../../hooks/useRealtimeFiles';
import { GlassCard, Button, Heading, Input, Modal, SkeletonCard } from '../UI/index';
import { MessageItem } from './MessageItem';
import { FileUploadModal } from '../FileUploadModal';
import { SurfaceDock } from '../SurfaceDock';
import {
  ArrowRight,
  Bell,
  Calendar,
  CheckSquare,
  FileText,
  Inbox,
  MessageSquare,
  MoreVertical,
  Search,
  Sparkles,
  Upload,
  Video,
  LogOut,
  FolderClosed,
} from 'lucide-react';
import { ClientSpace, Meeting, Task } from '../../types';

type ClientTab = 'Dashboard' | 'Chat' | 'Meetings' | 'Docs';

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
  const { user, profile, organizationId } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<ClientTab>('Dashboard');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [showQuickReview, setShowQuickReview] = useState(false);

  const orgId = organizationId || profile?.organization_id || '';
  const { messages, loading: messagesLoading, error, sendMessage, sendFile, messagesEndRef, uploadProgress } =
    useRealtimeMessages(client.id, orgId);
  const { files, loading: filesLoading, refreshFiles, removeFile } = useRealtimeFiles(client.id, orgId);

  const loadData = useCallback(async () => {
    if (!user || !orgId) return;

    try {
      const { data } = await apiService.getTasks(orgId, client.id);
      if (data) setTasks(data as Task[]);
    } catch (err) {
      console.error('Error loading client portal data:', err);
    }
  }, [user, orgId, client.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const upcomingMeetings = useMemo(
    () =>
      meetings
        .filter((m) => m.status === 'scheduled' || m.status === 'active' || m.status === 'live')
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [meetings]
  );

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((msg) =>
      [msg.content, msg.senderName, msg.channel, msg.extension].some((value) =>
        String(value || '').toLowerCase().includes(q)
      )
    );
  }, [messages, searchQuery]);

  const stats = [
    { label: 'Messages', value: messages.length, icon: MessageSquare, tone: 'text-sky-500' },
    { label: 'Meetings', value: upcomingMeetings.length, icon: Video, tone: 'text-amber-500' },
    { label: 'Files', value: files.length, icon: FolderClosed, tone: 'text-emerald-500' },
    { label: 'Tasks', value: tasks.filter((t) => t.status !== 'done').length, icon: CheckSquare, tone: 'text-violet-500' },
  ];

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const handleSend = async () => {
    if (!messageInput.trim() || sending) return;
    setSending(true);
    const success = await sendMessage(messageInput);
    if (success) setMessageInput('');
    setSending(false);
  };

  const dockItems = [
    { label: 'Dashboard', icon: Inbox, isActive: activeTab === 'Dashboard', onClick: () => setActiveTab('Dashboard') },
    { label: 'Chat', icon: MessageSquare, isActive: activeTab === 'Chat', onClick: () => setActiveTab('Chat') },
    { label: 'Meetings', icon: Calendar, isActive: activeTab === 'Meetings', onClick: () => setActiveTab('Meetings') },
    { label: 'Docs', icon: FolderClosed, isActive: activeTab === 'Docs', onClick: () => setActiveTab('Docs') },
  ];

  const renderDashboard = () => (
    <div className="space-y-6">
      <GlassCard className="p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-black text-white">
                <MessageSquare size={20} />
              </div>
              <div>
                <h1 className="text-[24px] font-semibold tracking-[-0.04em] text-[#0D0D0D] md:text-[26px]">{client.name}</h1>
                <p className="text-sm text-[#6E6E80]">Your workspace overview, updates, and active conversation.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="surface-chip px-3 py-1.5 text-[11px] font-medium">
                <span className="indicator-dot" data-tone="green" />
                Active space
              </span>
              <span className="surface-chip px-3 py-1.5 text-[11px] font-medium">
                <Calendar size={12} />
                {upcomingMeetings.length} upcoming meetings
              </span>
              <span className="surface-chip px-3 py-1.5 text-[11px] font-medium">
                <FolderClosed size={12} />
                {files.length} files stored
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="rounded-full px-3" onClick={() => setShowQuickReview(true)}>
              Review
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full px-3" onClick={onLogout}>
              <LogOut size={14} className="mr-2" />
              Sign out
            </Button>
            <Button variant="ghost" size="sm" className="h-9 w-9 rounded-full p-0">
              <MoreVertical size={16} />
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[#6E6E80]">
                  <span>{item.label}</span>
                  <Icon size={13} className={item.tone} />
                </div>
                <div className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[#0D0D0D] md:text-2xl">{item.value}</div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <GlassCard className="p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <Heading level={3}>Next meeting</Heading>
              <p className="text-sm text-[#6E6E80]">The next thing waiting for you in this space.</p>
            </div>
            {upcomingMeetings[0] && (
              <Button variant="primary" size="sm" onClick={() => onJoin(upcomingMeetings[0].id)}>
                Join
              </Button>
            )}
          </div>
          {upcomingMeetings[0] ? (
            <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[#F7F7F8] text-[#0D0D0D]">
                  <Video size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">
                    {formatDate(upcomingMeetings[0].starts_at)} at {formatTime(upcomingMeetings[0].starts_at)}
                  </div>
                  <div className="text-base font-medium text-[#0D0D0D]">{upcomingMeetings[0].title}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[8px] border border-dashed border-[#E5E5E5] bg-white p-8 text-center text-sm text-[#6E6E80]">
              No scheduled meetings yet.
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5 md:p-6">
          <div className="mb-4">
            <Heading level={3}>Quick actions</Heading>
            <p className="text-sm text-[#6E6E80]">Fast entry points for the core things you do most.</p>
          </div>
          <div className="grid gap-3">
            <Button variant="secondary" className="justify-start" onClick={() => setActiveTab('Chat')}>
              <MessageSquare size={16} className="mr-2" /> Open chat
            </Button>
            <Button variant="secondary" className="justify-start" onClick={() => setActiveTab('Meetings')}>
              <Calendar size={16} className="mr-2" /> View meetings
            </Button>
            <Button variant="secondary" className="justify-start" onClick={() => setActiveTab('Docs')}>
              <FolderClosed size={16} className="mr-2" /> Browse files
            </Button>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Heading level={3}>Recent messages</Heading>
            <p className="text-sm text-[#6E6E80]">A compact preview from the live thread.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setActiveTab('Chat')}>
            Open chat
          </Button>
        </div>
        <div className="space-y-3">
          {messages.slice(-3).length > 0 ? (
            messages.slice(-3).map((msg) => (
              <div key={msg.id} className="rounded-[8px] border border-[#E5E5E5] bg-white px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">
                  {msg.senderName || 'Message'} · {formatTime(msg.createdAt)}
                </div>
                <p className="mt-2 text-sm leading-6 text-[#0D0D0D]">{msg.content}</p>
              </div>
            ))
          ) : (
            <div className="rounded-[8px] border border-dashed border-[#E5E5E5] bg-white px-5 py-8 text-center text-sm text-[#6E6E80]">
              No messages yet.
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );

  const renderChat = () => (
    <div className="grid min-h-[calc(100svh-240px)] gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <GlassCard className="sheet-panel flex min-h-[320px] flex-col overflow-hidden rounded-[8px]">
        <div className="border-b border-[#E5E5E5] bg-[#F7F7F8] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Heading level={2} className="mb-1">
                Messages
              </Heading>
              <p className="text-sm text-[#6E6E80]">One active thread for your space.</p>
            </div>
            <div className="surface-chip px-3 py-1.5 text-[11px] font-medium">
              <span className="indicator-dot" data-tone="blue" />
              1 thread
            </div>
          </div>
          <div className="relative mt-4">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6E6E80]" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-[8px] border border-[#DADADA] bg-white py-2.5 pl-10 pr-4 text-sm text-[#0D0D0D] placeholder:text-[#6E6E80] focus:border-black focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white">
          <button type="button" className="database-row block w-full border-x-0 border-b border-t-0 px-4 py-4 text-left transition-colors hover:bg-[#F7F7F8]" onClick={() => setActiveTab('Chat')}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="indicator-dot" data-tone={messages.length ? 'blue' : 'rose'} />
                  <span className="truncate text-sm font-medium text-[#0D0D0D]">{client.name}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-[#6E6E80]">{messages[messages.length - 1]?.content || 'No messages yet'}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#6E6E80]">
                  {messages[messages.length - 1]?.createdAt ? formatTime(messages[messages.length - 1].createdAt) : 'Now'}
                </span>
                <div className="mt-2 inline-flex min-w-[20px] items-center justify-center rounded-full border border-[#DADADA] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#0D0D0D]">
                  {messages.length}
                </div>
              </div>
            </div>
          </button>

          <div className="border-b border-[#E5E5E5] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Quick info</div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] px-3 py-2 text-xs text-[#0D0D0D]">
                <span className="flex items-center gap-2"><Bell size={12} className="text-[#6E6E80]" /> Notifications</span>
                <span className="text-[#6E6E80]">{messages.length ? `${messages.length} updates` : 'Quiet'}</span>
              </div>
              <div className="flex items-center justify-between rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] px-3 py-2 text-xs text-[#0D0D0D]">
                <span className="flex items-center gap-2"><Calendar size={12} className="text-[#6E6E80]" /> Meetings</span>
                <span className="text-[#6E6E80]">{upcomingMeetings.length} upcoming</span>
              </div>
              <div className="flex items-center justify-between rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] px-3 py-2 text-xs text-[#0D0D0D]">
                <span className="flex items-center gap-2"><FileText size={12} className="text-[#6E6E80]" /> Files</span>
                <span className="text-[#6E6E80]">{files.length} stored</span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="sheet-panel relative flex min-h-[640px] flex-col overflow-hidden rounded-[8px]">
        <div className="border-b border-[#E5E5E5] bg-white p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-black text-white shadow-lg">
                <MessageSquare size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#0D0D0D]">{client.name}</h1>
                <p className="text-sm text-[#6E6E80]">Client messaging and workspace updates.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="surface-chip px-3 py-1.5 text-[11px] font-medium">
                <span className="indicator-dot" data-tone="green" />
                Active thread
              </span>
              <Button variant="ghost" size="sm" className="rounded-full px-3" onClick={onLogout}>
                <LogOut size={14} className="mr-2" />
                Sign out
              </Button>
              <Button variant="ghost" size="sm" className="h-9 w-9 rounded-full p-0">
                <MoreVertical size={16} />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-[#EEF4F1]">
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <div className="mb-4 flex items-center gap-2 rounded-full border border-[#E5E5E5] bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">
                <Sparkles size={12} />
                Conversation
              </div>

              {messagesLoading ? (
                <SkeletonCard className="h-64 rounded-[8px] border-[#E5E5E5] bg-white" />
              ) : error ? (
                <div className="flex h-64 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-white text-sm text-[#B42318]">
                  {error}
                </div>
              ) : filteredMessages.length > 0 ? (
                <div className="space-y-4">
                  {filteredMessages.map((msg) => (
                    <MessageItem key={msg.id} msg={msg} currentUserId={user?.id || ''} organizationId={orgId} theme="inbox" />
                  ))}
                </div>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-white text-center text-[#6E6E80]">
                  <MessageSquare size={40} className="mb-3 opacity-20" />
                  <p className="text-sm">No messages yet. Start the conversation here.</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div id="client-chat-composer" className="border-t border-[#E5E5E5] bg-white p-4 md:p-5">
              <div className="flex items-center gap-3">
                <button
                  title="Upload file"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-[#E5E5E5] text-[#6E6E80] transition-colors hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                >
                  <Upload size={18} />
                </button>
                <input
                  className="flex-1 rounded-[8px] border border-[#DADADA] bg-white px-4 py-3 text-sm text-[#0D0D0D] placeholder:text-[#6E6E80] focus:border-black focus:outline-none"
                  placeholder="Write a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={sending}
                />
                <button
                  title="Send message"
                  onClick={handleSend}
                  disabled={sending || !messageInput.trim()}
                  className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[#0D0D0D] text-white disabled:opacity-50"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <FileUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          loading={sending}
          uploadProgress={uploadProgress}
          onUpload={async (file) => {
            if (!orgId) return false;
            const result = await sendFile(orgId, file);
            if (result.success) {
              showToast('File uploaded.', 'success');
              return true;
            }
            showToast('File upload failed.', 'error');
            return false;
          }}
        />
      </GlassCard>
    </div>
  );

  const renderMeetings = () => (
    <div className="grid gap-4 xl:grid-cols-2">
      <GlassCard className="p-5 md:p-6">
        <Heading level={3} className="mb-2">Meetings</Heading>
        <p className="text-sm text-[#6E6E80]">Join upcoming calls and keep track of what is next.</p>
        <div className="mt-5 space-y-3">
          {upcomingMeetings.length > 0 ? (
            upcomingMeetings.map((meeting) => (
              <div key={meeting.id} className="rounded-[8px] border border-[#E5E5E5] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">
                      {formatDate(meeting.starts_at)} · {formatTime(meeting.starts_at)}
                    </div>
                    <div className="mt-1 text-base font-medium text-[#0D0D0D]">{meeting.title}</div>
                  </div>
                  <Button variant="primary" size="sm" onClick={() => onJoin(meeting.id)}>Join</Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[8px] border border-dashed border-[#E5E5E5] bg-white px-5 py-10 text-center text-sm text-[#6E6E80]">
              No upcoming meetings.
            </div>
          )}
        </div>
      </GlassCard>

      <GlassCard className="p-5 md:p-6">
        <Heading level={3} className="mb-2">Meeting summary</Heading>
        <p className="text-sm text-[#6E6E80]">Keep the calendar and agenda feeling light and readable.</p>
        <div className="mt-5 grid gap-3">
          <div className="rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#6E6E80]">
              <Calendar size={12} /> Next up
            </div>
            <div className="mt-2 text-lg font-medium text-[#0D0D0D]">
              {upcomingMeetings[0]?.title || 'No meetings scheduled'}
            </div>
            <div className="mt-1 text-sm text-[#6E6E80]">
              {upcomingMeetings[0] ? `${formatDate(upcomingMeetings[0].starts_at)} at ${formatTime(upcomingMeetings[0].starts_at)}` : 'Your team will add meetings here.'}
            </div>
          </div>
          <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">How it works</div>
            <p className="mt-2 text-sm leading-6 text-[#0D0D0D]">
              Meetings should feel like part of the space, not a separate product. The dock below keeps navigation consistent.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );

  const renderDocs = () => (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <GlassCard className="p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Heading level={3}>Files</Heading>
            <p className="text-sm text-[#6E6E80]">Upload and store the documents tied to this space.</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setIsUploadModalOpen(true)}>
            Upload
          </Button>
        </div>

        {filesLoading ? (
          <SkeletonCard className="h-40 rounded-[8px] border-[#E5E5E5] bg-[#F7F7F8]" />
        ) : files.length > 0 ? (
          <div className="space-y-3">
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-3 rounded-[8px] border border-[#E5E5E5] bg-white px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[#0D0D0D]">{file.name}</div>
                  <div className="text-xs text-[#6E6E80]">{file.file_size ? `${(file.file_size / (1024 * 1024)).toFixed(2)} MB` : 'File'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-[#E5E5E5] bg-white p-2 text-[#6E6E80] hover:bg-[#F7F7F8]"
                    onClick={async () => {
                      const { data } = await apiService.getSignedUrl(file.id, orgId);
                      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                    }}
                    title="Download"
                  >
                    <FileText size={14} />
                  </button>
                  <button
                    className="rounded-full border border-[#E5E5E5] bg-white p-2 text-[#6E6E80] hover:bg-[#F7F7F8]"
                    onClick={async () => {
                      if (confirm('Move this file to trash?')) {
                        await apiService.deleteFile(file.id, orgId);
                        removeFile(file.id);
                        refreshFiles();
                      }
                    }}
                    title="Delete"
                  >
                    <MoreVertical size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[8px] border border-dashed border-[#E5E5E5] bg-white px-5 py-10 text-center text-sm text-[#6E6E80]">
            No files uploaded yet.
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5 md:p-6">
        <Heading level={3} className="mb-2">File activity</Heading>
        <p className="text-sm text-[#6E6E80]">A small analytics surface for uploads and file use.</p>
        <div className="mt-5 space-y-3">
          <div className="rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#6E6E80]">
              <Upload size={12} /> Uploads
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#0D0D0D]">{files.length}</div>
          </div>
          <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#6E6E80]">
              <Bell size={12} /> Notes
            </div>
            <p className="mt-2 text-sm leading-6 text-[#0D0D0D]">
              Keep file cards compact and readable so the dashboard feels more like an overview than a stack of separate panels.
            </p>
          </div>
        </div>
      </GlassCard>

      <FileUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        loading={false}
        uploadProgress={uploadProgress}
        onUpload={async (file) => {
          if (!orgId) return false;
          const result = await sendFile(orgId, file);
          if (result.success) {
            showToast('File uploaded.', 'success');
            refreshFiles();
            return true;
          }
          showToast('File upload failed.', 'error');
          return false;
        }}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7F7F8] p-4 md:p-6 font-sans">
      <div className="mx-auto max-w-[1320px] space-y-6 pb-20">
        <div className="sheet-panel flex flex-col gap-3 rounded-[8px] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#6E6E80]">Main</div>
            <div className="mt-1 text-[13px] font-medium uppercase tracking-[0.18em] text-[#0D0D0D]">{activeTab}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="rounded-full px-3" onClick={() => setShowQuickReview(true)}>
              Review
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full px-3" onClick={onLogout}>
              <LogOut size={14} className="mr-2" />
              Sign out
            </Button>
          </div>
        </div>

        {activeTab === 'Dashboard' && renderDashboard()}
        {activeTab === 'Chat' && renderChat()}
        {activeTab === 'Meetings' && renderMeetings()}
        {activeTab === 'Docs' && renderDocs()}
      </div>

      <SurfaceDock items={dockItems} />

      <Modal isOpen={showQuickReview} onClose={() => setShowQuickReview(false)} title="Workspace feedback">
        <div className="space-y-4">
          <p className="text-sm text-[#6E6E80]">
            Use this space to tell us how the conversation and handoff feel.
          </p>
          <Input label="What should we improve?" placeholder="Add a quick note..." />
          <Button className="w-full" onClick={() => setShowQuickReview(false)}>
            Save note
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default ClientPortalView;
