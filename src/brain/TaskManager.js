const Task = require('../tasks/Task');
const TaskQueue = require('../tasks/TaskQueue');
const EventBus = require('./EventBus');

/**
 * TaskManager
 * Coordinates task creation, status transitions, priority queuing, and events.
 */
class TaskManager {
  constructor(eventBus = null) {
    this.eventBus = eventBus;
    this.queue = new TaskQueue();
    this.activeTaskId = null;
  }

  /**
   * Create and enqueue a task
   * @param {object} params 
   * @returns {Task}
   */
  createTask(params) {
    const task = new Task(params);
    this.queue.enqueue(task);

    if (this.eventBus) {
      this.eventBus.emit(EventBus.EVENTS.TASK_CREATED, {
        task: task.toJSON(),
        timestamp: Date.now()
      });
    }

    return task;
  }

  /**
   * Start a task by ID
   * @param {string} id 
   * @returns {Task}
   */
  startTask(id) {
    const task = this.queue.getById(id);
    if (!task) {
      throw new Error(`Task with ID "${id}" not found`);
    }

    // If another task is RUNNING, pause it
    if (this.activeTaskId && this.activeTaskId !== id) {
      const currentActive = this.queue.getById(this.activeTaskId);
      if (currentActive && currentActive.status === Task.STATUSES.RUNNING) {
        currentActive.pause();
        if (this.eventBus) {
          this.eventBus.emit(EventBus.EVENTS.TASK_UPDATED, {
            task: currentActive.toJSON(),
            action: 'paused',
            timestamp: Date.now()
          });
        }
      }
    }

    task.start();
    this.activeTaskId = id;
    this.queue._sort();

    if (this.eventBus) {
      this.eventBus.emit(EventBus.EVENTS.TASK_STARTED, {
        task: task.toJSON(),
        timestamp: Date.now()
      });
    }

    return task;
  }

  /**
   * Pause a running task
   * @param {string} id 
   * @returns {Task}
   */
  pauseTask(id) {
    const task = this.queue.getById(id);
    if (!task) throw new Error(`Task "${id}" not found`);

    task.pause();
    if (this.activeTaskId === id) {
      this.activeTaskId = null;
    }
    this.queue._sort();

    if (this.eventBus) {
      this.eventBus.emit(EventBus.EVENTS.TASK_UPDATED, {
        task: task.toJSON(),
        action: 'paused',
        timestamp: Date.now()
      });
    }

    return task;
  }

  /**
   * Resume a paused task
   * @param {string} id 
   * @returns {Task}
   */
  resumeTask(id) {
    const task = this.queue.getById(id);
    if (!task) throw new Error(`Task "${id}" not found`);

    return this.startTask(id);
  }

  /**
   * Update task progress percentage (0-100)
   * @param {string} id 
   * @param {number} progress 
   * @returns {Task}
   */
  updateProgress(id, progress) {
    const task = this.queue.getById(id);
    if (!task) throw new Error(`Task "${id}" not found`);

    task.updateProgress(progress);

    if (this.eventBus) {
      this.eventBus.emit(EventBus.EVENTS.TASK_UPDATED, {
        task: task.toJSON(),
        action: 'progress',
        progress: task.progress,
        timestamp: Date.now()
      });
    }

    return task;
  }

  /**
   * Complete a task
   * @param {string} id 
   * @param {any} [result] 
   * @returns {Task}
   */
  completeTask(id, result = null) {
    const task = this.queue.getById(id);
    if (!task) throw new Error(`Task "${id}" not found`);

    task.complete(result);
    if (this.activeTaskId === id) {
      this.activeTaskId = null;
    }
    this.queue._sort();

    if (this.eventBus) {
      this.eventBus.emit(EventBus.EVENTS.TASK_COMPLETED, {
        task: task.toJSON(),
        result,
        timestamp: Date.now()
      });
    }

    return task;
  }

  /**
   * Fail a task
   * @param {string} id 
   * @param {string} error 
   * @returns {Task}
   */
  failTask(id, error = 'Task failed') {
    const task = this.queue.getById(id);
    if (!task) throw new Error(`Task "${id}" not found`);

    task.fail(error);
    if (this.activeTaskId === id) {
      this.activeTaskId = null;
    }
    this.queue._sort();

    if (this.eventBus) {
      this.eventBus.emit(EventBus.EVENTS.TASK_FAILED, {
        task: task.toJSON(),
        error: task.error,
        timestamp: Date.now()
      });
    }

    return task;
  }

  /**
   * Cancel a task
   * @param {string} id 
   * @param {string} [reason] 
   * @returns {Task}
   */
  cancelTask(id, reason = 'Task cancelled') {
    const task = this.queue.getById(id);
    if (!task) throw new Error(`Task "${id}" not found`);

    task.cancel(reason);
    if (this.activeTaskId === id) {
      this.activeTaskId = null;
    }
    this.queue._sort();

    if (this.eventBus) {
      this.eventBus.emit(EventBus.EVENTS.TASK_CANCELLED, {
        task: task.toJSON(),
        reason,
        timestamp: Date.now()
      });
    }

    return task;
  }

  /**
   * Get active running task
   * @returns {Task|null}
   */
  getActiveTask() {
    if (!this.activeTaskId) return null;
    const task = this.queue.getById(this.activeTaskId);
    if (task && task.status === Task.STATUSES.RUNNING) {
      return task;
    }
    this.activeTaskId = null;
    return null;
  }

  /**
   * Get next runnable task from queue
   * @returns {Task|null}
   */
  getNextRunnableTask() {
    return this.queue.getNextRunnable();
  }

  /**
   * Get task by ID
   * @param {string} id 
   * @returns {Task|null}
   */
  getTask(id) {
    return this.queue.getById(id);
  }

  /**
   * Get all tasks
   * @returns {Task[]}
   */
  getAllTasks() {
    return this.queue.getAll();
  }

  /**
   * Clear all tasks
   */
  clear() {
    this.queue.clear();
    this.activeTaskId = null;
  }
}

module.exports = TaskManager;
