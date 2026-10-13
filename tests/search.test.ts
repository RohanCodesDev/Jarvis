import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  shouldSearchWeb,
  extractSearchKeywords,
  searchWeb,
  clearSearchCache,
} from '../src/services/search/webSearchService';

describe('Stage 2/3 Upgrade: Live Web Search Caching & Optimization', () => {
  beforeEach(() => {
    clearSearchCache();
    vi.restoreAllMocks();
  });

  it('determines whether queries require real-time search', () => {
    expect(shouldSearchWeb('hello jarvis')).toBe(false);
    expect(shouldSearchWeb('thank you')).toBe(false);
    expect(
      shouldSearchWeb('who is the current prime minister of the UK?'),
    ).toBe(true);
    expect(shouldSearchWeb('latest stock price of Apple')).toBe(true);
    expect(shouldSearchWeb('what actor died recently?')).toBe(true);
  });

  it('augments temporal queries with current year and month', () => {
    const extracted = extractSearchKeywords(
      'Hey Jarvis, which actor died recently?',
    );
    const now = new Date();
    const currentYear = String(now.getFullYear());
    expect(extracted).toContain('which actor died recently');
    expect(extracted).toContain(currentYear);
  });

  it('caches search results in LRU cache to avoid duplicate network requests', async () => {
    const mockHtml = `
      <h2 class="result__title"><a class="result__url" href="https://example.com">First Result</a></h2>
      <a class="result__snippet">Sample snippet for first query result.</a>
    `;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => mockHtml,
    });
    global.fetch = fetchMock;

    // First call: executes fetch
    const results1 = await searchWeb('weather today in London');
    expect(results1.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call: served instantly from cache (0ms latency)
    const results2 = await searchWeb('weather today in London');
    expect(results2).toEqual(results1);
    expect(fetchMock).toHaveBeenCalledTimes(1); // Still 1! Cached!
  });
});
