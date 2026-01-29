type CircuitState = 'closed' | 'open' | 'half_open';

interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;
  resetTimeoutMs?: number;
}

export class CircuitBreaker {
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private failures = 0;
  private state: CircuitState = 'closed';
  private openedAt = 0;

  constructor({ name, failureThreshold = 3, resetTimeoutMs = 8000 }: CircuitBreakerOptions) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  canRequest(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.resetTimeoutMs) {
        this.state = 'half_open';
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure() {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      this.openedAt = Date.now();
      console.warn(`[circuitBreaker] ${this.name} opened`, {
        failures: this.failures,
        resetTimeoutMs: this.resetTimeoutMs,
      });
    }
  }
}
