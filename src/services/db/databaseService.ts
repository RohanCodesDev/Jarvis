import { Pool } from 'pg';
import { getDbUri } from '../secretStore';
import type { ChatMessage, UserMemoryItem } from '../../types/hud';

export class DatabaseService {
  private pool: Pool | null = null;
  private isConnected = false;
  private lastError: string | null = null;
  private memoryCache: Map<string, UserMemoryItem> = new Map();
  private messageCache: ChatMessage[] = [];
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
}

export const databaseService = new DatabaseService();
