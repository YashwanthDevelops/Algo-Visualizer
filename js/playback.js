export class Playback {
  constructor(onFrame, onStatus) {
    this.onFrame = onFrame;
    this.onStatus = onStatus;
    this.steps = [];
    this.index = 0;
    this.speed = 5;
    this.timer = null;
    this.jumpPoints = [];
  }

  load(steps) {
    this.pause();
    this.steps = steps;
    this.index = 0;
    this.jumpPoints = steps
      .map((step, index) => ({ step, index }))
      .filter(
        ({ step, index }) =>
          index === 0 ||
          /goal|solution|backtrack|reject|cutoff|accepted|failure|complete|found|conflict|assign/i.test(
            `${step.event || ""} ${step.reason || ""}`,
          ),
      )
      .map(({ index }) => index);
    this.show();
  }

  show() {
    this.onFrame(this.steps[this.index] || null, this.index, this.steps.length);
  }

  play() {
    if (!this.steps.length) return;
    if (this.index === this.steps.length - 1) this.index = 0;
    this.pause();
    this.onStatus(true);
    this.timer = setInterval(() => {
      if (this.index >= this.steps.length - 1) {
        this.pause();
        return;
      }
      this.index++;
      this.show();
      if (this.index === this.steps.length - 1) this.pause();
    }, 1000 / this.speed);
    this.show();
  }

  pause() {
    clearInterval(this.timer);
    this.timer = null;
    this.onStatus(false);
  }

  next() {
    this.pause();
    this.index = Math.min(this.steps.length - 1, this.index + 1);
    this.show();
  }

  previous() {
    this.pause();
    this.index = Math.max(0, this.index - 1);
    this.show();
  }

  jump(direction) {
    this.pause();
    const points = this.jumpPoints.filter((index) =>
      direction < 0 ? index < this.index : index > this.index,
    );
    this.index =
      direction < 0
        ? (points.at(-1) ?? 0)
        : (points[0] ?? this.steps.length - 1);
    this.show();
  }

  seek(index) {
    this.pause();
    this.index = Math.max(0, Math.min(this.steps.length - 1, index));
    this.show();
  }

  reset() {
    this.pause();
    this.steps = [];
    this.index = 0;
    this.jumpPoints = [];
    this.show();
  }

  setSpeed(value) {
    const active = !!this.timer;
    this.speed = value;
    if (active) this.play();
  }
}
