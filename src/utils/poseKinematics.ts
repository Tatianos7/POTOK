import type { PosePoint3D } from './pose3dMath';

export interface DepthMetrics {
  hipDepth: number;
  kneeDepth: number;
  shoulderDepth: number;
  verticalDisplacement: number;
  romPercent: number;
  bottomDetected: boolean;
}

export interface KinematicMetrics {
  velocity: number;
  acceleration: number;
  tempoRatio: number;
  pauseDetected: boolean;
}

export interface LoadEstimates {
  relativeLoadProxy: number;
  fatigueIndex: number;
  rpeProxy: number;
  volumeStressScore: number;
  guardFlags: string[];
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const computeDepthMetrics = (
  landmarks: PosePoint3D[],
  baseline?: { minDepth: number; maxDepth: number }
): DepthMetrics => {
  const lHip = landmarks[23];
  const rHip = landmarks[24];
  const lKnee = landmarks[25];
  const rKnee = landmarks[26];
  const lShoulder = landmarks[11];
  const rShoulder = landmarks[12];

  const hipDepth = lHip && rHip ? (lHip.z + rHip.z) / 2 : 0;
  const kneeDepth = lKnee && rKnee ? (lKnee.z + rKnee.z) / 2 : 0;
  const shoulderDepth = lShoulder && rShoulder ? (lShoulder.z + rShoulder.z) / 2 : 0;
  const verticalDisplacement = lHip && rHip ? Math.abs(lHip.y - rHip.y) : 0;

  const minDepth = baseline?.minDepth ?? hipDepth;
  const maxDepth = baseline?.maxDepth ?? hipDepth;
  const range = Math.max(1e-4, maxDepth - minDepth);
  const romPercent = clamp((hipDepth - minDepth) / range, 0, 1);

  const bottomDetected = romPercent > 0.9;

  return {
    hipDepth,
    kneeDepth,
    shoulderDepth,
    verticalDisplacement,
    romPercent,
    bottomDetected,
  };
};

export const computeKinematics = (
  currentDepth: number,
  prevDepth: number,
  prevVelocity: number,
  dtSeconds: number
): KinematicMetrics => {
  const velocity = dtSeconds > 0 ? (currentDepth - prevDepth) / dtSeconds : 0;
  const acceleration = dtSeconds > 0 ? (velocity - prevVelocity) / dtSeconds : 0;

  const eccentric = Math.max(0.001, Math.abs(Math.min(velocity, 0)));
  const concentric = Math.max(0.001, Math.abs(Math.max(velocity, 0)));
  const tempoRatio = eccentric / concentric;
  const pauseDetected = Math.abs(velocity) < 0.01;

  return { velocity, acceleration, tempoRatio: clamp(tempoRatio, 0, 3), pauseDetected };
};

export const estimateLoad = (
  velocity: number,
  depthPercent: number,
  asymmetryIndex: number,
  velocityLoss: number,
  lumbarShearProxy?: number
): LoadEstimates => {
  const relativeLoadProxy = clamp((1 - Math.abs(velocity)) * depthPercent, 0, 1);
  const fatigueIndex = clamp(velocityLoss, 0, 1);
  const rpeProxy = clamp(0.6 * velocityLoss + 0.4 * asymmetryIndex, 0, 1);
  const volumeStressScore = clamp(depthPercent * (1 - Math.abs(velocity)), 0, 1);

  const guardFlags: string[] = [];
  if (depthPercent < 0.3) guardFlags.push('depth_insufficient');
  if (velocityLoss > 0.35) guardFlags.push('velocity_drop_risk');
  if (asymmetryIndex > 0.45) guardFlags.push('asymmetry_fatigue');
  if ((lumbarShearProxy ?? 0) > 0.7 && Math.abs(velocity) > 0.04) {
    guardFlags.push('shear_under_load');
  }

  return {
    relativeLoadProxy,
    fatigueIndex,
    rpeProxy,
    volumeStressScore,
    guardFlags,
  };
};
