const kyivFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Kiev',
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatKyivTime(utc: number): string {
  const date = new Date(utc * 1000);
  const parts = kyivFormatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')}, ${get('hour')}:${get('minute')}`;
}

const kyivDateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Kiev',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Calendar-day grouping key ('YYYY-MM-DD') in Kyiv local time. */
export function kyivDateKey(utc: number): string {
  return kyivDateKeyFormatter.format(new Date(utc * 1000));
}

/** A 'YYYY-MM-DD' key (as produced by kyivDateKey) into a 'DD.MM.YYYY' display label. */
export function formatDateKeyLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${day}.${month}.${year}`;
}

const kyivTimeOnlyFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Kiev',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatKyivTimeOnly(utc: number): string {
  return kyivTimeOnlyFormatter.format(new Date(utc * 1000));
}

const kyivHourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Kiev',
  hour: '2-digit',
  hour12: false,
});

/** Hour of day (0-23) in Kyiv local time. */
export function kyivHour(utc: number): number {
  return Number(kyivHourFormatter.format(new Date(utc * 1000)));
}

/**
 * Work shifts run 13:31 → 13:30 the next day, so a post made before 13:31
 * still belongs to the previous calendar day's shift.
 * Returns the shift's 'YYYY-MM-DD' key (same format as kyivDateKey).
 */
export function shiftDateKey(utc: number): string {
  const date = new Date(utc * 1000);
  const parts = kyivTimeOnlyFormatter.formatToParts(date);
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
  const beforeShiftStart = hour < 13 || (hour === 13 && minute <= 30);
  const effective = beforeShiftStart ? new Date(date.getTime() - 24 * 60 * 60 * 1000) : date;
  return kyivDateKeyFormatter.format(effective);
}

/** Day of week (0=Sun..6=Sat) of the shift a post belongs to — see shiftDateKey. */
export function shiftWeekday(utc: number): number {
  const [year, month, day] = shiftDateKey(utc).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function toInputDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function fromInputDate(str: string): Date {
  return new Date(str + 'T00:00:00');
}

/**
 * Formats an account-age requirement given in days into a compact string:
 * under a month → days, under a year → months + days, otherwise → years + months.
 */
export function formatAccountAge(days: number): string {
  if (days < 30) return `${days}d`;

  if (days < 365) {
    const months = Math.floor(days / 30);
    const restDays = days % 30;
    return restDays > 0 ? `${months}mo ${restDays}d` : `${months}mo`;
  }

  const years = Math.floor(days / 365);
  const restMonths = Math.floor((days % 365) / 30);
  return restMonths > 0 ? `${years}y ${restMonths}mo` : `${years}y`;
}
