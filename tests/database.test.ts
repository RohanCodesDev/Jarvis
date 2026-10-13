import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseService } from '../src/services/db/databaseService';
import type { UserMemoryItem } from '../src/types/hud';
import type { Pool, PoolClient } from 'pg';

describe('Stage 4: Persistent Memory & Knowledge Banks (DatabaseService)', () => {
  let db: DatabaseService;
  let mockPool: Partial<Pool>;
  let mockRows: Array<{
    id: string;
    content: string;
    category: string;
    created_at: string;
    updated_at: string;
  }>;
  let mockMessageRows: Array<{
    id: string;
    conversation_id: string;
    sender: string;
    text: string;
    timestamp: string;
    status: string;
    metadata: Record<string, unknown> | null;
  }>;

  beforeEach(() => {
    mockRows = [];
    mockMessageRows = [];

    const mockClient: Partial<PoolClient> = {
      query: vi
        .fn()
        .mockImplementation(async (sql: string, params?: unknown[]) => {
          if (sql.includes('SELECT id, content, category')) {
            return { rows: mockRows };
          }
          if (sql.includes('INSERT INTO user_memories')) {
            if (params) {
              mockRows.push({
                id: String(params[0]),
                content: String(params[1]),
                category: String(params[2]),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
            return { rows: [] };
          }
          return { rows: [] };
        }),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient as PoolClient),
      on: vi.fn(),
      query: vi
        .fn()
        .mockImplementation(async (sql: string, params?: unknown[]) => {
          if (sql.includes('SELECT id, content, category')) {
            return { rows: mockRows };
          }
          if (sql.includes('INSERT INTO user_memories')) {
            if (params) {
              const existing = mockRows.find((r) => r.id === params[0]);
              if (existing) {
                existing.content = String(params[1]);
                existing.category = String(params[2]);
              } else {
                mockRows.push({
                  id: String(params[0]),
                  content: String(params[1]),
                  category: String(params[2]),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
              }
            }
            return { rows: [] };
          }
          if (sql.includes('UPDATE user_memories')) {
            if (params) {
              const item = mockRows.find((r) => r.id === params[1]);
              if (item) item.content = String(params[0]);
            }
            return { rows: [] };
          }
          if (sql.includes('DELETE FROM user_memories')) {
            if (params) {
              mockRows = mockRows.filter((r) => r.id !== params[0]);
            }
            return { rows: [] };
          }
          if (sql.includes('SELECT id, sender, text')) {
            return { rows: mockMessageRows };
          }
          if (sql.includes('INSERT INTO chat_messages')) {
            if (params) {
              mockMessageRows.push({
                id: String(params[0]),
                conversation_id: String(params[1]),
                sender: String(params[2]),
                text: String(params[3]),
                timestamp: String(params[4]),
                status: String(params[5]),
                metadata: params[6] ? JSON.parse(String(params[6])) : null,
              });
            }
            return { rows: [] };
          }
          if (sql.includes('DELETE FROM chat_messages')) {
            mockMessageRows = [];
            return { rows: [] };
          }
          return { rows: [] };
        }),
    };

    db = new DatabaseService(mockPool as Pool);
  });

  it('initializes with seed system memories in cache', async () => {
    const memories = await db.getMemories();
    expect(memories.length).toBeGreaterThan(0);
    const systemSeed = memories.find((m) => m.category === 'system');
    expect(systemSeed).toBeDefined();
    expect(systemSeed?.content).toContain('Windows 11');
  });

  it('adds and updates user memories in memory cache and pool', async () => {
    const customMemory: UserMemoryItem = {
      id: 'mem-test-1',
      content: 'User prefers dark theme and concise answers.',
      category: 'preference',
      createdAt: '2026-10-13 22:50',
    };

    const addRes = await db.addMemory(customMemory);
    expect(addRes.success).toBe(true);

    let memories = await db.getMemories();
    expect(memories.find((m) => m.id === 'mem-test-1')?.content).toBe(
      'User prefers dark theme and concise answers.',
    );

    const updateRes = await db.updateMemory(
      'mem-test-1',
      'User prefers holographic cyan theme and direct voice responses.',
    );
    expect(updateRes.success).toBe(true);

    memories = await db.getMemories();
    expect(memories.find((m) => m.id === 'mem-test-1')?.content).toBe(
      'User prefers holographic cyan theme and direct voice responses.',
    );
  });

  it('deletes user memories correctly', async () => {
    const tempMemory: UserMemoryItem = {
      id: 'mem-del-1',
      content: 'Temporary experimental directive',
      category: 'personal',
      createdAt: '2026-10-13 22:51',
    };

    await db.addMemory(tempMemory);
    let memories = await db.getMemories();
    expect(memories.some((m) => m.id === 'mem-del-1')).toBe(true);

    const delRes = await db.deleteMemory('mem-del-1');
    expect(delRes.success).toBe(true);

    memories = await db.getMemories();
    expect(memories.some((m) => m.id === 'mem-del-1')).toBe(false);
  });

  it('formats memories into an injection block for AI reasoning', async () => {
    const promptBlock = await db.formatMemoriesForPrompt();
    expect(promptBlock).toContain('[PERSISTENT USER MEMORY BANKS]');
    expect(promptBlock).toContain('SYSTEM');
  });

  it('records and retrieves chat history messages', async () => {
    await db.saveChatMessage({
      id: 'msg-test-1',
      sender: 'user',
      text: 'Jarvis, store system parameters',
      timestamp: '22:52:00',
      status: 'delivered',
    });

    await db.saveChatMessage({
      id: 'msg-test-2',
      sender: 'jarvis',
      text: 'Parameters stored in Neon database.',
      timestamp: '22:52:01',
      status: 'delivered',
    });

    const history = await db.getChatHistory('main');
    expect(history.length).toBe(2);
    expect(history[0].text).toBe('Jarvis, store system parameters');
    expect(history[1].text).toBe('Parameters stored in Neon database.');

    await db.clearChatHistory('main');
    const cleared = await db.getChatHistory('main');
    expect(cleared.length).toBe(0);
  });

  it('handles database network failure gracefully with local cache fallback', async () => {
    const failingPool: Partial<Pool> = {
      connect: vi.fn().mockRejectedValue(new Error('Network unreachable')),
      on: vi.fn(),
      query: vi.fn().mockRejectedValue(new Error('Network unreachable')),
    };

    const resilientDb = new DatabaseService(failingPool as Pool);
    // Should NOT throw! Gracefully returns in-memory cached memories
    const memories = await resilientDb.getMemories();
    expect(memories.length).toBeGreaterThan(0);

    const status = resilientDb.getStatus();
    expect(status.isConnected).toBe(false);
  });
});
