import React, { useMemo, useState } from 'react';
import {
    CalendarDays,
    CheckCircle2,
    Clock3,
    Columns3,
    Flag,
    LayoutList,
    Plus,
    Search,
    SlidersHorizontal,
    Sparkles,
    Workflow
} from 'lucide-react';
import { Button, GlassCard, Heading, Input, Modal, Text } from '../UI';
import { ClientSpace, Task } from '../../types';

type TaskViewMode = 'board' | 'list' | 'timeline' | 'calendar' | 'space';

type TaskDraft = {
    title: string;
    description: string;
    priority: NonNullable<Task['priority']>;
    due_date: string;
    assigned_group: string;
    status: Task['status'];
    space_id: string;
};

type TaskWorkspaceProps = {
    tasks: Task[];
    clients: ClientSpace[];
    title: string;
    subtitle: string;
    scopeSpaceId?: string;
    groupOptions?: string[];
    defaultView?: TaskViewMode;
    compact?: boolean;
    allowCreate?: boolean;
    loading?: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
    showToolbar?: boolean;
    showSummary?: boolean;
    previewLimitPerColumn?: number;
    onCreateTask?: (draft: Partial<Task>) => Promise<void> | void;
    onUpdateTask?: (taskId: string, updates: Partial<Task>) => Promise<void> | void;
    onOpenSpace?: (spaceId: string) => void;
};

const VIEW_OPTIONS: Array<{ id: TaskViewMode; label: string; icon: React.ReactNode }> = [
    { id: 'board', label: 'Board', icon: <Columns3 size={14} /> },
    { id: 'list', label: 'List', icon: <LayoutList size={14} /> },
    { id: 'timeline', label: 'Timeline', icon: <Workflow size={14} /> },
    { id: 'calendar', label: 'Calendar', icon: <CalendarDays size={14} /> },
    { id: 'space', label: 'Space', icon: <Sparkles size={14} /> }
];

const BOARD_COLUMNS: Array<{ id: Task['status']; label: string }> = [
    { id: 'todo', label: 'To Do' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'review', label: 'Review' },
    { id: 'done', label: 'Done' }
];

const PRIORITY_STYLES: Record<NonNullable<Task['priority']>, string> = {
    low: 'border-zinc-200 bg-zinc-100 text-zinc-600',
        medium: 'border-[#E5E5E5] bg-[#F7F7F8] text-[#0D0D0D]',
    high: 'border-orange-200 bg-orange-50 text-orange-700',
    urgent: 'border-rose-200 bg-rose-50 text-rose-700'
};

const STATUS_LABELS: Record<Task['status'], string> = {
    todo: 'To Do',
    pending: 'To Do',
    in_progress: 'In Progress',
    review: 'Review',
    done: 'Done'
};

function normalizeStatus(status?: string): Task['status'] {
    if (status === 'in_progress' || status === 'review' || status === 'done') return status;
    return 'todo';
}

function normalizePriority(priority?: string): NonNullable<Task['priority']> {
    if (priority === 'low' || priority === 'high' || priority === 'urgent') return priority;
    return 'medium';
}

