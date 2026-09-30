import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Hammer, Loader2 } from 'lucide-react';
import { learningApi } from '@/lib/endpoints';
import { toUserMessage } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Badge, ErrorState, SkeletonCards } from '@/components/ui/States';
import { cn } from '@/lib/utils';

export default function Projects() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const projects = useQuery({ queryKey: ['projects'], queryFn: () => learningApi.projects() });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      learningApi.updateProject(id, { status, confirmSkillUpdates: status === 'done' }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['user-skills'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setError(result.note);
    },
    onError: (err) => setError(toUserMessage(err, 'Could not update that project.')),
  });

  const items = (projects.data?.items ?? []).filter((p) => filter === 'all' || p.status === filter);

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Skills stick when you use them. Finishing a project can raise the skills it practises."
      />

      {error ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-brand/30 bg-brand-subtle px-4 py-3 text-sm text-brand dark:bg-brand/20"
        >
          {error}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter projects">
        {(['all', 'todo', 'in_progress', 'done'] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              'h-10 rounded-lg px-4 text-sm font-medium',
              filter === key
                ? 'bg-brand text-white'
                : 'border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-raised))]',
            )}
          >
            {key === 'all'
              ? 'All'
              : key === 'todo'
                ? 'Not started'
                : key === 'in_progress'
                  ? 'In progress'
                  : 'Completed'}
          </button>
        ))}
      </div>

      {projects.isLoading ? <SkeletonCards count={3} /> : null}
      {projects.isError ? (
        <ErrorState
          message="We could not load the project list."
          onRetry={() => void projects.refetch()}
        />
      ) : null}

      {projects.data && items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Hammer className="h-8 w-8" />}
            title={projects.data.items.length === 0 ? 'No projects yet' : 'Nothing in this view'}
            body={
              projects.data.items.length === 0
                ? 'Projects appear here once the catalogue is seeded.'
                : 'Try a different filter.'
            }
          />
        </Card>
      ) : null}

      <ul className="space-y-3">
        {items.map((project) => (
          <li key={project.id}>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{project.title}</h2>
                    <Badge color="neutral">{project.level}</Badge>
                    {project.careerName ? <Badge color="brand">{project.careerName}</Badge> : null}
                    {project.status === 'done' ? (
                      <Badge color="strong" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                        Completed
                      </Badge>
                    ) : project.status === 'in_progress' ? (
                      <Badge color="developing">In progress</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-muted">{project.description}</p>
                  <p className="mt-2 text-xs text-muted">
                    About {project.estimatedHours} hours · practises{' '}
                    {project.skills.map((s) => s.skillName).join(', ')}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1">
                  {update.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted" />
                  ) : null}
                  {project.status !== 'done' ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => update.mutate({ id: project.id, status: 'in_progress' })}
                      >
                        Start
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => update.mutate({ id: project.id, status: 'done' })}
                      >
                        Mark done
                      </Button>
                    </>
                  ) : (
                    <span className="text-sm text-strong">Nice work.</span>
                  )}
                </div>
              </div>

              {project.steps.length > 0 ? (
                <details
                  className="mt-4"
                  open={expanded === project.id}
                  onToggle={(e) =>
                    setExpanded((e.currentTarget as HTMLDetailsElement).open ? project.id : null)
                  }
                >
                  <summary className="cursor-pointer text-sm font-medium text-brand">
                    Step checklist ({project.steps.length} steps)
                  </summary>
                  <ol className="mt-3 space-y-2">
                    {project.steps.map((step) => (
                      <li key={step.order} className="flex gap-2 text-sm">
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                        <span>
                          <span className="font-medium">{step.title}</span>
                          {step.description ? (
                            <span className="block text-muted">{step.description}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { CardHeader };
