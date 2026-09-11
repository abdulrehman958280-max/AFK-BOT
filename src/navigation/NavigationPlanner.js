const { goals } = require('mineflayer-pathfinder');

class NavigationPlanner {
  constructor(bot) {
    this.bot = bot;
    this.stuckThresholdMs = 5000; // 5 seconds without meaningful movement
    this.lastPosition = null;
    this.lastMoveTime = Date.now();
  }

  async navigateTo(x, y, z, range = 2) {
    if (!this.bot || !this.bot.pathfinder) return { success: false, error: 'Pathfinder not available' };
    
    return new Promise((resolve) => {
      this.lastPosition = this.bot.entity.position.clone();
      this.lastMoveTime = Date.now();

      const stuckCheck = setInterval(() => {
        if (!this.bot.pathfinder.isMoving()) {
           clearInterval(stuckCheck);
           return;
        }

        const currentPos = this.bot.entity.position;
        const dist = currentPos.distanceTo(this.lastPosition);
        
        if (dist > 1.0) {
          // Meaningful movement
          this.lastPosition = currentPos.clone();
          this.lastMoveTime = Date.now();
        } else if (Date.now() - this.lastMoveTime > this.stuckThresholdMs) {
          // Stuck detected
          clearInterval(stuckCheck);
          this.cancel();
          // Reposition / Recovery (jump, shift slightly)
          this.bot.setControlState('jump', true);
          setTimeout(() => this.bot.setControlState('jump', false), 500);
          resolve({ success: false, error: 'Pathfinder stuck, attempted recovery jump' });
        }
      }, 1000);

      try {
        let goal;
        if (y !== undefined && y !== null) {
          goal = new goals.GoalNear(x, y, z, range);
        } else {
          goal = new goals.GoalXZ(x, z);
        }

        this.bot.pathfinder.goto(goal)
          .then(() => {
            clearInterval(stuckCheck);
            resolve({ success: true });
          })
          .catch(err => {
            clearInterval(stuckCheck);
            resolve({ success: false, error: err.message });
          });
      } catch (e) {
        clearInterval(stuckCheck);
        resolve({ success: false, error: e.message });
      }
    });
  }

  cancel() {
    if (this.bot && this.bot.pathfinder) {
      this.bot.pathfinder.setGoal(null);
    }
  }
}

module.exports = NavigationPlanner;
