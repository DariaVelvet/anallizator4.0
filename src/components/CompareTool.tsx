import { useMemo, useState } from 'react';
import { allSubredditNames, allAccountNames, compareSubreddits, compareAccounts, models, accountToModel, getSubredditNamesForModel } from '../lib/dataUtils';
import { SERIES_PALETTE as PALETTE } from '../lib/palette';
import AccountIdentity, { TeamBadge, TEAM_FILTER_LABELS, type TeamFilter } from './AccountIdentity';

interface Props {
  onClose: () => void;
  /** When set, restricts pickable subreddits/accounts to those belonging to this model. */
  modelName?: string;
}

type Mode = 'subreddit' | 'account';
type Metric = 'avgUpvotes' | 'totalPosts' | 'avgComments' | 'successFormula' | 'maxUpvotes';

const METRIC_LABELS: Record<Metric, string> = {
  avgUpvotes: 'Средние апвоуты',
  totalPosts: 'Постов всего',
  avgComments: 'Средние комментарии',
  successFormula: 'Score',
  maxUpvotes: 'Макс. апвоуты',
};

function CloseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}

export default function CompareTool({ onClose, modelName }: Props) {
  const [mode, setMode] = useState<Mode>('subreddit');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [metric, setMetric] = useState<Metric>('avgUpvotes');
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');

  // The account/model breakdown and team split are only meaningful on the
  // unscoped compare view — a model-scoped one (opened from a model's own
  // page) only ever has accounts from that single model/team.
  const showAccountIdentity = mode === 'account' && !modelName;

  const allNames = useMemo(() => {
    if (modelName) {
      if (mode === 'account') return models.find(m => m.name === modelName)?.accounts ?? [];
      return getSubredditNamesForModel(modelName);
    }
    if (mode === 'account') {
      let accounts = allAccountNames();
      if (teamFilter !== 'all') accounts = accounts.filter(acc => accountToModel.get(acc)?.team === teamFilter);
      // Grouped by model rather than raw post count, so accounts belonging
      // to the same model sit next to each other in the picker.
      return [...accounts].sort((a, b) => {
        const modelA = accountToModel.get(a)?.name ?? '';
        const modelB = accountToModel.get(b)?.name ?? '';
        return modelA.localeCompare(modelB) || a.localeCompare(b);
      });
    }
    return allSubredditNames();
  }, [mode, modelName, teamFilter]);
  const visibleNames = useMemo(() => {
    const query = search.toLowerCase();
    return allNames
      .filter(name => {
        if (!query) return true;
        if (name.toLowerCase().includes(query)) return true;
        // Account mode on the unscoped view also matches the owning model's name.
        return showAccountIdentity && (accountToModel.get(name)?.name.toLowerCase().includes(query) ?? false);
      })
      .slice(0, 200);
  }, [allNames, search, showAccountIdentity]);

  const results = useMemo(() => {
    if (selected.length === 0) return [];
    return mode === 'subreddit' ? compareSubreddits(selected) : compareAccounts(selected);
  }, [mode, selected]);

  const maxMetricValue = Math.max(1, ...results.map(r => r[metric]));

  const toggle = (name: string) => {
    setSelected(prev => (prev.includes(name) ? prev.filter(n => n !== name) : prev.length >= 8 ? prev : [...prev, name]));
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setSelected([]);
    setSearch('');
    setTeamFilter('all');
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17, 24, 39, 0.4)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          width: 'min(920px, 100%)',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--background)' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Сравнение</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>
              {modelName
                ? `Сравнивайте сабреддиты или аккаунты модели «${modelName}» между собой (данные за всё время)`
                : 'Сравнивайте сабреддиты или аккаунты между собой (данные за всё время)'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 4, lineHeight: 0 }}>
            <CloseIcon />
          </button>
        </div>

        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          {/* Left: picker */}
          <div style={{ width: 260, borderRight: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 4, padding: '12px 14px 8px' }}>
              {(['subreddit', 'account'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  style={{
                    flex: 1,
                    background: mode === m ? 'var(--primary-light)' : 'var(--surface)',
                    border: '1px solid ' + (mode === m ? 'var(--primary-border)' : 'var(--border)'),
                    borderRadius: 5,
                    color: mode === m ? 'var(--primary)' : 'var(--text-muted)',
                    padding: '6px 0',
                    fontSize: 12,
                    fontWeight: mode === m ? 600 : 400,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {m === 'subreddit' ? 'Сабреддиты' : 'Аккаунты'}
                </button>
              ))}
            </div>
            {mode === 'account' && !modelName && (
              <div style={{ display: 'flex', gap: 4, padding: '0 14px 8px' }}>
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
                      padding: '4px 0',
                      fontSize: 11,
                      fontWeight: teamFilter === t ? 600 : 400,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {TEAM_FILTER_LABELS[t]}
                  </button>
                ))}
              </div>
            )}
            <div style={{ padding: '0 14px 10px' }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={mode === 'subreddit' ? 'Поиск сабреддита...' : showAccountIdentity ? 'Поиск аккаунта или модели...' : 'Поиск аккаунта...'}
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
            </div>
            <div style={{ padding: '0 14px 6px', fontSize: 11, color: 'var(--text-faint)' }}>
              Выбрано {selected.length} / 8
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '0 6px 10px' }}>
              {visibleNames.map(name => {
                const team = showAccountIdentity ? accountToModel.get(name)?.team : undefined;
                return (
                  <label
                    key={name}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 5, cursor: 'pointer', fontSize: 12.5, color: 'var(--text)' }}
                    onMouseOver={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'none')}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(name)}
                      onChange={() => toggle(name)}
                      style={{ accentColor: 'var(--primary)', width: 13, height: 13, flexShrink: 0 }}
                    />
                    {showAccountIdentity ? (
                      <>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <AccountIdentity name={name} compact />
                        </div>
                        {team && <TeamBadge team={team} />}
                      </>
                    ) : (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {mode === 'subreddit' ? `r/${name}` : name}
                      </span>
                    )}
                  </label>
                );
              })}
              {visibleNames.length === 0 && (
                <div style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 12 }}>Ничего не найдено</div>
              )}
            </div>
          </div>

          {/* Right: results */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 20 }}>
            {results.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 13, padding: '60px 0' }}>
                Выберите {mode === 'subreddit' ? 'сабреддиты' : 'аккаунты'} слева, чтобы увидеть сравнение
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
                  {(Object.keys(METRIC_LABELS) as Metric[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setMetric(m)}
                      style={{
                        background: metric === m ? 'var(--primary-light)' : 'var(--surface)',
                        border: '1px solid ' + (metric === m ? 'var(--primary-border)' : 'var(--border)'),
                        borderRadius: 5,
                        color: metric === m ? 'var(--primary)' : 'var(--text-muted)',
                        padding: '5px 10px',
                        fontSize: 11.5,
                        fontWeight: metric === m ? 600 : 400,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {METRIC_LABELS[m]}
                    </button>
                  ))}
                </div>

                {/* Bar chart */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
                  {results.map((r, i) => (
                    <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: showAccountIdentity ? 160 : 130, flexShrink: 0 }}>
                        {showAccountIdentity ? (
                          <AccountIdentity name={r.name} />
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>
                            {mode === 'subreddit' ? `r/${r.name}` : r.name}
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, background: 'var(--background)', borderRadius: 4, overflow: 'hidden', height: 20 }}>
                        <div
                          style={{
                            width: `${Math.max(2, (r[metric] / maxMetricValue) * 100)}%`,
                            height: '100%',
                            background: PALETTE[i % PALETTE.length],
                            borderRadius: 4,
                            transition: 'width 0.2s',
                          }}
                        />
                      </div>
                      <div style={{ width: 64, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                        {r[metric]}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Full data table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
                        {mode === 'subreddit' ? 'Сабреддит' : showAccountIdentity ? 'Аккаунт / Модель' : 'Аккаунт'}
                      </th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Постов</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Avg ▲</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Max ▲</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Avg 💬</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r.name} style={{ borderBottom: '1px solid var(--background)' }}>
                        <td style={{ padding: '7px 8px', color: 'var(--text)' }}>
                          {mode === 'subreddit' ? `r/${r.name}` : showAccountIdentity ? <AccountIdentity name={r.name} compact /> : r.name}
                        </td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{r.totalPosts}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.avgUpvotes}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{r.maxUpvotes}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.avgComments}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--primary)', fontWeight: 600 }}>{r.successFormula}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
