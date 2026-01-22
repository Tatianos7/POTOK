import { supabase } from '../lib/supabaseClient';

export interface Pose3dSessionInput {
  poseSessionId?: string | null;
  workoutEntryId?: string | null;
  canonicalExerciseId?: string | null;
  deviceInfo?: Record<string, unknown> | null;
}

export interface Pose3dJointInput {
  jointName: string;
  x: number;
  y: number;
  z: number;
  confidence?: number | null;
}

export interface Pose3dBiomechanicsInput {
  frameIndex: number;
  ts: string;
  metrics: Record<string, number | null>;
  riskLevel: 'safe' | 'caution' | 'danger';
  guardFlags: string[];
  guardReason?: string;
}

export interface Pose3dKinematicsInput {
  frameIndex: number;
  ts: string;
  metrics: Record<string, number | null>;
  estimates: Record<string, number | null> & { guardFlags?: string[] };
}

class Pose3dService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[pose3dService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  async startSession(userId: string, input: Pose3dSessionInput): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);

    const { data, error } = await supabase
      .from('pose_3d_sessions')
      .insert({
        user_id: sessionUserId,
        pose_session_id: input.poseSessionId ?? null,
        workout_entry_id: input.workoutEntryId ?? null,
        canonical_exercise_id: input.canonicalExerciseId ?? null,
        device_info: input.deviceInfo ?? null,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to start 3d pose session');
    }

    return data.id as string;
  }

  async addJoints(userId: string, sessionId: string, frameIndex: number, ts: string, joints: Pose3dJointInput[]): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    await this.getSessionUserId(userId);

    if (!joints.length) return;

    const payload = joints.map((joint) => ({
      pose_3d_session_id: sessionId,
      frame_index: frameIndex,
      ts,
      joint_name: joint.jointName,
      x: joint.x,
      y: joint.y,
      z: joint.z,
      confidence: joint.confidence ?? null,
    }));

    const { error } = await supabase.from('pose_3d_joints').insert(payload);
    if (error) {
      throw error;
    }
  }

  async addAngles(userId: string, sessionId: string, frameIndex: number, ts: string, angles: Record<string, number>): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    await this.getSessionUserId(userId);

    const { error } = await supabase.from('pose_3d_angles').insert({
      pose_3d_session_id: sessionId,
      frame_index: frameIndex,
      ts,
      angles,
    });

    if (error) {
      throw error;
    }
  }

  async addBiomechanics(userId: string, sessionId: string, input: Pose3dBiomechanicsInput): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    await this.getSessionUserId(userId);

    const [{ error: metricsError }, { error: riskError }] = await Promise.all([
      supabase.from('pose_biomechanics').insert({
        pose_3d_session_id: sessionId,
        frame_index: input.frameIndex,
        ts: input.ts,
        metrics: input.metrics,
      }),
      supabase.from('pose_risk_assessments').insert({
        pose_3d_session_id: sessionId,
        frame_index: input.frameIndex,
        ts: input.ts,
        risk_level: input.riskLevel,
        guard_flags: input.guardFlags,
        guard_reason: input.guardReason ?? null,
      }),
    ]);

    if (metricsError || riskError) {
      throw metricsError || riskError;
    }
  }

  async addKinematics(userId: string, sessionId: string, input: Pose3dKinematicsInput): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    await this.getSessionUserId(userId);

    const [{ error: metricsError }, { error: loadError }] = await Promise.all([
      supabase.from('pose_3d_metrics').insert({
        pose_3d_session_id: sessionId,
        frame_index: input.frameIndex,
        ts: input.ts,
        metrics: input.metrics,
      }),
      supabase.from('pose_load_estimates').insert({
        pose_3d_session_id: sessionId,
        frame_index: input.frameIndex,
        ts: input.ts,
        estimates: input.estimates,
      }),
    ]);

    if (metricsError || loadError) {
      throw metricsError || loadError;
    }
  }

  async closeSession(userId: string, sessionId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    await this.getSessionUserId(userId);

    const { error } = await supabase
      .from('pose_3d_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) {
      throw error;
    }
  }
}

export const pose3dService = new Pose3dService();
