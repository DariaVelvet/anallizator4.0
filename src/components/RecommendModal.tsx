import { useEffect, useMemo, useRef, useState } from 'react';
import { models, getSubredditModelBreakdown } from '../lib/dataUtils';
import { TEAM_FILTER_LABELS, TeamBadge, type TeamFilter } from './AccountIdentity';
import AvatarLink from './AvatarLink';

interface Props {
  subreddit: string;
  defaultModelName?: string;
  onClose: () => void;
}

function CloseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
function ChevronDownIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="m6 9 6 6 6-6" /></svg>;
}

type Action = 'recommend' | 'ban';

function countBadgeStyle(count: number): React.CSSProperties {
  return count > 0
    ? { background: 'var(--success-bg)', color: 'var(--success-text)' }
    : { background: 'var(--danger-bg)', color: 'var(--danger-text)' };
}

export default function RecommendModal({ subreddit, defaultModelName, onClose }: Props) {
  const [modelName, setModelName] = useState(defaultModelName ?? models[0]?.name ?? '');
  const [action, setAction] = useState<Action>('recommend');
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [teamFilter, setTeamFilter] = useState<TeamFilter>(
    () => models.find(m => m.name === defaultModelName)?.team ?? 'all',
  );
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const postCountByModel = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of getSubredditModelBreakdown(subreddit)) map.set(entry.modelName, entry.count);
    return map;
  }, [subreddit]);

  const filteredModels = useMemo(() => {
    return [...models]
      .filter(m => teamFilter === 'all' || m.team === teamFilter)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teamFilter]);

  const selectedModel = models.find(m => m.name === modelName);
  const selectedCount = postCountByModel.get(modelName) ?? 0;

  const handleSubmit = () => {
    // Intentionally a no-op beyond local UI state: this is a UI stub only —
    // it doesn't send or persist anything anywhere yet.
    setSent(true);
    setTimeout(onClose, 1100);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17, 24, 39, 0.35)',
        zIndex: 1100,
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
          width: 'min(420px, 100%)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--background)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>r/{subreddit}</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>Рекомендация по сабреддиту</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 4, lineHeight: 0 }}>
            <CloseIcon />
          </button>
        </div>

        {sent ? (
          <div style={{ padding: '32px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>Сохранено (демо)</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>Пока что это просто интерфейс — никуда не отправляется</div>
          </div>
        ) : (
          <div style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Модель</div>
            <div ref={pickerRef} style={{ position: 'relative', marginBottom: 14 }}>
              <button
                onClick={() => setPickerOpen(o => !o)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 6, fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-sans)', cursor: 'pointer',
                }}
              >
                {selectedModel && <AvatarLink src={selectedModel.avatar} size={20} alt={modelName} fallbackLetter={modelName[0]} border="1px solid var(--border)" />}
                <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{modelName}</span>
                {selectedModel?.team && <TeamBadge team={selectedModel.team} />}
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', borderRadius: 5, padding: '2px 7px', flexShrink: 0, ...countBadgeStyle(selectedCount) }}>
                  {selectedCount}
                </span>
                <span style={{ color: 'var(--text-faint)', display: 'flex', flexShrink: 0 }}><ChevronDownIcon /></span>
              </button>

              {pickerOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 1200,
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                  boxShadow: 'var(--shadow-md)', overflow: 'hidden',
                }}>
                  <div style={{ display: 'flex', gap: 4, padding: 8, borderBottom: '1px solid var(--background)' }}>
                    {(['all', 'velvet', 'gb'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setTeamFilter(t)}
                        style={{
                          flex: 1, background: teamFilter === t ? 'var(--primary-light)' : 'var(--surface)',
                          border: '1px solid ' + (teamFilter === t ? 'var(--primary-border)' : 'var(--border)'),
                          borderRadius: 5, color: teamFilter === t ? 'var(--primary)' : 'var(--text-muted)',
                          padding: '5px 0', fontSize: 11.5, fontWeight: teamFilter === t ? 600 : 400,
                          cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        }}
                      >
                        {TEAM_FILTER_LABELS[t]}
                      </button>
                    ))}
                  </div>
                  <div style={{ maxHeight: 220, overflowY: 'auto', padding: '4px 0' }}>
                    {filteredModels.map(m => {
                      const count = postCountByModel.get(m.name) ?? 0;
                      const selected = m.name === modelName;
                      return (
                        <button
                          key={m.name}
                          onClick={() => { setModelName(m.name); setPickerOpen(false); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px',
                            background: selected ? 'var(--hover-bg)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                          }}
                          onMouseOver={e => { if (!selected) e.currentTarget.style.background = 'var(--hover-bg)'; }}
                          onMouseOut={e => { if (!selected) e.currentTarget.style.background = 'none'; }}
                        >
                          <AvatarLink src={m.avatar} size={22} alt={m.name} fallbackLetter={m.name[0]} border="1px solid var(--border)" />
                          <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                          {m.team && <TeamBadge team={m.team} />}
                          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', borderRadius: 5, padding: '2px 7px', flexShrink: 0, ...countBadgeStyle(count) }}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Действие</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button
                onClick={() => setAction('recommend')}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: 6,
                  border: '1px solid ' + (action === 'recommend' ? 'var(--success-border)' : 'var(--border)'),
                  background: action === 'recommend' ? 'var(--success-bg)' : 'var(--surface)',
                  color: action === 'recommend' ? 'var(--success-text)' : 'var(--text-muted)',
                  fontWeight: action === 'recommend' ? 600 : 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M7 10v12M15 5.88 14 10h7a2 2 0 0 1 2 2v0a2 2 0 0 1-.31 1.06l-4 6.4A2 2 0 0 1 17 20.5H2V10h4.5L11 4a2 2 0 0 1 4 1.88Z" /></svg>
                Рекомендовать
              </button>
              <button
                onClick={() => setAction('ban')}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: 6,
                  border: '1px solid ' + (action === 'ban' ? 'var(--danger-border)' : 'var(--border)'),
                  background: action === 'ban' ? 'var(--danger-bg)' : 'var(--surface)',
                  color: action === 'ban' ? 'var(--danger-text)' : 'var(--text-muted)',
                  fontWeight: action === 'ban' ? 600 : 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></svg>
                Запретить
              </button>
            </div>

            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Комментарий</div>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Почему стоит (не) постить в этот сабреддит..."
              rows={4}
              style={{
                width: '100%',
                padding: '9px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 13,
                color: 'var(--text)',
                fontFamily: 'var(--font-sans)',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', padding: '8px 14px', borderRadius: 6, fontFamily: 'var(--font-sans)' }}
              >
                Отмена
              </button>
              <button
                onClick={handleSubmit}
                style={{
                  background: action === 'ban' ? 'var(--danger-text)' : 'var(--success-text)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Отправить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
