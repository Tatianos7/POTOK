export interface JointAngleLimits {
  joint: string;
  min: number;
  max: number;
}

export interface PoseLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface PoseGuardInput {
  angles: Record<string, number>;
  asymmetry?: Record<string, number>;
  confidence?: number;
  landmarks?: PoseLandmark[];
}

export interface PoseGuardFlag {
  flag_type: string;
  severity: 'low' | 'medium' | 'high';
  details?: Record<string, unknown>;
}

export interface PoseGuardResult {
  flags: PoseGuardFlag[];
  safe: boolean;
}

const DEFAULT_LIMITS: JointAngleLimits[] = [
  { joint: 'knee', min: 30, max: 170 },
  { joint: 'hip', min: 30, max: 170 },
  { joint: 'shoulder', min: 10, max: 170 },
  { joint: 'elbow', min: 20, max: 170 },
];

const CONFIDENCE_THRESHOLD = 0.6;
const ASYMMETRY_THRESHOLD = 0.25;
const KNEE_VALGUS_THRESHOLD = 0.04;
const BACK_HYPEREXT_THRESHOLD = 140;

export class PoseGuardService {
  evaluateSafety(input: PoseGuardInput, limits: JointAngleLimits[] = DEFAULT_LIMITS): PoseGuardResult {
    const flags: PoseGuardFlag[] = [];

    if (typeof input.confidence === 'number' && input.confidence < CONFIDENCE_THRESHOLD) {
      flags.push({
        flag_type: 'low_confidence',
        severity: 'high',
        details: { confidence: input.confidence },
      });
    }

    for (const limit of limits) {
      const value = input.angles[limit.joint];
      if (typeof value !== 'number') continue;
      if (value < limit.min || value > limit.max) {
        flags.push({
          flag_type: 'joint_limit',
          severity: value < limit.min - 10 || value > limit.max + 10 ? 'high' : 'medium',
          details: { joint: limit.joint, value, min: limit.min, max: limit.max },
        });
      }
    }

    if (input.asymmetry) {
      Object.entries(input.asymmetry).forEach(([key, value]) => {
        if (value > ASYMMETRY_THRESHOLD) {
          flags.push({
            flag_type: 'asymmetry',
            severity: value > 0.4 ? 'high' : 'medium',
            details: { axis: key, value },
          });
        }
      });
    }

    if (input.landmarks && input.landmarks.length > 28) {
      const leftKnee = input.landmarks[25];
      const rightKnee = input.landmarks[26];
      const leftAnkle = input.landmarks[27];
      const rightAnkle = input.landmarks[28];
      const leftHip = input.landmarks[23];
      const rightHip = input.landmarks[24];

      if (leftKnee && leftAnkle && leftHip) {
        const inward = leftKnee.x < leftAnkle.x - KNEE_VALGUS_THRESHOLD;
        if (inward) {
          flags.push({
            flag_type: 'knee_valgus',
            severity: 'high',
            details: { side: 'left', kneeX: leftKnee.x, ankleX: leftAnkle.x, hipX: leftHip.x },
          });
        }
      }

      if (rightKnee && rightAnkle && rightHip) {
        const inward = rightKnee.x > rightAnkle.x + KNEE_VALGUS_THRESHOLD;
        if (inward) {
          flags.push({
            flag_type: 'knee_valgus',
            severity: 'high',
            details: { side: 'right', kneeX: rightKnee.x, ankleX: rightAnkle.x, hipX: rightHip.x },
          });
        }
      }
    }

    const backAngle = input.angles.spine ?? input.angles.back;
    if (typeof backAngle === 'number' && backAngle < BACK_HYPEREXT_THRESHOLD) {
      flags.push({
        flag_type: 'lower_back_hyperextension',
        severity: 'high',
        details: { angle: backAngle },
      });
    }

    const highRisk = flags.some((f) => f.severity === 'high');
    return { flags, safe: !highRisk };
  }

  evaluate(input: PoseGuardInput, limits: JointAngleLimits[] = DEFAULT_LIMITS): PoseGuardResult {
    return this.evaluateSafety(input, limits);
  }
}

export const poseGuardService = new PoseGuardService();
