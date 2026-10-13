/**
 * Autonomous Live Web Search Service for J.A.R.V.I.S.
 * Fetches real-time web intelligence silently without requiring API keys or user confirmation.
 */

export interface WebSearchResult {
  title: string;
  snippet: string;
  url?: string;
}

const TRIVIAL_GREETINGS = new Set([
  'hi',
  'hello',
  'hey',
  'how are you',
  'how are you doing',
  'good morning',
  'good afternoon',
  'good evening',
  'good night',
  'who are you',
  'what is your name',
  'what can you do',
  'clear',
  'reset',
  'clear memory',
  'clear history',
  'thanks',
  'thank you',
  'bye',
  'goodbye',
  'ok',
  'okay',
  'cool',
  'great',
  'yes',
  'no',
]);

/**
 * Clean HTML entities and tags from raw text
 */
function cleanHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Determines whether a user directive benefits from live web search intelligence.
 */
export function shouldSearchWeb(rawQuery: string): boolean {
  if (!rawQuery) return false;
  const trimmed = rawQuery.trim();
  const lower = trimmed.toLowerCase();

  // Strip common conversational addressing
  const normalized = lower
    .replace(/^(?:hey\s+|hi\s+|ok\s+|okay\s+)?jarvis[,\s]*/i, '')
    .trim();

  if (TRIVIAL_GREETINGS.has(normalized) || normalized.length < 3) {
    return false;
  }

  // Explicit search requests
  if (
    normalized.startsWith('search ') ||
    normalized.startsWith('lookup ') ||
    normalized.startsWith('look up ') ||
    normalized.startsWith('google ') ||
    normalized.startsWith('browse ') ||
    normalized.startsWith('find out ') ||
    normalized.startsWith('check ') ||
    normalized.includes('on the web') ||
    normalized.includes('on the internet') ||
    normalized.includes('surf the net')
  ) {
    return true;
  }

  // Informational or factual questions
  const hasQuestionMark = trimmed.includes('?');
  const questionWords = [
    'who',
    'what',
    'where',
    'when',
    'why',
    'which',
    'how',
    'is ',
    'are ',
    'was ',
    'were ',
    'can ',
    'did ',
    'does ',
    'will ',
  ];

  const factKeywords = [
    'current',
    'latest',
    'recent',
    'today',
    'now',
    'prime minister',
    'president',
    'capital of',
    'winner',
    'election',
    'score',
    'price of',
    'news',
    'weather',
    'population',
    'released',
    'born',
    'died',
    'net worth',
    'ceo of',
  ];

  const startsWithQuestion = questionWords.some((w) =>
    normalized.startsWith(w),
  );
  const hasFactKeyword = factKeywords.some((k) => normalized.includes(k));

  if (hasQuestionMark || startsWithQuestion || hasFactKeyword) {
    return true;
  }

  // Any non-trivial informational query longer than 15 chars that isn't personal chatter
  if (normalized.length > 20 && !normalized.startsWith('my name is')) {
    return true;
  }

  return false;
}

/**
 * Extract clean search keywords from conversational phrasing
 */
export function extractSearchKeywords(rawQuery: string): string {
  let cleaned = rawQuery.trim();

  // Strip conversational wrappers
  cleaned = cleaned.replace(
    /^(?:hey\s+|hi\s+|ok\s+|okay\s+)?jarvis[,\s]*/i,
    '',
  );
  cleaned = cleaned.replace(/^(?:please\s+|can\s+you\s+|could\s+you\s+)/i, '');
  cleaned = cleaned.replace(
    /^(?:search\s+for\s+|search\s+|look\s+up\s+|lookup\s+|find\s+out\s+|tell\s+me\s+)/i,
    '',
  );
  cleaned = cleaned.replace(/[?.,!]+$/g, '').trim();

  // If query asks about recent / latest events, append current month and year to ensure fresh search hits
  const lower = cleaned.toLowerCase();
  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentMonth = now.toLocaleString('en-US', { month: 'long' });

  const hasRecentTerm =
    lower.includes('recent') ||
    lower.includes('recently') ||
    lower.includes('latest') ||
    lower.includes('today') ||
    lower.includes('yesterday') ||
    lower.includes('this week') ||
    lower.includes('this month') ||
    lower.includes('this year') ||
    lower.includes('just now') ||
    lower.includes('current') ||
    lower.includes('breaking') ||
    lower.includes('died') ||
    lower.includes('passed away');

  if (
    hasRecentTerm &&
    !lower.includes(currentYear) &&
    !lower.includes(currentMonth.toLowerCase())
  ) {
    cleaned = `${cleaned} ${currentMonth} ${currentYear}`;
  }

  return cleaned || rawQuery.trim();
}

