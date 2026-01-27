export interface PosePoint3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

const toVec = (p1: PosePoint3D, p2: PosePoint3D) => ({
  x: p2.x - p1.x,
  y: p2.y - p1.y,
  z: p2.z - p1.z,
});

const dot = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  a.x * b.x + a.y * b.y + a.z * b.z;

const magnitude = (v: { x: number; y: number; z: number }) =>
  Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

export const calcAngle3d = (a: PosePoint3D, b: PosePoint3D, c: PosePoint3D): number => {
  const ba = toVec(b, a);
  const bc = toVec(b, c);
  const denom = magnitude(ba) * magnitude(bc);
  if (denom === 0) return 0;
  const cos = Math.min(1, Math.max(-1, dot(ba, bc) / denom));
  return (Math.acos(cos) * 180) / Math.PI;
};

export interface Pose3dAngles {
  leftKnee: number;
  rightKnee: number;
  leftHip: number;
  rightHip: number;
  leftShoulder: number;
  rightShoulder: number;
  spine: number;
}

export const computePose3dAngles = (landmarks: PosePoint3D[]): Pose3dAngles => {
  const lHip = landmarks[23];
  const rHip = landmarks[24];
  const lKnee = landmarks[25];
  const rKnee = landmarks[26];
  const lAnkle = landmarks[27];
  const rAnkle = landmarks[28];
  const lShoulder = landmarks[11];
  const rShoulder = landmarks[12];
  const lElbow = landmarks[13];
  const rElbow = landmarks[14];

  const leftKnee = calcAngle3d(lHip, lKnee, lAnkle);
  const rightKnee = calcAngle3d(rHip, rKnee, rAnkle);
  const leftHip = calcAngle3d(lShoulder, lHip, lKnee);
  const rightHip = calcAngle3d(rShoulder, rHip, rKnee);
  const leftShoulder = calcAngle3d(lElbow, lShoulder, lHip);
  const rightShoulder = calcAngle3d(rElbow, rShoulder, rHip);

  const midShoulder: PosePoint3D = {
    x: (lShoulder.x + rShoulder.x) / 2,
    y: (lShoulder.y + rShoulder.y) / 2,
    z: (lShoulder.z + rShoulder.z) / 2,
  };
  const midHip: PosePoint3D = {
    x: (lHip.x + rHip.x) / 2,
    y: (lHip.y + rHip.y) / 2,
    z: (lHip.z + rHip.z) / 2,
  };
  const kneeMid: PosePoint3D = {
    x: (lKnee.x + rKnee.x) / 2,
    y: (lKnee.y + rKnee.y) / 2,
    z: (lKnee.z + rKnee.z) / 2,
  };
  const spine = calcAngle3d(midShoulder, midHip, kneeMid);

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

export const toPose3dPoints = (landmarks: Array<{ x: number; y: number; z?: number; visibility?: number }>): PosePoint3D[] => {
  return landmarks.map((lm) => ({
    x: lm.x,
    y: lm.y,
    z: typeof lm.z === 'number' ? lm.z : 0,
    visibility: lm.visibility,
  }));
};
