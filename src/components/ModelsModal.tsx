import { useMemo, useState } from 'react';
import { getSubredditModelBreakdown, getSubredditModelPosts } from '../lib/dataUtils';
import { formatKyivTime } from '../lib/timeUtils';
import { TeamBadge, TEAM_FILTER_LABELS, type TeamFilter } from './AccountIdentity';
import AvatarLink from './AvatarLink';

type PostSortKey = 'score' | 'date';

function CloseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}

function StatsIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 3v18h18" /><path d="M7 14v3M12 10v7M17 6v11" /></svg>;
}

function BackIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6" /></svg>;
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
      // Clipboard API unavailable (permissions/insecure context) — fail silently.
    }
  };

  return (
    <button
      onClick={handleCopy}
      title="Скопировать тайтл"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 4,
        lineHeight: 0,
        color: copied ? 'var(--success-text)' : 'var(--text-faint)',
        flexShrink: 0,
      }}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

export function ModelPostsView({
  subreddit,
  modelName,
  avatar,
  onBack,
}: {
  subreddit: string;
  modelName: string;
  avatar: string;
  onBack: () => void;
}) {
  const [sortKey, setSortKey] = useState<PostSortKey>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const perPage = 8;

  const posts = getSubredditModelPosts(subreddit, modelName);
  const sorted = [...posts].sort((a, b) => {
    const av = sortKey === 'score' ? a.score : a.created_utc;
    const bv = sortKey === 'score' ? b.score : b.created_utc;
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const clampedPage = Math.min(page, totalPages - 1);
  const paginated = sorted.slice(clampedPage * perPage, (clampedPage + 1) * perPage);

  const handleSort = (key: PostSortKey) => {
    if (key === sortKey) setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(0);
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--background)' }}>
        <button
          onClick={onBack}
          title="Назад к моделям"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, lineHeight: 0, flexShrink: 0 }}
        >
          <BackIcon />
        </button>
        <AvatarLink src={avatar} size={26} alt={modelName} fallbackLetter={modelName[0]} border="1.5px solid var(--border)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{modelName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>r/{subreddit} · {posts.length} post{posts.length === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: '8px 18px', borderBottom: '1px solid var(--background)' }}>
        {(['score', 'date'] as const).map(k => (
          <button
            key={k}
            onClick={() => handleSort(k)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: sortKey === k ? 'var(--primary-light)' : 'var(--surface)',
              border: '1px solid ' + (sortKey === k ? 'var(--primary-border)' : 'var(--border)'),
              borderRadius: 5,
              color: sortKey === k ? 'var(--primary)' : 'var(--text-muted)',
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: sortKey === k ? 600 : 400,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {k === 'score' ? 'Апвоуты' : 'Дата'} {sortKey === k && (sortDir === 'desc' ? '↓' : '↑')}
          </button>
        ))}
      </div>

      <div style={{ overflowY: 'auto', padding: '4px 0' }}>
        {sorted.length === 0 ? (
          <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 12 }}>Нет постов</div>
        ) : (
          paginated.map(post => (
            <div key={post.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px' }}>
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
                <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{formatKyivTime(post.created_utc)}</div>
              </a>
              <span style={{ fontSize: 12, color: '#FF4500', fontWeight: 600, fontFamily: 'var(--font-mono)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                ▲ {post.score}
              </span>
              <CopyButton text={post.title} />
            </div>
          ))
        )}
      </div>

      {sorted.length > perPage && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 18px',
          borderTop: '1px solid var(--background)',
          background: 'var(--hover-bg)',
        }}>
          <span style={{ color: 'var(--text-faint)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            {clampedPage * perPage + 1}–{Math.min((clampedPage + 1) * perPage, sorted.length)} of {sorted.length}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={clampedPage === 0}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 5,
                color: clampedPage === 0 ? 'var(--disabled)' : 'var(--text-secondary)',
                padding: '4px 10px',
                cursor: clampedPage === 0 ? 'not-allowed' : 'pointer',
                fontSize: 11,
                fontFamily: 'var(--font-sans)',
              }}
            >
              ← Назад
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={clampedPage >= totalPages - 1}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 5,
                color: clampedPage >= totalPages - 1 ? 'var(--disabled)' : 'var(--text-secondary)',
                padding: '4px 10px',
                cursor: clampedPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                fontSize: 11,
                fontFamily: 'var(--font-sans)',
              }}
            >
              Далее →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function ModelsModal({
  subreddit,
  onClose,
  onNavigateToModel,
  onNavigateToSubreddit,
}: {
  subreddit: string;
  onClose: () => void;
  onNavigateToModel: (modelName: string) => void;
  onNavigateToSubreddit?: (subreddit: string) => void;
}) {
  const [postsView, setPostsView] = useState<{ modelName: string; avatar: string } | null>(null);
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');
  const breakdown = getSubredditModelBreakdown(subreddit);

  const filteredBreakdown = useMemo(() => {
    return breakdown.filter(m => {
      if (teamFilter !== 'all' && m.team !== teamFilter) return false;
      if (search && !m.modelName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [breakdown, search, teamFilter]);

  const handleNavigate = (modelName: string) => {
    onClose();
    onNavigateToModel(modelName);
  };

  return (
    <div
      onClick={onClose}
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
        {postsView === null ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--background)' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>r/{subreddit}</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>Модели · всё время · {filteredBreakdown.length}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                {onNavigateToSubreddit && (
                  <button
                    onClick={() => { onClose(); onNavigateToSubreddit(subreddit); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'var(--primary-light)',
                      border: '1px solid var(--primary-border)',
                      borderRadius: 6,
                      color: 'var(--primary)',
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = 'var(--primary-light-alt)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'var(--primary-light)')}
                  >
                    <StatsIcon />
                    Статистика сабреддита
                  </button>
                )}
                <button
                  onClick={onClose}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 4, lineHeight: 0, flexShrink: 0 }}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--background)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск модели..."
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: 12,
                  fontFamily: 'var(--font-sans)',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
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
            </div>

            <div style={{ overflowY: 'auto', padding: '6px 0' }}>
              {filteredBreakdown.length === 0 ? (
                <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 12 }}>Нет данных</div>
              ) : (
                filteredBreakdown.map(m => (
                  <div key={m.modelName} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px' }}>
                    <button
                      onClick={() => handleNavigate(m.modelName)}
                      title="Открыть страницу модели"
                      style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
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
                      style={{
                        fontSize: 12,
                        color: 'var(--primary)',
                        fontFamily: 'var(--font-mono)',
                        background: 'var(--primary-light)',
                        border: 'none',
                        borderRadius: 5,
                        padding: '3px 9px',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {m.count} post{m.count === 1 ? '' : 's'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <ModelPostsView
            subreddit={subreddit}
            modelName={postsView.modelName}
            avatar={postsView.avatar}
            onBack={() => setPostsView(null)}
          />
        )}
      </div>
    </div>
  );
}
