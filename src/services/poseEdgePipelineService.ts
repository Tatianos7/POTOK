import { computePoseAngles } from '../utils/poseMath';
import { computePose3dAngles, toPose3dPoints } from '../utils/pose3dMath';
import { computeBiomechanics, assessRisk } from '../utils/poseBiomechanics';
import { computeDepthMetrics, computeKinematics, estimateLoad } from '../utils/poseKinematics';
import { aggregateSeverity, evaluateTechnique, ExerciseTemplate } from '../utils/poseTemplates';

export interface EdgePipelineInput {
  poseLandmarks: Array<{ x: number; y: number; z?: number; visibility?: number }>;
  template: ExerciseTemplate;
  nowMs: number;
}

export interface EdgePipelineOutput {
  severityRaw: 'green' | 'yellow' | 'red';
  stableSeverity: 'green' | 'yellow' | 'red';
  angles2d: ReturnType<typeof computePoseAngles>;
  angles3d: ReturnType<typeof computePose3dAngles>;
  deviations: ReturnType<typeof evaluateTechnique>;
  biomechanics: ReturnType<typeof computeBiomechanics>;
  riskLevel: 'safe' | 'caution' | 'danger';
  guardReason?: string;
  guardFlags: string[];
  depthMetrics: ReturnType<typeof computeDepthMetrics>;
  kinematics: ReturnType<typeof computeKinematics>;
  load: ReturnType<typeof estimateLoad>;
}

export class PoseEdgePipelineService {
  private lastDepth = 0;
  private lastVelocity = 0;
  private lastTs: number | null = null;
  private velocityLoss = 0;
  private depthRange = { minDepth: Infinity, maxDepth: -Infinity };
  private hipDepthWindow: number[] = [];
  private severityWindow: Array<{ ts: number; value: number }> = [];
  private lastSwitchAt = 0;

  reset(): void {
    this.lastDepth = 0;
    this.lastVelocity = 0;
    this.lastTs = null;
    this.velocityLoss = 0;
    this.depthRange = { minDepth: Infinity, maxDepth: -Infinity };
    this.hipDepthWindow = [];
    this.severityWindow = [];
    this.lastSwitchAt = 0;
  }

  private toSeverityValue(sev: 'green' | 'yellow' | 'red'): number {
    if (sev === 'red') return 1;
    if (sev === 'yellow') return 0.5;
    return 0;
  }

  private toSeverity(avg: number): 'green' | 'yellow' | 'red' {
    if (avg > 0.7) return 'red';
    if (avg > 0.35) return 'yellow';
    return 'green';
  }

  process(input: EdgePipelineInput): EdgePipelineOutput {
    const landmarks3d = toPose3dPoints(input.poseLandmarks);
    const angles2d = computePoseAngles(input.poseLandmarks as any);
    const angles3d = computePose3dAngles(landmarks3d);
    const deviations = evaluateTechnique(angles2d, input.template);
    const severityRaw = aggregateSeverity(deviations);

    this.severityWindow = this.severityWindow.filter((item) => input.nowMs - item.ts < 450);
    this.severityWindow.push({ ts: input.nowMs, value: this.toSeverityValue(severityRaw) });
    const avgSeverity = this.severityWindow.reduce((sum, v) => sum + v.value, 0) / this.severityWindow.length;
    let stableSeverity = this.toSeverity(avgSeverity);
    if (input.nowMs - this.lastSwitchAt > 400) {
      this.lastSwitchAt = input.nowMs;
    } else {
      stableSeverity = this.toSeverity(this.severityWindow[this.severityWindow.length - 1]?.value ?? 0);
    }

    const biomechanics = computeBiomechanics(landmarks3d, angles3d);
    const risk = assessRisk(biomechanics);

    const depthMetrics = computeDepthMetrics(landmarks3d, this.depthRange);
    this.depthRange = {
      minDepth: Math.min(this.depthRange.minDepth, depthMetrics.hipDepth),
      maxDepth: Math.max(this.depthRange.maxDepth, depthMetrics.hipDepth),
    };

    const dt = this.lastTs ? (input.nowMs - this.lastTs) / 1000 : 0;
    this.lastTs = input.nowMs;
    this.hipDepthWindow.push(depthMetrics.hipDepth);
    if (this.hipDepthWindow.length > 5) this.hipDepthWindow.shift();
    const smoothedDepth = this.hipDepthWindow.reduce((s, v) => s + v, 0) / this.hipDepthWindow.length;

    const kinematics = computeKinematics(smoothedDepth, this.lastDepth, this.lastVelocity, dt);
    this.lastDepth = smoothedDepth;
    this.lastVelocity = kinematics.velocity;
    this.velocityLoss = Math.max(this.velocityLoss, Math.abs(kinematics.velocity));

    const load = estimateLoad(
      kinematics.velocity,
      depthMetrics.romPercent,
      biomechanics.asymmetryIndex,
      this.velocityLoss,
      biomechanics.lumbarShearProxy
    );

    let riskLevel = risk.riskLevel;
    let guardReason = risk.guardReason;
    const guardFlags = [...risk.guardFlags, ...load.guardFlags];
    if (load.guardFlags.includes('velocity_drop_risk')) {
      riskLevel = riskLevel === 'danger' ? 'danger' : 'caution';
      guardReason = guardReason ? `${guardReason},velocity_drop_risk` : 'velocity_drop_risk';
    }
    if (load.guardFlags.includes('depth_insufficient')) {
      riskLevel = riskLevel === 'danger' ? 'danger' : 'caution';
      guardReason = guardReason ? `${guardReason},depth_insufficient` : 'depth_insufficient';
    }

    return {
      severityRaw,
      stableSeverity,
      angles2d,
      angles3d,
      deviations,
      biomechanics,
      riskLevel,
      guardReason,
      guardFlags,
      depthMetrics,
      kinematics,
      load,
    };
  }
}

export const poseEdgePipelineService = new PoseEdgePipelineService();
