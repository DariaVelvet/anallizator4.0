import { useState, useMemo, useRef } from 'react';
import { filterPosts, computeStats, sortStats, getDateRange, withMeta } from './lib/dataUtils';
import { loadHiddenSubreddits, saveHiddenSubreddits } from './lib/hiddenSubreddits';
import { exportCurrentView, exportPostsJson } from './lib/exportUtils';
import { useElementHeight } from './lib/useElementHeight';
import type { SortKey, SortDir, DatePreset } from './lib/types';
import Filters from './components/Filters';
import SubredditTable from './components/SubredditTable';
import SettingsMenu from './components/SettingsMenu';
import ModelPage from './components/ModelPage';
import SubredditPage from './components/SubredditPage';
import CompareTool from './components/CompareTool';
import ThemeToggle from './components/ThemeToggle';

export default function App() {
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('avgUpvotes');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(100);
  const [hiddenSubreddits, setHiddenSubreddits] = useState<string[]>(() => loadHiddenSubreddits());
  const [viewingModel, setViewingModel] = useState<string | null>(null);
  const [viewingSubreddit, setViewingSubreddit] = useState<string | null>(null);
  const [showCompareTool, setShowCompareTool] = useState(false);
  const [hideToast, setHideToast] = useState<string | null>(null);
  const hideToastTimer = useRef<number | null>(null);
  const [stickyRef, stickyHeight] = useElementHeight<HTMLDivElement>();

  const hideSubreddit = (subreddit: string) => {
    setHiddenSubreddits(prev => {
      if (prev.includes(subreddit)) return prev;
      const next = [...prev, subreddit];
      saveHiddenSubreddits(next);
      return next;
    });

    if (hideToastTimer.current) window.clearTimeout(hideToastTimer.current);
    setHideToast(subreddit);
    hideToastTimer.current = window.setTimeout(() => setHideToast(null), 4000);
  };

  const restoreSubreddit = (subreddit: string) => {
    setHiddenSubreddits(prev => {
      const next = prev.filter(s => s !== subreddit);
      saveHiddenSubreddits(next);
      return next;
    });
  };

  // Model page and subreddit page are mutually exclusive full-page views —
  // navigating to one always leaves the other.
  const navigateToModel = (modelName: string) => {
    setViewingSubreddit(null);
    setViewingModel(modelName);
  };

  const navigateToSubreddit = (subreddit: string) => {
    setViewingModel(null);
    setViewingSubreddit(subreddit);
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir(key === 'subreddit' ? 'asc' : 'desc');
    }
    setPage(0);
  };

  const [dateFrom, dateTo] = useMemo(
    () => getDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  const filteredPosts = useMemo(
    () => filterPosts(selectedModels, selectedAccounts, dateFrom, dateTo, hiddenSubreddits),
    [selectedModels, selectedAccounts, dateFrom, dateTo, hiddenSubreddits],
  );

  const sortedStats = useMemo(() => {
    const stats = computeStats(filteredPosts, search);
    return sortStats(stats, sortKey, sortDir);
  }, [filteredPosts, search, sortKey, sortDir]);

  const handleExportCurrentView = () => exportCurrentView(sortedStats);
  const handleExportPostsJson = () => exportPostsJson(withMeta(filteredPosts));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      {viewingSubreddit ? (
        <SubredditPage
          subreddit={viewingSubreddit}
          onNavigateToModel={navigateToModel}
          onBack={() => setViewingSubreddit(null)}
        />
      ) : viewingModel ? (
        <ModelPage
          modelName={viewingModel}
          hiddenSubreddits={hiddenSubreddits}
          onHideSubreddit={hideSubreddit}
          onNavigateToModel={navigateToModel}
          onNavigateToSubreddit={navigateToSubreddit}
          onBack={() => setViewingModel(null)}
        />
      ) : (
        <>
          {/* Sticky stack: top bar + filters + legend all stay pinned while scrolling */}
          <div ref={stickyRef} style={{ position: 'sticky', top: 0, zIndex: 60, background: 'var(--background)' }}>
            {/* Header */}
            <div style={{
              background: 'var(--surface)',
              borderBottom: '1px solid var(--border)',
              padding: '0 28px',
              display: 'flex',
              alignItems: 'center',
              height: 56,
            }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                Model stat
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                  {sortedStats.length} subreddits
                </span>
                <ThemeToggle />
                <SettingsMenu
                  hidden={hiddenSubreddits}
                  onRestore={restoreSubreddit}
                  onCompareClick={() => setShowCompareTool(true)}
                  onExportCurrentView={handleExportCurrentView}
                  onExportPostsJson={handleExportPostsJson}
                />
              </div>
            </div>

            {/* Filter bar */}
            <div style={{ padding: '20px 28px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <Filters
                selectedModels={selectedModels}
                selectedAccounts={selectedAccounts}
                datePreset={datePreset}
                customFrom={customFrom}
                customTo={customTo}
                search={search}
                onModelsChange={v => { setSelectedModels(v); setPage(0); }}
                onAccountsChange={v => { setSelectedAccounts(v); setPage(0); }}
                onDatePresetChange={v => { setDatePreset(v); setPage(0); }}
                onCustomFromChange={v => { setCustomFrom(v); setPage(0); }}
                onCustomToChange={v => { setCustomTo(v); setPage(0); }}
                onSearchChange={v => { setSearch(v); setPage(0); }}
              />
            </div>

            {/* Legend */}
            <div style={{ padding: '10px 28px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#86efac' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>200+ avg upvotes</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#93c5fd' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>50–200 avg upvotes</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#fca5a5' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>&lt;25 avg upvotes</span>
              </div>
            </div>
          </div>

          {/* Table card */}
          <div style={{ margin: '0 20px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'clip', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <SubredditTable
              stats={sortedStats}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              page={page}
              perPage={perPage}
              onPageChange={setPage}
              onPerPageChange={setPerPage}
              onHideSubreddit={hideSubreddit}
              onNavigateToModel={navigateToModel}
              onNavigateToSubreddit={navigateToSubreddit}
              stickyOffset={stickyHeight}
            />
          </div>
        </>
      )}

      {showCompareTool && <CompareTool onClose={() => setShowCompareTool(false)} />}

      {hideToast && (
        <div style={{
          position: 'fixed',
          left: '50%',
          bottom: 28,
          transform: 'translateX(-50%)',
          background: 'var(--text)',
          color: '#fff',
          borderRadius: 8,
          padding: '10px 16px',
          fontSize: 12.5,
          fontFamily: 'var(--font-sans)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
          zIndex: 2000,
        }}>
          <span>r/{hideToast} скрыт · увидеть скрытые сабреддиты можно через ⚙ → «Скрытые»</span>
          <button
            onClick={() => setHideToast(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 2, lineHeight: 0, flexShrink: 0 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
