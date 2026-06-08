import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Archive,
    ArrowUpDown,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    GripVertical,
    ListFilter,
    MessageSquare,
    Plus,
    Search,
    Send,
    SlidersHorizontal,
    UserRound,
    UsersRound,
    X
} from 'lucide-react';
import { Button, Input, LoadingScreen, useLoadingScreenGate } from '../UI';
import { ClientSpace, SpaceTaskMember, Task, TaskStatusDefinition } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/apiService';

type TaskScopeFilter = 'my' | 'team' | 'assigned';
type TaskSortMode = 'due' | 'updated' | 'priority';
type TaskDensity = 'auto' | 'compact' | 'comfortable';
type DragPreview = {
    task: Task;
    x: number;
    y: number;
    targetStatus: DisplayStatus | null;
};

type TaskDraft = {
    title: string;
    description: string;
    priority: NonNullable<Task['priority']>;
    due_date: string;
    status: Task['status'];
    space_id: string;
    assignee_id: string;
    reviewer_id: string;
    assigned_group: string;
};

type TaskWorkspaceProps = {
    tasks: Task[];
    clients: ClientSpace[];
    title: string;
    subtitle: string;
    scopeSpaceId?: string;
    groupOptions?: string[];
    compact?: boolean;
    allowCreate?: boolean;
    loading?: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
    showToolbar?: boolean;
    showSummary?: boolean;
    onCreateTask?: (draft: Partial<Task>) => Promise<void> | void;
    onUpdateTask?: (taskId: string, updates: Partial<Task>) => Promise<void> | void;
    onArchiveTask?: (taskId: string) => Promise<void> | void;
    onRequestReview?: (taskId: string, reviewerId: string) => Promise<void> | void;
    onCompleteReview?: (taskId: string, approved: boolean, comment?: string) => Promise<void> | void;
    onAddTaskComment?: (taskId: string, content: string) => Promise<Task | void> | Task | void;
    onOpenSpace?: (spaceId: string) => void;
};

const SCOPE_OPTIONS: Array<{ id: TaskScopeFilter; label: string; icon: React.ReactNode }> = [
    { id: 'my', label: 'My issues', icon: <UserRound size={14} /> },
    { id: 'team', label: 'Team issues', icon: <UsersRound size={14} /> },
    { id: 'assigned', label: 'Assigned', icon: <CheckCircle2 size={14} /> }
];

type DisplayStatus = Task['status'] | 'archived';
type StatusGroup = { id: DisplayStatus; label: string; caption: string; position: number; color?: string };

const DEFAULT_STATUS_GROUPS: StatusGroup[] = [
    { id: 'pending', label: 'Backlog', caption: 'Planned later', position: 10, color: '#A1A1AA' },
    { id: 'todo', label: 'Todo', caption: 'Ready or waiting', position: 20, color: '#64748B' },
    { id: 'in_progress', label: 'In Progress', caption: 'Actively moving', position: 30, color: '#3B82F6' },
    { id: 'review', label: 'In Review', caption: 'Needs handoff', position: 40, color: '#8B5CF6' },
    { id: 'done', label: 'Done', caption: 'Completed', position: 50, color: '#22C55E' },
    { id: 'archived', label: 'Archived', caption: 'Stored out of active flow', position: 60, color: '#94A3B8' }
];

const STATUS_LABELS: Record<Task['status'], string> = {
    todo: 'Todo',
    pending: 'Backlog',
    in_progress: 'In Progress',
    review: 'In Review',
    done: 'Done',
    canceled: 'Canceled'
};

const PRIORITY_STYLES: Record<NonNullable<Task['priority']>, string> = {
    none: 'border-zinc-200 bg-white text-zinc-500',
    low: 'border-zinc-200 bg-zinc-100 text-zinc-600',
    medium: 'border-[#E5E5E5] bg-[#F7F7F8] text-[#0D0D0D]',
    high: 'border-orange-200 bg-orange-50 text-orange-700',
    urgent: 'border-rose-200 bg-rose-50 text-rose-700'
};

const PRIORITY_DOTS: Record<NonNullable<Task['priority']>, string> = {
    none: 'bg-white border border-zinc-300',
    low: 'bg-zinc-300',
    medium: 'bg-amber-300',
    high: 'bg-orange-500',
    urgent: 'bg-rose-600'
};

const STATUS_CATEGORY_CAPTIONS: Record<TaskStatusDefinition['category'], string> = {
    triage: 'Needs sorting',
    backlog: 'Planned later',
    unstarted: 'Ready or waiting',
    started: 'Actively moving',
    review: 'Needs handoff',
    completed: 'Completed',
    canceled: 'Closed without action'
};

const MONTHS = Array.from({ length: 12 }, (_, index) => new Date(2026, index, 1).toLocaleString(undefined, { month: 'long' }));
const MONTH_INDEXES = MONTHS.map((_, index) => index);
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 31 }, (_, index) => CURRENT_YEAR - 10 + index);
const WHEEL_ITEM_HEIGHT = 34;

function normalizeStatus(status?: string): Task['status'] {
    if (status === 'pending' || status === 'in_progress' || status === 'review' || status === 'done' || status === 'canceled') return status;
    return 'todo';
}

function getDisplayStatus(task: Task): DisplayStatus {
    if (task.archived_at) return 'archived';
    const status = normalizeStatus(task.status);
    return status === 'canceled' ? 'archived' : status;
}

function normalizePriority(priority?: string): NonNullable<Task['priority']> {
    if (priority === 'none' || priority === 'low' || priority === 'high' || priority === 'urgent') return priority;
    return 'medium';
}

