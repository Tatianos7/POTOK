export type TechniqueSeverity = 'green' | 'yellow' | 'red';
export type RealtimeEvent = 'technique_error' | 'fatigue_warning' | 'overload_stop' | 'none';

export interface RealtimeFeedbackInput {
  ts: number;
  severity: TechniqueSeverity;
  riskLevel: 'safe' | 'caution' | 'danger';
  fatigueIndex: number | null;
  guardReason?: string;
  trustScore: number | null;
  allowRealtime: boolean;
}

export interface RealtimeFeedbackOutput {
  stableSeverity: TechniqueSeverity;
  event: RealtimeEvent;
  priority: 'high' | 'medium' | 'low' | 'none';
}

class PoseRealtimeFeedbackService {
  private windowMs = 450;
  private minSwitchMs = 400;
  private lastSwitchAt = 0;
  private buffer: Array<{ ts: number; value: number }> = [];

  private toValue(severity: TechniqueSeverity): number {
    if (severity === 'red') return 1;
    if (severity === 'yellow') return 0.5;
    return 0;
  }

  private toSeverity(avg: number): TechniqueSeverity {
    if (avg > 0.7) return 'red';
    if (avg > 0.35) return 'yellow';
    return 'green';
  }

  update(input: RealtimeFeedbackInput): RealtimeFeedbackOutput {
    if (!input.allowRealtime) {
      return { stableSeverity: 'green', event: 'none', priority: 'none' };
    }

    const now = input.ts;
    this.buffer = this.buffer.filter((item) => now - item.ts < this.windowMs);
    this.buffer.push({ ts: now, value: this.toValue(input.severity) });
    const avg = this.buffer.reduce((sum, item) => sum + item.value, 0) / this.buffer.length;

    let stableSeverity: TechniqueSeverity = this.toSeverity(avg);
    if (now - this.lastSwitchAt < this.minSwitchMs) {
      stableSeverity = this.toSeverity(this.buffer[this.buffer.length - 1]?.value ?? 0);
    } else {
      this.lastSwitchAt = now;
    }

    if (input.riskLevel === 'danger') {
      return { stableSeverity, event: 'overload_stop', priority: 'high' };
    }

    if (input.guardReason?.includes('velocity_drop_risk') || (input.fatigueIndex ?? 0) > 0.35) {
      return { stableSeverity, event: 'fatigue_warning', priority: 'medium' };
    }

    const trust = input.trustScore ?? 0;
    if (trust < 40) {
      return { stableSeverity, event: 'none', priority: 'none' };
    }

    if (stableSeverity === 'yellow' || stableSeverity === 'red') {
      return { stableSeverity, event: 'technique_error', priority: stableSeverity === 'red' ? 'high' : 'medium' };
    }

    return { stableSeverity, event: 'none', priority: 'none' };
  }
}

export const poseRealtimeFeedbackService = new PoseRealtimeFeedbackService();
