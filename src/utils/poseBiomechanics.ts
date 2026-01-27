import type { PosePoint3D, Pose3dAngles } from './pose3dMath';

export interface BiomechanicsMetrics {
  kneeValgus: number;
  hipHingeDeviation: number;
  lumbarShearProxy: number;
  trunkForwardLean: number;
  asymmetryIndex: number;
  barPathDeviation: number | null;
}

export type RiskLevel = 'safe' | 'caution' | 'danger';

export interface RiskAssessment {
  riskLevel: RiskLevel;
  guardFlags: string[];
  guardReason?: string;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const distance2d = (a: PosePoint3D, b: PosePoint3D) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

export const computeBiomechanics = (
  landmarks: PosePoint3D[],
  angles: Pose3dAngles
): BiomechanicsMetrics => {
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];

  const kneeValgusLeft = leftKnee && leftAnkle ? (leftKnee.x - leftAnkle.x) : 0;
  const kneeValgusRight = rightKnee && rightAnkle ? (rightAnkle.x - rightKnee.x) : 0;
  const kneeValgus = Math.max(Math.abs(kneeValgusLeft), Math.abs(kneeValgusRight));

  const hipDepth = leftHip && rightHip ? (leftHip.z + rightHip.z) / 2 : 0;
  const shoulderDepth = leftShoulder && rightShoulder ? (leftShoulder.z + rightShoulder.z) / 2 : 0;
  const trunkForwardLean = Math.abs(shoulderDepth - hipDepth);

  const hipHingeDeviation = Math.abs(angles.spine - 150) / 50;
  const lumbarShearProxy = clamp(trunkForwardLean * 2 + Math.abs(angles.spine - 150) / 90, 0, 1);

  const asymmetryIndex = clamp(
    (Math.abs(angles.leftKnee - angles.rightKnee) + Math.abs(angles.leftHip - angles.rightHip)) / 180,
    0,
    1
  );

  let barPathDeviation: number | null = null;
  if (leftShoulder && rightShoulder) {
    const shoulderSpan = distance2d(leftShoulder, rightShoulder);
    barPathDeviation = shoulderSpan ? clamp(Math.abs(leftShoulder.z - rightShoulder.z) / shoulderSpan, 0, 1) : null;
  }

  return {
    kneeValgus: Math.abs(kneeValgus),
    hipHingeDeviation: clamp(hipHingeDeviation, 0, 1),
    lumbarShearProxy,
    trunkForwardLean: clamp(trunkForwardLean, 0, 1),
    asymmetryIndex,
    barPathDeviation,
  };
};

export const assessRisk = (metrics: BiomechanicsMetrics): RiskAssessment => {
  const guardFlags: string[] = [];

  if (metrics.kneeValgus > 0.05) guardFlags.push('knee_valgus_risk');
  if (metrics.lumbarShearProxy > 0.7) guardFlags.push('lumbar_shear_risk');
  if (metrics.hipHingeDeviation > 0.6) guardFlags.push('hip_hinge_deviation');
  if (metrics.asymmetryIndex > 0.4) guardFlags.push('asymmetry_overload');

  let riskLevel: RiskLevel = 'safe';
  if (guardFlags.length > 0) {
    riskLevel = guardFlags.some((flag) => flag === 'lumbar_shear_risk' || flag === 'knee_valgus_risk')
      ? 'danger'
      : 'caution';
  }

  const guardReason = guardFlags.length ? guardFlags.join(',') : undefined;

  return { riskLevel, guardFlags, guardReason };
};
