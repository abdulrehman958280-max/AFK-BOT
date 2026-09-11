const Task = require('./Task');

/**
 * TaskQueue
 * Priority-based queue for agent tasks.
 */
class TaskQueue {
  constructor() {
    this._tasks = [];
  }

  /**
   * Add task to queue
   * @param {Task} task 
   */
  enqueue(task) {
    if (!(task instanceof Task)) {
      throw new Error('Item must be an instance of Task');
    }

    // Check for duplicate ID
    const existingIndex = this._tasks.findIndex(t => t.id === task.id);
    if (existingIndex !== -1) {
      this._tasks[existingIndex] = task;
    } else {
      this._tasks.push(task);
    }

    this._sort();
    return task;
  }

  /**
   * Sort tasks:
   * 1. RUNNING tasks first
   * 2. Highest priority next (e.g. 10 before 5)
   * 3. Earliest createdAt (FIFO) for ties
   */
  _sort() {
    this._tasks.sort((a, b) => {
      // Prioritize running tasks
      if (a.status === Task.STATUSES.RUNNING && b.status !== Task.STATUSES.RUNNING) return -1;
      if (b.status === Task.STATUSES.RUNNING && a.status !== Task.STATUSES.RUNNING) return 1;

      // Prioritize higher priority
      if (b.priority !== a.priority) return b.priority - a.priority;

      // Earliest first
      return a.createdAt - b.createdAt;
    });
  }

  /**
   * Get next runnable task (RUNNING or PENDING)
   * @returns {Task|null}
   */
  getNextRunnable() {
    return this._tasks.find(t => t.isRunnable()) || null;
  }

  /**
   * Dequeue next runnable task
   * @returns {Task|null}
   */
  dequeue() {
    const nextRunnableIndex = this._tasks.findIndex(t => t.isRunnable());
    if (nextRunnableIndex === -1) return null;

    const [task] = this._tasks.splice(nextRunnableIndex, 1);
    return task;
  }

  /**
   * Peek next runnable task without removing
   * @returns {Task|null}
   */
  peek() {
    return this.getNextRunnable();
  }

  /**
   * Remove task by ID
   * @param {string} id 
   * @returns {Task|null}
   */
  remove(id) {
    const index = this._tasks.findIndex(t => t.id === id);
    if (index === -1) return null;
    const [removed] = this._tasks.splice(index, 1);
    return removed;
  }

  /**
   * Find task by ID
   * @param {string} id 
   * @returns {Task|null}
   */
  getById(id) {
    return this._tasks.find(t => t.id === id) || null;
  }

  /**
   * Get all tasks (as array of clones or JSON objects)
   * @returns {Task[]}
   */
  getAll() {
    return [...this._tasks];
  }

  /**
   * Get total task count
   * @returns {number}
   */
  size() {
    return this._tasks.length;
  }

  /**
   * Clear all tasks
   */
  clear() {
    this._tasks = [];
  }
}

module.exports = TaskQueue;
