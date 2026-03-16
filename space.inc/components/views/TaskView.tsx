import React, { useState } from 'react';
import {
    Plus, Clock, GripVertical
} from 'lucide-react';
import {
    GlassCard, Button, Heading, Text, Input, Modal, SkeletonLoader
} from '../UI/index';
import { ClientSpace, ViewState, Task } from '../../types';

// 5. Task View
const TaskView = ({ tasks, clients, onUpdateStatus, onCreate }: { 
    tasks: Task[], 
    clients: ClientSpace[], 
    onUpdateStatus: (id: string, status: any) => void, 
    onCreate: (t: any) => void 
}) => {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskSpace, setNewTaskSpace] = useState(clients[0]?.id || '');
    const [newTaskDate, setNewTaskDate] = useState('');

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        e.dataTransfer.setData('taskId', taskId);
    };

    const handleDrop = (e: React.DragEvent, newStatus: Task['status']) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('taskId');
        onUpdateStatus(taskId, newStatus);
    };

    const handleCreate = () => {
        if (!newTaskTitle.trim()) return;
        onCreate({
            title: newTaskTitle,
            space_id: newTaskSpace,
            due_date: newTaskDate,
            status: 'pending'
        });
        setNewTaskTitle('');
        setNewTaskDate('');
        setIsCreateOpen(false);
    };

    return (
        <div className="space-y-6 h-full flex flex-col animate-[fadeIn_0.5s_ease-out]">
            <header className="flex justify-between items-center mb-4">
                <div>
                    <Heading level={1}>Task Engine</Heading>
                    <Text variant="secondary" className="mt-1">Manage team workload and space-specific deliverables.</Text>
                </div>
                <Button onClick={() => setIsCreateOpen(true)} icon={<Plus size={18} />}>
                    New Task
                </Button>
            </header>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
                {(['pending', 'in_progress', 'done'] as const).map(status => (
                    <div
                        key={status}
                        className="bg-[#F7F7F8] rounded-lg p-4 flex flex-col h-full border border-[#D1D5DB]"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, status)}
                    >
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h3 className="font-medium text-zinc-500 text-sm uppercase tracking-wider">{status.replace('_', ' ')}</h3>
                            <span className="bg-white text-zinc-500 text-xs px-2 py-0.5 rounded-full shadow-sm">
                                {tasks.filter(t => t.status === status).length}
                            </span>
                        </div>
                        <div className="space-y-3 overflow-y-auto flex-1 min-h-[200px]">
                            {tasks.filter(t => t.status === status).map(task => {
                                const spaceName = clients.find(c => c.id === task.space_id)?.name || 'General';
                                return (
                                    <div
                                        key={task.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, task.id)}
                                        className="bg-white p-4 rounded-md border border-[#D1D5DB] shadow-sm cursor-grab active:cursor-grabbing hover:border-[#10A37F] transition-colors"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 truncate max-w-[100px]">
                                                {spaceName}
                                            </span>
                                            <div className="text-zinc-300"><GripVertical size={14} /></div>
                                        </div>
                                        <p className="text-sm font-medium text-[#1D1D1D] mb-3">{task.title}</p>
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-50">
                                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                                                <Clock size={12} /> {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                                            </div>
                                            <div className="h-6 w-6 rounded-full bg-[#1D1D1D] text-white text-[10px] flex items-center justify-center" title="Assigned">
                                                {task.assignee_id ? 'AS' : 'UN'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Task">
                <div className="space-y-4 pt-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Task Title</label>
                        <Input placeholder="e.g. Prepare Contract" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Linked Space</label>
                        <select
                            title="Link to Space"
                            className="w-full bg-white border border-zinc-200 rounded-lg px-4 py-3 text-zinc-800 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            value={newTaskSpace}
                            onChange={e => setNewTaskSpace(e.target.value)}
                        >
                            <option value="">Select a Space</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Due Date</label>
                        <Input type="date" value={newTaskDate} onChange={e => setNewTaskDate(e.target.value)} />
                    </div>
                    <Button className="w-full mt-4" onClick={handleCreate} disabled={!newTaskTitle.trim()}>
                        Create Task
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default TaskView;
