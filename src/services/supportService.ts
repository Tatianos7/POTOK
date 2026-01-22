import { SupportMessage, MessageResponse } from '../types';

const MESSAGES_KEY = 'potok_support_messages';

class SupportService {
  private async delay(ms: number = 300): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Получить все сообщения (для админ-панели)
  async getAllMessages(): Promise<SupportMessage[]> {
    await this.delay();
    const messagesStr = localStorage.getItem(MESSAGES_KEY);
    if (!messagesStr) return [];
    
    try {
      const messages: SupportMessage[] = JSON.parse(messagesStr);
      return messages.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      return [];
    }
  }

  // Получить сообщения конкретного пользователя
  async getUserMessages(userId: string): Promise<SupportMessage[]> {
    await this.delay();
    const messagesStr = localStorage.getItem(MESSAGES_KEY);
    if (!messagesStr) return [];
    
    try {
      const messages: SupportMessage[] = JSON.parse(messagesStr);
      // Фильтруем только сообщения этого пользователя
      const userMessages = messages.filter(m => m.userId === userId);
      return userMessages.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      return [];
    }
  }

  // Создать новое сообщение от пользователя
  async createMessage(
    userId: string,
    userName: string,
    message: string,
    userEmail?: string,
    userPhone?: string,
    subject: string = ''
  ): Promise<SupportMessage> {
    await this.delay();
    
    const newMessage: SupportMessage = {
      id: this.generateId(),
      userId,
      userName,
      userEmail,
      userPhone,
      subject,
      message,
      status: 'new',
      createdAt: new Date().toISOString(),
      responses: [],
    };

    const messages = await this.getAllMessages();
    messages.push(newMessage);
    console.warn('[supportService] createMessage disabled: Supabase is source of truth');
    
    // Отправляем событие об изменении сообщений
    window.dispatchEvent(new Event('support-message-changed'));

    return newMessage;
  }

  // Добавить ответ на сообщение
  async addResponse(
    messageId: string,
    fromAdmin: boolean,
    text: string
  ): Promise<MessageResponse> {
    await this.delay();

    const messages = await this.getAllMessages();
    const messageIndex = messages.findIndex(m => m.id === messageId);
    
    if (messageIndex === -1) {
      throw new Error('Сообщение не найдено');
    }

    const newResponse: MessageResponse = {
      id: this.generateId(),
      messageId,
      fromAdmin,
      text,
      createdAt: new Date().toISOString(),
    };

    if (!messages[messageIndex].responses) {
      messages[messageIndex].responses = [];
    }
    messages[messageIndex].responses!.push(newResponse);

    // Обновляем статус сообщения
    if (fromAdmin && messages[messageIndex].status === 'new') {
      messages[messageIndex].status = 'in_progress';
    }

    console.warn('[supportService] addResponse disabled: Supabase is source of truth');
    
    // Отправляем событие об изменении сообщений
    window.dispatchEvent(new Event('support-message-changed'));

    return newResponse;
  }

  // Обновить статус сообщения
  async updateMessageStatus(messageId: string, status: SupportMessage['status']): Promise<void> {
    await this.delay();

    const messages = await this.getAllMessages();
    const messageIndex = messages.findIndex(m => m.id === messageId);
    
    if (messageIndex === -1) {
      throw new Error('Сообщение не найдено');
    }

    messages[messageIndex].status = status;
    console.warn('[supportService] updateMessageStatus disabled: Supabase is source of truth');
    
    // Отправляем событие для обновления админ-панели
    window.dispatchEvent(new Event('support-message-changed'));
    
    // Отправляем событие об изменении сообщений
    window.dispatchEvent(new Event('support-message-changed'));
  }

  // Получить статистику пользователей
  getUsersStats(): {
    total: number;
    withPremium: number;
    withoutPremium: number;
  } {
    const usersStr = localStorage.getItem('potok_users');
    if (!usersStr) {
      return { total: 0, withPremium: 0, withoutPremium: 0 };
    }

    try {
      const users = JSON.parse(usersStr);
      const total = users.length;
      const withPremium = users.filter((u: any) => u.hasPremium).length;
      const withoutPremium = total - withPremium;

      return { total, withPremium, withoutPremium };
    } catch {
      return { total: 0, withPremium: 0, withoutPremium: 0 };
    }
  }

  // Получить статистику сообщений
  async getMessagesStats(): Promise<{
    total: number;
    new: number;
    inProgress: number;
    resolved: number;
  }> {
    const messages = await this.getAllMessages();
    return {
      total: messages.length,
      new: messages.filter(m => m.status === 'new').length,
      inProgress: messages.filter(m => m.status === 'in_progress').length,
      resolved: messages.filter(m => m.status === 'resolved').length,
    };
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

export const supportService = new SupportService();

