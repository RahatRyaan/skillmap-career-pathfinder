import { useState } from 'react';
import { useAdminList } from '@/hooks/useAdminList';
import { adminApi, careersApi, skillsApi } from '@/lib/endpoints';
import { PageHeader } from '@/components/layout/AppShell';
import { CrudTable, type Column } from '@/components/admin/CrudTable';
import { Card } from '@/components/ui/Card';
import { Badge, ErrorState, SkeletonCards } from '@/components/ui/States';
import { Field, Select } from '@/components/ui/Form';

type Row = Record<string, unknown>;

const IMPORTANCE_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };

export default function AdminMappings() {
  const [careerFilter, setCareerFilter] = useState('');
  const list = useAdminList<{ items: Row[] }>('mappings', () =>
    adminApi.mappings(careerFilter || undefined),
  );
  const careers = useQueryCareers();

  const columns: Column<Row>[] = [
    {
      header: 'Career',
      render: (row) => {
        const career = row['careerId'] as { name?: string } | null;
        return String(career?.name ?? '—');
      },
    },
    {
      header: 'Skill',
      render: (row) => {
        const skill = row['skillId'] as { name?: string } | null;
        return <span className="font-medium">{String(skill?.name ?? '—')}</span>;
      },
    },
    { header: 'Required level', render: (row) => String(row['requiredLevel'] ?? '') },
    {
      header: 'Importance',
      render: (row) => {
        const importance = String(row['importance'] ?? '');
        return (
          <span className="inline-flex items-center gap-2">
            <Badge
              color={
                importance === 'high'
                  ? 'critical'
                  : importance === 'medium'
                    ? 'developing'
                    : 'neutral'
              }
            >
              {importance}
            </Badge>
            <span className="text-xs text-muted">weight {IMPORTANCE_WEIGHT[importance] ?? 0}</span>
          </span>
        );
      },
    },
    { header: 'Core', render: (row) => (row['isCore'] ? 'Yes' : 'No') },
    { header: 'Effort (h)', render: (row) => String(row['estimatedEffortHours'] ?? '') },
    {
      header: 'Prerequisites',
      render: (row) => {
        const prereqs = (row['prerequisiteSkillIds'] as unknown[]) ?? [];
        return (
          <span className="text-muted">{prereqs.length === 0 ? '—' : `${prereqs.length}`}</span>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Career-skill mapping"
        description="This is what every alignment score is computed from. Change it carefully."
      />

      <Card className="mb-6">
        <Field label="Filter by career" htmlFor="mapping-career">
          <Select
            id="mapping-career"
            value={careerFilter}
            onChange={(e) => setCareerFilter(e.target.value)}
          >
            <option value="">All careers</option>
            {careers.map((career) => (
              <option key={career.id} value={career.id}>
                {career.name}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {list.isLoading ? <SkeletonCards count={4} /> : null}
      {list.isError ? (
        <ErrorState message="We could not load the mappings." onRetry={() => void list.refetch()} />
      ) : null}

      {list.data ? (
        <CrudTable<Row>
          rows={list.data.items}
          columns={columns}
          rowKey={(row) => String(row['_id'])}
          onDelete={(row) => {
            const career = row['careerId'] as { _id?: unknown } | null;
            const skill = row['skillId'] as { _id?: unknown } | null;
            if (career?._id && skill?._id) {
              list.deleteOne(() => adminApi.deleteMapping(String(career._id), String(skill._id)));
            }
          }}
          isDeleting={list.isDeleting}
          deleteLabel={(row) => {
            const skill = row['skillId'] as { name?: string } | null;
            return String(skill?.name ?? 'this mapping');
          }}
          emptyTitle="No mappings"
          emptyBody="Run npm run seed to create the career-skill mappings."
        />
      ) : null}
    </div>
  );
}

function useQueryCareers() {
  const query = useAdminList<{ items: { id: string; name: string }[] }>(
    'career-options',
    async () => {
      const [careers, skills] = await Promise.all([
        careersApi.list({ limit: 50 }),
        skillsApi.catalog({ limit: 1 }),
      ]);
      void skills;
      return { items: careers.items.map((c) => ({ id: c.id, name: c.name })) };
    },
  );
  return query.data?.items ?? [];
}
