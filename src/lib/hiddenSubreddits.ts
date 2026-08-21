const STORAGE_KEY = 'hiddenSubreddits';

/**
 * Reads the list of subreddits the user chose to hide from the table.
 * Falls back to an empty list if storage is unavailable or corrupted
 * (e.g. private browsing mode, or manual tampering with localStorage).
 */
export function loadHiddenSubreddits(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function saveHiddenSubreddits(list: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage may be unavailable (private mode, quota, etc). Failing silently
    // just means the hidden list won't persist across reloads this time.
  }
}
