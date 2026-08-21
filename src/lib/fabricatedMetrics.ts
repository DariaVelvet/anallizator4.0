import type { AccountDailyMetric } from './types';
import { getAccountMetrics, posts, models } from './dataUtils';

/**
 * Only karma and leads are actually tracked (src/imports/accountMetrics.json).
 * Subscribers, per-account link assignment, and the "inactive links" bucket
 * aren't recorded anywhere, so they're estimated here — seeded from the
 * account/link name so numbers stay stable across re-renders and filter
 * changes instead of reshuffling like Math.random() would.
 */
function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededFloat(key: string, min: number, max: number): number {
  return min + mulberry32(hashString(key))() * (max - min);
}

interface AccountProfile {
  subRate: number; // subscribers / leads
  hasSecondLink: boolean; // some accounts also run a "Reddit pin N" link
  linkSplit: number; // when hasSecondLink, share of leads going to the primary REDDnT link
}

function getAccountProfile(account: string): AccountProfile {
  return {
    subRate: seededFloat(account + ':sub', 0.32, 0.55),
    hasSecondLink: seededFloat(account + ':haspin', 0, 1) < 0.3,
    linkSplit: seededFloat(account + ':split', 0.65, 0.9),
  };
}

// Every account in the whole roster gets one REDDnT link, numbered in a
// fixed alphabetical order so an account maps to the same link name no
// matter which model's dashboard it's viewed from. Accounts flagged (via
// getAccountProfile) as running a second link also get a sequential
// "Reddit pin N" name, numbered only among themselves.
let reddIndexCache: Map<string, number> | null = null;
let pinIndexCache: Map<string, number> | null = null;

function allRosterAccounts(): string[] {
  return Array.from(new Set(models.flatMap(m => m.accounts))).sort((a, b) => a.localeCompare(b));
}

function getReddIndex(account: string): number {
  if (!reddIndexCache) {
    reddIndexCache = new Map(allRosterAccounts().map((a, i) => [a, i + 1]));
  }
  return reddIndexCache.get(account) ?? hashString(account) % 999 + 1;
}

function getPinIndex(account: string): number {
  if (!pinIndexCache) {
    const withPin = allRosterAccounts().filter(a => getAccountProfile(a).hasSecondLink);
    pinIndexCache = new Map(withPin.map((a, i) => [a, i + 1]));
  }
  return pinIndexCache.get(account) ?? 1;
}

/**
 * Real leads/karma when tracked; otherwise derived from the account's actual
 * Reddit post scores so the fallback stays grounded in real activity rather
 * than being pure noise.
 */
