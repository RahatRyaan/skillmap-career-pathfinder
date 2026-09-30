/**
 * Shared admin table.
 *
 * A generic, typed list with a delete confirmation, so every CRUD admin page
 * behaves identically instead of each inventing its own behaviour.
 */

import { useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { ConfirmDialog } from '@/pages/student/MySkills';

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  /** Optional stable key; falls back to the header. */
  key?: string;
}

interface CrudTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onDelete?: (row: T) => void | Promise<unknown>;
  deleteLabel?: (row: T) => string;
  isDeleting?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  addAction?: ReactNode;
}

export function CrudTable<T>({
  rows,
  columns,
  rowKey,
  onDelete,
  deleteLabel,
  isDeleting,
  emptyTitle = 'Nothing here yet',
  emptyBody,
  addAction,
}: CrudTableProps<T>) {
  const [pending, setPending] = useState<T | null>(null);

  return (
    <Card className="overflow-hidden">
      {addAction ? <div className="mb-4 flex justify-end">{addAction}</div> : null}

      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} body={emptyBody ?? ''} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgb(var(--border))] text-left">
                {columns.map((column, i) => (
                  <th
                    key={column.key ?? `${column.header}-${i}`}
                    scope="col"
                    className="py-2.5 pr-4 font-medium"
                  >
                    {column.header}
                  </th>
                ))}
                {onDelete ? (
                  <th scope="col" className="py-2.5 font-medium">
                    <span className="sr-only-focusable">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-b border-[rgb(var(--border))] last:border-0"
                >
                  {columns.map((column, i) => (
                    <td
                      key={column.key ?? `${column.header}-${i}`}
                      className="py-2.5 pr-4 align-top"
                    >
                      {column.render(row)}
                    </td>
                  ))}
                  {onDelete ? (
                    <td className="py-2.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPending(row)}
                        aria-label={`Delete ${deleteLabel?.(row) ?? 'this record'}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pending && onDelete ? (
        <ConfirmDialog
          title={`Delete ${deleteLabel?.(pending) ?? 'this record'}?`}
          body="This cannot be undone. If students are already using it, prefer unpublishing instead of deleting."
          confirmLabel="Delete"
          isDanger
          isLoading={isDeleting}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            void onDelete(pending);
            setPending(null);
          }}
        />
      ) : null}
    </Card>
  );
}
