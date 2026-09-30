import type { ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-3 px-6 py-16"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-5 w-5 animate-spin text-muted" aria-hidden="true" />
      <span className="text-sm text-muted">{label}…</span>
    </div>
  );
}

/** Skeleton shaped like a card list, so the layout does not jump on load. */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading content">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card space-y-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}
      role="alert"
    >
      <AlertCircle className="mb-4 h-8 w-8 text-critical" aria-hidden="true" />
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted">{message}</p>
      {onRetry ? (
        <Button onClick={onRetry} variant="outline" className="mt-6">
          Try again
        </Button>
      ) : null}
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  color?: 'neutral' | 'strong' | 'developing' | 'gap' | 'critical' | 'brand';
  icon?: ReactNode;
  className?: string;
}

const BADGE_COLORS: Record<NonNullable<BadgeProps['color']>, string> = {
  neutral: 'bg-[rgb(var(--surface-raised))] text-muted',
  strong: 'bg-strong/10 text-strong',
  developing: 'bg-developing/10 text-developing',
  gap: 'bg-gap/10 text-gap',
  critical: 'bg-critical/10 text-critical',
  brand: 'bg-brand/10 text-brand',
};

/** A badge always carries an icon or text, so colour is never the only signal. */
export function Badge({ children, color = 'neutral', icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        BADGE_COLORS[color],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
