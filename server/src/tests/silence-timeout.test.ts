describe('Silence Timeout Logic', () => {
  let mockSetTimeout: jest.SpyInstance;
  let mockClearTimeout: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    mockSetTimeout = jest.spyOn(global, 'setTimeout');
    mockClearTimeout = jest.spyOn(global, 'clearTimeout');
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    mockSetTimeout.mockRestore();
    mockClearTimeout.mockRestore();
  });

  class SilenceDetector {
    private timeoutId: NodeJS.Timeout | null = null;
    private lastSpeechTime: number = Date.now();
    private onSilenceCallback: () => void;

    constructor(onSilenceCallback: () => void) {
      this.onSilenceCallback = onSilenceCallback;
    }

    startMonitoring(silenceThreshold: number = 10000) {
      this.resetTimeout(silenceThreshold);
    }

    onSpeechDetected() {
      this.lastSpeechTime = Date.now();
      this.resetTimeout();
    }

    private resetTimeout(threshold: number = 10000) {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }

      this.timeoutId = setTimeout(() => {
        this.onSilenceCallback();
      }, threshold);
    }

    stop() {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
    }

    getLastSpeechTime() {
      return this.lastSpeechTime;
    }
  }

  test('should trigger callback after 10 seconds of silence', () => {
    const onSilence = jest.fn();
    const detector = new SilenceDetector(onSilence);

    detector.startMonitoring(10000);

    // Fast-forward time by 10 seconds
    jest.advanceTimersByTime(10000);

    expect(onSilence).toHaveBeenCalledTimes(1);
  });

  test('should reset timeout when speech is detected', () => {
    const onSilence = jest.fn();
    const detector = new SilenceDetector(onSilence);

    detector.startMonitoring(10000);

    // Advance 5 seconds, then detect speech
    jest.advanceTimersByTime(5000);
    detector.onSpeechDetected();

    // Advance another 5 seconds (total 10, but speech detected at 5)
    jest.advanceTimersByTime(5000);

    expect(onSilence).not.toHaveBeenCalled();

    // Advance another 5 seconds (10 seconds since last speech)
    jest.advanceTimersByTime(5000);

    expect(onSilence).toHaveBeenCalledTimes(1);
  });

  test('should not trigger callback if stopped before timeout', () => {
    const onSilence = jest.fn();
    const detector = new SilenceDetector(onSilence);

    detector.startMonitoring(10000);

    // Advance 5 seconds, then stop monitoring
    jest.advanceTimersByTime(5000);
    detector.stop();

    // Advance past the original timeout
    jest.advanceTimersByTime(6000);

    expect(onSilence).not.toHaveBeenCalled();
  });

  test('should track last speech time correctly', () => {
    const onSilence = jest.fn();
    const detector = new SilenceDetector(onSilence);
    
    const startTime = Date.now();
    detector.startMonitoring();

    // Simulate speech after 3 seconds
    jest.advanceTimersByTime(3000);
    const speechTime = Date.now();
    detector.onSpeechDetected();

    expect(detector.getLastSpeechTime()).toBe(speechTime);
    expect(detector.getLastSpeechTime()).toBeGreaterThan(startTime);
  });
});