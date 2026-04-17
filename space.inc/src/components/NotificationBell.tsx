import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Bell, MessageSquare, FileText, Calendar, AlertTriangle, Settings, Rocket } from 'lucide-react';
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
        return `or(recipient_id.eq.${userId},user_id.eq.${userId})`;
    }, [userId]);

    const fetchUnreadCount = useCallback(async () => {
        if (!userId) return;
        const { count, error } = await supabase
            .from('notifications')
            .select('id', { count: 'exact' })
            .eq('read', false)
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
                .or(unreadFilter || `recipient_id.eq.${userId},user_id.eq.${userId}`)
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
    }, [showToast, unreadFilter, userId]);

    useEffect(() => {
        if (!userId) return;

        fetchUnreadCount();

        const channel = supabase
            .channel(`notifs-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
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
            const read_at = new Date().toISOString();
            const { error } = await supabase
                .from('notifications')
                .update({ read: true, read_at })
                .eq('id', n.id);

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
                className="relative rounded-[6px] border border-[#E5E5E5] bg-white p-2 text-[#6E6E80] hover:bg-[#F7F7F8] hover:text-[#0D0D0D] transition-colors"
                onClick={handleBellClick}
                aria-label="Notifications"
                title="Notifications"
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold text-white">
                        {unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-[380px] max-w-[90vw] overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] z-[999]">
                    <div className="flex items-center justify-between border-b border-[#E5E5E5] p-3">
                        <div className="flex items-center gap-2">
                            <Bell size={16} className="text-[#0D0D0D]" />
                            <span className="text-sm font-semibold text-[#0D0D0D]">Notifications</span>
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6E6E80]">
                            {unreadCount} unread
                        </span>
                    </div>

                    {loadingDropdown ? (
                        <div className="p-4 text-sm text-[#6E6E80]">Loading...</div>
                    ) : notifications.length === 0 ? (
                        <div className="p-4 text-sm text-[#6E6E80]">No notifications.</div>
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
                                        className={`flex w-full items-start gap-3 border-b border-[#E5E5E5] px-3 py-3 text-left transition-colors hover:bg-[#F7F7F8] ${
                                            isUnread ? 'bg-[#F7F7F8]' : ''
                                        }`}
                                    >
                                        <div className={`mt-1 h-2.5 w-2.5 rounded-full ${isUnread ? 'bg-black' : 'bg-[#D4D4D8]'}`} />
                                        <div className="flex-shrink-0 mt-0.5 text-[#6E6E80]">
                                            {iconForType(n.type)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className={`truncate text-sm ${isUnread ? 'font-semibold text-[#0D0D0D]' : 'font-medium text-[#6E6E80]'}`}>
                                                        {title}
                                                    </p>
                                                    <p className="mt-1 truncate text-[12px] text-[#6E6E80]">
                                                        {excerpt || '—'}
                                                    </p>
                                                </div>
                                                <span className="ml-2 whitespace-nowrap text-[10px] text-[#6E6E80]">
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

