const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateInput(value?: string | Date | null): Date {
  if (!value) {
    return new Date();
  }

  if (value instanceof Date) {
    return value;
  }

  if (DATE_ONLY_PATTERN.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  return new Date(value);
}

export function toUtcDayStart(value: string | Date): Date {
  const date = parseDateInput(value);

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

export function toUtcDayEnd(value: string | Date): Date {
  const date = parseDateInput(value);

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

export function addUtcDays(value: string | Date, days: number): Date {
  const date = toUtcDayStart(value);
  date.setUTCDate(date.getUTCDate() + days);

  return date;
}

export function combineUtcDateAndMinutes(value: string | Date, minutes: number): Date {
  const date = toUtcDayStart(value);
  date.setUTCHours(Math.floor(minutes / 60), minutes % 60, 0, 0);

  return date;
}

export function combineUtcDateAndTime(value: string | Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);

  return combineUtcDateAndMinutes(value, hours * 60 + minutes);
}

export function utcMinutesSinceMidnight(value: Date): number {
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}

export function toDateOnly(value: Date): string {
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function toUtcTimeOnly(value: Date): string {
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
}
