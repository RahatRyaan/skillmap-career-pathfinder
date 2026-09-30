import { useState } from 'react';
import { useAdminList } from '@/hooks/useAdminList';
import { adminApi } from '@/lib/endpoints';
import { PageHeader } from '@/components/layout/AppShell';
import { CrudTable, type Column } from '@/components/admin/CrudTable';
import { Button } from '@/components/ui/Button';
import { Badge, ErrorState, SkeletonCards } from '@/components/ui/States';
import { formatDate } from '@/lib/utils';

type Row = Record<string, unknown>;

export default function AdminUsers() {
  const list = useAdminList<{ items: Row[]; total: number }>('users', () => adminApi.users());
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (id: string, isActive: boolean) => {
    setBusy(id);
    try {
      await adminApi.setUserActive(id, isActive);
      await list.refetch();
    } finally {
      setBusy(null);
    }
  };

  const columns: Column<Row>[] = [
    { header: 'Name', render: (row) => <span className="font-medium">{String(row['name'])}</span> },
    {
      header: 'Email',
      render: (row) => <span className="text-muted">{String(row['email'])}</span>,
    },
    {
      header: 'Role',
      render: (row) => (
        <Badge color={row['role'] === 'admin' ? 'brand' : 'neutral'}>{String(row['role'])}</Badge>
      ),
    },
    {
      header: 'Status',
      render: (row) => (
        <span className={row['isActive'] ? 'text-strong' : 'text-critical'}>
          {row['isActive'] ? 'Active' : 'Deactivated'}
        </span>
      ),
    },
    {
      header: 'Joined',
      render: (row) => <span className="text-muted">{formatDate(String(row['createdAt']))}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        description="Deactivating an account revokes its sessions immediately. Password hashes are never sent to the browser."
      />

      {list.isLoading ? <SkeletonCards count={3} /> : null}
      {list.isError ? (
        <ErrorState
          message="We could not load the user list."
          onRetry={() => void list.refetch()}
        />
      ) : null}

      {list.data ? (
        <CrudTable<Row>
          rows={list.data.items}
          columns={columns}
          rowKey={(row) => String(row['_id'])}
          emptyTitle="No users"
          addAction={
            <Button variant="outline" disabled>
              Invite a user (coming next)
            </Button>
          }
        />
      ) : null}

      {list.data ? (
        <div className="mt-4 space-y-2">
          {list.data.items.map((row) => {
            const id = String(row['_id']);
            return (
              <div
                key={id}
                className="flex items-center justify-between rounded-lg border border-[rgb(var(--border))] p-3"
              >
                <span className="text-sm">
                  {String(row['name'])}{' '}
                  <span className="text-muted">
                    {row['isActive'] ? 'is active' : 'is deactivated'}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant={row['isActive'] ? 'outline' : 'primary'}
                  isLoading={busy === id}
                  onClick={() => void toggle(id, !row['isActive'])}
                >
                  {row['isActive'] ? 'Deactivate' : 'Reactivate'}
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
