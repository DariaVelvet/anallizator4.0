import postsData from '../imports/posts.json';
import modelsData from '../imports/models.json';
import subredditRulesData from '../imports/subredditRules.json';
import accountMetricsData from '../imports/accountMetrics.json';
import type { Post, Model, SubredditStats, PostWithMeta, SubredditModelBreakdownEntry, SubredditRules, AccountDailyMetric } from './types';

export const posts: Post[] = postsData as Post[];
export const models: Model[] = modelsData as Model[];
const subredditRules = subredditRulesData as Record<string, SubredditRules>;
const accountMetrics = accountMetricsData as Record<string, AccountDailyMetric[]>;

const EMPTY_RULES: SubredditRules = { botBouncer: null, minAccountAgeDays: null, minPostKarma: null, minCommentKarma: null };

/** Manually maintained posting requirements for a subreddit (see src/imports/subredditRules.json). */
export function getSubredditRules(subreddit: string): SubredditRules {
  return subredditRules[subreddit] ?? EMPTY_RULES;
}

/** Manually maintained daily karma/leads growth for an account (see src/imports/accountMetrics.json). */
export function getAccountMetrics(account: string): AccountDailyMetric[] {
  return accountMetrics[account] ?? [];
}

export const accountToModel = new Map<string, Model>();
for (const model of models) {
  for (const account of model.accounts) {
    accountToModel.set(account, model);
  }
}

// Precomputed once at load time: for every subreddit, which models posted
// there and how many times, across the *entire* dataset (all-time, ignoring
// any active filters). Used by the subreddit-name hover tooltip.
const subredditModelBreakdown = new Map<string, SubredditModelBreakdownEntry[]>();
{
  const raw = new Map<string, Map<string, { avatar: string; count: number; team?: Model['team'] }>>();
  for (const post of posts) {
    const model = accountToModel.get(post.account);
    const modelName = model?.name ?? 'Unknown';
    const avatar = model?.avatar ?? '';

    let bySub = raw.get(post.subreddit);
    if (!bySub) {
      bySub = new Map();
      raw.set(post.subreddit, bySub);
    }
    const entry = bySub.get(modelName);
    if (entry) entry.count += 1;
    else bySub.set(modelName, { avatar, count: 1, team: model?.team });
  }
  for (const [subreddit, modelMap] of raw.entries()) {
    const list = Array.from(modelMap.entries())
      .map(([modelName, v]) => ({ modelName, avatar: v.avatar, count: v.count, team: v.team }))
      .sort((a, b) => b.count - a.count);
    subredditModelBreakdown.set(subreddit, list);
  }
}

export function getSubredditModelBreakdown(subreddit: string): SubredditModelBreakdownEntry[] {
  return subredditModelBreakdown.get(subreddit) ?? [];
}

/** All-time posts by a single model (across every account she uses), ignoring any active app filters. */
export function getPostsForModel(modelName: string): Post[] {
  return posts.filter(p => (accountToModel.get(p.account)?.name ?? 'Unknown') === modelName);
}

/** All-time posts in a single subreddit, across every model/account, ignoring any active app filters. */
export function getPostsForSubreddit(subreddit: string): Post[] {
  return posts.filter(p => p.subreddit === subreddit);
}

/** Attaches model name/avatar/successScore metadata to a flat list of posts. */
export function withMeta(rawPosts: Post[]): PostWithMeta[] {
  return rawPosts.map(p => {
    const model = accountToModel.get(p.account);
    return {
      ...p,
      modelName: model?.name ?? 'Unknown',
      modelAvatar: model?.avatar ?? '',
      successScore: p.score + 10 * p.comments,
    };
  });
}

/** Filters a post list down to the given accounts (if provided) and date range. */
export function filterPostsByAccountsAndDate(
  sourcePosts: Post[],
  selectedAccounts: string[] | null,
  dateFrom: Date | null,
  dateTo: Date | null,
): Post[] {
  return sourcePosts.filter(post => {
    if (selectedAccounts && !selectedAccounts.includes(post.account)) return false;
    if (dateFrom || dateTo) {
      const postDate = new Date(post.created_utc * 1000);
      if (dateFrom && postDate < dateFrom) return false;
      if (dateTo && postDate > dateTo) return false;
    }
    return true;
  });
}

