import { EventEmitter } from 'events';
import type { Task } from '$lib/server/db/schema';

class TaskEmitter extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(100); // Allow many connections
    }

    emitTaskUpdate(task: any, type: 'create' | 'update' | 'delete') {
        this.emit('task', { type, task });
    }
}

// Singleton instance
const globalForEvents = globalThis as unknown as { taskEvents: TaskEmitter };

export const taskEvents = globalForEvents.taskEvents || new TaskEmitter();

if (process.env.NODE_ENV !== 'production') globalForEvents.taskEvents = taskEvents;
