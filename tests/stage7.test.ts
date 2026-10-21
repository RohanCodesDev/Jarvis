import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReminderService } from '../src/services/scheduler/reminderService';
import { OllamaProvider } from '../src/services/ai/ollamaProvider';
import { detectDirectIntent } from '../src/services/tools/intentDetector';
import { DatabaseService } from '../src/services/db/databaseService';
import type { ReminderItem } from '../src/services/scheduler/reminderTypes';

describe('Stage 7: Reminders, Autonomous Scheduling, and Ollama Local AI', () => {
  describe('ReminderService & Autonomous Scheduler', () => {
    let reminderService: ReminderService;

    beforeEach(() => {
      reminderService = new ReminderService();
      reminderService.stopScheduler(); // Stop timer to test manually
    });

    afterEach(() => {
      reminderService.stopScheduler();
    });

    it('creates and calculates due timestamp for timed reminders', async () => {
      const item = await reminderService.createReminder({
        text: 'Review system security telemetry',
        dueInMinutes: 10,
      });

      expect(item.id).toMatch(/^rem-/);
      expect(item.text).toBe('Review system security telemetry');
      expect(item.status).toBe('pending');
      expect(item.dueTimestamp).toBeGreaterThan(Date.now() + 9 * 60 * 1000);
      expect(item.dueTimestamp).toBeLessThanOrEqual(
        Date.now() + 10 * 60 * 1000,
      );
    });

    it('triggers due reminders and dispatches callbacks when time arrives', async () => {
      const triggeredSpy = vi.fn();
      reminderService.onReminderTrigger(triggeredSpy);

      // Create an immediately due reminder (due in past)
      const pastItem = await reminderService.createReminder({
        text: 'Immediate alarm check',
        exactDate: new Date(Date.now() - 1000),
      });

      const triggered = reminderService.checkDueReminders();
      expect(triggered.length).toBe(1);
      expect(triggered[0].id).toBe(pastItem.id);
      expect(triggered[0].status).toBe('triggered');
      expect(triggeredSpy).toHaveBeenCalledTimes(1);
      expect(triggeredSpy).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Immediate alarm check' }),
      );
    });

    it('dismisses reminders and updates status', async () => {
      const item = await reminderService.createReminder({
        text: 'Dismissable test reminder',
        dueInMinutes: 20,
      });

      const ok = reminderService.dismissReminder(item.id);
      expect(ok).toBe(true);

      const all = reminderService.getAllReminders();
      const updated = all.find((r) => r.id === item.id);
      expect(updated?.status).toBe('dismissed');
    });
  });

  describe('Natural Language Reminder Intent Detection', () => {
    it('detects "remind me in X minutes to Y" directives', () => {
      const intent = detectDirectIntent(
        'remind me in 10 minutes to submit the quarterly report',
      );
      expect(intent).not.toBeNull();
      expect(intent?.toolId).toBe('schedule_reminder');
      expect(intent?.args.minutes).toBe(10);
      expect(intent?.args.text).toBe('submit the quarterly report');
    });

    it('detects "remind me to X in Y minutes" directives', () => {
      const intent = detectDirectIntent('remind me to drink water in 15 mins');
      expect(intent).not.toBeNull();
      expect(intent?.toolId).toBe('schedule_reminder');
      expect(intent?.args.minutes).toBe(15);
      expect(intent?.args.text).toBe('drink water');
    });

    it('detects "set a reminder in X minutes for Y" directives', () => {
      const intent = detectDirectIntent(
        'set a reminder in 30 minutes for server telemetry check',
      );
      expect(intent).not.toBeNull();
      expect(intent?.toolId).toBe('schedule_reminder');
      expect(intent?.args.minutes).toBe(30);
      expect(intent?.args.text).toBe('server telemetry check');
    });
  });

  describe('OllamaProvider (Local Model Provider)', () => {
    it('provides fallback model list when local server is offline or unreachable', async () => {
      const offlineProvider = new OllamaProvider('http://127.0.0.1:59999');
      const models = await offlineProvider.getModels();
      expect(models.length).toBeGreaterThanOrEqual(2);
      expect(models.some((m) => m.id.includes('llama3'))).toBe(true);
    });

    it('queries models from local server or falls back cleanly', async () => {
      const liveProvider = new OllamaProvider('http://127.0.0.1:11434');
      const models = await liveProvider.getModels();
      expect(models.length).toBeGreaterThanOrEqual(1);
      expect(models[0].name).toContain('(Local)');
    });

    it('returns an informative failure when Ollama server is offline or unreachable', async () => {
      const offlineProvider = new OllamaProvider('http://127.0.0.1:59999');
      const errorSpy = vi.fn();
      await offlineProvider.sendMessage(
        {
          messages: [{ role: 'user', content: 'hello local model' }],
          model: 'llama3:latest',
        },
        {
          onChunk: vi.fn(),
          onDone: vi.fn(),
          onError: errorSpy,
        },
      );

      // Should handle offline gracefully without crashing
      expect(errorSpy).toHaveBeenCalled();
      const errArg = errorSpy.mock.calls[0][0];
      expect(errArg).toContain('Ollama');
    });
  });

  describe('Database Persistence (Reminders Table)', () => {
    it('persists and retrieves reminders in storage', async () => {
      const mockPool: any = {
        connect: vi.fn().mockResolvedValue({
          query: vi.fn().mockResolvedValue({ rows: [] }),
          release: vi.fn(),
        }),
        on: vi.fn(),
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT id, text, due_timestamp')) {
            return {
              rows: [
                {
                  id: 'rem-test-1',
                  text: 'Check database backup',
                  due_timestamp: Date.now() + 60000,
                  due_date_str: '11:00 PM',
                  status: 'pending',
                  created_at: new Date().toISOString(),
                },
              ],
            };
          }
          return { rows: [] };
        }),
      };

      const db = new DatabaseService(mockPool);

      const reminder: ReminderItem = {
        id: 'rem-test-1',
        text: 'Check database backup',
        dueTimestamp: Date.now() + 60000,
        dueDateStr: '11:00 PM',
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      const saveRes = await db.saveReminder(reminder);
      expect(saveRes.success).toBe(true);

      const loaded = await db.getReminders();
      expect(loaded.some((r) => r.id === 'rem-test-1')).toBe(true);
    });
  });
});
