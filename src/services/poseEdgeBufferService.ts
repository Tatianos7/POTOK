import { pose3dService } from './pose3dService';

interface BufferedFrame {
  frameIndex: number;
  ts: string;
  joints: Array<{ jointName: string; x: number; y: number; z: number; confidence?: number | null }>;
  angles: Record<string, number>;
  biomechanics: { metrics: Record<string, number | null>; riskLevel: 'safe' | 'caution' | 'danger'; guardFlags: string[]; guardReason?: string };
  kinematics: { metrics: Record<string, number | null>; estimates: Record<string, number | null> & { guardFlags?: string[] } };
}

class PoseEdgeBufferService {
  private frames: BufferedFrame[] = [];

  bufferFrame(frame: BufferedFrame): void {
    this.frames.push(frame);
  }

  async flush(userId: string, session3dId: string): Promise<void> {
    if (this.frames.length === 0) return;
    for (const frame of this.frames) {
      await pose3dService.addJoints(userId, session3dId, frame.frameIndex, frame.ts, frame.joints);
      await pose3dService.addAngles(userId, session3dId, frame.frameIndex, frame.ts, frame.angles);
      await pose3dService.addBiomechanics(userId, session3dId, {
        frameIndex: frame.frameIndex,
        ts: frame.ts,
        metrics: frame.biomechanics.metrics,
        riskLevel: frame.biomechanics.riskLevel,
        guardFlags: frame.biomechanics.guardFlags,
        guardReason: frame.biomechanics.guardReason,
      });
      await pose3dService.addKinematics(userId, session3dId, {
        frameIndex: frame.frameIndex,
        ts: frame.ts,
        metrics: frame.kinematics.metrics,
        estimates: frame.kinematics.estimates,
      });
    }
    this.frames = [];
  }
}

export const poseEdgeBufferService = new PoseEdgeBufferService();
