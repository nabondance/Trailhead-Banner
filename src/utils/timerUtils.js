class Timer {
  constructor() {
    this._starts = {};
    this.timings = {};
  }

  start(key) {
    this._starts[key] = Date.now();
    return this;
  }

  end(key) {
    const now = Date.now();
    const start = this._starts[key];
    this.timings[`${key}_ms`] = start != null ? now - start : 0;
    return this;
  }

  async wrap(key, fn) {
    const start = Date.now();
    try {
      const result = await fn();
      this.timings[`${key}_ms`] = Date.now() - start;
      return result;
    } catch (e) {
      this.timings[`${key}_ms`] = Date.now() - start;
      throw e;
    }
  }

  set(key, value) {
    this.timings[key] = value;
    return this;
  }

  get() {
    return { ...this.timings };
  }
}

export { Timer };