interface SearchCacheEntry {
  results: WebSearchResult[];
  timestamp: number;
}

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute freshness window
const MAX_CACHE_ENTRIES = 50;
const searchCache = new Map<string, SearchCacheEntry>();

export function clearSearchCache(): void {
  searchCache.clear();
}

/**
 * Execute silent, live web search via DuckDuckGo HTML endpoint with strict 2.0s timeout and LRU caching.
 */
export async function searchWeb(
  rawQuery: string,
  maxResults = 6,
): Promise<WebSearchResult[]> {
  const query = extractSearchKeywords(rawQuery);
  if (!query) return [];

  const cacheKey = query.toLowerCase().trim();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL_MS) {
    // Refresh LRU position
    searchCache.delete(cacheKey);
    searchCache.set(cacheKey, cached);
    return cached.results;
  }

  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const controller = new AbortController();
  // Strict 2.0s network ceiling to prevent dialogue stalls
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.7',
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[WebSearch] DDG responded with HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();

    const titleRegex =
      /<h2[^>]*class="[^"]*result__title[^"]*"[^>]*>[\s\S]*?<a[^>]*class="result__url"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex =
      /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

    const snippets: string[] = [];
    let sm: RegExpExecArray | null;
    while ((sm = snippetRegex.exec(html)) !== null) {
      const clean = cleanHtml(sm[1]);
      if (clean) snippets.push(clean);
    }

    const titles: string[] = [];
    let tm: RegExpExecArray | null;
    while ((tm = titleRegex.exec(html)) !== null) {
      const clean = cleanHtml(tm[2]);
      if (clean) titles.push(clean);
    }

    const count = Math.min(titles.length, snippets.length, maxResults);
    const results: WebSearchResult[] = [];

    for (let i = 0; i < count; i++) {
      results.push({
        title: titles[i],
        snippet: snippets[i],
      });
    }

    // Store in LRU cache
    if (results.length > 0) {
      if (searchCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = searchCache.keys().next().value;
        if (oldestKey) searchCache.delete(oldestKey);
      }
      searchCache.set(cacheKey, {
        results,
        timestamp: Date.now(),
      });
    }

    return results;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    console.warn(
      '[WebSearch] Silent search skipped due to network/timeout:',
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}

/**
 * Builds the real-time web intelligence prompt to augment JARVIS's context.
 */
export function buildSearchAugmentationPrompt(
  query: string,
  results: WebSearchResult[],
): string {
  if (!results.length) return '';

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const sourcesFormatted = results
    .map((r, i) => `[Source ${i + 1}] ${r.title}: ${r.snippet}`)
    .join('\n');

  return `[REAL-TIME LIVE WEB INTELLIGENCE]
Current System Date: ${dateStr}
Live web intelligence sourced for: "${query}"
${sourcesFormatted}

CRITICAL TEMPORAL DIRECTIVE:
- Today is ${dateStr}.
- When answering queries about events that happened "recently", "latest", or "today", evaluate dates relative to ${dateStr}. Prioritize occurrences closest to today over older dates from months or years prior.
- Incorporate these verified real-time facts directly into your answer with quiet authority. Answer concisely as J.A.R.V.I.S. without stating that you performed a search or quoting the search engine.`;
}
