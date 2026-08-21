export interface Post {
  id: string;
  account: string;
  subreddit: string;
  title: string;
  score: number;
  comments: number;
  created_utc: number;
  url: string;
  /** Whether the post has since been removed/deleted. Defaults to false until confirmed otherwise. */
  removed: boolean;
}

export type Team = 'velvet' | 'gb';

export interface Model {
  name: string;
  avatar: string;
  accounts: string[];
  team?: Team;
}

export interface PostWithMeta extends Post {
  modelName: string;
  modelAvatar: string;
  successScore: number;
}

/** Manually maintained posting requirements for a subreddit — see src/imports/subredditRules.json. */
export interface SubredditRules {
  botBouncer: boolean | null;
  minAccountAgeDays: number | null;
  minPostKarma: number | null;
  minCommentKarma: number | null;
}

export interface SubredditStats {
  subreddit: string;
  totalPosts: number;
  avgUpvotes: number;
  maxUpvotes: number;
  avgComments: number;
  maxComments: number;
  successFormula: number;
  topPosts: PostWithMeta[];
  rules: SubredditRules;
}

export type SortKey = 'subreddit' | 'totalPosts' | 'avgUpvotes' | 'maxUpvotes' | 'avgComments' | 'maxComments' | 'successFormula' | 'botBouncer' | 'minAccountAgeDays' | 'minKarma';
export type SortDir = 'asc' | 'desc';
export type DatePreset = 'week' | 'month' | '3months' | 'all' | 'custom';

export interface SubredditModelBreakdownEntry {
  modelName: string;
  avatar: string;
  count: number;
  team?: Team;
}

/** Manually maintained daily growth per account — see src/imports/accountMetrics.json. */
export interface AccountDailyMetric {
  date: string; // YYYY-MM-DD (UTC)
  karma: number; // karma gained that day
  leads: number; // new leads/fans gained that day
}

export type ChartMetric = 'karma' | 'leads';
export type ChartType = 'line' | 'candle';
