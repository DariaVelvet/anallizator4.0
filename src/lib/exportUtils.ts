import * as XLSX from 'xlsx';
import type { PostWithMeta, SubredditStats } from './types';
import type { AccountOverviewRow } from './fabricatedMetrics';
import { formatAccountAge, formatDateKeyLabel, formatKyivTime, formatKyivTimeOnly, shiftDateKey } from './timeUtils';

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadJson(filename: string, data: unknown): void {
  downloadBlob(filename, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Exports exactly what's currently shown in the table (respecting all active
 * filters/sort) as a real .xlsx workbook — same columns/order as on screen,
 * with the subreddit column as a real clickable hyperlink to Reddit, model
 * *names* instead of avatars in the last column, and column widths matching
 * the on-screen table's spacing.
 */
export function exportCurrentView(stats: SubredditStats[]): void {
  const headers = ['Subreddit', 'Posts', 'Avg Upvotes', 'Max Upvotes', 'Avg Comments', 'Max Comments', 'Score', 'Bot Bouncer', 'Min Account Age', 'Min Karma (post/comment)', 'Top Posts (models)'];
  const rows = stats.map(s => [
    `r/${s.subreddit}`,
    s.totalPosts,
    s.avgUpvotes,
    s.maxUpvotes,
    s.avgComments,
    s.maxComments,
    s.successFormula,
    s.rules.botBouncer === null ? '—' : s.rules.botBouncer ? 'Yes' : 'No',
    s.rules.minAccountAgeDays === null ? '—' : formatAccountAge(s.rules.minAccountAgeDays),
    s.rules.minPostKarma === null && s.rules.minCommentKarma === null
      ? '—'
      : `${s.rules.minPostKarma ?? '—'} / ${s.rules.minCommentKarma ?? '—'}`,
    s.topPosts.map(p => p.modelName).join(', '),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Real, clickable hyperlinks on each subreddit cell — not just plain text.
  stats.forEach((s, i) => {
    const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: 0 });
    const cell = ws[cellRef];
    if (cell) {
      cell.l = { Target: `https://reddit.com/r/${s.subreddit}`, Tooltip: `Открыть r/${s.subreddit} на Reddit` };
    }
  });

  // Column widths mirroring the on-screen table's proportions, so columns
  // aren't cramped together the way a default-width spreadsheet would be.
  ws['!cols'] = [
    { wch: 24 }, // Subreddit
    { wch: 8 },  // Posts
    { wch: 12 }, // Avg Upvotes
    { wch: 12 }, // Max Upvotes
    { wch: 13 }, // Avg Comments
    { wch: 13 }, // Max Comments
    { wch: 10 }, // Score
    { wch: 12 }, // Bot Bouncer
    { wch: 14 }, // Min Account Age
    { wch: 20 }, // Min Karma (post/comment)
    { wch: 46 }, // Top Posts (models)
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Subreddits');
  XLSX.writeFile(wb, `subreddit-stats-${dateStamp()}.xlsx`);
}

/** Exports the given posts as a JSON array — full post objects (with model + removed status), newest first. */
export function exportPostsJson(posts: PostWithMeta[]): void {
  const data = [...posts]
    .sort((a, b) => b.created_utc - a.created_utc)
    .map(p => ({
      date: formatKyivTime(p.created_utc),
      created_utc: p.created_utc,
      subreddit: p.subreddit,
      title: p.title,
      url: p.url,
      score: p.score,
      comments: p.comments,
      account: p.account,
      model: p.modelName,
      removed: p.removed,
    }));

  downloadJson(`posts-${dateStamp()}.json`, data);
}

/**
 * Exports posts grouped by calendar day (Kyiv time), newest day first. Each
 * day opens with a summary row (date, post count, total karma) followed by
 * that day's individual posts: time, subreddit, linked title, removed status.
 */
export function exportDailyPostBreakdown(posts: PostWithMeta[]): void {
  // Shifts run 14:00 → 10:00 next day, so a post made before 10:00 still
  // counts toward the previous day's shift — see shiftDateKey.
  const byDay = new Map<string, PostWithMeta[]>();
  for (const post of posts) {
    const day = shiftDateKey(post.created_utc);
    const arr = byDay.get(day);
    if (arr) arr.push(post);
    else byDay.set(day, [post]);
  }

  const days = Array.from(byDay.keys()).sort((a, b) => b.localeCompare(a));

  const rows: (string | number)[][] = [['Time', 'Account', 'Subreddit', 'Title', 'Upvotes', 'Status']];
  const hyperlinks: { row: number; url: string }[] = [];

  for (const day of days) {
    const dayPosts = byDay.get(day)!.sort((a, b) => b.created_utc - a.created_utc);
    const totalKarma = dayPosts.reduce((sum, p) => sum + p.score, 0);

    rows.push([formatDateKeyLabel(day), `${dayPosts.length} post${dayPosts.length === 1 ? '' : 's'}`, `${totalKarma} karma`, '', '', '']);

    for (const post of dayPosts) {
      rows.push([
        formatKyivTimeOnly(post.created_utc),
        post.account,
        `r/${post.subreddit}`,
        post.title,
        post.score,
        post.removed ? 'REMOVED' : '',
      ]);
      hyperlinks.push({ row: rows.length - 1, url: post.url });
    }

    rows.push(['', '', '', '', '', '']);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  for (const { row, url } of hyperlinks) {
    const cellRef = XLSX.utils.encode_cell({ r: row, c: 3 });
    const cell = ws[cellRef];
    if (cell) cell.l = { Target: url, Tooltip: 'Открыть пост на Reddit' };
  }

  ws['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 70 }, { wch: 10 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Posting by day');
  XLSX.writeFile(wb, `posting-by-day-${dateStamp()}.xlsx`);
}

/** Exports the "Обзор" overview dashboard (leads/subscribers/karma) for a model's accounts. */
export function exportModelOverview(modelName: string, from: string, to: string, accounts: AccountOverviewRow[]): void {
  const summaryHeaders = ['Account', 'Leads', 'Subscribers', 'Karma'];
  const summaryRows = accounts.map(a => [a.account, a.leads, a.subscribers, a.karma]);
  const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  wsSummary['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 10 }];

  const dailyRows: (string | number)[][] = [['Date', 'Account', 'Leads']];
  for (const account of accounts) {
    for (const day of account.daily) {
      dailyRows.push([day.date, account.account, day.leads]);
    }
  }
  const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
  wsDaily['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 10 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily');
  XLSX.writeFile(wb, `${modelName}-overview-${from}_${to}.xlsx`);
}
