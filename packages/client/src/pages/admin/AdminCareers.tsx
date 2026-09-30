import { useAdminList } from '@/hooks/useAdminList';
import { adminApi } from '@/lib/endpoints';
import { PageHeader } from '@/components/layout/AppShell';
import { CrudTable, type Column } from '@/components/admin/CrudTable';
import { ErrorState, SkeletonCards } from '@/components/ui/States';

type Row = Record<string, unknown>;

export default function AdminCareers() {
  const list = useAdminList<{ items: Row[]; total: number }>('careers', () => adminApi.careers());

  if (list.isLoading) {
    return (
      <div>
        <PageHeader title="Careers" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (list.isError) {
    return (
      <div>
        <PageHeader title="Careers" />
        <ErrorState
          message="We could not load the career list."
          onRetry={() => void list.refetch()}
        />
      </div>
    );
  }

  const columns: Column<Row>[] = [
    { header: 'Name', render: (row) => <span className="font-medium">{String(row['name'])}</span> },
    { header: 'Category', render: (row) => String(row['category'] ?? '') },
    { header: 'Published', render: (row) => (row['isPublished'] ? 'Yes' : 'No') },
    {
      header: 'Summary',
      render: (row) => (
        <span className="text-muted">{String(row['summary'] ?? '').slice(0, 100)}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Careers" description={`${list.data.total} careers in the catalogue.`} />
      <CrudTable<Row>
        rows={list.data.items}
        columns={columns}
        rowKey={(row) => String(row['_id'])}
        deleteLabel={(row) => String(row['name'] ?? 'this career')}
        emptyTitle="No careers yet"
        emptyBody="Run npm run seed to load the initial catalogue."
      />
    </div>
  );
}
