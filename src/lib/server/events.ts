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
export const taskEvents = new TaskEmitter();
