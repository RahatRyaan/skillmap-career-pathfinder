import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover disabled:bg-brand/50',
  secondary:
    'bg-brand-subtle text-brand hover:bg-brand-subtle/70 dark:bg-brand/20 dark:text-brand-100',
  ghost: 'text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-raised))]',
  danger: 'bg-critical text-white hover:bg-critical/90',
  outline:
    'border border-[rgb(var(--border))] text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-raised))]',
};

const SIZES: Record<Size, string> = {
  // 44px minimum touch target on md and up, which is the WCAG 2.2 target size.
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading,
    icon,
    fullWidth,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled ?? isLoading}
      aria-busy={isLoading ?? undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});
