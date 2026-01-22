import { supabase } from '../lib/supabaseClient';
import { aiTrustService } from './aiTrustService';
import { aiNotificationScoringService } from './aiNotificationScoringService';

export type NotificationCategory = 'support' | 'messages' | 'news';

export interface ThreadMessage {
  id: string;
  text: string;
  isUser: boolean;
  date: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  date: string;
  category: NotificationCategory;
  isRead: boolean;
  isDeleted: boolean;
  isArchived: boolean;
}

export interface NotificationRuleInput {
  name: string;
  triggerType: string;
  priorityWeight?: number;
  cooldownHours?: number;
  active?: boolean;
}

export interface AttentionStateInput {
  chronotype?: string | null;
  preferredHours?: string | null;
  timezone?: string | null;
  fatigueScore?: number | null;
}

export interface NotificationEventInput {
  scoreId?: string | null;
  channel: string;
  messageId?: string | null;
  message?: string | null;
  explainability?: Record<string, unknown> | null;
}

export type NotificationFeedback = 'positive' | 'neutral' | 'negative';

class NotificationService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[notificationService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  async upsertRule(userId: string, input: NotificationRuleInput): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);

    const { error } = await supabase
      .from('notification_rules')
      .upsert(
        {
          user_id: sessionUserId,
          name: input.name,
          trigger_type: input.triggerType,
          priority_weight: input.priorityWeight ?? 1,
          cooldown_hours: input.cooldownHours ?? 24,
          active: input.active ?? true,
        },
        { onConflict: 'user_id,name,trigger_type' }
      );

    if (error) {
      throw error;
    }
  }

  async getActiveRules(userId: string): Promise<any[]> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { data, error } = await supabase
      .from('notification_rules')
      .select('*')
      .eq('user_id', sessionUserId)
      .eq('active', true)
      .order('priority_weight', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async upsertAttentionState(userId: string, input: AttentionStateInput): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);

    const { error } = await supabase
      .from('user_attention_state')
      .upsert(
        {
          user_id: sessionUserId,
          chronotype: input.chronotype ?? null,
          preferred_hours: input.preferredHours ?? null,
          timezone: input.timezone ?? null,
          fatigue_score: input.fatigueScore ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      throw error;
    }
  }

  async queueScore(userId: string, input: Parameters<typeof aiNotificationScoringService.queueScore>[1]): Promise<string> {
    return aiNotificationScoringService.queueScore(userId, input);
  }

  async scoreQueued(userId: string, period: { fromDate: string; toDate: string }) {
    return aiNotificationScoringService.scoreQueued(userId, period);
  }

  async createEvent(userId: string, input: NotificationEventInput): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);

    const { data, error } = await supabase
      .from('notification_history')
      .insert({
        user_id: sessionUserId,
        score_id: input.scoreId ?? null,
        channel: input.channel,
        message_id: input.messageId ?? null,
        message: input.message ?? null,
        status: 'queued',
        explainability: input.explainability ?? null,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to create notification event');
    }

    return data.id as string;
  }

  async markEventStatus(userId: string, eventId: string, status: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);

    const { error } = await supabase
      .from('notification_history')
      .update({ status, sent_at: status === 'sent' ? new Date().toISOString() : undefined })
      .eq('id', eventId)
      .eq('user_id', sessionUserId);

    if (error) {
      throw error;
    }
  }

  async submitFeedback(userId: string, eventId: string, feedback: NotificationFeedback, reason?: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);

    const { error } = await supabase
      .from('notification_feedback')
      .insert({
        user_id: sessionUserId,
        history_id: eventId,
        feedback,
        reason: reason ?? null,
      });

    if (error) {
      throw error;
    }

    const delta = feedback === 'positive' ? 2 : feedback === 'negative' ? -5 : 0;
    if (delta !== 0) {
      await aiTrustService.updateTrustScore(sessionUserId, delta);
    }

    if (feedback === 'negative') {
      await this.applySuppressionIfNeeded(sessionUserId);
    }
  }

  private async applySuppressionIfNeeded(userId: string): Promise<void> {
    if (!supabase) return;
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const { count } = await supabase
      .from('notification_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('feedback', 'negative')
      .gte('created_at', since);

    if ((count ?? 0) < 3) return;

    const untilTs = new Date(Date.now() + 3 * 86400000).toISOString();
    await supabase
      .from('notification_suppression')
      .upsert(
        {
          user_id: userId,
          reason: 'negative_feedback_streak',
          until_ts: untilTs,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
  }

  async getNotifications(userId: string): Promise<AppNotification[]> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { data, error } = await supabase
      .from('notification_history')
      .select('id,message,created_at,channel,explainability,status')
      .eq('user_id', sessionUserId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      title: row.explainability?.title ?? 'Уведомление',
      message: row.message ?? '',
      date: row.created_at,
      category: (row.explainability?.category ?? row.channel ?? 'messages') as NotificationCategory,
      isRead: row.explainability?.isRead ?? row.status === 'opened',
      isDeleted: row.explainability?.isDeleted ?? false,
      isArchived: row.explainability?.isArchived ?? false,
    }));
  }

  async saveNotifications(userId: string, items: AppNotification[]): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);

    await Promise.all(
      items.map((item) =>
        supabase
          .from('notification_history')
          .update({
            channel: item.category,
            message: item.message,
            explainability: {
              title: item.title,
              category: item.category,
              isRead: item.isRead,
              isDeleted: item.isDeleted,
              isArchived: item.isArchived,
            },
          })
          .eq('id', item.id)
          .eq('user_id', sessionUserId)
      )
    );
  }

  async addNotification(userId: string, input: Omit<AppNotification, 'id' | 'date' | 'isRead' | 'isDeleted' | 'isArchived'>): Promise<AppNotification> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);

    const { data, error } = await supabase
      .from('notification_history')
      .insert({
        user_id: sessionUserId,
        channel: input.category,
        message: input.message,
        status: 'delivered',
        explainability: {
          title: input.title,
          category: input.category,
          isRead: false,
          isDeleted: false,
          isArchived: false,
          thread: [],
        },
      })
      .select('id,created_at')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to create notification');
    }

    return {
      id: data.id,
      title: input.title,
      message: input.message,
      date: data.created_at,
      category: input.category,
      isRead: false,
      isDeleted: false,
      isArchived: false,
    };
  }

  private async getExplainability(userId: string, notificationId: string): Promise<Record<string, any> | null> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { data, error } = await supabase
      .from('notification_history')
      .select('explainability')
      .eq('id', notificationId)
      .eq('user_id', sessionUserId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data?.explainability ?? null) as Record<string, any> | null;
  }

  async getThread(userId: string, notificationId: string): Promise<ThreadMessage[]> {
    const explainability = await this.getExplainability(userId, notificationId);
    return (explainability?.thread ?? []) as ThreadMessage[];
  }

  async seedThreadIfNeeded(userId: string, notificationId: string, message: ThreadMessage): Promise<void> {
    const thread = await this.getThread(userId, notificationId);
    if (thread.length > 0) return;
    await this.addThreadMessage(userId, notificationId, message.text, message.isUser, message.id, message.date);
  }

  async addThreadMessage(userId: string, notificationId: string, text: string, isUser: boolean, id?: string, date?: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const explainability = await this.getExplainability(userId, notificationId);
    const thread = (explainability?.thread ?? []) as ThreadMessage[];
    const next = thread.concat({
      id: id ?? `msg_${Date.now()}`,
      text,
      isUser,
      date: date ?? new Date().toISOString(),
    });

    await supabase
      .from('notification_history')
      .update({
        explainability: {
          ...(explainability ?? {}),
          thread: next,
        },
      })
      .eq('id', notificationId)
      .eq('user_id', sessionUserId);
  }
}

export const notificationService = new NotificationService();
