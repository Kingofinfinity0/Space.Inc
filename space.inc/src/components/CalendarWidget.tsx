import React, { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, ListTodo, Video } from 'lucide-react';
import { Button, GlassCard } from './UI/index';
import { ClientSpace, Meeting, Task } from '../types';

type CalendarItemType = 'meeting' | 'task';

type CalendarItem = {
    id: string;
    type: CalendarItemType;
    spaceId: string;
    title: string;
    startAt: string;
    endAt?: string | null;
};

type Props = {
    meetings: Meeting[];
    tasks: Task[];
    spaces: ClientSpace[];
    defaultSpaceId?: string | null;
    showSpaceFilter?: boolean;
    showTypeFilter?: boolean;
    title?: string;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

const toDayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

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
    title = 'Calendar'
}: Props) {
    const now = new Date();
    const [cursorYear, setCursorYear] = useState(now.getFullYear());
    const [cursorMonth, setCursorMonth] = useState(now.getMonth());
    const [selectedDayKey, setSelectedDayKey] = useState<string>(toDayKey(now));

    const [spaceFilter, setSpaceFilter] = useState<string>(defaultSpaceId || 'all');
    const [showMeetings, setShowMeetings] = useState(true);
    const [showTasks, setShowTasks] = useState(true);

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
                    endAt: null
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

    const goPrevMonth = () => {
        const d = new Date(cursorYear, cursorMonth - 1, 1);
        setCursorYear(d.getFullYear());
        setCursorMonth(d.getMonth());
    };

    const goNextMonth = () => {
        const d = new Date(cursorYear, cursorMonth + 1, 1);
        setCursorYear(d.getFullYear());
        setCursorMonth(d.getMonth());
    };

    const todayKey = toDayKey(now);

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

            <GlassCard className="p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-zinc-900">Agenda</div>
                    <div className="text-[11px] text-zinc-500">{selectedDayKey}</div>
                </div>

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
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="text-xs font-bold text-zinc-900 truncate">{item.title}</div>
                                                <div className="text-[10px] text-zinc-500 whitespace-nowrap">{time}</div>
                                            </div>
                                            <div className="text-[10px] text-zinc-500 mt-1 truncate">{spaceName}</div>
                                            <div className="mt-2 inline-flex items-center gap-2 text-[10px] px-2 py-1 rounded-md bg-zinc-50 text-zinc-600 border border-zinc-100">
                                                {item.type === 'meeting' ? <Video size={12} /> : <ListTodo size={12} />}
                                                {item.type === 'meeting' ? 'Meeting' : 'Task deadline'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </GlassCard>
        </div>
    );
}
