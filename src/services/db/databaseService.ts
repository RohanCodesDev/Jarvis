import { Pool } from 'pg';
import { getDbUri } from '../secretStore';
import type { ChatMessage, UserMemoryItem } from '../../types/hud';
import type { ExecutionPlan } from '../agent/agentTypes';
import type { ReminderItem } from '../scheduler/reminderTypes';
import type { WorkflowItem } from '../automation/workflowTypes';

export class DatabaseService {
  private pool: Pool | null = null;
  private isConnected = false;
  private lastError: string | null = null;
  private memoryCache: Map<string, UserMemoryItem> = new Map();
  private messageCache: ChatMessage[] = [];
  private taskPlansCache: Map<string, ExecutionPlan> = new Map();
  private remindersCache: Map<string, ReminderItem> = new Map();
  private workflowsCache: Map<string, WorkflowItem> = new Map();
  private isInitialized = false;

  constructor(customPool?: Pool) {
    if (customPool) {
      this.pool = customPool;
    }
    this.seedDefaultMemories();
  }

  private seedDefaultMemories(): void {
    const defaultItems: UserMemoryItem[] = [
      {
        id: 'mem-seed-1',
        content: 'System User is building J.A.R.V.I.S. Desktop on Windows 11.',
        category: 'system',
        createdAt: new Date().toLocaleString(),
      },
      {
        id: 'mem-seed-2',
        content:
          'Prefers ultra-concise, hyper-direct responses with zero unnecessary preamble.',
        category: 'preference',
        createdAt: new Date().toLocaleString(),
      },
    ];
    for (const item of defaultItems) {
      this.memoryCache.set(item.id, item);
    }
  }

  private getPool(): Pool {
    if (!this.pool) {
      const connectionString = getDbUri();
      this.pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      this.pool.on('error', (err) => {
        console.warn(
          '[DatabaseService] Unexpected idle client error:',
          err.message,
        );
        this.isConnected = false;
        this.lastError = err.message;
      });
    }
    return this.pool;
  }

