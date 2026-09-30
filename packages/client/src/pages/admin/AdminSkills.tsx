import { useAdminList } from '@/hooks/useAdminList';
import { adminApi } from '@/lib/endpoints';
import { PageHeader } from '@/components/layout/AppShell';
import { CrudTable, type Column } from '@/components/admin/CrudTable';
import { ErrorState, SkeletonCards } from '@/components/ui/States';

type Row = Record<string, unknown>;

export default function AdminSkills() {
  const list = useAdminList<{ items: Row[]; total: number }>('skills', () => adminApi.skills());

  if (list.isLoading) {
    return (
      <div>
        <PageHeader title="Skills" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (list.isError) {
    return (
      <div>
        <PageHeader title="Skills" />
        <ErrorState
          message="We could not load the skill library."
          onRetry={() => void list.refetch()}
        />
      </div>
    );
  }

  const columns: Column<Row>[] = [
    { header: 'Name', render: (row) => <span className="font-medium">{String(row['name'])}</span> },
    { header: 'Category', render: (row) => String(row['category'] ?? '') },
    {
      header: 'Aliases',
      render: (row) => (
        <span className="text-muted">{((row['aliases'] as string[]) ?? []).join(', ') || '—'}</span>
      ),
    },
    { header: 'Published', render: (row) => (row['isPublished'] ? 'Yes' : 'No') },
  ];

  return (
    <div>
      <PageHeader title="Skills" description={`${list.data.total} skills in the library.`} />
      <CrudTable<Row>
        rows={list.data.items}
        columns={columns}
        rowKey={(row) => String(row['_id'])}
        deleteLabel={(row) => String(row['name'] ?? 'this skill')}
        emptyTitle="No skills yet"
        emptyBody="Run npm run seed to load the initial library."
      />
    </div>
  );
}
