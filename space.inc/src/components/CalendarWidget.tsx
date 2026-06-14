import React, { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, ListTodo, MoreHorizontal, Video, X } from 'lucide-react';
import { Button, GlassCard } from './UI/index';
import { ClientSpace, Meeting, Task } from '../types';
import { usePersistentState } from '../lib/persistence';

type CalendarItemType = 'meeting' | 'task';

type CalendarItem = {
    id: string;
    type: CalendarItemType;
    spaceId: string;
    title: string;
    startAt: string;
    endAt?: string | null;
    status?: string | null;
};

type CalendarTaskAction = 'complete' | 'postpone' | 'open';
type CalendarMeetingAction = 'join' | 'delete' | 'review';

type Props = {
    meetings: Meeting[];
    tasks: Task[];
    spaces: ClientSpace[];
    defaultSpaceId?: string | null;
    showSpaceFilter?: boolean;
    showTypeFilter?: boolean;
    title?: string;
    variant?: 'default' | 'compact';
    stateKey?: string;
    onOpenSpace?: (spaceId: string) => void;
    onTaskAction?: (taskId: string, action: CalendarTaskAction) => void | Promise<void>;
    onMeetingAction?: (meetingId: string, action: CalendarMeetingAction) => void | Promise<void>;
    canDeleteMeetings?: boolean;
};

type CalendarCursor = {
    year: number;
    month: number;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

const toDayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const isDayKey = (value: unknown): value is string => (
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
);

const isOptionalDayKey = (value: unknown): value is string => value === '' || isDayKey(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const isCalendarCursor = (value: unknown): value is CalendarCursor => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const cursor = value as Partial<CalendarCursor>;
    return (
        Number.isInteger(cursor.year)
        && Number.isInteger(cursor.month)
        && (cursor.year as number) >= 1970
        && (cursor.year as number) <= 2200
        && (cursor.month as number) >= 0
        && (cursor.month as number) <= 11
    );
};

const parseIsoSafe = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
};

const startOfMonthGrid = (year: number, monthIndex: number) => {
    const first = new Date(year, monthIndex, 1);
    const day = first.getDay();
    const offset = (day + 6) % 7;
    return new Date(year, monthIndex, 1 - offset);
};

const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

const isSameMonth = (a: Date, year: number, monthIndex: number) => a.getFullYear() === year && a.getMonth() === monthIndex;

const hashToColor = (input: string) => {
    let h = 0;
    for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;

    const palette = [
        'bg-emerald-500',
        'bg-indigo-500',
        'bg-rose-500',
        'bg-amber-500',
        'bg-sky-500',
        'bg-violet-500',
        'bg-teal-500'
    ];
    return palette[h % palette.length];
};