  public async initialize(): Promise<boolean> {
    if (this.isInitialized && this.isConnected) return true;

    try {
      const pool = this.getPool();
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS user_memories (
            id VARCHAR(64) PRIMARY KEY,
            content TEXT NOT NULL,
            category VARCHAR(32) NOT NULL DEFAULT 'preference',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS chat_messages (
            id VARCHAR(64) PRIMARY KEY,
            conversation_id VARCHAR(64) NOT NULL DEFAULT 'main',
            sender VARCHAR(16) NOT NULL,
            text TEXT NOT NULL,
            timestamp VARCHAR(32) NOT NULL,
            status VARCHAR(16) DEFAULT 'delivered',
            metadata JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS task_executions (
            id VARCHAR(64) PRIMARY KEY,
            title TEXT NOT NULL,
            prompt TEXT NOT NULL,
            status VARCHAR(32) NOT NULL,
            steps JSONB NOT NULL,
            summary TEXT,
            duration_ms INT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ
          );
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS reminders (
            id VARCHAR(64) PRIMARY KEY,
            text TEXT NOT NULL,
            due_timestamp BIGINT NOT NULL,
            due_date_str VARCHAR(32) NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS workflows (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(128) NOT NULL,
            description TEXT,
            trigger_type VARCHAR(32) NOT NULL,
            trigger_config JSONB NOT NULL,
            action_type VARCHAR(32) NOT NULL,
            action_payload JSONB NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'active',
            next_run_ms BIGINT NOT NULL,
            last_run_ms BIGINT,
            execution_count INT NOT NULL DEFAULT 0,
            max_executions INT,
            last_result JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);

        this.isConnected = true;
        this.lastError = null;
        this.isInitialized = true;
        console.log(
          '[DatabaseService] Neon PostgreSQL persistent storage armed.',
        );

        // Initial sync from DB to warm in-memory cache
        await this.syncMemoriesFromDb(client);

        return true;
      } finally {
        client.release();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.isConnected = false;
      this.lastError = msg;
      console.warn(
        '[DatabaseService] Connection to Neon PostgreSQL unavailable, operating in cached mode:',
        msg,
      );
      return false;
    }
  }

  private async syncMemoriesFromDb(
    client: import('pg').PoolClient,
  ): Promise<void> {
    try {
      const res = await client.query(`
        SELECT id, content, category, created_at, updated_at
        FROM user_memories
        ORDER BY updated_at DESC
        LIMIT 100;
      `);

      if (res.rows.length > 0) {
        this.memoryCache.clear();
        for (const row of res.rows) {
          const item: UserMemoryItem = {
            id: row.id,
            content: row.content,
            category: (row.category ||
              'preference') as UserMemoryItem['category'],
            createdAt: new Date(
              row.created_at || row.updated_at,
            ).toLocaleString(),
          };
          this.memoryCache.set(item.id, item);
        }
      } else {
        // If DB table is empty, seed our initial system memories into Neon
        for (const item of this.memoryCache.values()) {
          await client.query(
            `INSERT INTO user_memories (id, content, category, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             ON CONFLICT (id) DO NOTHING;`,
            [item.id, item.content, item.category],
          );
        }
      }
    } catch (syncErr) {
      console.warn(
        '[DatabaseService] Failed to sync memories from DB:',
        syncErr,
      );
    }
  }

  public getStatus(): { isConnected: boolean; error?: string } {
    return {
      isConnected: this.isConnected,
      error: this.lastError || undefined,
    };
  }

  public async getMemories(): Promise<UserMemoryItem[]> {
    if (!this.isConnected) {
      await this.initialize().catch(() => {});
    }

    if (this.isConnected && this.pool) {
      try {
        const res = await this.pool.query(`
          SELECT id, content, category, created_at, updated_at
          FROM user_memories
          ORDER BY updated_at DESC
          LIMIT 100;
        `);
        const items = res.rows.map((row) => ({
          id: row.id,
          content: row.content,
          category: (row.category ||
            'preference') as UserMemoryItem['category'],
          createdAt: new Date(
            row.created_at || row.updated_at,
          ).toLocaleString(),
        }));

        this.memoryCache.clear();
        for (const it of items) {
          this.memoryCache.set(it.id, it);
        }
        return items;
      } catch (err) {
        console.warn(
          '[DatabaseService] getMemories query failed, returning cache:',
          err,
        );
      }
    }

    return Array.from(this.memoryCache.values());
  }

  public async addMemory(
    item: UserMemoryItem,
  ): Promise<{ success: boolean; error?: string }> {
    this.memoryCache.set(item.id, item);

    if (!this.isConnected) {
      await this.initialize().catch(() => {});
    }

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO user_memories (id, content, category, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE
             SET content = EXCLUDED.content,
                 category = EXCLUDED.category,
                 updated_at = NOW();`,
          [item.id, item.content, item.category],
        );
        return { success: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    }

    return { success: true };
  }

  public async updateMemory(
    id: string,
    content: string,
  ): Promise<{ success: boolean; error?: string }> {
    const existing = this.memoryCache.get(id);
    if (existing) {
      this.memoryCache.set(id, { ...existing, content });
    }

    if (!this.isConnected) {
      await this.initialize().catch(() => {});
    }

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `UPDATE user_memories SET content = $1, updated_at = NOW() WHERE id = $2;`,
          [content, id],
        );
        return { success: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    }

    return { success: true };
  }

  public async deleteMemory(
    id: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.memoryCache.delete(id);

    if (!this.isConnected) {
      await this.initialize().catch(() => {});
    }

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(`DELETE FROM user_memories WHERE id = $1;`, [id]);
        return { success: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    }

    return { success: true };
  }

  public async getChatHistory(
    conversationId = 'main',
    limit = 50,
  ): Promise<ChatMessage[]> {
    if (!this.isConnected) {
      await this.initialize().catch(() => {});
    }

    if (this.isConnected && this.pool) {
      try {
        const res = await this.pool.query(
          `SELECT id, sender, text, timestamp, status, metadata
           FROM chat_messages
           WHERE conversation_id = $1
           ORDER BY created_at ASC
           LIMIT $2;`,
          [conversationId, limit],
        );

        const items: ChatMessage[] = res.rows.map((row) => ({
          id: row.id,
          sender: row.sender as ChatMessage['sender'],
          text: row.text,
          timestamp: row.timestamp,
          status: row.status as ChatMessage['status'],
          metadata: row.metadata || undefined,
        }));

        this.messageCache = items;
        return items;
      } catch (err) {
        console.warn(
          '[DatabaseService] getChatHistory query failed, returning cache:',
          err,
        );
      }
    }

    return this.messageCache;
  }

  public async saveChatMessage(
    msg: ChatMessage,
    conversationId = 'main',
  ): Promise<{ success: boolean }> {
    const existingIndex = this.messageCache.findIndex((m) => m.id === msg.id);
    if (existingIndex >= 0) {
      this.messageCache[existingIndex] = msg;
    } else {
      this.messageCache.push(msg);
      if (this.messageCache.length > 100) this.messageCache.shift();
    }

    if (!this.isConnected) {
      await this.initialize().catch(() => {});
    }

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO chat_messages (id, conversation_id, sender, text, timestamp, status, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (id) DO UPDATE
             SET text = EXCLUDED.text,
                 status = EXCLUDED.status,
                 metadata = EXCLUDED.metadata;`,
          [
            msg.id,
            conversationId,
            msg.sender,
            msg.text,
            msg.timestamp,
            msg.status || 'delivered',
            msg.metadata ? JSON.stringify(msg.metadata) : null,
          ],
        );
        return { success: true };
      } catch (err) {
        console.warn(
          '[DatabaseService] Failed to persist message to Neon DB:',
          err,
        );
      }
    }

    return { success: true };
  }

  public async clearChatHistory(
    conversationId = 'main',
  ): Promise<{ success: boolean }> {
    this.messageCache = [];

    if (!this.isConnected) {
      await this.initialize().catch(() => {});
    }

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `DELETE FROM chat_messages WHERE conversation_id = $1;`,
          [conversationId],
        );
        return { success: true };
      } catch (err) {
        console.warn(
          '[DatabaseService] Failed to clear chat history in DB:',
          err,
        );
      }
    }

    return { success: true };
  }

  /**
   * Format persistent user memories into an injection block for AI reasoning.
   */
  public async formatMemoriesForPrompt(): Promise<string> {
    const memories = await this.getMemories();
    if (!memories.length) return '';

    const lines = memories
      .slice(0, 8)
      .map((m) => `- [${m.category.toUpperCase()}]: ${m.content}`);
    return `[PERSISTENT USER MEMORY BANKS]\n${lines.join('\n')}\n(Use these persistent facts to personalize your responses and address the user with full context.)`;
  }

  public async saveTaskPlan(
    plan: ExecutionPlan,
  ): Promise<{ success: boolean }> {
    this.taskPlansCache.set(plan.id, plan);

    if (!this.isConnected) {
      await this.initialize().catch(() => {});
    }

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO task_executions (id, title, prompt, status, steps, summary, duration_ms, created_at, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE
             SET status = EXCLUDED.status,
                 steps = EXCLUDED.steps,
                 summary = EXCLUDED.summary,
                 duration_ms = EXCLUDED.duration_ms,
                 completed_at = EXCLUDED.completed_at;`,
          [
            plan.id,
            plan.title,
            plan.prompt,
            plan.status,
            JSON.stringify(plan.steps),
            plan.summary || null,
            plan.totalDurationMs || null,
            plan.createdAt,
            plan.completedAt || null,
          ],
        );
      } catch (err) {
        console.warn(
          '[DatabaseService] Failed to persist task execution plan to Neon DB:',
          err,
        );
      }
    }

    return { success: true };
  }

  public async getTaskPlans(limit = 20): Promise<ExecutionPlan[]> {
    if (!this.isConnected) {
      await this.initialize().catch(() => {});
    }

    if (this.isConnected && this.pool) {
      try {
        const res = await this.pool.query(
          `SELECT id, title, prompt, status, steps, summary, duration_ms, created_at, completed_at
           FROM task_executions
           ORDER BY created_at DESC
           LIMIT $1;`,
          [limit],
        );

        if (res.rows.length > 0) {
          const loaded: ExecutionPlan[] = res.rows.map((r) => ({
            id: r.id,
            title: r.title,
            prompt: r.prompt,
            status: r.status,
            steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps,
            summary: r.summary,
            totalDurationMs: r.duration_ms,
            createdAt: new Date(r.created_at).toISOString(),
            completedAt: r.completed_at
              ? new Date(r.completed_at).toISOString()
              : undefined,
            currentStepIndex: 0,
          }));
          for (const p of loaded) {
            this.taskPlansCache.set(p.id, p);
          }
          return loaded;
        }
      } catch (err) {
        console.warn(
          '[DatabaseService] Failed to query task plans from Neon DB:',
          err,
        );
      }
    }

    return Array.from(this.taskPlansCache.values()).slice(-limit);
  }

  public async saveReminder(
    reminder: ReminderItem,
  ): Promise<{ success: boolean }> {
    this.remindersCache.set(reminder.id, reminder);

    if (!this.isConnected) {
      await this.initialize().catch(() => {});
    }

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO reminders (id, text, due_timestamp, due_date_str, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE
             SET status = EXCLUDED.status;`,
          [
            reminder.id,
            reminder.text,
            reminder.dueTimestamp,
            reminder.dueDateStr,
            reminder.status,
            reminder.createdAt,
          ],
        );
      } catch (err) {
        console.warn(
          '[DatabaseService] Failed to persist reminder to Neon DB:',
          err,
        );
      }
    }

    return { success: true };
  }

  public async getReminders(limit = 50): Promise<ReminderItem[]> {
    if (!this.isConnected) {
      await this.initialize().catch(() => {});
    }

    if (this.isConnected && this.pool) {
      try {
        const res = await this.pool.query(
          `SELECT id, text, due_timestamp, due_date_str, status, created_at
           FROM reminders
           ORDER BY due_timestamp ASC
           LIMIT $1;`,
          [limit],
        );

        if (res.rows.length > 0) {
          const loaded: ReminderItem[] = res.rows.map((r) => ({
            id: r.id,
            text: r.text,
            dueTimestamp: Number(r.due_timestamp),
            dueDateStr: r.due_date_str,
            status: r.status,
            createdAt: new Date(r.created_at).toISOString(),
          }));
          for (const item of loaded) {
            this.remindersCache.set(item.id, item);
          }
          return loaded;
        }
      } catch (err) {
        console.warn(
          '[DatabaseService] Failed to query reminders from Neon DB:',
          err,
        );
      }
    }

    return Array.from(this.remindersCache.values()).slice(0, limit);
  }

  public async saveWorkflow(
    workflow: WorkflowItem,
  ): Promise<{ success: boolean }> {
    this.workflowsCache.set(workflow.id, workflow);

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO workflows (
            id, name, description, trigger_type, trigger_config, action_type,
            action_payload, status, next_run_ms, last_run_ms, execution_count,
            max_executions, last_result, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            trigger_type = EXCLUDED.trigger_type,
            trigger_config = EXCLUDED.trigger_config,
            action_type = EXCLUDED.action_type,
            action_payload = EXCLUDED.action_payload,
            status = EXCLUDED.status,
            next_run_ms = EXCLUDED.next_run_ms,
            last_run_ms = EXCLUDED.last_run_ms,
            execution_count = EXCLUDED.execution_count,
            max_executions = EXCLUDED.max_executions,
            last_result = EXCLUDED.last_result;`,
          [
            workflow.id,
            workflow.name,
            workflow.description ?? null,
            workflow.triggerType,
            JSON.stringify(workflow.triggerConfig),
            workflow.actionType,
            JSON.stringify(workflow.actionPayload),
            workflow.status,
            workflow.nextRunMs,
            workflow.lastRunMs ?? null,
            workflow.executionCount,
            workflow.maxExecutions ?? null,
            workflow.lastResult ? JSON.stringify(workflow.lastResult) : null,
            workflow.createdAt,
          ],
        );
      } catch (err) {
        console.warn(
          '[DatabaseService] Failed to persist workflow to Neon DB:',
          err,
        );
      }
    }

    return { success: true };
  }

  public async getWorkflows(): Promise<WorkflowItem[]> {
    if (!this.isConnected) {
      await this.initialize().catch(() => {});
    }

    if (this.isConnected && this.pool) {
      try {
        const res = await this.pool.query(
          `SELECT id, name, description, trigger_type, trigger_config, action_type,
                  action_payload, status, next_run_ms, last_run_ms, execution_count,
                  max_executions, last_result, created_at
           FROM workflows
           ORDER BY created_at DESC;`,
        );

        if (res.rows.length > 0) {
          const loaded: WorkflowItem[] = res.rows.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description || undefined,
            triggerType: r.trigger_type,
            triggerConfig:
              typeof r.trigger_config === 'string'
                ? JSON.parse(r.trigger_config)
                : r.trigger_config,
            actionType: r.action_type,
            actionPayload:
              typeof r.action_payload === 'string'
                ? JSON.parse(r.action_payload)
                : r.action_payload,
            status: r.status,
            nextRunMs: Number(r.next_run_ms),
            lastRunMs: r.last_run_ms ? Number(r.last_run_ms) : undefined,
            executionCount: Number(r.execution_count),
            maxExecutions: r.max_executions
              ? Number(r.max_executions)
              : undefined,
            lastResult:
              typeof r.last_result === 'string'
                ? JSON.parse(r.last_result)
                : (r.last_result ?? undefined),
            createdAt: new Date(r.created_at).toISOString(),
          }));
          for (const item of loaded) {
            this.workflowsCache.set(item.id, item);
          }
          return loaded;
        }
      } catch (err) {
        console.warn(
          '[DatabaseService] Failed to query workflows from Neon DB:',
          err,
        );
      }
    }

    return Array.from(this.workflowsCache.values());
  }

  public async deleteWorkflow(id: string): Promise<boolean> {
    const existed = this.workflowsCache.delete(id);

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(`DELETE FROM workflows WHERE id = $1;`, [id]);
      } catch (err) {
        console.warn(
          '[DatabaseService] Failed to delete workflow from Neon DB:',
          err,
        );
      }
    }

    return existed;
  }
}

export const databaseService = new DatabaseService();