function formatDateLabel(value?: string) {
    if (!value) return 'No due date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No due date';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getSpaceName(clients: ClientSpace[], spaceId?: string) {
    return clients.find((client) => client.id === spaceId)?.name || 'Unassigned';
}

function getTaskGroupLabel(task: Task, clients: ClientSpace[]) {
    return task.assigned_group || getSpaceName(clients, task.space_id);
}

function makeDraft(task?: Task, scopeSpaceId?: string, fallbackGroup?: string): TaskDraft {
    return {
        title: task?.title || '',
        description: task?.description || '',
        priority: normalizePriority(task?.priority),
        due_date: task?.due_date || '',
        assigned_group: task?.assigned_group || fallbackGroup || '',
        status: normalizeStatus(task?.status),
        space_id: task?.space_id || scopeSpaceId || ''
    };
}

function TaskBadge({ priority }: { priority: NonNullable<Task['priority']> }) {
    return (
        <span className={`surface-chip px-2.5 py-1 text-[11px] font-medium ${PRIORITY_STYLES[priority]}`}>
            {priority.charAt(0).toUpperCase() + priority.slice(1)}
        </span>
    );
}

function TaskCard({
    task,
    clients,
    compact,
    onClick,
    onDragStart
}: {
    task: Task;
    clients: ClientSpace[];
    compact?: boolean;
    onClick: () => void;
    onDragStart?: (taskId: string) => void;
}) {
    return (
        <button
            type="button"
            draggable={!!onDragStart}
            onDragStart={onDragStart ? () => onDragStart(task.id) : undefined}
            onClick={onClick}
            className={`database-row interactive-surface w-full p-3 text-left ${compact ? 'min-h-[92px]' : 'min-h-[146px]'}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="line-clamp-2 text-[12px] font-medium text-[#0D0D0D]">{task.title}</p>
                    {task.description && <p className="mt-1 line-clamp-2 text-[11px] text-[#6E6E80]">{task.description}</p>}
                </div>
                <TaskBadge priority={normalizePriority(task.priority)} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[#6E6E80]">
                <span className="surface-chip px-2.5 py-1">
                    <Clock3 size={11} />
                    {formatDateLabel(task.due_date)}
                </span>
                <span className="surface-chip px-2.5 py-1">
                    <Sparkles size={11} />
                    {getTaskGroupLabel(task, clients)}
                </span>
            </div>
        </button>
    );
}

function TaskBoard({
    tasks,
    clients,
    compact,
    previewLimitPerColumn,
    onCardClick,
    onDragStart,
    onDropTask
}: {
    tasks: Task[];
    clients: ClientSpace[];
    compact?: boolean;
    previewLimitPerColumn?: number;
    onCardClick: (task: Task) => void;
    onDragStart: (taskId: string) => void;
    onDropTask: (status: Task['status']) => void;
}) {
    return (
        <div className={`grid gap-3 ${compact ? 'xl:grid-cols-4' : 'xl:grid-cols-4'}`}>
            {BOARD_COLUMNS.map((column) => {
                const items = tasks.filter((task) => normalizeStatus(task.status) === column.id);
                const visibleItems = previewLimitPerColumn ? items.slice(0, previewLimitPerColumn) : items;
                return (
                    <div
                        key={column.id}
                        className={`flex flex-col rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-2.5 ${compact ? 'min-h-[220px]' : 'min-h-[320px]'}`}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => onDropTask(column.id)}
                    >
                        <div className="mb-2 flex items-center justify-between px-0.5">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0D0D0D]">{column.label}</p>
                                <p className="text-[10px] text-[#6E6E80]">{items.length} tasks</p>
                            </div>
                            <span className="surface-chip px-2 py-0.5 text-[10px] font-medium">{items.length}</span>
                        </div>
                        <div className="flex flex-1 flex-col gap-2">
                            {visibleItems.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    clients={clients}
                                    compact={compact}
                                    onDragStart={onDragStart}
                                    onClick={() => onCardClick(task)}
                                />
                            ))}
                            {items.length === 0 && (
                                <div className="flex flex-1 items-center justify-center rounded-[8px] border border-dashed border-[#E5E5E5] bg-white/70 p-4 text-center text-xs text-[#6E6E80]">
                                    Drop a task here
                                </div>
                            )}
                            {previewLimitPerColumn && items.length > previewLimitPerColumn && (
                                <div className="px-1 pt-1 text-[10px] text-[#6E6E80]">
                                    +{items.length - previewLimitPerColumn} more
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
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
    defaultView = 'board',
    compact = false,
    allowCreate = true,
    loading = false,
    emptyTitle = 'No tasks yet',
    emptyDescription = 'Create your first task to start building momentum.',
    showToolbar = true,
    showSummary = true,
    previewLimitPerColumn,
    onCreateTask,
    onUpdateTask,
    onOpenSpace
}: TaskWorkspaceProps) {
    const [activeView, setActiveView] = useState<TaskViewMode>(defaultView);
    const [search, setSearch] = useState('');
    const [priorityFilter, setPriorityFilter] = useState<'all' | NonNullable<Task['priority']>>('all');
    const [groupFilter, setGroupFilter] = useState('all');
    const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [draft, setDraft] = useState<TaskDraft>(() => makeDraft(undefined, scopeSpaceId));
    const [isSaving, setIsSaving] = useState(false);

    const visibleTasks = useMemo(() => {
        const base = scopeSpaceId ? tasks.filter((task) => task.space_id === scopeSpaceId) : tasks;
        return base.filter((task) => {
            const group = getTaskGroupLabel(task, clients);
            const searchText = `${task.title} ${task.description || ''} ${group}`.toLowerCase();
            const matchesSearch = !search.trim() || searchText.includes(search.trim().toLowerCase());
            const matchesPriority = priorityFilter === 'all' || normalizePriority(task.priority) === priorityFilter;
            const matchesGroup = groupFilter === 'all' || group === groupFilter;
            return matchesSearch && matchesPriority && matchesGroup;
        });
    }, [clients, groupFilter, priorityFilter, scopeSpaceId, search, tasks]);

    const availableGroups = useMemo(() => {
        const fromTasks = visibleTasks.map((task) => getTaskGroupLabel(task, clients)).filter(Boolean);
        return Array.from(new Set([...(groupOptions || []), ...fromTasks]));
    }, [clients, groupOptions, visibleTasks]);

    const sortedTasks = useMemo(() => {
        return [...visibleTasks].sort((left, right) => {
            const leftDate = left.due_date ? new Date(left.due_date).getTime() : Number.MAX_SAFE_INTEGER;
            const rightDate = right.due_date ? new Date(right.due_date).getTime() : Number.MAX_SAFE_INTEGER;
            return leftDate - rightDate;
        });
    }, [visibleTasks]);

    const counts = useMemo(() => ({
        open: sortedTasks.filter((task) => normalizeStatus(task.status) !== 'done').length,
        dueSoon: sortedTasks.filter((task) => {
            if (!task.due_date || normalizeStatus(task.status) === 'done') return false;
            const due = new Date(task.due_date).getTime();
            const now = Date.now();
            const week = now + (7 * 24 * 60 * 60 * 1000);
            return due >= now && due <= week;
        }).length,
        done: sortedTasks.filter((task) => normalizeStatus(task.status) === 'done').length
    }), [sortedTasks]);

    const calendarGroups = useMemo(() => {
        const map = new Map<string, Task[]>();
        sortedTasks.forEach((task) => {
            const key = task.due_date || 'No due date';
            const next = map.get(key) || [];
            next.push(task);
            map.set(key, next);
        });
        return Array.from(map.entries());
    }, [sortedTasks]);

    const tasksBySpace = useMemo(() => {
        return clients
            .map((client) => ({ client, tasks: sortedTasks.filter((task) => task.space_id === client.id) }))
            .filter((entry) => entry.tasks.length > 0);
    }, [clients, sortedTasks]);

    const openCreate = () => {
        setEditingTask(null);
        setDraft(makeDraft(undefined, scopeSpaceId, availableGroups[0]));
        setIsComposerOpen(true);
    };

    const openEdit = (task: Task) => {
        setEditingTask(task);
        setDraft(makeDraft(task, scopeSpaceId, availableGroups[0]));
        setIsComposerOpen(true);
    };

    const handleSave = async () => {
        if (!draft.title.trim()) return;
        setIsSaving(true);
        const payload: Partial<Task> = {
            title: draft.title.trim(),
            description: draft.description.trim() || undefined,
            priority: draft.priority,
            due_date: draft.due_date || undefined,
            assigned_group: draft.assigned_group || undefined,
            status: draft.status,
            space_id: scopeSpaceId || draft.space_id || undefined
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

    const handleDrop = async (status: Task['status']) => {
        if (!draggingTaskId || !onUpdateTask) return;
        const task = tasks.find((item) => item.id === draggingTaskId);
        setDraggingTaskId(null);
        if (!task || normalizeStatus(task.status) === status) return;
        await onUpdateTask(task.id, { status });
    };

    return (
        <>
            <div className="space-y-5">
                <div className={`flex flex-col gap-4 ${compact ? '' : 'xl:flex-row xl:items-end xl:justify-between'}`}>
                    <div className="space-y-2">
                        <div className="surface-chip px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em]">
                            <Flag size={12} />
                            Task System
                        </div>
                        <div>
                            <Heading level={compact ? 4 : 2} className={compact ? 'text-xl md:text-2xl' : ''}>{title}</Heading>
                            <Text variant="secondary" size="sm" className="mt-1 max-w-2xl">{subtitle}</Text>
                        </div>
                    </div>
                    {showSummary && (
                        <div className="flex flex-wrap gap-3">
                            <GlassCard className="min-w-[96px] px-3 py-2.5"><p className="text-[10px] uppercase tracking-[0.18em] text-[#6E6E80]">Open</p><p className="mt-1 text-xl font-semibold text-[#0D0D0D]">{counts.open}</p></GlassCard>
                            <GlassCard className="min-w-[96px] px-3 py-2.5"><p className="text-[10px] uppercase tracking-[0.18em] text-[#6E6E80]">Due Soon</p><p className="mt-1 text-xl font-semibold text-[#0D0D0D]">{counts.dueSoon}</p></GlassCard>
                            <GlassCard className="min-w-[96px] px-3 py-2.5"><p className="text-[10px] uppercase tracking-[0.18em] text-[#6E6E80]">Done</p><p className="mt-1 text-xl font-semibold text-[#0D0D0D]">{counts.done}</p></GlassCard>
                            {allowCreate && <Button className="h-auto rounded-[8px] px-4 py-2.5 text-sm" onClick={openCreate}><Plus size={14} className="mr-2" />Add Task</Button>}
                        </div>
                    )}
                </div>

                <GlassCard className="rounded-[8px] p-4 md:p-5">
                    <div className="flex flex-col gap-4">
                        {showToolbar && (
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex flex-wrap gap-2">
                                    {VIEW_OPTIONS.map((view) => (
                                        <button key={view.id} type="button" onClick={() => setActiveView(view.id)} className={`surface-chip px-3 py-2 text-xs font-medium transition-all ${activeView === view.id ? 'surface-chip-active' : ''}`}>{view.icon}{view.label}</button>
                                    ))}
                                </div>
                                <div className="flex flex-col gap-3 md:flex-row">
                                    <div className="relative min-w-[240px]">
                                        <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6E6E80]" />
                                        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search task title or group" className="rounded-[8px] pl-10 pr-4" />
                                    </div>
                                    <div className="flex gap-2">
                                        <select title="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)} className="rounded-[8px] border border-[#E5E5E5] bg-white px-4 py-2 text-sm text-[#0D0D0D] outline-none">
                                            <option value="all">All priorities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                                        </select>
                                        <select title="Filter by group" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="rounded-[8px] border border-[#E5E5E5] bg-white px-4 py-2 text-sm text-[#0D0D0D] outline-none">
                                            <option value="all">All groups</option>
                                            {availableGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {loading ? (
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8]" />)}</div>
                        ) : sortedTasks.length === 0 ? (
                            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[8px] border border-dashed border-[#E5E5E5] bg-[#f7f7f8] px-6 py-12 text-center">
                                <SlidersHorizontal size={28} className="mb-4 text-[#D4D4D8]" />
                                <p className="text-base font-medium text-[#0D0D0D]">{emptyTitle}</p>
                                <p className="mt-2 max-w-sm text-sm text-[#6E6E80]">{emptyDescription}</p>
                            </div>
                        ) : activeView === 'board' ? (
                            <TaskBoard
                                tasks={sortedTasks}
                                clients={clients}
                                compact={compact}
                                previewLimitPerColumn={compact ? 1 : undefined}
                                onCardClick={openEdit}
                                onDragStart={setDraggingTaskId}
                                onDropTask={(status) => void handleDrop(status)}
                            />
                        ) : activeView === 'list' ? (
                            <div className="space-y-3">{sortedTasks.map((task) => <button key={task.id} type="button" onClick={() => openEdit(task)} className="grid w-full gap-4 rounded-[24px] border border-zinc-200 bg-white px-4 py-4 text-left transition hover:border-zinc-300 md:grid-cols-[minmax(0,1.5fr)_150px_160px_160px]"><div><p className="text-sm font-medium text-zinc-950">{task.title}</p>{task.description && <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{task.description}</p>}</div><div><p className="mb-1 text-xs uppercase tracking-[0.14em] text-zinc-400">Status</p><p className="text-sm text-zinc-800">{STATUS_LABELS[normalizeStatus(task.status)]}</p></div><div><p className="mb-1 text-xs uppercase tracking-[0.14em] text-zinc-400">Due</p><p className="text-sm text-zinc-800">{formatDateLabel(task.due_date)}</p></div><div className="flex items-center justify-between gap-3"><TaskBadge priority={normalizePriority(task.priority)} /><span className="text-xs text-zinc-500">{getTaskGroupLabel(task, clients)}</span></div></button>)}</div>
                        ) : activeView === 'timeline' ? (
                            <div className="space-y-5">{sortedTasks.map((task) => <button key={task.id} type="button" onClick={() => openEdit(task)} className="flex w-full items-center justify-between rounded-[24px] border border-zinc-200 bg-white px-5 py-4 text-left transition hover:border-zinc-300"><div><p className="text-sm font-medium text-zinc-950">{task.title}</p><p className="mt-1 text-xs text-zinc-500">{formatDateLabel(task.due_date)} · {STATUS_LABELS[normalizeStatus(task.status)]} · {getTaskGroupLabel(task, clients)}</p></div><TaskBadge priority={normalizePriority(task.priority)} /></button>)}</div>
                        ) : activeView === 'calendar' ? (
                            <div className="space-y-3">{calendarGroups.map(([label, groupTasks]) => <GlassCard key={label} className="rounded-[24px] p-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium text-zinc-950">{label === 'No due date' ? label : formatDateLabel(label)}</p><p className="text-xs text-zinc-500">{groupTasks.length} tasks</p></div><div className="space-y-2">{groupTasks.map((task) => <button key={task.id} type="button" onClick={() => openEdit(task)} className="flex w-full items-center justify-between rounded-2xl bg-[#f7f7f8] px-4 py-3 text-left transition hover:bg-zinc-100"><div><p className="text-sm font-medium text-zinc-950">{task.title}</p><p className="mt-1 text-xs text-zinc-500">{STATUS_LABELS[normalizeStatus(task.status)]} · {getTaskGroupLabel(task, clients)}</p></div><TaskBadge priority={normalizePriority(task.priority)} /></button>)}</div></GlassCard>)}</div>
                        ) : (
                            <div className="grid gap-4 xl:grid-cols-2">{tasksBySpace.map(({ client, tasks: clientTasks }) => <GlassCard key={client.id} className="rounded-[28px] p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-lg font-medium text-zinc-950">{client.name}</p><p className="text-sm text-zinc-500">{clientTasks.length} tasks across all stages</p></div>{onOpenSpace && <Button variant="ghost" size="sm" onClick={() => onOpenSpace(client.id)}>Open Space</Button>}</div><div className="space-y-3">{clientTasks.slice(0, 4).map((task) => <button key={task.id} type="button" onClick={() => openEdit(task)} className="flex w-full items-center justify-between rounded-2xl bg-[#f7f7f8] px-4 py-3 text-left transition hover:bg-zinc-100"><div><p className="text-sm font-medium text-zinc-950">{task.title}</p><p className="mt-1 text-xs text-zinc-500">{STATUS_LABELS[normalizeStatus(task.status)]} · {formatDateLabel(task.due_date)}</p></div><TaskBadge priority={normalizePriority(task.priority)} /></button>)}</div></GlassCard>)}</div>
                        )}
                    </div>
                </GlassCard>
            </div>

            <Modal isOpen={isComposerOpen} onClose={() => !isSaving && setIsComposerOpen(false)} title={editingTask ? 'Edit Task' : 'Add Task'}>
                <div className="space-y-4">
                    <Input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Task title" />
                    <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Description" className="min-h-[120px] w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none" />
                    <div className="grid gap-3 sm:grid-cols-2">
                        <select title="Task priority" value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as TaskDraft['priority'] }))} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select>
                        <Input type="date" value={draft.due_date} onChange={(event) => setDraft((current) => ({ ...current, due_date: event.target.value }))} />
                        <select title="Assigned group" value={draft.assigned_group} onChange={(event) => setDraft((current) => ({ ...current, assigned_group: event.target.value }))} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none"><option value="">Assigned group</option>{availableGroups.map((group) => <option key={group} value={group}>{group}</option>)}</select>
                        <select title="Task status" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as Task['status'] }))} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none">{BOARD_COLUMNS.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}</select>
                    </div>
                    {!scopeSpaceId && <select title="Linked space" value={draft.space_id} onChange={(event) => setDraft((current) => ({ ...current, space_id: event.target.value }))} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 outline-none"><option value="">Linked space</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>}
                    <div className="flex items-center justify-between rounded-2xl bg-[#f7f7f8] px-4 py-3"><div><p className="text-sm font-medium text-zinc-900">Views available</p><p className="text-xs text-zinc-500">Board, List, Timeline, Calendar, and Space grouping.</p></div><CheckCircle2 size={18} className="text-zinc-400" /></div>
                    <div className="flex gap-3">
                        <Button variant="secondary" className="flex-1 rounded-2xl" onClick={() => setIsComposerOpen(false)} disabled={isSaving}>Cancel</Button>
                        <Button className="flex-1 rounded-2xl" onClick={() => void handleSave()} disabled={isSaving || !draft.title.trim()}>{isSaving ? 'Saving...' : editingTask ? 'Save Changes' : 'Create Task'}</Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
