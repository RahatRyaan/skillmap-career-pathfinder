import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/endpoints';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState, SkeletonCards } from '@/components/ui/States';
import { formatDate } from '@/lib/utils';

export default function AdminDashboard() {
  const stats = useQuery({ queryKey: ['admin-stats'], queryFn: () => adminApi.stats() });

  return (
    <div>
      <PageHeader
        title="Admin"
        description="Platform state. Every figure is a live database count."
        action={
          <a href="/admin/impact" className="text-sm font-medium text-brand hover:underline">
            Impact dashboard
          </a>
        }
      />

      {stats.isLoading ? <SkeletonCards count={2} /> : null}
      {stats.isError ? (
        <ErrorState
          message="We could not load platform statistics."
          onRetry={() => void stats.refetch()}
        />
      ) : null}

      {stats.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Total users', stats.data.totalUsers],
              ['Active students', stats.data.activeStudents],
              ['Published careers', stats.data.publishedCareers],
              ['Published skills', stats.data.publishedSkills],
              ['Career-skill mappings', stats.data.careerSkillMappings],
              ['Learning resources', stats.data.learningResources],
              ['Projects', stats.data.projects],
              ['CV documents', stats.data.cvDocuments],
            ].map(([label, value]) => (
              <Card key={String(label)}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
                <p className="mt-2 text-3xl font-bold">{Number(value).toLocaleString()}</p>
              </Card>
            ))}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ['AI calls', stats.data.aiCalls],
              ['AI cost (USD)', Number(stats.data.aiCostUsd).toFixed(4)],
              ['Extracted CV items', stats.data.extractedItems],
            ].map(([label, value]) => (
              <Card key={String(label)}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
                <p className="mt-2 text-xl font-bold">{String(value)}</p>
              </Card>
            ))}
          </div>

          <Card className="mt-6">
            <CardHeader
              title="Manage content"
              description="All of these write to the database the students read from."
            />
            <div className="flex flex-wrap gap-2">
              {[
                ['/admin/careers', 'Careers'],
                ['/admin/skills', 'Skills'],
                ['/admin/mappings', 'Career-skill mapping'],
                ['/admin/resources', 'Resources'],
                ['/admin/projects', 'Projects'],
                ['/admin/users', 'Users'],
                ['/admin/impact', 'Impact'],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="inline-flex h-11 items-center rounded-lg border border-[rgb(var(--border))] px-4 text-sm font-medium hover:bg-[rgb(var(--surface-raised))]"
                >
                  {label}
                </a>
              ))}
            </div>
          </Card>

          <p className="mt-4 text-xs text-muted">
            Generated {formatDate(String(stats.data.generatedAt))}
          </p>
        </>
      ) : null}
    </div>
  );
}
