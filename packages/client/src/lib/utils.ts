import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware class merge, so a caller can override a component's defaults. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Math.round(value * 10) / 10}%`;
}

export function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0h';
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 8;
  return `${Math.round(hours)}h (${Math.round(days * 10) / 10} days)`;
}

export function formatDate(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(iso);
}

/**
 * A streak message that never shames the student.
 * Missing a day is normal, not a failure.
 */
export function streakMessage(streakDays: number): string {
  if (streakDays === 0) return 'Start a streak today. One session is enough.';
  if (streakDays === 1) return 'One day in. That is a start.';
  if (streakDays < 7) return `${streakDays} days in a row. Keep it going when you can.`;
  if (streakDays < 30) return `${streakDays} days in a row. That is a real habit.`;
  return `${streakDays} days in a row. Remarkable.`;
}

export const GAP_LABEL_COPY: Record<string, { label: string; color: string; icon: string }> = {
  strong: { label: 'Strong', color: 'text-strong', icon: 'check-circle' },
  developing: { label: 'Developing', color: 'text-developing', icon: 'trending-up' },
  gap: { label: 'Gap', color: 'text-gap', icon: 'alert-triangle' },
  critical: { label: 'Critical', color: 'text-critical', icon: 'alert-octagon' },
};

export function debounce<T extends (...args: never[]) => void>(fn: T, delayMs: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  }) as T;
}