interface Summary {
  totalPosts: number;
  avgUpvotes: number;
  maxUpvotes: number;
  avgComments: number;
  successFormula: number;
}

function summarize(postList: Post[]): Summary {
  const n = postList.length;
  if (n === 0) return { totalPosts: 0, avgUpvotes: 0, maxUpvotes: 0, avgComments: 0, successFormula: 0 };
  const totalUpvotes = postList.reduce((s, p) => s + p.score, 0);
  const totalComments = postList.reduce((s, p) => s + p.comments, 0);
  return {
    totalPosts: n,
    avgUpvotes: Math.round((totalUpvotes / n) * 10) / 10,
    maxUpvotes: Math.max(...postList.map(p => p.score)),
    avgComments: Math.round((totalComments / n) * 10) / 10,
    successFormula: Math.round(((totalUpvotes + 10 * totalComments) / n) * 10) / 10,
  };
}

/** Every subreddit name that has at least one real (non-u_) post, sorted by post count desc. */
export function allSubredditNames(): string[] {
  const counts = new Map<string, number>();
  for (const p of posts) {
    if (p.subreddit.toLowerCase().startsWith('u_')) continue;
    counts.set(p.subreddit, (counts.get(p.subreddit) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

/** Every reddit account in the dataset, sorted by post count desc. */
export function allAccountNames(): string[] {
  const counts = new Map<string, number>();
  for (const p of posts) counts.set(p.account, (counts.get(p.account) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

/** Subreddits a given model has posted in (excluding u_ profile "subreddits"), sorted by post count desc. */
export function getSubredditNamesForModel(modelName: string): string[] {
  const counts = new Map<string, number>();
  for (const p of getPostsForModel(modelName)) {
    if (p.subreddit.toLowerCase().startsWith('u_')) continue;
    counts.set(p.subreddit, (counts.get(p.subreddit) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

/** All-time comparison stats for a set of subreddits (ignores active app filters -- standalone comparison tool). */
export function compareSubreddits(names: string[]): (Summary & { name: string })[] {
  return names.map(name => ({ name, ...summarize(posts.filter(p => p.subreddit === name)) }));
}

/** All-time comparison stats for a set of reddit accounts. */
export function compareAccounts(names: string[]): (Summary & { name: string })[] {
  return names.map(name => ({ name, ...summarize(posts.filter(p => p.account === name)) }));
}

/** All-time posts by a single model within one specific subreddit — used by the models-modal drill-down. */
export function getSubredditModelPosts(subreddit: string, modelName: string): PostWithMeta[] {
  return posts
    .filter(p => p.subreddit === subreddit && (accountToModel.get(p.account)?.name ?? 'Unknown') === modelName)
    .map(p => {
      const model = accountToModel.get(p.account);
      return {
        ...p,
        modelName: model?.name ?? 'Unknown',
        modelAvatar: model?.avatar ?? '',
        successScore: p.score + 10 * p.comments,
      };
    });
}

/** An account's posts on one calendar day (UTC), top score first — used by the karma/leads chart's per-point hover. */
export function getAccountPostsOnDate(account: string, dateStr: string): PostWithMeta[] {
  return withMeta(posts.filter(p => p.account === account && new Date(p.created_utc * 1000).toISOString().slice(0, 10) === dateStr))
    .sort((a, b) => b.score - a.score);
}

export function getDateRange(preset: string, customFrom: Date | null, customTo: Date | null): [Date | null, Date | null] {
  const now = new Date();
  switch (preset) {
    case 'week': return [new Date(now.getTime() - 7 * 86400000), now];
    case 'month': return [new Date(now.getTime() - 30 * 86400000), now];
    case '3months': return [new Date(now.getTime() - 90 * 86400000), now];
    case 'custom': return [customFrom, customTo];
    default: return [null, null];
  }
}

export function filterPosts(
  selectedModels: string[],
  selectedAccounts: string[],
  dateFrom: Date | null,
  dateTo: Date | null,
  hiddenSubreddits: string[] = [],
): Post[] {
  const hiddenSet = hiddenSubreddits.length > 0 ? new Set(hiddenSubreddits) : null;
  return posts.filter(post => {
    if (hiddenSet && hiddenSet.has(post.subreddit)) return false;

    // Once a model is selected, only the currently selected accounts count.
    // Accounts are auto-selected when a model is picked, but the user can
    // remove some — those removed accounts must be ignored entirely.
    if (selectedModels.length > 0) {
      if (!selectedAccounts.includes(post.account)) return false;
    }

    if (dateFrom || dateTo) {
      const postDate = new Date(post.created_utc * 1000);
      if (dateFrom && postDate < dateFrom) return false;
      if (dateTo && postDate > dateTo) return false;
    }

    return true;
  });
}

export function computeStats(filteredPosts: Post[], searchQuery: string): SubredditStats[] {
  const bySubreddit = new Map<string, Post[]>();

  for (const post of filteredPosts) {
    if (post.subreddit.toLowerCase().startsWith('u_')) continue;
    if (searchQuery && !post.subreddit.toLowerCase().includes(searchQuery.toLowerCase())) continue;
    const existing = bySubreddit.get(post.subreddit);
    if (existing) existing.push(post);
    else bySubreddit.set(post.subreddit, [post]);
  }

  return Array.from(bySubreddit.entries()).map(([subreddit, subPosts]) => {
    const n = subPosts.length;
    const totalUpvotes = subPosts.reduce((s, p) => s + p.score, 0);
    const totalComments = subPosts.reduce((s, p) => s + p.comments, 0);
    const maxUpvotes = Math.max(...subPosts.map(p => p.score));
    const maxComments = Math.max(...subPosts.map(p => p.comments));

    const postsWithMeta: PostWithMeta[] = subPosts.map(p => {
      const model = accountToModel.get(p.account);
      return {
        ...p,
        modelName: model?.name ?? 'Unknown',
        modelAvatar: model?.avatar ?? '',
        successScore: p.score + 10 * p.comments,
      };
    });

    const topPosts = [...postsWithMeta]
      .sort((a, b) => b.successScore - a.successScore)
      .slice(0, 10);

    return {
      subreddit,
      totalPosts: n,
      avgUpvotes: Math.round((totalUpvotes / n) * 10) / 10,
      maxUpvotes,
      avgComments: Math.round((totalComments / n) * 10) / 10,
      maxComments,
      successFormula: Math.round(((totalUpvotes + 10 * totalComments) / n) * 10) / 10,
      topPosts,
      rules: getSubredditRules(subreddit),
    };
  });
}

// Sort keys for the subreddit-rules columns live under `rules` rather than
// directly on SubredditStats, so they need their own accessor. Unknown
// (null) values sort to the bottom regardless of direction.
function getSortValue(row: SubredditStats, key: string): number | string {
  switch (key) {
    case 'botBouncer':
      return row.rules.botBouncer === null ? -1 : row.rules.botBouncer ? 1 : 0;
    case 'minAccountAgeDays':
      return row.rules.minAccountAgeDays ?? -1;
    case 'minKarma':
      return row.rules.minPostKarma === null && row.rules.minCommentKarma === null
        ? -1
        : (row.rules.minPostKarma ?? 0) + (row.rules.minCommentKarma ?? 0);
    default:
      return row[key as keyof SubredditStats] as number | string;
  }
}

export function sortStats(stats: SubredditStats[], key: string, dir: 'asc' | 'desc'): SubredditStats[] {
  return [...stats].sort((a, b) => {
    const av = getSortValue(a, key);
    const bv = getSortValue(b, key);
    if (typeof av === 'string' && typeof bv === 'string') {
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    const an = av as number;
    const bn = bv as number;
    return dir === 'asc' ? an - bn : bn - an;
  });
}