function formatDateLabel(value?: string) {
    if (!value) return 'No due date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No due date';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDueDateTone(task: Task) {
    if (!task.due_date) return 'none';
    if (isOverdue(task)) return 'overdue';
    const due = new Date(task.due_date);
    const today = new Date();
    if (
        due.getFullYear() === today.getFullYear() &&
        due.getMonth() === today.getMonth() &&
        due.getDate() === today.getDate()
    ) {
        return 'today';
    }
    return 'future';
}

function getPriorityLabel(priority?: Task['priority']) {
    const normalized = normalizePriority(priority);
    return normalized === 'none' ? 'No priority' : normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getTaskIdentifier(task: Task) {
    if (task.task_key) return task.task_key;
    if (task.task_number) return `SPA-${task.task_number}`;
    return task.id ? `SPA-${task.id.slice(0, 4).toUpperCase()}` : 'SPA';
}

function getPersonInitials(name?: string) {
    if (!name) return '?';
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || '?';
}

function isOverdue(task: Task) {
    if (!task.due_date || normalizeStatus(task.status) === 'done') return false;
    const due = new Date(task.due_date);
    if (Number.isNaN(due.getTime())) return false;
    due.setHours(23, 59, 59, 999);
    return due.getTime() < Date.now();
}

function getSpaceName(clients: ClientSpace[], spaceId?: string) {
    return clients.find((client) => client.id === spaceId)?.name || 'No space';
}

function makeDraft(task?: Task, scopeSpaceId?: string): TaskDraft {
    return {
        title: task?.title || '',
        description: task?.description || '',
        priority: normalizePriority(task?.priority),
        due_date: task?.due_date || '',
        status: normalizeStatus(task?.status),
        space_id: task?.space_id || scopeSpaceId || '',
        assignee_id: task?.assignee_id || '',
        reviewer_id: task?.reviewer_id || '',
        assigned_group: task?.assigned_group || ''
    };
}

function TaskBadge({ priority }: { priority: NonNullable<Task['priority']> }) {
    return (
        <span className={`surface-chip px-2.5 py-1.5 text-[12px] font-medium ${PRIORITY_STYLES[priority]}`}>
            <span className={`h-2 w-2 rounded-full ${PRIORITY_DOTS[priority]}`} />
            {priority === 'none' ? 'No priority' : priority.charAt(0).toUpperCase() + priority.slice(1)}
        </span>
    );
}

function PersonCell({ name, avatar, fallback }: { name?: string; avatar?: string; fallback: string }) {
    return (
        <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0D0D0D] text-sm font-medium uppercase text-white">
                {avatar ? <img src={avatar} alt="" className="h-full w-full rounded-full object-cover" /> : (name || fallback).charAt(0)}
            </span>
            <span className="truncate text-base text-[#0D0D0D]">{name || fallback}</span>
        </div>
    );
}

function IssueAvatar({ name, avatar }: { name?: string; avatar?: string }) {
    return (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-[#0D0D0D] text-[10px] font-semibold uppercase text-white ring-1 ring-[#E5E5E5]">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : getPersonInitials(name)}
        </span>
    );
}

function getMemberLabel(member: SpaceTaskMember) {
    const name = member.full_name || member.email || 'Unknown member';
    const detail = member.member_type || member.context_role || member.role;
    return detail ? `${name} (${detail})` : name;
}

function toDateParts(value?: string) {
    const fallback = new Date();
    if (!value) {
        return {
            day: fallback.getDate(),
            month: fallback.getMonth(),
            year: fallback.getFullYear()
        };
    }

    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
        return {
            day: fallback.getDate(),
            month: fallback.getMonth(),
            year: fallback.getFullYear()
        };
    }

    return { day, month: month - 1, year };
}

function toDateValue(day: number, month: number, year: number) {
    const safeDay = Math.min(day, new Date(year, month + 1, 0).getDate());
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

function WheelColumn({
    label,
    options,
    value,
    onChange,
    getLabel = String
}: {
    label: string;
    options: number[];
    value: number;
    onChange: (value: number) => void;
    getLabel?: (value: number) => string;
}) {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const scrollTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const index = Math.max(0, options.indexOf(value));
        scrollRef.current?.scrollTo({ top: index * WHEEL_ITEM_HEIGHT, behavior: 'smooth' });
    }, [options, value]);

    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
        };
    }, []);

    const handleScroll = () => {
        if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = window.setTimeout(() => {
            const nextIndex = Math.round((scrollRef.current?.scrollTop || 0) / WHEEL_ITEM_HEIGHT);
            const nextValue = options[Math.min(options.length - 1, Math.max(0, nextIndex))];
            if (nextValue !== undefined && nextValue !== value) onChange(nextValue);
        }, 80);
    };

    const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        const target = scrollRef.current;
        if (!target) return;

        event.preventDefault();
        target.scrollBy({
            top: event.deltaY * 0.28,
            behavior: 'smooth'
        });
    };

    return (
        <div className="min-w-[108px] flex-1">
            <p className="mb-1 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-[#0D0D0D]">{label}</p>
            <div className="relative h-[170px] overflow-hidden rounded-[8px] bg-transparent">
                <div className="pointer-events-none absolute inset-x-2 top-1/2 z-10 h-[34px] -translate-y-1/2 rounded-full bg-transparent" />
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    onWheel={handleWheel}
                    className="date-wheel-scroll relative z-20 h-full overflow-y-auto px-1 py-[68px]"
                    aria-label={label}
                >
                    {options.map((option) => {
                        const distance = Math.min(3, Math.abs(options.indexOf(value) - options.indexOf(option)));
                        const opacity = distance === 0 ? 1 : Math.max(0.2, 0.66 - distance * 0.16);
                        return (
                            <button
                                key={option}
                                type="button"
                                onClick={() => onChange(option)}
                                className="date-wheel-item flex h-[34px] w-full snap-center items-center justify-center rounded-full text-[13px] transition-[color,opacity,transform] duration-150"
                                style={{
                                    opacity,
                                    transform: distance === 0 ? 'scale(1)' : 'scale(0.94)',
                                    color: '#0D0D0D',
                                    fontWeight: distance === 0 ? 600 : 400
                                }}
                            >
                                {getLabel(option)}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function WheelDatePicker({
    value,
    onChange
}: {
    value: string;
    onChange: (value: string) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const selected = toDateParts(value);
    const daysInMonth = new Date(selected.year, selected.month + 1, 0).getDate();
    const days = useMemo(() => Array.from({ length: daysInMonth }, (_, index) => index + 1), [daysInMonth]);

    const updateDate = (next: Partial<{ day: number; month: number; year: number }>) => {
        onChange(toDateValue(next.day ?? selected.day, next.month ?? selected.month, next.year ?? selected.year));
    };

    return (
        <div className="shrink-0">
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                className="task-composer-pill inline-flex h-9 min-w-[136px] items-center gap-2 rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-3 text-left text-[12px] text-[#0D0D0D] outline-none transition hover:border-[#D4D4D8]"
                aria-expanded={isOpen}
            >
                <CalendarDays size={13} className="text-[#6E6E80]" />
                <span>{value ? formatDateLabel(value) : 'mm/dd/yyyy'}</span>
            </button>
            {isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/20 px-4" onClick={() => setIsOpen(false)}>
                <div className="w-[360px] max-w-[calc(100vw-2rem)] rounded-[14px] border border-white/10 bg-[#FDFDFD] p-3 text-[#0D0D0D] shadow-[0_18px_48px_rgba(0,0,0,0.3)]" onClick={(event) => event.stopPropagation()}>
                    <div className="mb-2 h-1 w-9 rounded-full bg-zinc-300 mx-auto" />
                    <div className="grid grid-cols-3 gap-2">
                        <WheelColumn label="Day" options={days} value={Math.min(selected.day, daysInMonth)} onChange={(day) => updateDate({ day })} />
                        <WheelColumn label="Month" options={MONTH_INDEXES} value={selected.month} onChange={(month) => updateDate({ month })} getLabel={(month) => MONTHS[month]} />
                        <WheelColumn label="Year" options={YEARS} value={selected.year} onChange={(year) => updateDate({ year })} />
                    </div>
                    <div className="mt-3 flex justify-between gap-2">
                        <button type="button" className="rounded-full px-3 py-1.5 text-[12px] font-medium text-zinc-500 hover:bg-zinc-100" onClick={() => onChange('')}>
                            Clear
                        </button>
                        <button type="button" className="rounded-full bg-[#0D0D0D] px-4 py-1.5 text-[12px] font-semibold text-white" onClick={() => setIsOpen(false)}>
                            Done
                        </button>
                    </div>
                </div>
                </div>
            )}
        </div>
    );
}

export default function TaskWorkspace({
    tasks,
    clients,
    title,
    subtitle,
    scopeSpaceId,
    groupOptions,
    compact = false,
    allowCreate = true,
    loading = false,
    emptyTitle = 'No tasks yet',
    emptyDescription = 'Create your first task to start building momentum.',
    showToolbar = true,
    showSummary = false,
    onCreateTask,
    onUpdateTask,
    onArchiveTask,
    onRequestReview,
    onCompleteReview,
    onAddTaskComment,
    onOpenSpace
}: TaskWorkspaceProps) {
    void groupOptions;
    void showSummary;
    const { user } = useAuth();
    const [scopeFilter, setScopeFilter] = useState<TaskScopeFilter>('team');
    const [spaceFilter, setSpaceFilter] = useState(scopeSpaceId || 'all');
    const [statusFilter, setStatusFilter] = useState<'all' | DisplayStatus>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortMode, setSortMode] = useState<TaskSortMode>('due');
    const [density, setDensity] = useState<TaskDensity>('auto');
    const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));
    const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
    const dragPreviewRef = useRef<DragPreview | null>(null);
    const dragCandidateRef = useRef<{ task: Task; startX: number; startY: number; pointerId: number } | null>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterMenuRef = useRef<HTMLDivElement | null>(null);
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [draft, setDraft] = useState<TaskDraft>(() => makeDraft(undefined, scopeSpaceId));
    const [isSaving, setIsSaving] = useState(false);
    const [availableMembers, setAvailableMembers] = useState<SpaceTaskMember[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [membersError, setMembersError] = useState<string | null>(null);
    const [taskStatuses, setTaskStatuses] = useState<TaskStatusDefinition[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [reviewComment, setReviewComment] = useState('');
    const [commentDraft, setCommentDraft] = useState('');
    const loadingGate = useLoadingScreenGate(Boolean(loading));
    const detailLoadingGate = useLoadingScreenGate(detailLoading);
    const [isCommentSaving, setIsCommentSaving] = useState(false);

    const activeTaskSpaceId = scopeSpaceId || draft.space_id;
    const statusScopeId = scopeSpaceId || (spaceFilter !== 'all' ? spaceFilter : undefined);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleResize = () => setViewportWidth(window.innerWidth);
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const statusGroups = useMemo(() => {
        if (taskStatuses.length === 0) return DEFAULT_STATUS_GROUPS;

        const byKey = new Map<DisplayStatus, StatusGroup>();
        taskStatuses.forEach((status) => {
            const key = normalizeStatus(status.status_key);
            if (key === 'canceled' || byKey.has(key)) return;

            byKey.set(key, {
                id: key,
                label: key === 'pending' ? STATUS_LABELS.pending : status.name || STATUS_LABELS[key],
                caption: STATUS_CATEGORY_CAPTIONS[status.category] || STATUS_LABELS[key],
                position: status.position,
                color: status.color
            });
        });

        const customGroups = Array.from(byKey.values()).sort((left, right) => left.position - right.position);
        DEFAULT_STATUS_GROUPS.forEach((group) => {
            if (!byKey.has(group.id)) customGroups.push(group);
        });

        return customGroups.length > 0 ? customGroups.sort((left, right) => left.position - right.position) : DEFAULT_STATUS_GROUPS;
    }, [taskStatuses]);

    const editableStatusGroups = useMemo(
        () => statusGroups.filter((group): group is StatusGroup & { id: Task['status'] } => group.id !== 'archived'),
        [statusGroups]
    );

    const visibleTasks = useMemo(() => {
        const normalizedSearch = searchQuery.trim().toLowerCase();
        const base = scopeSpaceId ? tasks.filter((task) => task.space_id === scopeSpaceId) : tasks;
        return base.filter((task) => {
            const assignedToMe = task.assignee_id === user?.id;
            const reviewedByMe = task.reviewer_id === user?.id;
            const createdByMe = task.created_by === user?.id;
            const displayStatus = getDisplayStatus(task);

            if (scopeFilter === 'my' && !assignedToMe && !reviewedByMe && !createdByMe) return false;
            if (scopeFilter === 'assigned' && !task.assignee_id) return false;
            if (spaceFilter !== 'all' && task.space_id !== spaceFilter) return false;
            if (statusFilter === 'all' && displayStatus === 'archived') return false;
            if (statusFilter !== 'all' && displayStatus !== statusFilter) return false;
            if (normalizedSearch) {
                const searchable = [
                    task.title,
                    task.description,
                    task.task_key,
                    task.task_number ? `SPA-${task.task_number}` : undefined,
                    task.assignee_name,
                    task.assigned_group,
                    getSpaceName(clients, task.space_id),
                    ...(task.labels || []).map((label) => label.name)
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!searchable.includes(normalizedSearch)) return false;
            }

            return true;
        });
    }, [clients, scopeFilter, scopeSpaceId, searchQuery, spaceFilter, statusFilter, tasks, user?.id]);

    const groupedTasks = useMemo(() => {
        const groups = new Map<DisplayStatus, Task[]>();
        statusGroups.forEach((group) => groups.set(group.id, []));

        visibleTasks.forEach((task) => {
            const status = getDisplayStatus(task);
            const target = groups.get(status) || [];
            target.push(task);
            groups.set(status, target);
        });

        const priorityRank: Record<NonNullable<Task['priority']>, number> = {
            urgent: 0,
            high: 1,
            medium: 2,
            low: 3,
            none: 4
        };

        for (const [status, items] of groups.entries()) {
            groups.set(status, [...items].sort((left, right) => {
                if (sortMode === 'priority') {
                    const rankDiff = priorityRank[normalizePriority(left.priority)] - priorityRank[normalizePriority(right.priority)];
                    if (rankDiff !== 0) return rankDiff;
                }
                if (sortMode === 'updated') {
                    return new Date(right.updated_at || right.created_at || 0).getTime() - new Date(left.updated_at || left.created_at || 0).getTime();
                }
                const leftDue = left.due_date ? new Date(left.due_date).getTime() : Number.MAX_SAFE_INTEGER;
                const rightDue = right.due_date ? new Date(right.due_date).getTime() : Number.MAX_SAFE_INTEGER;
                if (leftDue !== rightDue) return leftDue - rightDue;
                return new Date(right.updated_at || right.created_at || 0).getTime() - new Date(left.updated_at || left.created_at || 0).getTime();
            }));
        }

        return statusGroups
            .filter((group) => group.id !== 'archived' || statusFilter === 'archived')
            .map((group) => ({ ...group, tasks: groups.get(group.id) || [] }));
    }, [sortMode, statusFilter, statusGroups, visibleTasks]);

    useEffect(() => {
        let isCurrent = true;

        apiService.listTaskStatuses(statusScopeId)
            .then(({ data, error }) => {
                if (!isCurrent) return;
                setTaskStatuses(error ? [] : data || []);
            })
            .catch(() => {
                if (isCurrent) setTaskStatuses([]);
            });

        return () => {
            isCurrent = false;
        };
    }, [statusScopeId]);

    const selectableMembers = useMemo(() => {
        const byId = new Map<string, SpaceTaskMember>();
        availableMembers.forEach((member) => {
            if (member.user_id) byId.set(member.user_id, member);
        });

        if (editingTask?.assignee_id && !byId.has(editingTask.assignee_id)) {
            byId.set(editingTask.assignee_id, {
                user_id: editingTask.assignee_id,
                membership_id: editingTask.assignee_id,
                full_name: editingTask.assignee_name || 'Current assignee',
                avatar_url: editingTask.assignee_avatar,
                status: 'existing'
            });
        }

        if (editingTask?.reviewer_id && !byId.has(editingTask.reviewer_id)) {
            byId.set(editingTask.reviewer_id, {
                user_id: editingTask.reviewer_id,
                membership_id: editingTask.reviewer_id,
                full_name: editingTask.reviewer_name || 'Current reviewer',
                avatar_url: editingTask.reviewer_avatar,
                status: 'existing'
            });
        }

        return Array.from(byId.values());
    }, [availableMembers, editingTask]);

    useEffect(() => {
        if (!isComposerOpen || !activeTaskSpaceId) {
            setAvailableMembers([]);
            setMembersError(null);
            setMembersLoading(false);
            return;
        }

        let isCurrent = true;
        setMembersLoading(true);
        setMembersError(null);

        apiService.listTaskAssignees(activeTaskSpaceId)
            .then(({ data, error }) => {
                if (!isCurrent) return;
                if (error) {
                setAvailableMembers([]);
                setMembersError(error.message || 'Could not load members');
                return;
            }
                setAvailableMembers(data || []);
            })
            .catch((error) => {
                if (!isCurrent) return;
                setAvailableMembers([]);
                setMembersError(error?.message || 'Could not load members');
            })
            .finally(() => {
                if (isCurrent) setMembersLoading(false);
            });

        return () => {
            isCurrent = false;
        };
    }, [activeTaskSpaceId, isComposerOpen]);

    useEffect(() => {
        if (!isFilterOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!filterMenuRef.current?.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsFilterOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFilterOpen]);

    useEffect(() => {
        if (!isComposerOpen || !editingTask?.id) {
            setDetailLoading(false);
            setDetailError(null);
            return;
        }

        let isCurrent = true;
        setDetailLoading(true);
        setDetailError(null);

        apiService.getTaskDetail(editingTask.id)
            .then(({ data, error }) => {
                if (!isCurrent) return;
                if (error) {
                    setDetailError(error.message || 'Could not load task detail');
                    return;
                }
                if (data) {
                    setEditingTask((current) => current?.id === editingTask.id ? { ...current, ...data } : current);
                }
            })
            .catch((error) => {
                if (isCurrent) setDetailError(error?.message || 'Could not load task detail');
            })
            .finally(() => {
                if (isCurrent) setDetailLoading(false);
            });

        return () => {
            isCurrent = false;
        };
    }, [editingTask?.id, isComposerOpen]);

    const openCreate = () => {
        setEditingTask(null);
        setDraft(makeDraft(undefined, scopeSpaceId));
        setReviewComment('');
        setCommentDraft('');
        setDetailError(null);
        setDetailLoading(false);
        setIsComposerOpen(true);
    };

    const openCreateForStatus = (status: Task['status']) => {
        setEditingTask(null);
        setDraft({
            ...makeDraft(undefined, scopeSpaceId),
            status,
            space_id: scopeSpaceId || (spaceFilter !== 'all' ? spaceFilter : clients[0]?.id || '')
        });
        setReviewComment('');
        setCommentDraft('');
        setDetailError(null);
        setDetailLoading(false);
        setIsComposerOpen(true);
    };

    const openEdit = (task: Task) => {
        setEditingTask(task);
        setDraft(makeDraft(task, scopeSpaceId));
        setReviewComment('');
        setCommentDraft('');
        setDetailError(null);
        setIsComposerOpen(true);
    };

    const handleSave = async () => {
        if (!draft.title.trim()) return;
        if (!scopeSpaceId && !draft.space_id) return;

        setIsSaving(true);
        const payload: Partial<Task> & Record<string, unknown> = {
            title: draft.title.trim(),
            description: draft.description.trim() || null,
            priority: draft.priority,
            due_date: draft.due_date || null,
            status: draft.status,
            space_id: scopeSpaceId || draft.space_id,
            assignee_id: draft.assignee_id || null,
            reviewer_id: draft.reviewer_id || null,
            assigned_group: draft.assigned_group || null
        };

        try {
            if (editingTask) {
                await onUpdateTask?.(editingTask.id, payload);
            } else {
                await onCreateTask?.(payload);
            }
            setIsComposerOpen(false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleArchive = async () => {
        if (!editingTask || !onArchiveTask) return;

        setIsSaving(true);
        try {
            await onArchiveTask(editingTask.id);
            setIsComposerOpen(false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRequestReview = async () => {
        if (!editingTask || !draft.reviewer_id || !onRequestReview) return;

        setIsSaving(true);
        try {
            await onRequestReview(editingTask.id, draft.reviewer_id);
            setDraft((current) => ({ ...current, status: 'review' }));
        } finally {
            setIsSaving(false);
        }
    };

    const handleCompleteReview = async (approved: boolean) => {
        if (!editingTask || !onCompleteReview) return;

        setIsSaving(true);
        try {
            await onCompleteReview(editingTask.id, approved, reviewComment.trim() || undefined);
            setIsComposerOpen(false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddComment = async () => {
        if (!editingTask || !onAddTaskComment || !commentDraft.trim()) return;

        setIsCommentSaving(true);
        try {
            const updatedTask = await onAddTaskComment(editingTask.id, commentDraft.trim());
            if (updatedTask) {
                setEditingTask(updatedTask);
                setDraft(makeDraft(updatedTask, scopeSpaceId));
            }
            setCommentDraft('');
        } finally {
            setIsCommentSaving(false);
        }
    };

    const updateDragPreview = (preview: DragPreview | null) => {
        dragPreviewRef.current = preview;
        setDragPreview(preview);
    };

    const getPointerTargetStatus = (clientX: number, clientY: number): DisplayStatus | null => {
        const target = document.elementFromPoint(clientX, clientY);
        const group = target?.closest<HTMLElement>('[data-task-group]');
        return (group?.dataset.taskGroup as DisplayStatus | undefined) || null;
    };

    const handleTaskPointerDown = (event: React.PointerEvent<HTMLDivElement>, task: Task) => {
        if (event.button !== 0 || !onUpdateTask || getDisplayStatus(task) === 'archived') return;
        const target = event.target as HTMLElement;
        if (target.closest('button,input,textarea,select,a')) return;

        dragCandidateRef.current = {
            task,
            startX: event.clientX,
            startY: event.clientY,
            pointerId: event.pointerId
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handleTaskPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const candidate = dragCandidateRef.current;
        if (!candidate) return;

        const moveX = event.clientX - candidate.startX;
        const moveY = event.clientY - candidate.startY;
        const hasMoved = Math.hypot(moveX, moveY) > 5;
        if (!hasMoved && !dragPreviewRef.current) return;

        updateDragPreview({
            task: candidate.task,
            x: event.clientX,
            y: event.clientY,
            targetStatus: getPointerTargetStatus(event.clientX, event.clientY)
        });
    };

    const handleTaskPointerUp = async (event: React.PointerEvent<HTMLDivElement>, task: Task) => {
        const candidate = dragCandidateRef.current;
        const preview = dragPreviewRef.current;

        if (candidate) {
            event.currentTarget.releasePointerCapture(candidate.pointerId);
        }
        dragCandidateRef.current = null;
        updateDragPreview(null);

        if (preview) {
            const nextStatus = preview.targetStatus;
            if (nextStatus && nextStatus !== 'archived' && nextStatus !== getDisplayStatus(task) && onUpdateTask) {
                await onUpdateTask(task.id, { status: nextStatus });
            }
            return;
        }

        openEdit(task);
    };

    const cycleSortMode = () => {
        setSortMode((current) => current === 'due' ? 'updated' : current === 'updated' ? 'priority' : 'due');
    };

    const cycleDensity = () => {
        setDensity((current) => current === 'auto' ? 'compact' : current === 'compact' ? 'comfortable' : 'auto');
    };

    const canSave = Boolean(draft.title.trim()) && Boolean(scopeSpaceId || draft.space_id);
    const memberSelectDisabled = !activeTaskSpaceId || membersLoading;
    const canRequestReview = Boolean(editingTask && onRequestReview && draft.reviewer_id && draft.status !== 'review');
    const canCompleteReview = Boolean(editingTask && onCompleteReview && normalizeStatus(draft.status) === 'review');
    const activeFilterCount = (spaceFilter !== 'all' && !scopeSpaceId ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);
    const sortLabel = sortMode === 'due' ? 'Due date' : sortMode === 'updated' ? 'Updated' : 'Priority';
    const adaptiveDensity = useMemo<Exclude<TaskDensity, 'auto'>>(() => {
        if (density !== 'auto') return density;
        if (compact || viewportWidth < 900) return 'comfortable';
        return visibleTasks.length > 14 ? 'compact' : 'comfortable';
    }, [compact, density, viewportWidth, visibleTasks.length]);
    const isNarrowLayout = viewportWidth < 720;
    const densityLabel = density === 'auto' ? 'Auto' : density === 'compact' ? 'Compact' : 'Comfortable';
    const densityTitle = density === 'auto' ? `Display: Auto (${adaptiveDensity})` : `Display: ${densityLabel}`;
    const rowHeightClass = adaptiveDensity === 'compact' ? 'min-h-[54px] py-2' : 'min-h-[66px] py-3';
    const rowGridClass = isNarrowLayout
        ? 'grid-cols-[32px_minmax(0,1fr)] gap-x-3 gap-y-1'
        : 'grid-cols-[32px_minmax(180px,1fr)_minmax(128px,auto)] gap-3';
    const rowMetaClass = isNarrowLayout ? 'col-start-2 row-start-2 justify-start gap-2 pb-1' : 'justify-end gap-3';

    return (
        <>
            <div className="task-workspace mx-auto flex w-full max-w-[1480px] flex-col gap-4">
                <div className={`task-page-header flex min-h-[76px] flex-col justify-center gap-3 border-b pb-4 ${compact ? '' : 'md:flex-row md:items-end md:justify-between'}`}>
                    <div className="min-w-0">
                        <h1 className="task-title text-[30px] font-semibold leading-tight">{title}</h1>
                        <p className="task-muted mt-1 max-w-2xl text-[13px] leading-5">{subtitle}</p>
                    </div>
                    {allowCreate && (
                        <Button className="h-9 w-fit rounded-none px-3 text-[13px]" onClick={openCreate}>
                            <Plus size={14} className="mr-2" />
                            Add issue
                        </Button>
                    )}
                </div>

                {showToolbar && (
                    <div className="task-toolbar sticky top-[76px] z-20 flex min-h-12 flex-col gap-2 border-b py-2 backdrop-blur md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            {SCOPE_OPTIONS.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => setScopeFilter(option.id)}
                                    className={`task-control inline-flex h-8 items-center gap-1.5 rounded-none border px-2.5 text-[13px] font-medium transition ${scopeFilter === option.id ? 'task-control-active' : ''}`}
                                >
                                    {option.icon}
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <div ref={filterMenuRef} className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsFilterOpen((current) => !current)}
                                    className={`task-control inline-flex h-8 items-center gap-1.5 rounded-none border px-2.5 text-[13px] font-medium ${isFilterOpen || activeFilterCount > 0 ? 'task-control-active' : ''}`}
                                    aria-expanded={isFilterOpen}
                                >
                                    <ListFilter size={14} />
                                    Filter{activeFilterCount > 0 ? ` ${activeFilterCount}` : ''}
                                </button>

                                {isFilterOpen && (
                                    <div className="task-popover absolute left-0 top-10 z-30 w-[300px] overflow-hidden rounded-none border shadow-[0_18px_48px_rgba(15,15,20,0.14)] md:left-auto md:right-0">
                                        <div className="task-divider flex items-center justify-between border-b px-3 py-2">
                                            <div className="task-title flex items-center gap-2 text-[13px] font-semibold">
                                                <ListFilter size={14} />
                                                Filters
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setIsFilterOpen(false)}
                                                className="task-icon-button rounded-none p-1.5"
                                                aria-label="Close filters"
                                                title="Close filters"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                        {!scopeSpaceId && (
                                            <div className="task-divider border-b p-2">
                                                <p className="task-muted px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">Space</p>
                                                <button type="button" onClick={() => setSpaceFilter('all')} className={`task-menu-item flex w-full rounded-none px-2 py-1.5 text-left text-[13px] ${spaceFilter === 'all' ? 'task-menu-item-active font-semibold' : ''}`}>
                                                    All spaces
                                                </button>
                                                {clients.map((client) => (
                                                    <button
                                                        key={client.id}
                                                        type="button"
                                                        onClick={() => setSpaceFilter(client.id)}
                                                        className={`task-menu-item flex w-full rounded-none px-2 py-1.5 text-left text-[13px] ${spaceFilter === client.id ? 'task-menu-item-active font-semibold' : ''}`}
                                                    >
                                                        <span className="truncate">{client.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <div className="p-2">
                                            <p className="task-muted px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">Status</p>
                                            <button type="button" onClick={() => setStatusFilter('all')} className={`task-menu-item flex w-full rounded-none px-2 py-1.5 text-left text-[13px] ${statusFilter === 'all' ? 'task-menu-item-active font-semibold' : ''}`}>
                                                Active work
                                            </button>
                                            {statusGroups.map((group) => (
                                                <button
                                                    key={group.id}
                                                    type="button"
                                                    onClick={() => setStatusFilter(group.id)}
                                                    className={`task-menu-item flex w-full items-center gap-2 rounded-none px-2 py-1.5 text-left text-[13px] ${statusFilter === group.id ? 'task-menu-item-active font-semibold' : ''}`}
                                                >
                                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: group.color || '#A1A1AA' }} />
                                                    <span>{group.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={cycleSortMode}
                                className="task-control inline-flex h-8 items-center gap-1.5 rounded-none border px-2.5 text-[13px] font-medium"
                                title={`Sort: ${sortLabel}`}
                            >
                                <ArrowUpDown size={14} />
                                <span className="hidden sm:inline">{sortLabel}</span>
                            </button>

                            <button
                                type="button"
                                onClick={cycleDensity}
                                className="task-control inline-flex h-8 items-center gap-1.5 rounded-none border px-2.5 text-[13px] font-medium"
                                title={densityTitle}
                            >
                                <SlidersHorizontal size={14} />
                                <span className="hidden sm:inline">{densityLabel}</span>
                            </button>

                            <label className="task-control flex h-8 min-w-[190px] flex-1 items-center gap-2 rounded-none border px-2.5 md:w-[240px] md:flex-none">
                                <Search size={14} />
                                <input
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Search issues"
                                    className="task-input min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none"
                                />
                            </label>
                        </div>
                    </div>
                )}

                {loadingGate.isVisible ? (
                    <LoadingScreen
                        key={loadingGate.cycleKey}
                        message="Loading tasks..."
                        isComplete={loadingGate.isComplete}
                        onExitComplete={loadingGate.handleExitComplete}
                    />
                ) : visibleTasks.length === 0 ? (
                    <div className="task-empty flex min-h-[240px] flex-col items-center justify-center rounded-none border border-dashed px-6 py-12 text-center">
                        <CheckCircle2 size={26} className="task-muted mb-3" />
                        <p className="task-title text-[15px] font-medium">{emptyTitle}</p>
                        <p className="task-muted mt-1 max-w-sm text-[13px]">{emptyDescription}</p>
                    </div>
                ) : (
                    <div className="task-list-shell overflow-hidden rounded-none border">
                        {groupedTasks.map((group) => {
                            const isCollapsed = collapsedGroups[group.id];
                            const canInlineCreate = allowCreate && group.id !== 'archived';
                            const inlineStatus = group.id as Task['status'];

                            return (
                                <section
                                    key={group.id}
                                    data-task-group={group.id}
                                    className={`task-list-section border-b last:border-b-0 ${dragPreview?.targetStatus === group.id && group.id !== 'archived' ? 'task-drop-target' : ''}`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setCollapsedGroups((current) => ({ ...current, [group.id]: !current[group.id] }))}
                                        className="task-section-header flex w-full items-center justify-between gap-4 border-b px-3 py-2 text-left"
                                    >
                                        <div className="flex min-w-0 items-center gap-2">
                                            <ChevronDown size={13} className={`task-muted transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: group.color || '#A1A1AA' }} />
                                            <p className="task-title truncate text-[13px] font-semibold">{group.label}</p>
                                            <span className="task-muted text-[13px]">{group.tasks.length}</span>
                                            <p className="task-muted hidden truncate text-[12px] sm:block">{group.caption}</p>
                                        </div>
                                        {canInlineCreate && (
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    openCreateForStatus(inlineStatus);
                                                }}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        openCreateForStatus(inlineStatus);
                                                    }
                                                }}
                                                className="task-icon-button inline-flex h-7 items-center gap-1.5 rounded-none px-2 text-[12px] font-medium"
                                            >
                                                <Plus size={13} />
                                                Add
                                            </span>
                                        )}
                                    </button>

                                    {!isCollapsed && (
                                        <div className="task-list-rows divide-y">
                                            {group.tasks.length === 0 ? (
                                                <div className="task-muted px-10 py-2.5 text-[12px]">No issues in this group.</div>
                                            ) : group.tasks.map((task) => {
                                                const dueTone = getDueDateTone(task);
                                                const priority = normalizePriority(task.priority);
                                                const labels = task.labels || [];

                                                return (
                                                    <div
                                                        key={task.id}
                                                        role="button"
                                                        tabIndex={0}
                                                        onPointerDown={(event) => handleTaskPointerDown(event, task)}
                                                        onPointerMove={handleTaskPointerMove}
                                                        onPointerUp={(event) => void handleTaskPointerUp(event, task)}
                                                        onPointerCancel={() => {
                                                            dragCandidateRef.current = null;
                                                            updateDragPreview(null);
                                                        }}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter') openEdit(task);
                                                        }}
                                                        className={`task-issue-row group grid w-full cursor-grab ${rowGridClass} items-center px-3 text-left transition active:cursor-grabbing ${dragPreview?.task.id === task.id ? 'task-row-dragging' : ''} ${rowHeightClass}`}
                                                    >
                                                        <span className="task-muted flex justify-center opacity-70 group-hover:opacity-100">
                                                            <GripVertical size={14} />
                                                        </span>

                                                        <div className="min-w-0">
                                                            <div className="flex min-w-0 items-center gap-2">
                                                                <span className="task-title truncate text-[14px] font-medium leading-5">{task.title || 'Untitled issue'}</span>
                                                                {task.comment_count ? (
                                                                    <span className="task-muted hidden items-center gap-1 text-[12px] sm:inline-flex">
                                                                        <MessageSquare size={12} />
                                                                        {task.comment_count}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                            <div className="task-muted mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-4">
                                                                <span className="font-medium">{getTaskIdentifier(task)}</span>
                                                                <span className="hidden sm:inline">{getSpaceName(clients, task.space_id)}</span>
                                                                {labels.slice(0, 2).map((label) => (
                                                                    <span key={label.id} className="hidden items-center gap-1 sm:inline-flex">
                                                                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: label.color || '#A1A1AA' }} />
                                                                        {label.name}
                                                                    </span>
                                                                ))}
                                                                <span className="inline-flex items-center gap-1">
                                                                    <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOTS[priority]}`} />
                                                                    {getPriorityLabel(priority)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className={`flex shrink-0 items-center ${rowMetaClass}`}>
                                                            <span className={`${isNarrowLayout ? 'inline' : 'hidden sm:inline'} min-w-[84px] text-right text-[12px] ${dueTone === 'overdue' ? 'font-medium text-rose-600' : dueTone === 'today' ? 'task-title font-medium' : dueTone === 'none' ? 'task-muted' : 'task-muted'}`}>
                                                                {formatDateLabel(task.due_date)}
                                                            </span>
                                                            <IssueAvatar name={task.assignee_name || 'Unassigned'} avatar={task.assignee_avatar} />
                                                            <span className="task-muted hidden min-w-[78px] text-[12px] md:inline">{STATUS_LABELS[normalizeStatus(task.status)]}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                )}
            </div>

            {dragPreview && (
                <div
                    className="task-drag-preview fixed z-[120] grid w-[min(720px,calc(100vw-2rem))] grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border px-3 py-2"
                    style={{
                        left: dragPreview.x,
                        top: dragPreview.y,
                        transform: 'translate(-24px, -50%)'
                    }}
                >
                    <span className="task-muted flex justify-center">
                        <GripVertical size={14} />
                    </span>
                    <div className="min-w-0">
                        <p className="task-title truncate text-[14px] font-medium">{dragPreview.task.title || 'Untitled issue'}</p>
                        <p className="task-muted truncate text-[12px]">
                            {getTaskIdentifier(dragPreview.task)} - {getSpaceName(clients, dragPreview.task.space_id)} - {getPriorityLabel(dragPreview.task.priority)}
                        </p>
                    </div>
                    <span className="task-muted text-[12px]">
                        {dragPreview.targetStatus && dragPreview.targetStatus !== 'archived'
                            ? STATUS_LABELS[dragPreview.targetStatus as Task['status']]
                            : 'Move'}
                    </span>
                </div>
            )}

            {isComposerOpen && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/25 px-4 py-6">
                    <div className="task-composer-light flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white text-[#0D0D0D] shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                        <div className="flex items-center justify-between gap-4 border-b border-[#EFEFEF] px-4 py-3">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-2.5 py-1 text-xs font-medium text-[#4B4B55]">
                                    {editingTask ? STATUS_LABELS[normalizeStatus(editingTask.status)] : 'New task'}
                                </span>
                                {editingTask?.archived_at && <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-2.5 py-1 text-xs text-[#6E6E80]">Archived</span>}
                            </div>
                            <button
                                type="button"
                                onClick={() => !isSaving && setIsComposerOpen(false)}
                                className="rounded-[8px] p-2 text-[#6E6E80] hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                                title="Close task"
                                aria-label="Close task"
                            >
                                <X size={17} />
                            </button>
                        </div>

                        <div className="overflow-y-auto px-5 py-5 md:px-6">
                            <div className="space-y-5">
                                <input
                                    value={draft.title}
                                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                                    placeholder="Task title"
                                    className="task-page-title w-full border-0 bg-transparent text-[22px] font-semibold leading-8 text-[#0D0D0D] outline-none placeholder:text-[#8A8A93]"
                                />
                                <textarea
                                    value={draft.description}
                                    onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                                    placeholder="Add description..."
                                    className="task-page-description min-h-[112px] w-full resize-none border-0 bg-transparent text-[14px] leading-6 text-[#4B4B55] outline-none placeholder:text-[#8A8A93]"
                                />

                                <div className="flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1">
                                    <select title="Task status" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as Task['status'] }))} className="task-composer-pill h-9 shrink-0 rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-3 text-[12px] text-[#0D0D0D] outline-none">
                                        {editableStatusGroups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
                                    </select>
                                    <select title="Task priority" value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as TaskDraft['priority'] }))} className="task-composer-pill h-9 shrink-0 rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-3 text-[12px] text-[#0D0D0D] outline-none">
                                        <option value="none">No priority</option>
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                    <WheelDatePicker value={draft.due_date} onChange={(dueDate) => setDraft((current) => ({ ...current, due_date: dueDate }))} />
                                    <Input value={draft.assigned_group} onChange={(event) => setDraft((current) => ({ ...current, assigned_group: event.target.value }))} placeholder="Group" className="task-composer-pill h-9 w-[150px] shrink-0 rounded-full border-[#E5E5E5] bg-[#F7F7F8] px-3 text-[12px] text-[#0D0D0D] placeholder:text-[#8A8A93]" />
                                </div>

                                <div className="task-page-properties grid gap-x-6 gap-y-1 md:grid-cols-2">
                                    {!scopeSpaceId && (
                                        <label className="task-property-row">
                                            <span className="task-property-label">Space</span>
                                            <select
                                                title="Linked space"
                                                value={draft.space_id}
                                                onChange={(event) => setDraft((current) => ({
                                                    ...current,
                                                    space_id: event.target.value,
                                                    assignee_id: '',
                                                    reviewer_id: ''
                                                }))}
                                                className="task-property-control"
                                            >
                                                <option value="">Linked space required</option>
                                                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                                            </select>
                                        </label>
                                    )}
                                    <label className="task-property-row">
                                        <span className="task-property-label">Assignee</span>
                                        <select
                                            title="Assignee"
                                            value={draft.assignee_id}
                                            onChange={(event) => setDraft((current) => ({ ...current, assignee_id: event.target.value }))}
                                            disabled={memberSelectDisabled}
                                            className="task-property-control disabled:text-zinc-500"
                                        >
                                            <option value="">{membersLoading ? 'Loading members...' : 'Unassigned'}</option>
                                            {selectableMembers.map((member) => (
                                                <option key={member.user_id} value={member.user_id}>{getMemberLabel(member)}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="task-property-row">
                                        <span className="task-property-label">Reviewer</span>
                                        <select
                                            title="Reviewer"
                                            value={draft.reviewer_id}
                                            onChange={(event) => setDraft((current) => ({ ...current, reviewer_id: event.target.value }))}
                                            disabled={memberSelectDisabled}
                                            className="task-property-control disabled:text-zinc-500"
                                        >
                                            <option value="">{membersLoading ? 'Loading members...' : 'No reviewer'}</option>
                                            {selectableMembers.map((member) => (
                                                <option key={member.user_id} value={member.user_id}>{getMemberLabel(member)}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <div className="task-property-row">
                                        <span className="task-property-label">Details</span>
                                        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-[#0D0D0D]">
                                            <span>{getSpaceName(clients, draft.space_id || editingTask?.space_id)}</span>
                                            <TaskBadge priority={draft.priority} />
                                            {(editingTask?.comment_count || editingTask?.comments?.length || 0) > 0 && (
                                                <span className="inline-flex items-center gap-1 rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-2.5 py-1.5">
                                                    <MessageSquare size={13} />
                                                    {editingTask?.comment_count || editingTask?.comments?.length}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {membersError && <p className="rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{membersError}</p>}
                                {detailError && <p className="rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{detailError}</p>}

                                {editingTask && (canRequestReview || canCompleteReview) && (
                                    <div className="space-y-3 rounded-[8px] border border-[#E5E5E5] bg-[#FAFAFA] p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-medium text-[#0D0D0D]">{canCompleteReview ? 'Finish review' : 'Review handoff'}</p>
                                            {canRequestReview && (
                                                <Button variant="secondary" className="rounded-full" onClick={() => void handleRequestReview()} disabled={isSaving || !draft.reviewer_id}>
                                                    Request
                                                </Button>
                                            )}
                                        </div>
                                        {canCompleteReview && (
                                            <>
                                                <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Review note" className="min-h-[88px] w-full rounded-[8px] border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0D0D0D] outline-none placeholder:text-[#8A8A93]" />
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    <Button variant="secondary" className="rounded-full" onClick={() => void handleCompleteReview(false)} disabled={isSaving}>Send Back</Button>
                                                    <Button className="rounded-full" onClick={() => void handleCompleteReview(true)} disabled={isSaving}><CheckCircle2 size={14} className="mr-2" />Approve</Button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {editingTask && (
                                    <div className="space-y-3 rounded-[8px] border border-[#E5E5E5] bg-[#FAFAFA] p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-medium text-[#0D0D0D]">Comments</p>
                                            <span className="text-xs text-[#6E6E80]">{editingTask.comment_count || editingTask.comments?.length || 0}</span>
                                        </div>
                                        {detailLoadingGate.isVisible && (
                                            <LoadingScreen
                                                key={detailLoadingGate.cycleKey}
                                                message="Loading comments..."
                                                isComplete={detailLoadingGate.isComplete}
                                                onExitComplete={detailLoadingGate.handleExitComplete}
                                            />
                                        )}
                                        {!detailLoadingGate.isVisible && (editingTask.comments || []).slice(-3).map((comment) => (
                                            <div key={comment.id} className="rounded-[8px] bg-white p-3">
                                                <div className="mb-1 flex items-center justify-between gap-3">
                                                    <p className="truncate text-xs font-medium text-[#4B4B55]">{comment.author_name || 'Member'}</p>
                                                    <p className="shrink-0 text-xs text-[#6E6E80]">{comment.created_at ? formatDateLabel(comment.created_at) : ''}</p>
                                                </div>
                                                <p className="whitespace-pre-wrap text-sm text-[#0D0D0D]">{comment.content}</p>
                                            </div>
                                        ))}
                                        {!detailLoadingGate.isVisible && (editingTask.comments || []).length === 0 && <p className="text-sm text-[#6E6E80]">No comments yet.</p>}
                                        {onAddTaskComment && (
                                            <div className="flex gap-2">
                                                <input value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Add a comment" className="task-composer-input min-w-0 flex-1 rounded-[8px] border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#0D0D0D] outline-none placeholder:text-[#8A8A93]" />
                                                <Button className="rounded-full" onClick={() => void handleAddComment()} disabled={isCommentSaving || !commentDraft.trim()}>
                                                    <Send size={14} />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFEFEF] px-4 py-3">
                            <div className="flex gap-2">
                                {editingTask && onArchiveTask && !editingTask.archived_at && (
                                    <Button variant="secondary" className="rounded-full" onClick={() => void handleArchive()} disabled={isSaving}>
                                        <Archive size={14} className="mr-2" />
                                        Archive
                                    </Button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="secondary" className="rounded-full px-5" onClick={() => setIsComposerOpen(false)} disabled={isSaving}>Cancel</Button>
                                <Button className="rounded-full px-5" onClick={() => void handleSave()} disabled={isSaving || !canSave}>{isSaving ? 'Saving...' : editingTask ? 'Save' : 'Create Task'}</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
