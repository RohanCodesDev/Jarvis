import type { ReminderItem, CreateReminderParams } from './reminderTypes';
import { databaseService } from '../db/databaseService';

export type ReminderTriggerCallback = (reminder: ReminderItem) => void;

export class ReminderService {
  private reminders: Map<string, ReminderItem> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private listeners: Set<ReminderTriggerCallback> = new Set();

  constructor() {
    this.startScheduler();
  }

  public startScheduler(): void {
    if (this.checkInterval) return;
    this.checkInterval = setInterval(() => {
      this.checkDueReminders();
    }, 3000);
  }

  public stopScheduler(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  public onReminderTrigger(cb: ReminderTriggerCallback): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public async createReminder(
    params: CreateReminderParams,
  ): Promise<ReminderItem> {
    const now = Date.now();
    let dueMs = now + (params.dueInMinutes ?? 5) * 60 * 1000;

    if (params.exactDate) {
      dueMs = params.exactDate.getTime();
    }

    const id = `rem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const item: ReminderItem = {
      id,
      text: params.text.trim(),
      dueTimestamp: dueMs,
      dueDateStr: new Date(dueMs).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.reminders.set(id, item);

    // Save to persistent database
    databaseService.saveReminder(item).catch(() => {});

    return item;
  }

  public checkDueReminders(): ReminderItem[] {
    const now = Date.now();
    const triggered: ReminderItem[] = [];

    for (const item of this.reminders.values()) {
      if (item.status === 'pending' && item.dueTimestamp <= now) {
        item.status = 'triggered';
        triggered.push(item);
        databaseService.saveReminder(item).catch(() => {});

        for (const listener of this.listeners) {
          try {
            listener(item);
          } catch (err) {
            console.warn('[ReminderService] Error in trigger listener:', err);
          }
        }
      }
    }

    return triggered;
  }

  public dismissReminder(id: string): boolean {
    const item = this.reminders.get(id);
    if (!item) return false;

    item.status = 'dismissed';
    databaseService.saveReminder(item).catch(() => {});
    return true;
  }

  public getPendingReminders(): ReminderItem[] {
    return Array.from(this.reminders.values())
      .filter((r) => r.status === 'pending')
      .sort((a, b) => a.dueTimestamp - b.dueTimestamp);
  }

  public getAllReminders(): ReminderItem[] {
    return Array.from(this.reminders.values()).sort(
      (a, b) => b.dueTimestamp - a.dueTimestamp,
    );
  }

  public async syncFromDatabase(): Promise<void> {
    try {
      const dbReminders = await databaseService.getReminders();
      for (const item of dbReminders) {
        this.reminders.set(item.id, item);
      }
    } catch {
      // Ignore initial sync error
    }
  }
}

export const globalReminderService = new ReminderService();
