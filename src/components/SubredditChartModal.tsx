import { useMemo, useState } from 'react';
import type { PostWithMeta } from '../lib/types';
import { getSubredditModelPosts } from '../lib/dataUtils';
import { formatKyivTime, shiftWeekday } from '../lib/timeUtils';

interface Props {
  subreddit: string;
  modelName: string;
  posts: PostWithMeta[];
  onNavigateToSubreddit?: (subreddit: string) => void;
  onClose: () => void;
}

type Tab = 'chart' | 'posts';
type PostSortKey = 'score' | 'date';

function CloseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
function StatsIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 3v18h18" /><path d="M7 14v3M12 10v7M17 6v11" /></svg>;
}
function CopyIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
}
function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>;
}

// Row order Mon..Sun; label indexed by JS Date.getUTCDay() (0=Sun..6=Sat) —
// same convention as SubredditActivityHeatmap / AccountMetricsChart.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard API unavailable — fail silently.
    }
  };
  return (
    <button onClick={handleCopy} title="Скопировать тайтл" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0, color: copied ? 'var(--success-text)' : 'var(--text-faint)', flexShrink: 0 }}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

interface WeekdayStat {
  jsDay: number;
  label: string;
  count: number;
  avg: number;
}

function WeekdayPerformanceChart({ posts }: { posts: PostWithMeta[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const stats: WeekdayStat[] = useMemo(() => {
    const byDay = Array.from({ length: 7 }, () => ({ count: 0, totalScore: 0 }));
    for (const p of posts) {
      const day = shiftWeekday(p.created_utc);
      byDay[day].count += 1;
      byDay[day].totalScore += p.score;
    }
    return WEEKDAY_ORDER.map(jsDay => ({
      jsDay,
      label: WEEKDAY_LABELS[jsDay],
      count: byDay[jsDay].count,
      avg: byDay[jsDay].count > 0 ? Math.round((byDay[jsDay].totalScore / byDay[jsDay].count) * 10) / 10 : 0,
    }));
  }, [posts]);

  const maxAvg = Math.max(1, ...stats.map(s => s.avg));
  const bestIdx = stats.reduce((best, s, i) => (s.avg > stats[best].avg ? i : best), 0);
  const hasAnyData = stats.some(s => s.count > 0);

  const W = 640, H = 260, PAD_L = 44, PAD_R = 16, PAD_T = 16, PAD_B = 34;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const bandW = plotW / stats.length;
  const barW = Math.min(40, bandW * 0.5);
  const yFor = (v: number) => PAD_T + (1 - v / (maxAvg * 1.15)) * plotH;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxAvg * 1.15 * f));

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10 }}>
        Средние апвоуты по дню недели · вся история модели в этом сабреддите ({posts.length} пост{posts.length === 1 ? '' : 'ов'})
      </div>

      {!hasAnyData ? (
        <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 12, padding: '60px 0' }}>Нет данных для графика</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yFor(t)} y2={yFor(t)} stroke="var(--background)" strokeWidth={1} />
              <text x={PAD_L - 8} y={yFor(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--text-faint)" fontFamily="var(--font-mono)">{t}</text>
            </g>
          ))}
          <line x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} stroke="var(--border)" strokeWidth={1} />

          {stats.map((s, i) => {
            const cx = PAD_L + bandW * i + bandW / 2;
            const top = yFor(s.avg);
            const bottom = H - PAD_B;
            const isBest = i === bestIdx && s.avg > 0;
            const dimmed = hoverIdx !== null && hoverIdx !== i;
            return (
              <g
                key={s.jsDay}
                style={{ cursor: 'default' }}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                <rect
                  x={cx - barW / 2}
                  y={top}
                  width={barW}
                  height={Math.max(0, bottom - top)}
                  rx={4}
                  fill={isBest ? 'var(--primary)' : 'var(--disabled)'}
                  opacity={dimmed ? 0.5 : 1}
                  style={{ transition: 'opacity 0.1s' }}
                />
                {s.avg > 0 && (
                  <text x={cx} y={top - 6} textAnchor="middle" fontSize={10.5} fontWeight={isBest ? 700 : 500} fill={isBest ? 'var(--primary)' : 'var(--text-secondary)'} fontFamily="var(--font-mono)">
                    {s.avg}
                  </text>
                )}
                <text x={cx} y={H - PAD_B + 16} textAnchor="middle" fontSize={11} fontWeight={isBest ? 700 : 400} fill={isBest ? 'var(--primary)' : 'var(--text-faint)'} fontFamily="var(--font-sans)">
                  {s.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {hoverIdx !== null && stats[hoverIdx].count > 0 && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text-secondary)' }}>
          <b style={{ color: 'var(--text)' }}>{stats[hoverIdx].label}</b> · среднее {stats[hoverIdx].avg} апвоутов · {stats[hoverIdx].count} пост{stats[hoverIdx].count === 1 ? '' : 'ов'}
        </div>
      )}
    </div>
  );
}

function PostsTab({ posts }: { posts: PostWithMeta[] }) {
  const [sortKey, setSortKey] = useState<PostSortKey>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const perPage = 8;

  const sorted = useMemo(() => [...posts].sort((a, b) => {
    const av = sortKey === 'score' ? a.score : a.created_utc;
    const bv = sortKey === 'score' ? b.score : b.created_utc;
    return sortDir === 'asc' ? av - bv : bv - av;
  }), [posts, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const clampedPage = Math.min(page, totalPages - 1);
  const paginated = sorted.slice(clampedPage * perPage, (clampedPage + 1) * perPage);

  const handleSort = (key: PostSortKey) => {
    if (key === sortKey) setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setSortDir('desc'); }
    setPage(0);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {(['score', 'date'] as const).map(k => (
          <button
            key={k}
            onClick={() => handleSort(k)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: sortKey === k ? 'var(--primary-light)' : 'var(--surface)',
              border: '1px solid ' + (sortKey === k ? 'var(--primary-border)' : 'var(--border)'),
              borderRadius: 5, color: sortKey === k ? 'var(--primary)' : 'var(--text-muted)',
              padding: '4px 10px', fontSize: 11, fontWeight: sortKey === k ? 600 : 400,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            {k === 'score' ? 'Апвоуты' : 'Дата'} {sortKey === k && (sortDir === 'desc' ? '↓' : '↑')}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', alignSelf: 'center' }}>
          {posts.length} пост{posts.length === 1 ? '' : 'ов'}
        </span>
      </div>

      {sorted.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: 12 }}>
          Нет постов в этом сабреддите для текущих фильтров
        </div>
      ) : (
        <>
          <div>
            {paginated.map(post => (
              <div key={post.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 2px', borderBottom: '1px solid var(--border-light)' }}>
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={post.title}
                  style={{ flex: 1, minWidth: 0, color: 'var(--text)', textDecoration: 'none' }}
                  onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                  <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{formatKyivTime(post.created_utc)}</div>
                </a>
                <span style={{ fontSize: 12.5, color: '#FF4500', fontWeight: 600, fontFamily: 'var(--font-mono)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  ▲ {post.score}
                </span>
                <CopyButton text={post.title} />
              </div>
            ))}
          </div>

          {sorted.length > perPage && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, marginTop: 4 }}>
              <span style={{ color: 'var(--text-faint)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                {clampedPage * perPage + 1}–{Math.min((clampedPage + 1) * perPage, sorted.length)} of {sorted.length}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={clampedPage === 0}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, color: clampedPage === 0 ? 'var(--disabled)' : 'var(--text-secondary)', padding: '4px 10px', cursor: clampedPage === 0 ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                >
                  ← Назад
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={clampedPage >= totalPages - 1}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, color: clampedPage >= totalPages - 1 ? 'var(--disabled)' : 'var(--text-secondary)', padding: '4px 10px', cursor: clampedPage >= totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                >
                  Далее →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SubredditChartModal({ subreddit, modelName, posts, onNavigateToSubreddit, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('posts');

  // The weekday chart deliberately ignores the page's active period/account
  // filters — it needs the model's whole history in this subreddit to say
  // anything meaningful about which days tend to perform better.
  const allTimePosts = useMemo(() => getSubredditModelPosts(subreddit, modelName), [subreddit, modelName]);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 12, width: 'min(760px, 100%)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-md)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--background)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>r/{subreddit}</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>{modelName}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            {onNavigateToSubreddit && (
              <button
                onClick={() => { onClose(); onNavigateToSubreddit(subreddit); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, background: 'var(--primary-light)',
                  border: '1px solid var(--primary-border)', borderRadius: 6, color: 'var(--primary)',
                  padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--primary-light-alt)')}
                onMouseOut={e => (e.currentTarget.style.background = 'var(--primary-light)')}
              >
                <StatsIcon />
                Статистика сабреддита
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 4, lineHeight: 0, flexShrink: 0 }}>
              <CloseIcon />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '10px 20px 0' }}>
          {([['posts', 'Посты'], ['chart', 'График']] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '8px 16px', fontSize: 12.5, fontWeight: tab === key ? 600 : 400,
                color: tab === key ? 'var(--primary)' : 'var(--text-muted)',
                background: 'none', border: 'none', borderBottom: '2px solid ' + (tab === key ? 'var(--primary)' : 'transparent'),
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ padding: 20, overflowY: 'auto' }}>
          {tab === 'posts' ? <PostsTab posts={posts} /> : <WeekdayPerformanceChart posts={allTimePosts} />}
        </div>
      </div>
    </div>
  );
}
