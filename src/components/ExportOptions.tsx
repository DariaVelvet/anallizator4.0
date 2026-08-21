interface Props {
  onExportCurrentView: () => void;
  onExportPostsJson: () => void;
  /** Omit on pages with no per-day posting breakdown (e.g. the main dashboard) — that row is hidden entirely. */
  onExportDailyBreakdown?: () => void;
}

const itemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '11px 14px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};

/** SettingsMenu's export flyout content — one row per export format. */
export function ExportOptionsList({ onExportCurrentView, onExportPostsJson, onExportDailyBreakdown }: Props) {
  return (
    <>
      <button
        onClick={onExportCurrentView}
        style={{ ...itemStyle, borderBottom: '1px solid var(--background)' }}
        onMouseOver={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
        onMouseOut={e => (e.currentTarget.style.background = 'none')}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Как отображено на сайте</div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>Текущие фильтры, сортировка и колонки таблицы</div>
      </button>
      <button
        onClick={onExportPostsJson}
        style={{ ...itemStyle, borderBottom: onExportDailyBreakdown ? '1px solid var(--background)' : 'none' }}
        onMouseOver={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
        onMouseOut={e => (e.currentTarget.style.background = 'none')}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Все посты (JSON)</div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>За выбранный период и модели, с заголовками полей</div>
      </button>
      {onExportDailyBreakdown && (
        <button
          onClick={onExportDailyBreakdown}
          style={itemStyle}
          onMouseOver={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
          onMouseOut={e => (e.currentTarget.style.background = 'none')}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Постинг по дням</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>Посты по дням: время, сабреддит, тайтл, статус</div>
        </button>
      )}
    </>
  );
}
