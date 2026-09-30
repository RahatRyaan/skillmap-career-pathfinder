import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Every input has a real <label>, a hint tied by aria-describedby, and an error
 * announced politely. Placeholder text is never used as the only label.
 */
export function Field({ label, htmlFor, hint, error, required, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
        {required ? (
          <span className="ml-1 text-critical" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="flex items-center gap-1 text-xs text-critical"
          role="alert"
        >
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClasses =
  'w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2.5 text-sm ' +
  'placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60';

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className, invalid, ...rest }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(inputClasses, 'h-11', invalid && 'border-critical', className)}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(inputClasses, 'min-h-24', invalid && 'border-critical', className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(inputClasses, 'h-11', invalid && 'border-critical', className)}
      {...rest}
    >
      {children}
    </select>
  );
});

interface RangeProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  valueLabel: string;
  hint?: string;
}

export function RangeSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  valueLabel,
  hint,
}: RangeProps) {
  const id = useId();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span className="text-sm font-semibold text-brand">{valueLabel}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[rgb(var(--border))] accent-brand"
        aria-valuetext={valueLabel}
      />
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
