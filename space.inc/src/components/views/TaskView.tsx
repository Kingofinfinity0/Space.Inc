import React from 'react';
import TaskWorkspace from '../tasks/TaskWorkspace';
import { ClientSpace, Task } from '../../types';

type TaskViewProps = {
    tasks: Task[];
    clients: ClientSpace[];
    onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void> | void;
    onCreateTask: (task: Partial<Task>) => Promise<void> | void;
    onArchiveTask?: (taskId: string) => Promise<void> | void;
    onDeleteTask?: (taskId: string) => Promise<void> | void;
    onRequestReview?: (taskId: string, reviewerId: string) => Promise<void> | void;
    onCompleteReview?: (taskId: string, approved: boolean, comment?: string) => Promise<void> | void;
    onAddTaskComment?: (taskId: string, content: string) => Promise<Task | void> | Task | void;
    onOpenSpace?: (spaceId: string) => void;
};

export default function TaskView({
    tasks,
    clients,
    onUpdateTask,
    onCreateTask,
    onArchiveTask,
    onDeleteTask,
    onRequestReview,
    onCompleteReview,
    onAddTaskComment,
    onOpenSpace
}: TaskViewProps) {
    return (
        <TaskWorkspace
            tasks={tasks}
            clients={clients}
            title="Tasks"
            subtitle="List-first work tracking across every client space."
            groupOptions={['Design', 'Engineering', 'Marketing']}
            onCreateTask={onCreateTask}
            onUpdateTask={onUpdateTask}
            onArchiveTask={onArchiveTask}
            onDeleteTask={onDeleteTask}
            onRequestReview={onRequestReview}
            onCompleteReview={onCompleteReview}
            onAddTaskComment={onAddTaskComment}
            onOpenSpace={onOpenSpace}
        />
    );
}
