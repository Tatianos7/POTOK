import { supabase } from '../lib/supabaseClient';

export type PoseCueType = 'safety_alert' | 'form_correction' | 'tempo_cue' | 'fatigue_warning' | 'motivation';
export type PoseCuePriority = 'high' | 'medium' | 'low';

export interface PoseCueInput {
  userId: string;
  session3dId: string;
  type: PoseCueType;
  priority: PoseCuePriority;
  message: string;
  cooldownMs?: number;
}

class PoseVoiceCueService {
  private lastCueAt: Record<string, number> = {};
  private isSpeaking = false;
  private queue: Array<{ priority: number; cue: PoseCueInput }> = [];

  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[poseVoiceCueService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  private priorityValue(priority: PoseCuePriority): number {
    if (priority === 'high') return 3;
    if (priority === 'medium') return 2;
    return 1;
  }

  private async logCue(userId: string, session3dId: string, input: PoseCueInput): Promise<void> {
    if (!supabase) return;
    await this.getSessionUserId(userId);
    await supabase.from('pose_voice_cues').insert({
      pose_3d_session_id: session3dId,
      cue_type: input.type,
      priority: input.priority,
      message: input.message,
    });
  }

  async enqueue(input: PoseCueInput): Promise<void> {
    const cooldown = input.cooldownMs ?? 4000;
    const key = `${input.session3dId}_${input.type}`;
    const last = this.lastCueAt[key] ?? 0;
    const now = Date.now();
    if (now - last < cooldown) return;

    this.lastCueAt[key] = now;
    this.queue.push({ priority: this.priorityValue(input.priority), cue: input });
    this.queue.sort((a, b) => b.priority - a.priority);

    if (!this.isSpeaking) {
      await this.playNext();
    }
  }

  private async playNext(): Promise<void> {
    const next = this.queue.shift();
    if (!next) {
      this.isSpeaking = false;
      return;
    }

    const cue = next.cue;
    this.isSpeaking = true;
    await this.logCue(cue.userId, cue.session3dId, cue);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(cue.message);
      utterance.lang = 'ru-RU';
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onend = () => {
        this.isSpeaking = false;
        this.playNext();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } else {
      this.isSpeaking = false;
      await this.playNext();
    }
  }
}

export const poseVoiceCueService = new PoseVoiceCueService();
