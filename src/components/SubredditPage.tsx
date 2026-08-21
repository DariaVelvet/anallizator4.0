import { useMemo, useState } from 'react';
import {
  getPostsForSubreddit,
  getSubredditRules,
  getSubredditModelBreakdown,
  withMeta,
} from '../lib/dataUtils';
import { formatAccountAge, formatKyivTime } from '../lib/timeUtils';
import { TeamBadge, TEAM_FILTER_LABELS, type TeamFilter } from './AccountIdentity';
import AvatarLink from './AvatarLink';
import ThemeToggle from './ThemeToggle';
import SubredditActivityHeatmap from './SubredditActivityHeatmap';
import { ModelPostsView } from './ModelsModal';

interface Props {
  subreddit: string;
  onNavigateToModel: (modelName: string) => void;
  onBack: () => void;
}

function BackIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6" /></svg>;
}

function ExternalLinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6M10 14 21 3" />
    </svg>
  );
}

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
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      )}
    </button>
  );
}

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{label}</div>
    </div>
  );
}

function RuleCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div title={hint} style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-light)', borderRadius: 8, padding: '12px 16px', minWidth: 140 }}>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    </div>
  );
}

export default function SubredditPage({ subreddit, onNavigateToModel, onBack }: Props) {
  const [modelSearch, setModelSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');
  const [postsView, setPostsView] = useState<{ modelName: string; avatar: string } | null>(null);

  const rules = useMemo(() => getSubredditRules(subreddit), [subreddit]);
  const rawPosts = useMemo(() => getPostsForSubreddit(subreddit), [subreddit]);
  const postsWithMeta = useMemo(() => withMeta(rawPosts), [rawPosts]);
  const breakdown = useMemo(() => getSubredditModelBreakdown(subreddit), [subreddit]);

  const filteredBreakdown = useMemo(() => {
    return breakdown.filter(m => {
      if (teamFilter !== 'all' && m.team !== teamFilter) return false;
      if (modelSearch && !m.modelName.toLowerCase().includes(modelSearch.toLowerCase())) return false;
      return true;
    });
  }, [breakdown, modelSearch, teamFilter]);

  const topPosts = useMemo(
    () => [...postsWithMeta].sort((a, b) => b.successScore - a.successScore),
    [postsWithMeta],
  );

  const n = rawPosts.length;
  const totalUpvotes = rawPosts.reduce((s, p) => s + p.score, 0);
  const totalComments = rawPosts.reduce((s, p) => s + p.comments, 0);
  const avgUpvotes = n > 0 ? Math.round((totalUpvotes / n) * 10) / 10 : 0;
  const maxUpvotes = n > 0 ? Math.max(...rawPosts.map(p => p.score)) : 0;
  const avgComments = n > 0 ? Math.round((totalComments / n) * 10) / 10 : 0;
  const maxComments = n > 0 ? Math.max(...rawPosts.map(p => p.comments)) : 0;
  const score = n > 0 ? Math.round(((totalUpvotes + 10 * totalComments) / n) * 10) / 10 : 0;

  return (
    <div>
      <div style={{ position: 'sticky', top: 0, zIndex: 60, background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <button
            onClick={onBack}
            title="Назад к таблице"
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 12px',
              cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'var(--font-sans)', flexShrink: 0,
            }}
          >
            <BackIcon />
            Назад
          </button>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>r/{subreddit}</span>
              <a
                href={`https://reddit.com/r/${subreddit}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Открыть на Reddit"
                style={{ color: 'var(--text-faint)', display: 'flex', opacity: 0.6 }}
                onMouseOver={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--primary)'; }}
                onMouseOut={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.color = 'var(--text-faint)'; }}
              >
                <ExternalLinkIcon />
              </a>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 3 }}>Все данные о сабреддите · всё время</div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <StatTile value={n} label="постов всего" />
            <StatTile value={avgUpvotes} label="средние апвоуты" />
            <StatTile value={maxUpvotes} label="макс. апвоуты" />
            <StatTile value={avgComments} label="средние комменты" />
            <StatTile value={maxComments} label="макс. комменты" />
            <StatTile value={score} label="score" />
          </div>

          <ThemeToggle />
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Posting requirements */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Правила постинга</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <RuleCard
              label="Bot Bouncer"
              value={rules.botBouncer === null ? '—' : rules.botBouncer ? 'Да' : 'Нет'}
            />
            <RuleCard
              label="Мин. возраст аккаунта"
              value={rules.minAccountAgeDays === null ? '—' : formatAccountAge(rules.minAccountAgeDays)}
            />
            <RuleCard
              label="Мин. карма"
              value={rules.minPostKarma === null && rules.minCommentKarma === null ? '—' : (rules.minPostKarma ?? 0) + (rules.minCommentKarma ?? 0)}
              hint={rules.minPostKarma === null && rules.minCommentKarma === null ? undefined : `Карма постов: ${rules.minPostKarma ?? '—'} · Карма комментариев: ${rules.minCommentKarma ?? '—'}`}
            />
          </div>
        </div>

        <SubredditActivityHeatmap posts={rawPosts} />

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Models breakdown */}
          <div style={{ flex: '1 1 320px', minWidth: 300, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
              Модели, постящие в этот сабреддит · {filteredBreakdown.length}
            </div>
            <input
              type="text"
              value={modelSearch}
              onChange={e => setModelSearch(e.target.value)}
              placeholder="Поиск модели..."
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-sans)', boxSizing: 'border-box', marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {(['all', 'velvet', 'gb'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTeamFilter(t)}
                  style={{
                    flex: 1,
                    background: teamFilter === t ? 'var(--primary-light)' : 'var(--surface)',
                    border: '1px solid ' + (teamFilter === t ? 'var(--primary-border)' : 'var(--border)'),
                    borderRadius: 5,
                    color: teamFilter === t ? 'var(--primary)' : 'var(--text-muted)',
                    padding: '5px 0',
                    fontSize: 12,
                    fontWeight: teamFilter === t ? 600 : 400,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {TEAM_FILTER_LABELS[t]}
                </button>
              ))}
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {filteredBreakdown.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: 12 }}>Ничего не найдено</div>
              ) : (
                filteredBreakdown.map(m => (
                  <div key={m.modelName} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px' }}>
                    <button
                      onClick={() => onNavigateToModel(m.modelName)}
                      title="Открыть страницу модели"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 0%', minWidth: 0,
                        background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', borderRadius: 6,
                      }}
                      onMouseOver={e => (e.currentTarget.style.opacity = '0.7')}
                      onMouseOut={e => (e.currentTarget.style.opacity = '1')}
                    >
                      <AvatarLink src={m.avatar} size={28} alt={m.modelName} fallbackLetter={m.modelName[0]} border="1.5px solid var(--border)" />
                      <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 0%', minWidth: 0 }}>{m.modelName}</span>
                      {m.team && <TeamBadge team={m.team} />}
                    </button>
                    <button
                      onClick={() => setPostsView({ modelName: m.modelName, avatar: m.avatar })}
                      title="Показать посты модели в этом сабреддите"
                      style={{ fontSize: 12, color: 'var(--primary)', fontFamily: 'var(--font-mono)', background: 'var(--primary-light)', border: 'none', borderRadius: 5, padding: '3px 9px', cursor: 'pointer', flexShrink: 0 }}
                    >
                      {m.count} post{m.count === 1 ? '' : 's'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top posts */}
          <div style={{ flex: '1 1 380px', minWidth: 320, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Топ посты</div>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {topPosts.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: 12 }}>Нет постов</div>
              ) : (
                topPosts.map(post => (
                  <div key={post.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px', borderBottom: '1px solid var(--background)' }}>
                    <AvatarLink src={post.modelAvatar} size={24} alt={post.modelName} fallbackLetter={post.modelName[0]} border="1.5px solid var(--border)" />
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={post.title}
                      style={{ flex: 1, minWidth: 0, color: 'var(--text)', textDecoration: 'none' }}
                      onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
                      onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}
                    >
                      <div style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                        {post.modelName} · {formatKyivTime(post.created_utc)}
                      </div>
                    </a>
                    <span style={{ fontSize: 12, color: '#FF4500', fontWeight: 600, fontFamily: 'var(--font-mono)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      ▲ {post.score}
                    </span>
                    <CopyButton text={post.title} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {postsView && (
        <div
          onClick={() => setPostsView(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(17, 24, 39, 0.35)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              width: 400,
              maxHeight: '72vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}
          >
            <ModelPostsView
              subreddit={subreddit}
              modelName={postsView.modelName}
              avatar={postsView.avatar}
              onBack={() => setPostsView(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
