import { useId, useState, type ReactNode } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChartDatum {
  label: string;
  value: number;
  /** Optional secondary value, rendered in the table fallback. */
  secondary?: string;
}

interface ChartFrameProps {
  title: string;
  description?: string;
  data: ChartDatum[];
  children: ReactNode;
  /** Units shown in the table header, e.g. "Percent" or "Hours". */
  unit?: string;
  className?: string;
}

/**
 * Wraps every chart with a table fallback.
 *
 * WCAG 2.2 requires a non-visual equivalent for information conveyed only by a
 * chart. The toggle is keyboard reachable and the table is always rendered in
 * the DOM for screen readers, even when the chart is showing.
 */
export function ChartFrame({
  title,
  description,
  data,
  children,
  unit = '',
  className,
}: ChartFrameProps) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  return (
    <section className={cn('card', className)} aria-labelledby={`${tableId}-title`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 id={`${tableId}-title`} className="text-base font-semibold">
            {title}
          </h3>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          aria-controls={tableId}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] px-3 text-xs font-medium hover:bg-[rgb(var(--surface-raised))]"
        >
          {showTable ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      <div className={showTable ? 'sr-only-focusable' : ''}>{children}</div>

      <div
        id={tableId}
        className={cn('overflow-x-auto', showTable ? 'block' : 'sr-only-focusable')}
      >
        <table className="w-full text-sm">
          <caption className="sr-only">
            {title}
            {description ? `: ${description}` : ''}
          </caption>
          <thead>
            <tr className="border-b border-[rgb(var(--border))] text-left">
              <th scope="col" className="py-2 pr-4 font-medium">
                Item
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Value{unit ? ` (${unit})` : ''}
              </th>
              {data.some((d) => d.secondary !== undefined) ? (
                <th scope="col" className="py-2 font-medium">
                  Detail
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.label} className="border-b border-[rgb(var(--border))] last:border-0">
                <th scope="row" className="py-2 pr-4 text-left font-normal">
                  {row.label}
                </th>
                <td className="py-2 pr-4 font-medium">{row.value}</td>
                {row.secondary !== undefined ? (
                  <td className="py-2 text-muted">{row.secondary}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
