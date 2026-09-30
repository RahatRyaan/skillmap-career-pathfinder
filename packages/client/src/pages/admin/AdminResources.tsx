import { useAdminList } from '@/hooks/useAdminList';
import { adminApi } from '@/lib/endpoints';
import { PageHeader } from '@/components/layout/AppShell';
import { CrudTable, type Column } from '@/components/admin/CrudTable';
import { ErrorState, SkeletonCards } from '@/components/ui/States';

type Row = Record<string, unknown>;

export default function AdminResources() {
  const list = useAdminList<{ items: Row[]; total: number }>('resources', () =>
    adminApi.resources(),
  );

  if (list.isLoading) {
    return (
      <div>
        <PageHeader title="Resources" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (list.isError) {
    return (
      <div>
        <PageHeader title="Resources" />
        <ErrorState
          message="We could not load the resource list."
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
    {
      header: 'Skill',
      render: (row) => {
        const skill = row['skillId'] as { name?: string } | null;
        return String(skill?.name ?? '—');
      },
    },
    { header: 'Type', render: (row) => String(row['type'] ?? '') },
    { header: 'Cost', render: (row) => (row['isFree'] ? 'Free' : 'Paid') },
    {
      header: 'Link status',
      render: (row) =>
        row['isSample'] ? (
          <span className="text-developing">Sample — unverified</span>
        ) : (
          <span className="text-strong">Verified</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Resources"
        description={`${list.data.total} resources. Anything unverified is labelled as a sample, as the spec requires.`}
      />
      <CrudTable<Row>
        rows={list.data.items}
        columns={columns}
        rowKey={(row) => String(row['_id'])}
        onDelete={(row) => list.deleteOne(() => adminApi.deleteResource(String(row['_id'])))}
        isDeleting={list.isDeleting}
        deleteLabel={(row) => String(row['title'] ?? 'this resource')}
        emptyTitle="No resources yet"
        emptyBody="Run npm run seed to load the resource catalogue."
      />
    </div>
  );
}
