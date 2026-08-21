import { useEffect, useRef, useState } from 'react';
import { ExportOptionsList } from './ExportOptions';

interface Props {
  /** Omit both on pages with no hidden-subreddits panel of their own (e.g. a single model's page) — the "Скрытые" row is hidden entirely. */
  hidden?: string[];
  onRestore?: (subreddit: string) => void;
  onCompareClick: () => void;
  /** Omit on pages with no per-account metrics view (e.g. the main dashboard) — the "Графики" row is hidden entirely. */
  onChartsClick?: () => void;
  onExportCurrentView: () => void;
  onExportPostsJson: () => void;
  /** Omit on pages with no per-day posting breakdown (e.g. the main dashboard) — that export row is hidden entirely. */
  onExportDailyBreakdown?: () => void;
}

type SubmenuKey = 'hidden' | 'export';

function GearIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M3 3v18h18" /><path d="M18 17V9M13 17V5M8 17v-3" />
    </svg>
  );
}

function ChartsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M3 3v18h18" /><path d="m7 14 4-5 3 3 5-7" />
    </svg>
  );
}

function HiddenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
    </svg>
  );
}

// Flyouts open to the left (there's no room to the right, next to the
// screen edge), so the indicator points left to match.
function ChevronFlyoutIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m15 18-6-6 6-6" /></svg>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '9px 14px',
  fontSize: 13,
  color: 'var(--text)',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  whiteSpace: 'nowrap',
  background: 'none',
  border: 'none',
  textAlign: 'left',
};

export default function SettingsMenu({ hidden, onRestore, onCompareClick, onChartsClick, onExportCurrentView, onExportPostsJson, onExportDailyBreakdown }: Props) {
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<SubmenuKey | null>(null);
  const [hiddenSearch, setHiddenSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  const showHiddenRow = hidden !== undefined && onRestore !== undefined;
  const hiddenList = hidden ?? [];
  const restoreSubreddit = onRestore ?? (() => {});
  const visibleHidden = hiddenList.filter(sub => sub.toLowerCase().includes(hiddenSearch.toLowerCase()));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSubmenu(null);
        setHiddenSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const closeAll = () => {
    setOpen(false);
    setSubmenu(null);
    setHiddenSearch('');
  };

  // Submenus open/close on hover; a short delay before closing lets the
  // pointer cross the gap between the row and its flyout without flickering.
  const openSubmenu = (key: SubmenuKey) => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setSubmenu(key);
  };

  const scheduleCloseSubmenu = () => {
    closeTimer.current = window.setTimeout(() => setSubmenu(null), 200);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(o => !o); if (open) setSubmenu(null); }}
        title="Меню"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 7,
          width: 34,
          height: 34,
          color: 'var(--text-muted)',
          cursor: 'pointer',
        }}
        onMouseOver={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
        onMouseOut={e => (e.currentTarget.style.background = 'var(--surface)')}
      >
        <GearIcon />
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
          zIndex: 500,
          minWidth: 210,
          padding: '4px 0',
        }}>
          <button
            onClick={() => { onCompareClick(); closeAll(); }}
            style={rowStyle}
            onMouseOver={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseOut={e => (e.currentTarget.style.background = 'none')}
          >
            <CompareIcon />
            Сравнить
          </button>

          {onChartsClick && (
            <button
              onClick={() => { onChartsClick(); closeAll(); }}
              style={rowStyle}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseOut={e => (e.currentTarget.style.background = 'none')}
            >
              <ChartsIcon />
              Графики
            </button>
          )}

          {showHiddenRow && (
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => openSubmenu('hidden')}
            onMouseLeave={scheduleCloseSubmenu}
          >
            <div
              style={rowStyle}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseOut={e => (e.currentTarget.style.background = 'none')}
            >
              <HiddenIcon />
              Скрытые
              {hiddenList.length > 0 && (
                <span style={{
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  borderRadius: 10,
                  padding: '1px 7px',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                }}>
                  {hiddenList.length}
                </span>
              )}
              <span style={{ marginLeft: 'auto', color: 'var(--disabled)', display: 'flex' }}>
                <ChevronFlyoutIcon />
              </span>
            </div>

            {submenu === 'hidden' && (
              <div style={{
                position: 'absolute',
                top: 0,
                right: '100%',
                marginRight: 6,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                width: 260,
                maxHeight: 360,
                display: 'flex',
                flexDirection: 'column',
              }}>
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--background)', flexShrink: 0 }}>
                  <input
                    type="text"
                    value={hiddenSearch}
                    onChange={e => setHiddenSearch(e.target.value)}
                    placeholder="Поиск сабреддита..."
                    style={{
                      width: '100%',
                      padding: '6px 9px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: 'var(--font-sans)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ overflowY: 'auto', padding: '4px 0' }}>
                  {hiddenList.length === 0 ? (
                    <div style={{ padding: '16px 14px', fontSize: 12, color: 'var(--text-faint)', textAlign: 'center' }}>
                      Нет скрытых сабреддитов
                    </div>
                  ) : visibleHidden.length === 0 ? (
                    <div style={{ padding: '16px 14px', fontSize: 12, color: 'var(--text-faint)', textAlign: 'center' }}>
                      Ничего не найдено
                    </div>
                  ) : (
                    visibleHidden.map(sub => (
                      <div
                        key={sub}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px' }}
                        onMouseOver={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                        onMouseOut={e => (e.currentTarget.style.background = 'none')}
                      >
                        <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--font-mono)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          r/{sub}
                        </span>
                        <button
                          onClick={() => restoreSubreddit(sub)}
                          style={{
                            background: 'var(--primary-light)',
                            color: 'var(--primary)',
                            border: 'none',
                            borderRadius: 5,
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'var(--font-sans)',
                            flexShrink: 0,
                          }}
                        >
                          Вернуть
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          )}

          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => openSubmenu('export')}
            onMouseLeave={scheduleCloseSubmenu}
          >
            <div
              style={rowStyle}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseOut={e => (e.currentTarget.style.background = 'none')}
            >
              <ExportIcon />
              Экспорт данных
              <span style={{ marginLeft: 'auto', color: 'var(--disabled)', display: 'flex' }}>
                <ChevronFlyoutIcon />
              </span>
            </div>

            {submenu === 'export' && (
              <div style={{
                position: 'absolute',
                top: 0,
                right: '100%',
                marginRight: 6,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                minWidth: 260,
                overflow: 'hidden',
              }}>
                <ExportOptionsList
                  onExportCurrentView={() => { onExportCurrentView(); closeAll(); }}
                  onExportPostsJson={() => { onExportPostsJson(); closeAll(); }}
                  onExportDailyBreakdown={onExportDailyBreakdown ? () => { onExportDailyBreakdown(); closeAll(); } : undefined}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
