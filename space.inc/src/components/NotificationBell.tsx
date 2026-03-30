import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Bell, MessageSquare, FileText, Calendar, AlertTriangle, CheckCircle2, Settings, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { friendlyError } from '../utils/errors';

type NotificationRow = {
    id: string;
    read?: boolean;
    read_at?: string;
    created_at?: string;
    type?: string;
    message?: string;
    payload?: any;
    action_url?: string;
    recipient_id?: string;
    user_id?: string;
};

const ICON_BY_TYPE: Record<string, React.ReactNode> = {
    client_message: <MessageSquare size={16} />,
    message_received: <MessageSquare size={16} />,
    file_uploaded: <FileText size={16} />,
    meeting_scheduled: <Calendar size={16} />,
    meeting_starting: <Calendar size={16} />,
    meeting_ended: <Calendar size={16} />,
    plan_limit: <AlertTriangle size={16} />,
    staff_assigned: <Settings size={16} />,
    capability_changed: <Settings size={16} />,
    invitation_received: <Rocket size={16} />,
    system: <Bell size={16} />,
};

function timeAgo(dateStr?: string) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

export const NotificationBell: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [unreadCount, setUnreadCount] = useState(0);
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationRow[]>([]);
    const [loadingDropdown, setLoadingDropdown] = useState(false);

    const userId = user?.id;
    const unreadFilter = useMemo(() => {
        if (!userId) return '';
        // Recipient-first, but keep backward compat with legacy `user_id` field.
        return `or(recipient_id.eq.${userId},user_id.eq.${userId})`;
    }, [userId]);

    const fetchUnreadCount = useCallback(async () => {
        if (!userId) return;
        const { count, error } = await supabase
            .from('notifications')
            .select('id', { count: 'exact' })
            .eq('read', false)
            // Supabase `or()` accepts a string list, not a full expression from `useMemo`.
            .or(`recipient_id.eq.${userId},user_id.eq.${userId}`);

        if (error) {
            showToast(friendlyError(error.message), 'error');
            return;
        }
        setUnreadCount(count ?? 0);
    }, [showToast, userId]);

    const fetchLatest = useCallback(async () => {
        if (!userId) return;
        setLoadingDropdown(true);
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .or(`recipient_id.eq.${userId},user_id.eq.${userId}`)
                .order('created_at', { ascending: false })
                .limit(20);
            if (error) throw error;
            setNotifications((data || []) as NotificationRow[]);
        } catch (err: any) {
            console.error('[NotificationBell] fetchLatest failed:', err);
            showToast(friendlyError(err?.message), 'error');
        } finally {
            setLoadingDropdown(false);
        }
    }, [showToast, userId]);

    useEffect(() => {
        if (!userId) return;

        fetchUnreadCount();

        // Realtime badge updates: INSERT into notifications.
        const channel = supabase
            .channel(`notifs-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    // Prefer recipient_id (new system), fallback to user_id via a second subscription.
                    filter: `recipient_id=eq.${userId}`
                },
                (payload) => {
                    const n = payload.new as NotificationRow;
                    if (n?.read === true) return;
                    setUnreadCount((prev) => prev + 1);
                    setNotifications((prev) => [n, ...prev].slice(0, 20));
                }
            )
            .subscribe();

        const legacyChannel = supabase
            .channel(`notifs-legacy-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    const n = payload.new as NotificationRow;
                    if (n?.read === true) return;
                    setUnreadCount((prev) => prev + 1);
                    setNotifications((prev) => [n, ...prev].slice(0, 20));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(legacyChannel);
        };
    }, [fetchUnreadCount, userId]);

    const handleBellClick = async () => {
        setOpen((v) => !v);
        if (!open) {
            await fetchLatest();
        }
    };

    const iconForType = (type?: string) => {
        if (!type) return <Bell size={16} />;
        return ICON_BY_TYPE[type] || <Bell size={16} />;
    };

    const handleNotificationClick = async (n: NotificationRow) => {
        const isUnread = n?.read !== true;
        try {
            // Task 4B: mark read and set read_at.
            const read_at = new Date().toISOString();
            const { error } = await supabase
                .from('notifications')
                .update({ read: true, read_at })
                .eq('id', n.id);

            // Backward compat if `read_at` doesn't exist.
            if (error) {
                const retry = await supabase
                    .from('notifications')
                    .update({ read: true })
                    .eq('id', n.id);
                if (retry.error) throw retry.error;
            }

            setUnreadCount((prev) => (isUnread ? Math.max(0, prev - 1) : prev));
            setNotifications((prev) =>
                prev.map((x) => (x.id === n.id ? { ...x, read: true, read_at } : x))
            );

            const actionUrl = n.payload?.action_url || n.action_url;
            if (actionUrl) {
                // Navigate internal routes or open external links.
                if (typeof actionUrl === 'string' && actionUrl.startsWith('http')) {
                    window.open(actionUrl, '_blank');
                } else {
                    navigate(actionUrl);
                }
            }
        } catch (err: any) {
            console.error('[NotificationBell] mark read failed:', err);
            showToast(friendlyError(err?.message), 'error');
        }
        setOpen(false);
    };

    if (!userId || unreadCount <= 0) return null;

    return (
        <div className="relative">
            <button
                className="relative p-2 rounded-lg hover:bg-zinc-200/50 transition-colors"
                onClick={handleBellClick}
                aria-label="Notifications"
                title="Notifications"
            >
                <Bell size={18} className="text-zinc-700" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-[380px] max-w-[90vw] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden z-[999]">
                    <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bell size={16} className="text-rose-500" />
                            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notifications</span>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            {unreadCount} unread
                        </span>
                    </div>

                    {loadingDropdown ? (
                        <div className="p-4 text-sm text-zinc-500">Loading...</div>
                    ) : notifications.length === 0 ? (
                        <div className="p-4 text-sm text-zinc-500">No notifications.</div>
                    ) : (
                        <div className="max-h-[420px] overflow-y-auto">
                            {notifications.map((n) => {
                                const isUnread = n?.read !== true;
                                const title = n.payload?.title || n.payload?.content || n.message || n.type || 'Notification';
                                const body =
                                    n.payload?.message ||
                                    n.message ||
                                    n.payload?.content ||
                                    n.type ||
                                    '';
                                const excerpt = body.length > 80 ? body.slice(0, 80) + '...' : body;
                                return (
                                    <button
                                        key={n.id}
                                        onClick={() => handleNotificationClick(n)}
                                        className={`w-full text-left px-3 py-3 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors flex gap-3 items-start ${
                                            isUnread ? 'bg-rose-50/40' : ''
                                        }`}
                                    >
                                        <div className={`mt-1 h-2.5 w-2.5 rounded-full ${isUnread ? 'bg-rose-500' : 'bg-zinc-300'}`} />
                                        <div className="flex-shrink-0 mt-0.5 text-zinc-700">
                                            {iconForType(n.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start gap-2 justify-between">
                                                <div className="min-w-0">
                                                    <p className={`text-sm ${isUnread ? 'font-bold text-zinc-900 dark:text-zinc-100' : 'font-semibold text-zinc-700 dark:text-zinc-300'} truncate`}>
                                                        {title}
                                                    </p>
                                                    <p className="text-[12px] text-zinc-500 truncate mt-1">
                                                        {excerpt || '—'}
                                                    </p>
                                                </div>
                                                <span className="text-[10px] text-zinc-400 whitespace-nowrap ml-2">
                                                    {timeAgo(n.created_at)}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

