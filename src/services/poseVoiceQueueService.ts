import { supabase } from '../lib/supabaseClient';

export type PoseCueType = 'safety_alert' | 'form_correction' | 'tempo_cue' | 'fatigue_warning' | 'motivation';
export type PoseCuePriority = 'high' | 'medium' | 'low';

export interface PoseCueInput {
  userId: string;
  session3dId: string;
  type: PoseCueType;
  priority: PoseCuePriority;
  message: string;
  spatialPan?: number;
}

const COOLDOWNS_MS: Record<PoseCueType, number> = {
  safety_alert: 0,
  form_correction: 5000,
  tempo_cue: 10000,
  fatigue_warning: 6000,
  motivation: 45000,
};

class PoseVoiceQueueService {
  private isSpeaking = false;
  private queue: Array<{ priority: number; cue: PoseCueInput }> = [];
  private lastCueAt: Record<string, number> = {};
  private externalSpeaker?: (cue: PoseCueInput) => Promise<void> | void;

  private priorityValue(priority: PoseCuePriority): number {
    if (priority === 'high') return 3;
    if (priority === 'medium') return 2;
    return 1;
  }

  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }
    if (userId && userId !== data.user.id) {
      console.warn('[poseVoiceQueueService] Передан userId не совпадает с сессией');
    }
    return data.user.id;
  }

  private async logCue(input: PoseCueInput): Promise<void> {
    if (!supabase) return;
    await this.getSessionUserId(input.userId);
    await supabase.from('pose_voice_cues').insert({
      pose_3d_session_id: input.session3dId,
      cue_type: input.type,
      priority: input.priority,
      message: input.message,
    });
  }

  async enqueue(input: PoseCueInput): Promise<void> {
    const key = `${input.session3dId}_${input.type}`;
    const now = Date.now();
    const last = this.lastCueAt[key] ?? 0;
    const cooldown = COOLDOWNS_MS[input.type] ?? 5000;
    if (now - last < cooldown) return;

    this.lastCueAt[key] = now;
    this.queue.push({ priority: this.priorityValue(input.priority), cue: input });
    this.queue.sort((a, b) => b.priority - a.priority);

    if (!this.isSpeaking) {
      await this.playNext();
    }
  }

  async enqueuePreempt(input: PoseCueInput): Promise<void> {
    this.queue = [];
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    await this.enqueue(input);
  }

  setExternalSpeaker(handler: (cue: PoseCueInput) => Promise<void> | void): void {
    this.externalSpeaker = handler;
  }

  private async playNext(): Promise<void> {
    const next = this.queue.shift();
    if (!next) {
      this.isSpeaking = false;
      return;
    }

    this.isSpeaking = true;
    await this.logCue(next.cue);

    if (this.externalSpeaker) {
      await this.externalSpeaker(next.cue);
      this.isSpeaking = false;
      await this.playNext();
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(next.cue.message);
      utterance.lang = 'ru-RU';
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = next.cue.spatialPan !== undefined ? Math.max(0.2, 1 - Math.abs(next.cue.spatialPan)) : 1;
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

export const poseVoiceQueueService = new PoseVoiceQueueService();
