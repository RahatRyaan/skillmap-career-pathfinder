import { useQuery } from '@tanstack/react-query';
import { Info, TrendingUp } from 'lucide-react';
import { adminApi } from '@/lib/endpoints';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { ErrorState, SkeletonCards } from '@/components/ui/States';
import { GapDistribution } from '@/components/charts';
import { formatDate } from '@/lib/utils';

export default function AdminImpact() {
  const impact = useQuery({ queryKey: ['admin-impact'], queryFn: () => adminApi.impact() });

  if (impact.isLoading) {
    return (
      <div>
        <PageHeader title="Impact" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (impact.isError || !impact.data) {
    return (
      <div>
        <PageHeader title="Impact" />
        <ErrorState
          message="We could not compute the impact metrics."
          onRetry={() => void impact.refetch()}
        />
      </div>
    );
  }

  const data = impact.data;

  const metrics: { label: string; value: string; hint: string }[] = [
    {
      label: 'Students assessed',
      value: String(data.studentsAssessed),
      hint: 'Students with at least one recorded skill',
    },
    {
      label: 'Skill gaps identified',
      value: String(data.skillGapsIdentified),
      hint: 'Open gaps across all students',
    },
    {
      label: 'Roadmaps generated',
      value: String(data.roadmapsGenerated),
      hint: 'Including every re-plan version',
    },
    {
      label: 'Roadmap completion',
      value: `${data.roadmapCompletionRate}%`,
      hint: 'By estimated hours, across all items',
    },
    {
      label: 'Average skill improvement',
      value: `+${data.averageSkillImprovement}`,
      hint: 'Alignment points gained, students with two or more snapshots',
    },
    {
      label: 'Projects completed',
      value: String(data.projectsCompleted),
      hint: 'Marked done by students',
    },
    {
      label: 'Students above target',
      value: String(data.studentsReachingTarget),
      hint: `At or above ${data.targetAlignmentPercent}% alignment`,
    },
    {
      label: 'Active this week',
      value: String(data.weeklyActiveStudents),
      hint: 'Logged a study session in the last 7 days',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Impact"
        description="Measured from real records, for social-impact reporting."
      />

      <div className="mb-6 flex items-start gap-3 rounded-lg border border-strong/30 bg-strong/5 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-strong" aria-hidden="true" />
        <p className="text-sm">{data.note}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{metric.label}</p>
            <p className="mt-2 text-3xl font-bold text-brand">{metric.value}</p>
            <p className="mt-1 text-xs text-muted">{metric.hint}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <GapDistribution
          data={(['strong', 'developing', 'gap', 'critical'] as const).map((label) => ({
            label,
            count: data.skillGapsByLabel[label] ?? 0,
          }))}
        />

        <Card>
          <CardHeader
            title="Most common open gaps"
            description="Only shown when the group is large enough that individuals cannot be identified."
          />
          {data.topCommonGaps.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-8 w-8" />}
              title="Not enough students yet"
              body="Common-gap insights appear once enough students have chosen a target career, so no individual's gaps can be identified."
            />
          ) : (
            <ol className="space-y-2">
              {data.topCommonGaps.map((gap, i) => (
                <li key={gap.skillId} className="flex items-center justify-between text-sm">
                  <span>
                    <span className="font-bold text-muted">{i + 1}.</span> {gap.skillName}
                  </span>
                  <span className="font-medium">{gap.studentCount} students</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <p className="mt-6 text-xs text-muted">Generated {formatDate(data.generatedAt)}</p>
    </div>
  );
}
