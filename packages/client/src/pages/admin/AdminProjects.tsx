import { useAdminList } from '@/hooks/useAdminList';
import { adminApi } from '@/lib/endpoints';
import { PageHeader } from '@/components/layout/AppShell';
import { CrudTable, type Column } from '@/components/admin/CrudTable';
import { ErrorState, SkeletonCards } from '@/components/ui/States';

type Row = Record<string, unknown>;

export default function AdminProjects() {
  const list = useAdminList<{ items: Row[]; total: number }>('projects', () => adminApi.projects());

  if (list.isLoading) {
    return (
      <div>
        <PageHeader title="Projects" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (list.isError) {
    return (
      <div>
        <PageHeader title="Projects" />
        <ErrorState
          message="We could not load the project list."
          onRetry={() => void list.refetch()}
        />
      </div>
    );
  }

  const columns: Column<Row>[] = [
    {
      header: 'Title',
      render: (row) => <span className="font-medium">{String(row['title'])}</span>,
    },
    { header: 'Level', render: (row) => String(row['level'] ?? '') },
    { header: 'Hours', render: (row) => String(row['estimatedHours'] ?? '') },
    { header: 'Steps', render: (row) => String(((row['steps'] as unknown[]) ?? []).length) },
  ];

  return (
    <div>
      <PageHeader title="Projects" description={`${list.data.total} practice projects.`} />
      <CrudTable<Row>
        rows={list.data.items}
        columns={columns}
        rowKey={(row) => String(row['_id'])}
        deleteLabel={(row) => String(row['title'] ?? 'this project')}
        emptyTitle="No projects yet"
        emptyBody="Run npm run seed to load the project catalogue."
      />
    </div>
  );
}
