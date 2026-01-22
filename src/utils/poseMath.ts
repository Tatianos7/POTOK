export interface PosePoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

const toVec = (p1: PosePoint, p2: PosePoint) => ({ x: p2.x - p1.x, y: p2.y - p1.y });

const dot = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x * b.x + a.y * b.y;

const magnitude = (v: { x: number; y: number }) => Math.sqrt(v.x * v.x + v.y * v.y);

export const calcAngle = (a: PosePoint, b: PosePoint, c: PosePoint): number => {
  const ba = toVec(b, a);
  const bc = toVec(b, c);
  const denom = magnitude(ba) * magnitude(bc);
  if (denom === 0) return 0;
  const cos = Math.min(1, Math.max(-1, dot(ba, bc) / denom));
  return (Math.acos(cos) * 180) / Math.PI;
};

export interface PoseAngles {
  leftKnee: number;
  rightKnee: number;
  leftHip: number;
  rightHip: number;
  leftShoulder: number;
  rightShoulder: number;
  spine: number;
}

export const computePoseAngles = (landmarks: PosePoint[]): PoseAngles => {
  const lHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
  const lKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
  const rKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
  const lAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
  const rAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
  const lShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
  const lElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
  const rElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];

  const leftKnee = calcAngle(lHip, lKnee, lAnkle);
  const rightKnee = calcAngle(rHip, rKnee, rAnkle);
  const leftHip = calcAngle(lShoulder, lHip, lKnee);
  const rightHip = calcAngle(rShoulder, rHip, rKnee);
  const leftShoulder = calcAngle(lElbow, lShoulder, lHip);
  const rightShoulder = calcAngle(rElbow, rShoulder, rHip);

  const midShoulder: PosePoint = {
    x: (lShoulder.x + rShoulder.x) / 2,
    y: (lShoulder.y + rShoulder.y) / 2,
  };
  const midHip: PosePoint = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
  const kneeMid: PosePoint = { x: (lKnee.x + rKnee.x) / 2, y: (lKnee.y + rKnee.y) / 2 };
  const spine = calcAngle(midShoulder, midHip, kneeMid);

  return {
    leftKnee,
    rightKnee,
    leftHip,
    rightHip,
    leftShoulder,
    rightShoulder,
    spine,
  };
};

export const computeConfidence = (landmarks: PosePoint[]): number => {
  const vis = landmarks.map((lm) => Number.isFinite(lm.visibility) ? (lm.visibility as number) : 1);
  const sum = vis.reduce((acc, v) => acc + v, 0);
  return vis.length ? sum / vis.length : 0;
};
