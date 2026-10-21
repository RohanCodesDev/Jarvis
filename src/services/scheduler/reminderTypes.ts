export type ReminderStatus = 'pending' | 'triggered' | 'dismissed';

export interface ReminderItem {
  id: string;
  text: string;
  dueTimestamp: number; // Unix epoch ms
  dueDateStr: string;
  status: ReminderStatus;
  createdAt: string;
}

export interface CreateReminderParams {
  text: string;
  dueInMinutes?: number;
  exactDate?: Date;
}