export function CalendarWidget({
    meetings,
    tasks,
    spaces,
    defaultSpaceId = null,
    showSpaceFilter = true,
    showTypeFilter = true,
    title = 'Calendar',
    variant = 'default',
    onOpenSpace,
    onTaskAction,
    onMeetingAction,
    canDeleteMeetings = false,
    stateKey
}: Props) {
    const now = new Date();
    const initialDayKey = toDayKey(now);
    const calendarStateKey = `calendar.${variant}.${stateKey || defaultSpaceId || 'global'}`;
    const [cursor, setCursor] = usePersistentState<CalendarCursor>(
        `${calendarStateKey}.cursor`,
        { year: now.getFullYear(), month: now.getMonth() },
        { validate: isCalendarCursor }
    );
    const cursorYear = cursor.year;
    const cursorMonth = cursor.month;
    const [selectedDayKey, setSelectedDayKey] = usePersistentState<string>(
        `${calendarStateKey}.selectedDay`,
        initialDayKey,
        { validate: isDayKey }
    );
    const [agendaDayValue, setAgendaDayValue] = usePersistentState<string>(
        `${calendarStateKey}.agendaDay`,
        '',
        { validate: isOptionalDayKey }
    );
    const agendaDayKey = agendaDayValue || null;
    const setAgendaDayKey = (key: string | null) => setAgendaDayValue(key || '');
    const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

    const [spaceFilter, setSpaceFilter] = usePersistentState<string>(
        `${calendarStateKey}.spaceFilter`,
        defaultSpaceId || 'all',
        { validate: isString }
    );
    const [showMeetings, setShowMeetings] = usePersistentState<boolean>(
        `${calendarStateKey}.showMeetings`,
        true,
        { validate: isBoolean }
    );
    const [showTasks, setShowTasks] = usePersistentState<boolean>(
        `${calendarStateKey}.showTasks`,
        true,
        { validate: isBoolean }
    );

    useEffect(() => {
        if (defaultSpaceId && !showSpaceFilter && spaceFilter !== defaultSpaceId) {
            setSpaceFilter(defaultSpaceId);
        }
    }, [defaultSpaceId, showSpaceFilter, spaceFilter, setSpaceFilter]);

    const spaceNameById = useMemo(() => {
        const m = new Map<string, string>();
        spaces.forEach(s => m.set(s.id, s.name));
        return m;
    }, [spaces]);

    const items = useMemo<CalendarItem[]>(() => {
        const out: CalendarItem[] = [];

        if (showMeetings) {
            for (const m of meetings) {
                const starts = parseIsoSafe((m as any).starts_at);
                if (!starts) continue;
                out.push({
                    id: m.id,
                    type: 'meeting',
                    spaceId: (m as any).space_id,
                    title: (m as any).title || 'Meeting',
                    startAt: (m as any).starts_at,
                    endAt: null,
                    status: (m as any).status || null
                });
            }
        }

        if (showTasks) {
            for (const t of tasks) {
                const due = parseIsoSafe((t as any).due_date);
                if (!due) continue;
                out.push({
                    id: t.id,
                    type: 'task',
                    spaceId: (t as any).space_id,
                    title: (t as any).title || 'Task',
                    startAt: (t as any).due_date,
                    endAt: null
                });
            }
        }

        return out;
    }, [meetings, tasks, showMeetings, showTasks]);

    const filteredItems = useMemo(() => {
        if (spaceFilter === 'all') return items;
        return items.filter(i => i.spaceId === spaceFilter);
    }, [items, spaceFilter]);

    const itemsByDay = useMemo(() => {
        const map = new Map<string, CalendarItem[]>();
        for (const item of filteredItems) {
            const d = parseIsoSafe(item.startAt);
            if (!d) continue;
            const key = toDayKey(d);
            const list = map.get(key) || [];
            list.push(item);
            map.set(key, list);
        }
        for (const [k, list] of map.entries()) {
            list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
            map.set(k, list);
        }
        return map;
    }, [filteredItems]);

    const monthLabel = useMemo(() => {
        const d = new Date(cursorYear, cursorMonth, 1);
        return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    }, [cursorYear, cursorMonth]);

    const gridStart = useMemo(() => startOfMonthGrid(cursorYear, cursorMonth), [cursorYear, cursorMonth]);

    const gridDays = useMemo(() => {
        const days: Date[] = [];
        for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));
        return days;
    }, [gridStart]);

    const selectedItems = useMemo(() => itemsByDay.get(selectedDayKey) || [], [itemsByDay, selectedDayKey]);
    const agendaItems = useMemo(() => agendaDayKey ? itemsByDay.get(agendaDayKey) || [] : [], [agendaDayKey, itemsByDay]);
    const hasAgendaItems = agendaItems.length > 0;

    const compactGridDays = useMemo(() => {
        const first = new Date(cursorYear, cursorMonth, 1);
        const last = new Date(cursorYear, cursorMonth + 1, 0);
        const offset = (first.getDay() + 6) % 7;
        const dayCount = offset + last.getDate();
        const visibleCells = Math.ceil(dayCount / 7) * 7;
        const days: Date[] = [];
        for (let i = 0; i < visibleCells; i++) days.push(addDays(gridStart, i));
        return days;
    }, [cursorYear, cursorMonth, gridStart]);
    const compactWeekCount = compactGridDays.length / 7;

    const goPrevMonth = () => {
        const d = new Date(cursorYear, cursorMonth - 1, 1);
        setCursor({ year: d.getFullYear(), month: d.getMonth() });
    };

    const goNextMonth = () => {
        const d = new Date(cursorYear, cursorMonth + 1, 1);
        setCursor({ year: d.getFullYear(), month: d.getMonth() });
    };

    const todayKey = toDayKey(now);
    const todayStartMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const handleTaskAction = async (taskId: string, action: CalendarTaskAction) => {
        setOpenActionMenuId(null);
        await onTaskAction?.(taskId, action);
    };

    const handleMeetingAction = async (meetingId: string, action: CalendarMeetingAction) => {
        setOpenActionMenuId(null);
        await onMeetingAction?.(meetingId, action);
    };

    if (variant === 'compact') {
        return (
            <section className="relative h-full overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
                <div
                    className={`absolute left-3 right-3 top-3 flex min-h-0 flex-col transition-all duration-500 ease-out ${
                        agendaDayKey
                            ? hasAgendaItems
                                ? 'bottom-3 -translate-y-full scale-[0.96] opacity-0'
                                : 'bottom-[118px] -translate-y-1 scale-100 opacity-100'
                            : 'bottom-3 translate-y-0 scale-100 opacity-100'
                    }`}
                >
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="truncate text-[15px] font-semibold tracking-[-0.03em] text-[#0D0D0D]">{monthLabel}</h3>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Button variant="ghost" size="sm" className="h-6 w-6 border border-[#E5E5E5] bg-white p-0 text-[#0D0D0D] hover:bg-[#F7F7F8]" onClick={goPrevMonth} title="Previous month">
                                <ChevronLeft size={12} />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 border border-[#E5E5E5] bg-white p-0 text-[#0D0D0D] hover:bg-[#F7F7F8]" onClick={goNextMonth} title="Next month">
                                <ChevronRight size={12} />
                            </Button>
                        </div>
                    </div>

                    <div
                        className="grid min-h-0 flex-1 grid-cols-7 gap-x-2 gap-y-1.5"
                        style={{ gridTemplateRows: `20px repeat(${compactWeekCount}, minmax(0, 1fr))` }}
                    >
                        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
                            <div key={day} className="flex h-full items-center justify-center rounded-full bg-[#F7F7F8] text-[8px] font-semibold text-[#6E6E80]">
                                {day}
                            </div>
                        ))}

                        {compactGridDays.map((day) => {
                            const key = toDayKey(day);
                            const dayItems = itemsByDay.get(key) || [];
                            const inMonth = isSameMonth(day, cursorYear, cursorMonth);
                            const isToday = key === todayKey;
                            const isSelected = key === selectedDayKey;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => {
                                        setSelectedDayKey(key);
                                        setAgendaDayKey(key);
                                        setOpenActionMenuId(null);
                                    }}
                                    className="relative flex h-full items-center justify-center"
                                    title={day.toDateString()}
                                    disabled={!inMonth}
                                >
                                    {inMonth && (
                                        <>
                                            <span
                                                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold leading-none transition ${
                                                    isSelected
                                                        ? 'bg-black text-white'
                                                        : isToday
                                                            ? 'bg-[#F1F1F2] text-[#0D0D0D]'
                                                            : 'text-[#0D0D0D] hover:bg-[#F7F7F8]'
                                                }`}
                                            >
                                                {day.getDate()}
                                            </span>
                                            {dayItems.length > 0 && (
                                                <div className="absolute right-1.5 top-1 flex gap-0.5">
                                                    {dayItems.slice(0, 2).map((item) => (
                                                        <span
                                                            key={item.id}
                                                            className={`h-1.5 w-1.5 rounded-full ring-1 ring-white ${item.type === 'meeting' ? 'bg-orange-500' : 'bg-lime-500'}`}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                            {dayItems.length > 2 && (
                                                <span className="absolute bottom-0.5 right-1 rounded-full bg-[#F7F7F8] px-1 text-[8px] text-[#6E6E80]">
                                                    +{dayItems.length - 2}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div
                    className={`absolute inset-3 z-20 transition-[transform,opacity] duration-500 ease-out ${
                        agendaDayKey ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[calc(100%+12px)] opacity-0'
                    }`}
                >
                    <div className={`${hasAgendaItems ? 'h-full' : 'flex h-full items-end'}`}>
                    <div className={`${hasAgendaItems ? 'h-full' : 'h-[102px]'} w-full overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white p-3 text-[#0D0D0D] shadow-[0_16px_32px_rgba(15,23,42,0.12)]`}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className={`${hasAgendaItems ? 'text-sm' : 'text-[11px]'} font-semibold text-[#0D0D0D]`}>Events</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setAgendaDayKey(null);
                                    setOpenActionMenuId(null);
                                }}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#6E6E80] hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                                aria-label="Close events"
                            >
                                <X size={14} />
                            </button>
                        </div>
                        <div className={`${hasAgendaItems ? 'max-h-[calc(100%-44px)]' : 'max-h-[62px]'} overflow-y-auto pr-1`}>
                            {agendaItems.length === 0 ? (
                                <div className="rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] px-3 py-2">
                                    <p className="text-[11px] font-semibold text-[#0D0D0D]">No events scheduled</p>
                                    <p className="mt-0.5 text-[10px] text-[#6E6E80]">This day is open.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {agendaItems.map((item) => {
                                        const d = new Date(item.startAt);
                                        const time = item.type === 'meeting'
                                            ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                            : 'Due';
                                        const isActionMenuOpen = openActionMenuId === item.id;
                                        const isPastMeeting = item.type === 'meeting' && (
                                            item.status === 'ended'
                                            || item.status === 'cancelled'
                                            || d.getTime() < todayStartMs
                                        );
                                        return (
                                            <div
                                                key={item.id}
                                                className={`w-full rounded-[8px] border px-3 py-2.5 text-left transition-all duration-300 ease-out ${
                                                    isActionMenuOpen
                                                        ? 'border-[#D7D7DB] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.08)]'
                                                        : 'border-[#E5E5E5] bg-[#F7F7F8] hover:bg-white'
                                                }`}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.type === 'meeting' ? 'bg-orange-500' : 'bg-lime-500'}`} />
                                                    <button
                                                        type="button"
                                                        onClick={() => item.type === 'task'
                                                            ? void handleTaskAction(item.id, 'open')
                                                            : void handleMeetingAction(item.id, isPastMeeting ? 'review' : 'join')
                                                        }
                                                        className="min-w-0 flex-1 text-left"
                                                    >
                                                        <span className="block truncate text-[12px] font-semibold text-[#0D0D0D]">{item.title}</span>
                                                        <span className="mt-0.5 block truncate text-[11px] text-[#6E6E80]">{item.type === 'meeting' ? 'Meeting' : 'Task'} - {spaceNameById.get(item.spaceId) || 'This space'}</span>
                                                    </button>
                                                    <span className="ml-2 shrink-0 text-[10px] font-medium text-[#6E6E80]">{time}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setOpenActionMenuId((current) => current === item.id ? null : item.id)}
                                                        className={`-mr-1 flex h-7 shrink-0 items-center justify-center rounded-full transition-all duration-300 ease-out ${
                                                            isActionMenuOpen
                                                                ? 'w-10 bg-black text-white'
                                                                : 'w-7 text-[#6E6E80] hover:bg-white hover:text-[#0D0D0D]'
                                                        }`}
                                                        aria-label={`${item.type === 'meeting' ? 'Meeting' : 'Task'} actions for ${item.title}`}
                                                    >
                                                        <MoreHorizontal size={15} className={`transition-transform duration-300 ${isActionMenuOpen ? 'rotate-90' : ''}`} />
                                                    </button>
                                                </div>
                                                <div className={`overflow-hidden transition-all duration-300 ease-out ${
                                                    isActionMenuOpen ? 'mt-2 max-h-28 opacity-100' : 'mt-0 max-h-0 opacity-0'
                                                }`}>
                                                    <div className="flex flex-wrap gap-1.5 rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-1">
                                                        {item.type === 'task' ? (
                                                            <>
                                                                <button type="button" onClick={() => void handleTaskAction(item.id, 'complete')} className="rounded-full bg-black px-2.5 py-1 text-[10px] font-semibold text-white transition hover:bg-[#1A1A1A]">
                                                                    Completed
                                                                </button>
                                                                <button type="button" onClick={() => void handleTaskAction(item.id, 'postpone')} className="rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#0D0D0D] transition hover:bg-[#F7F7F8]">
                                                                    Postpone
                                                                </button>
                                                                <button type="button" onClick={() => void handleTaskAction(item.id, 'open')} className="rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#0D0D0D] transition hover:bg-[#F7F7F8]">
                                                                    Open task
                                                                </button>
                                                            </>
                                                        ) : isPastMeeting ? (
                                                            <button type="button" onClick={() => void handleMeetingAction(item.id, 'review')} className="rounded-full bg-black px-2.5 py-1 text-[10px] font-semibold text-white transition hover:bg-[#1A1A1A]">
                                                                Review meeting
                                                            </button>
                                                        ) : (
                                                            <>
                                                                <button type="button" onClick={() => void handleMeetingAction(item.id, 'join')} className="rounded-full bg-black px-2.5 py-1 text-[10px] font-semibold text-white transition hover:bg-[#1A1A1A]">
                                                                    Join meeting
                                                                </button>
                                                                {canDeleteMeetings && (
                                                                    <button type="button" onClick={() => void handleMeetingAction(item.id, 'delete')} className="rounded-full border border-rose-100 bg-white px-2.5 py-1 text-[10px] font-semibold text-rose-600 transition hover:bg-rose-50">
                                                                        Delete meeting
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <GlassCard className="p-5 lg:col-span-2">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
                            <CalendarIcon size={16} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-zinc-900 truncate">{title}</div>
                            <div className="text-[11px] text-zinc-500 truncate">{monthLabel}</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={goPrevMonth} title="Previous month">
                            <ChevronLeft size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={goNextMonth} title="Next month">
                            <ChevronRight size={16} />
                        </Button>
                    </div>
                </div>

                {(showSpaceFilter || showTypeFilter) && (
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 mr-2">
                            <Filter size={14} /> Filters
                        </div>

                        {showSpaceFilter && (
                            <select
                                title="Filter by space"
                                className="bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-800 focus:outline-none"
                                value={spaceFilter}
                                onChange={(e) => setSpaceFilter(e.target.value)}
                            >
                                <option value="all">All spaces</option>
                                {spaces.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        )}

                        {showTypeFilter && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowMeetings(v => !v)}
                                    className={`px-3 py-2 rounded-lg text-xs border transition-colors flex items-center gap-2 ${showMeetings ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-white border-zinc-200 text-zinc-500'}`}
                                >
                                    <Video size={14} /> Meetings
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowTasks(v => !v)}
                                    className={`px-3 py-2 rounded-lg text-xs border transition-colors flex items-center gap-2 ${showTasks ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-white border-zinc-200 text-zinc-500'}`}
                                >
                                    <ListTodo size={14} /> Tasks
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-7 gap-px bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                        <div key={d} className="bg-zinc-50 text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-3 py-2">
                            {d}
                        </div>
                    ))}

                    {gridDays.map((d) => {
                        const key = toDayKey(d);
                        const isToday = key === todayKey;
                        const isSelected = key === selectedDayKey;
                        const inMonth = isSameMonth(d, cursorYear, cursorMonth);
                        const dayItems = itemsByDay.get(key) || [];
                        const maxPills = 3;

                        return (
                            <button
                                type="button"
                                key={key}
                                onClick={() => setSelectedDayKey(key)}
                                className={`bg-white text-left px-3 py-2 h-24 border border-zinc-100 hover:bg-zinc-50 transition-colors relative ${isSelected ? 'ring-2 ring-zinc-900 ring-inset' : ''}`}
                                title={d.toDateString()}
                            >
                                <div className="flex items-center justify-between">
                                    <span className={`text-xs font-semibold ${inMonth ? 'text-zinc-900' : 'text-zinc-300'}`}>{d.getDate()}</span>
                                    {isToday && <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 text-white">Today</span>}
                                </div>

                                <div className="mt-2 space-y-1">
                                    {dayItems.slice(0, maxPills).map(item => {
                                        const color = hashToColor(item.spaceId);
                                        const label = item.type === 'meeting' ? 'Meeting' : 'Task';
                                        return (
                                            <div key={item.id} className="flex items-center gap-2 min-w-0">
                                                <div className={`h-2.5 w-2.5 rounded ${color}`} />
                                                <div className="min-w-0">
                                                    <div className="text-[10px] text-zinc-700 truncate">
                                                        <span className="font-bold text-zinc-500 mr-1">{label}:</span>
                                                        {item.title}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {dayItems.length > maxPills && (
                                        <div className="text-[10px] text-zinc-400">+{dayItems.length - maxPills} more</div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </GlassCard>

            <GlassCard className="ui-card-lane max-h-[560px] p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-zinc-900">Agenda</div>
                    <div className="text-[11px] text-zinc-500">{selectedDayKey}</div>
                </div>

                <div className="ui-card-scroll pr-1">
                    {selectedItems.length === 0 ? (
                        <div className="p-6 border border-dashed border-zinc-200 rounded-xl bg-zinc-50 text-center">
                            <div className="text-xs text-zinc-500">No items on this day.</div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {selectedItems.map(item => {
                                const d = new Date(item.startAt);
                                const time = item.type === 'meeting'
                                    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : 'Due';

                                const spaceName = spaceNameById.get(item.spaceId) || 'Unknown space';
                                const color = hashToColor(item.spaceId);

                                return (
                                    <div key={item.id} className="p-3 bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <div className={`h-9 w-1.5 rounded-full ${color}`} />
                                            <button type="button" onClick={() => onOpenSpace?.(item.spaceId)} className="min-w-0 flex-1 text-left">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-xs font-bold text-zinc-900 truncate">{item.title}</div>
                                                    <div className="text-[10px] text-zinc-500 whitespace-nowrap">{time}</div>
                                                </div>
                                                <div className="text-[10px] text-zinc-500 mt-1 truncate">{spaceName}</div>
                                                <div className="mt-2 inline-flex items-center gap-2 text-[10px] px-2 py-1 rounded-md bg-zinc-50 text-zinc-600 border border-zinc-100">
                                                    {item.type === 'meeting' ? <Video size={12} /> : <ListTodo size={12} />}
                                                    {item.type === 'meeting' ? 'Meeting' : 'Task deadline'}
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </GlassCard>
        </div>
    );
}