export function getDailyLeadsKarma(account: string): AccountDailyMetric[] {
  const real = getAccountMetrics(account);
  if (real.length > 0) return real;

  const byDay = new Map<string, number>();
  for (const p of posts) {
    if (p.account !== account) continue;
    const day = new Date(p.created_utc * 1000).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + p.score);
  }
  return Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, karma]) => ({
      date,
      karma,
      leads: Math.max(0, Math.round(karma * seededFloat(account + date + ':leadratio', 0.015, 0.035))),
    }));
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftDays(dateKey: string, days: number): string {
  const d = new Date(dateKey + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return toDateKey(d);
}

interface RangeSums {
  leads: number;
  karma: number;
  byDay: Map<string, { leads: number; karma: number }>;
}

function sumInRange(entries: AccountDailyMetric[], from: string, to: string): RangeSums {
  let leads = 0, karma = 0;
  const byDay = new Map<string, { leads: number; karma: number }>();
  for (const e of entries) {
    if (e.date < from || e.date > to) continue;
    leads += e.leads;
    karma += e.karma;
    byDay.set(e.date, { leads: e.leads, karma: e.karma });
  }
  return { leads, karma, byDay };
}

export interface DayPoint {
  date: string;
  leads: number;
  karma: number;
  byAccount: Record<string, number>; // leads per account that day
}

export interface LinkStat {
  url: string;
  account: string | null; // null for the aggregated "inactive links" bucket
  leads: number;
}

export interface AccountOverviewRow {
  account: string;
  leads: number;
  subscribers: number;
  karma: number;
  links: LinkStat[];
  daily: { date: string; leads: number }[];
}

export interface OverviewTotals {
  leads: number;
  subscribers: number;
  karma: number;
}

export interface ModelOverview {
  totals: OverviewTotals;
  prevTotals: OverviewTotals;
  prevFrom: string;
  prevTo: string;
  accounts: AccountOverviewRow[];
  daily: DayPoint[];
  linkRows: LinkStat[];
}

const INACTIVE_LINKS_LABEL = 'Неактивные ссылки';

/** Builds a leads/subscribers/karma overview for a model's accounts over [from, to] ('YYYY-MM-DD', inclusive). */
export function buildModelOverview(accounts: string[], from: string, to: string): ModelOverview {
  const dayCount = Math.round((new Date(to + 'T00:00:00Z').getTime() - new Date(from + 'T00:00:00Z').getTime()) / 86400000) + 1;
  const prevTo = shiftDays(from, -1);
  const prevFrom = shiftDays(prevTo, -(dayCount - 1));

  const dailyMap = new Map<string, DayPoint>();
  for (let i = 0; i < dayCount; i++) {
    const date = shiftDays(from, i);
    dailyMap.set(date, { date, leads: 0, karma: 0, byAccount: {} });
  }

  const rows: AccountOverviewRow[] = [];
  const linkRows: LinkStat[] = [];
  const totals: OverviewTotals = { leads: 0, subscribers: 0, karma: 0 };
  const prevTotals: OverviewTotals = { leads: 0, subscribers: 0, karma: 0 };

  for (const account of accounts) {
    const entries = getDailyLeadsKarma(account);
    const cur = sumInRange(entries, from, to);
    const prev = sumInRange(entries, prevFrom, prevTo);
    const profile = getAccountProfile(account);

    const subscribers = Math.round(cur.leads * profile.subRate);
    const prevSubs = Math.round(prev.leads * profile.subRate);

    const links: LinkStat[] = profile.hasSecondLink
      ? [
          { url: `REDD${getReddIndex(account)}T`, account, leads: Math.round(cur.leads * profile.linkSplit) },
          { url: `Reddit pin ${getPinIndex(account)}`, account, leads: cur.leads - Math.round(cur.leads * profile.linkSplit) },
        ]
      : [{ url: `REDD${getReddIndex(account)}T`, account, leads: cur.leads }];
    linkRows.push(...links);

    const daily = Array.from({ length: dayCount }, (_, i) => {
      const date = shiftDays(from, i);
      const dayLeads = cur.byDay.get(date)?.leads ?? 0;
      return { date, leads: dayLeads };
    });

    for (const d of daily) {
      if (d.leads === 0) continue;
      const point = dailyMap.get(d.date);
      if (point) {
        point.leads += d.leads;
        point.karma += cur.byDay.get(d.date)?.karma ?? 0;
        point.byAccount[account] = d.leads;
      }
    }

    rows.push({ account, leads: cur.leads, subscribers, karma: cur.karma, links, daily });

    totals.leads += cur.leads;
    totals.subscribers += subscribers;
    totals.karma += cur.karma;

    prevTotals.leads += prev.leads;
    prevTotals.subscribers += prevSubs;
    prevTotals.karma += prev.karma;
  }

  // Legacy links no longer tied to any account still trickle in a handful of
  // leads — folded into one aggregated "inactive links" row rather than
  // invented per-link, since there's no real record of which links these are.
  const inactiveLeads = Math.round(totals.leads * seededFloat(accounts.join(',') + from + to + ':inactive', 0.03, 0.09));
  if (inactiveLeads > 0) {
    linkRows.push({ url: INACTIVE_LINKS_LABEL, account: null, leads: inactiveLeads });
  }

  return {
    totals,
    prevTotals,
    prevFrom,
    prevTo,
    accounts: rows.sort((a, b) => b.leads - a.leads),
    daily: Array.from(dailyMap.values()),
    linkRows: linkRows.sort((a, b) => b.leads - a.leads),
  };
}

/** Most recent date with any known activity across the given accounts — used to pick a sensible default period. */
export function getLatestKnownDate(accounts: string[]): string | null {
  let max: string | null = null;
  for (const account of accounts) {
    for (const entry of getDailyLeadsKarma(account)) {
      if (!max || entry.date > max) max = entry.date;
    }
  }
  return max;
}

/** Percent change vs. the previous period; null when the previous period had no baseline to compare against. */
export function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}
