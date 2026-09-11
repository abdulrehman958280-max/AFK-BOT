const crypto = require('crypto');

/**
 * Task
 * Discrete unit of work associated with an agent goal or manual user instruction.
 */
class Task {
  constructor({
    id = null,
    goalId = null,
    name,
    description = '',
    priority = 5,
    metadata = {}
  } = {}) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Task name is required and must be a non-empty string');
    }

    this.id = id || `task_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    this.goalId = goalId || null;
    this.name = name.trim().slice(0, 100);
    this.description = typeof description === 'string' ? description.trim().slice(0, 250) : '';
    this.priority = Number.isFinite(priority) ? Math.max(1, Math.min(100, Math.round(priority))) : 5;
    this.status = Task.STATUSES.PENDING;
    this.progress = 0;
    this.createdAt = Date.now();
    this.startedAt = null;
    this.completedAt = null;
    this.error = null;
    this.metadata = typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata) ? { ...metadata } : {};
  }

  start() {
    if (this.status === Task.STATUSES.COMPLETED || this.status === Task.STATUSES.CANCELLED) {
      throw new Error(`Cannot start task in terminal state: ${this.status}`);
    }
    this.status = Task.STATUSES.RUNNING;
    if (!this.startedAt) {
      this.startedAt = Date.now();
    }
    return this;
  }

  pause() {
    if (this.status !== Task.STATUSES.RUNNING) {
      throw new Error(`Cannot pause task with status: ${this.status}`);
    }
    this.status = Task.STATUSES.PAUSED;
    return this;
  }

  resume() {
    if (this.status !== Task.STATUSES.PAUSED) {
      throw new Error(`Cannot resume task that is not paused (current: ${this.status})`);
    }
    this.status = Task.STATUSES.RUNNING;
    return this;
  }

  updateProgress(percent) {
    if (Number.isFinite(percent)) {
      this.progress = Math.max(0, Math.min(100, Math.round(percent)));
    }
    return this;
  }

  complete(result = null) {
    this.status = Task.STATUSES.COMPLETED;
    this.completedAt = Date.now();
    this.progress = 100;
    if (result !== null) {
      this.metadata.result = result;
    }
    return this;
  }

  fail(error = 'Task failed') {
    this.status = Task.STATUSES.FAILED;
    this.completedAt = Date.now();
    this.error = typeof error === 'string' ? error : (error?.message || String(error));
    this.metadata.error = this.error;
    return this;
  }

  cancel(reason = 'Task cancelled') {
    this.status = Task.STATUSES.CANCELLED;
    this.completedAt = Date.now();
    this.metadata.cancelReason = reason;
    return this;
  }

  isTerminal() {
    return (
      this.status === Task.STATUSES.COMPLETED ||
      this.status === Task.STATUSES.FAILED ||
      this.status === Task.STATUSES.CANCELLED
    );
  }

  isRunnable() {
    return this.status === Task.STATUSES.PENDING || this.status === Task.STATUSES.RUNNING;
  }

  toJSON() {
    return {
      id: this.id,
      goalId: this.goalId,
      name: this.name,
      description: this.description,
      priority: this.priority,
      status: this.status,
      progress: this.progress,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      error: this.error,
      metadata: this.metadata
    };
  }
}

Task.STATUSES = Object.freeze({
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
});

module.exports = Task;
