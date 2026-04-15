import React from 'react';
import TaskWorkspace from '../tasks/TaskWorkspace';
import { ClientSpace, Task } from '../../types';

type TaskViewProps = {
    tasks: Task[];
    clients: ClientSpace[];
    onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void> | void;
    onCreateTask: (task: Partial<Task>) => Promise<void> | void;
    onOpenSpace?: (spaceId: string) => void;
};

export default function TaskView({
    tasks,
    clients,
    onUpdateTask,
    onCreateTask,
    onOpenSpace
}: TaskViewProps) {
    return (
        <TaskWorkspace
            tasks={tasks}
            clients={clients}
            title="Task Management"
            subtitle="A calmer workspace for planning, sorting, and moving work across every client space."
            groupOptions={['Design', 'Engineering', 'Marketing']}
            onCreateTask={onCreateTask}
            onUpdateTask={onUpdateTask}
            onOpenSpace={onOpenSpace}
        />
    );
}
