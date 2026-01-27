import { supabase } from '../lib/supabaseClient';
import { poseGuardService, PoseGuardInput } from './poseGuardService';

export interface PoseSessionInput {
  workoutEntryId?: string | null;
  canonicalExerciseId?: string | null;
  deviceInfo?: Record<string, unknown> | null;
}

export interface PoseFrameInput {
  frameIndex: number;
  ts: string;
  qualityScore?: number | null;
}

export interface PoseJointInput {
  jointName: string;
  x?: number | null;
  y?: number | null;
  z?: number | null;
  confidence?: number | null;
}

export interface PoseDeviationInput {
  joint: string;
  observed: number;
  expectedMin: number;
  expectedMax: number;
  severity: 'green' | 'yellow' | 'red';
}

export interface PoseProcessInput {
  frameIndex: number;
  ts: string;
  joints: PoseJointInput[];
  angles: Record<string, number>;
  deviations: PoseDeviationInput[];
  guardInput: PoseGuardInput;
  qualityScore?: number | null;
}

class PoseService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[poseService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  async startSession(userId: string, input: PoseSessionInput): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);

    const { data, error } = await supabase
      .from('pose_sessions')
      .insert({
        user_id: sessionUserId,
        workout_entry_id: input.workoutEntryId ?? null,
        canonical_exercise_id: input.canonicalExerciseId ?? null,
        device_info: input.deviceInfo ?? null,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to start pose session');
    }

    return data.id as string;
  }

  async addFrame(userId: string, sessionId: string, input: PoseFrameInput): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    await this.getSessionUserId(userId);

    const { data, error } = await supabase
      .from('pose_frames')
      .insert({
        pose_session_id: sessionId,
        frame_index: input.frameIndex,
        ts: input.ts,
        quality_score: input.qualityScore ?? null,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to insert pose frame');
    }

    return data.id as string;
  }

  async addJoints(userId: string, frameId: string, joints: PoseJointInput[]): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    await this.getSessionUserId(userId);

    const payload = joints.map((joint) => ({
      pose_frame_id: frameId,
      joint_name: joint.jointName,
      x: joint.x ?? null,
      y: joint.y ?? null,
      z: joint.z ?? null,
      confidence: joint.confidence ?? null,
    }));

    const { error } = await supabase.from('pose_joints').insert(payload);
    if (error) {
      throw error;
    }
  }

  async addAngles(userId: string, frameId: string, angles: Record<string, number>): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    await this.getSessionUserId(userId);

    const { error } = await supabase.from('pose_angles').insert({
      pose_frame_id: frameId,
      angles,
    });

    if (error) {
      throw error;
    }
  }

  async addDeviations(userId: string, frameId: string, deviations: PoseDeviationInput[]): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    await this.getSessionUserId(userId);

    if (!deviations.length) return;

    const payload = deviations.map((dev) => ({
      pose_frame_id: frameId,
      joint: dev.joint,
      observed: dev.observed,
      expected_min: dev.expectedMin,
      expected_max: dev.expectedMax,
      severity: dev.severity,
    }));

    const { error } = await supabase.from('pose_deviations').insert(payload);
    if (error) {
      throw error;
    }
  }

  async evaluateAndStoreGuard(userId: string, sessionId: string, input: PoseGuardInput): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    await this.getSessionUserId(userId);

    const result = poseGuardService.evaluateSafety(input);
    if (result.flags.length === 0) return;

    const payload = result.flags.map((flag) => ({
      pose_session_id: sessionId,
      flag_type: flag.flag_type,
      severity: flag.severity,
      details: flag.details ?? null,
    }));

    const { error } = await supabase.from('pose_guard_flags').insert(payload);
    if (error) {
      throw error;
    }
  }

  async saveQualityScores(
    userId: string,
    sessionId: string,
    scores: { poseQualityScore: number; stabilityScore?: number | null; symmetryScore?: number | null; tempoScore?: number | null }
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    await this.getSessionUserId(userId);

    const { error } = await supabase.from('pose_quality_scores').insert({
      pose_session_id: sessionId,
      pose_quality_score: scores.poseQualityScore,
      stability_score: scores.stabilityScore ?? null,
      symmetry_score: scores.symmetryScore ?? null,
      tempo_score: scores.tempoScore ?? null,
    });

    if (error) {
      throw error;
    }
  }

  async closeSession(userId: string, sessionId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    await this.getSessionUserId(userId);

    const { error } = await supabase
      .from('pose_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) {
      throw error;
    }
  }

  async processFrame(userId: string, sessionId: string, input: PoseProcessInput): Promise<{ frameId: string; guardSafe: boolean }> {
    const frameId = await this.addFrame(userId, sessionId, {
      frameIndex: input.frameIndex,
      ts: input.ts,
      qualityScore: input.qualityScore ?? null,
    });

    await Promise.all([
      this.addJoints(userId, frameId, input.joints),
      this.addAngles(userId, frameId, input.angles),
      this.addDeviations(userId, frameId, input.deviations),
    ]);

    const guard = poseGuardService.evaluateSafety(input.guardInput);
    if (!guard.safe) {
      await this.evaluateAndStoreGuard(userId, sessionId, input.guardInput);
    }

    return { frameId, guardSafe: guard.safe };
  }
}

export const poseService = new PoseService();
