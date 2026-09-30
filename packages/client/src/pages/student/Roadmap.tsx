import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Columns3, Info, ListChecks, RefreshCw, Sparkles, Timer } from 'lucide-react';
import { profileApi, roadmapApi } from '@/lib/endpoints';
import { toUserMessage } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Badge, ErrorState, SkeletonCards } from '@/components/ui/States';
import { cn } from '@/lib/utils';

type View = 'timeline' | 'checklist' | 'kanban';

const VIEWS: { key: View; label: string; icon: typeof Timer }[] = [
  { key: 'timeline', label: 'Timeline', icon: Timer },
  { key: 'checklist', label: 'Weekly checklist', icon: ListChecks },
  { key: 'kanban', label: 'Kanban', icon: Columns3 },
];

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  todo: { label: 'To do', className: 'bg-[rgb(var(--surface-raised))]' },
  in_progress: { label: 'In progress', className: 'bg-brand-subtle dark:bg-brand/20' },
  done: { label: 'Done', className: 'bg-strong/10' },
  skipped: { label: 'Skipped', className: 'bg-[rgb(var(--surface-raised))] opacity-60' },
};

export default function Roadmap() {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => profileApi.get() });
  const careerId = profile.data?.targetCareerId ?? null;

  const [view, setView] = useState<View>('timeline');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const roadmap = useQuery({
    queryKey: ['roadmap', careerId],
    queryFn: () => roadmapApi.current(careerId ?? undefined),
    enabled: Boolean(careerId),
    retry: false,
  });

  const generate = useMutation({
    mutationFn: () => roadmapApi.generate(careerId!),
    onSuccess: (result) => {
      setNotice(
        result.isReplan
          ? `Roadmap updated to version ${result.version}.${result.carriedOverItems > 0 ? ` ${result.carriedOverItems} completed item${result.carriedOverItems === 1 ? '' : 's'} carried over.` : ''}`
          : `Roadmap created with ${result.items.length} steps.`,
      );
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['roadmap'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      setError(toUserMessage(err, 'Could not build the roadmap.'));
      setNotice(null);
    },
  });

  const updateItem = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      roadmapApi.updateItem(id, { status }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['roadmap'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setNotice(result.replanReason);
    },
    onError: (err) => setError(toUserMessage(err, 'Could not save that change.')),
  });

  const grouped = useMemo(() => {
    const items = roadmap.data?.items ?? [];
    if (view === 'timeline') {
      const months = new Map<number, typeof items>();
      for (const item of items) months.set(item.month, [...(months.get(item.month) ?? []), item]);
      return [...months.entries()].sort((a, b) => a[0] - b[0]);
    }
    return [];
  }, [roadmap.data, view]);

  if (!careerId) {
    return (
      <div>
        <PageHeader title="Roadmap" />
        <Card>
          <EmptyState
            title="No target career yet"
            body="Your roadmap is built from the gaps between your skills and one career's requirements."
            action={
              <Link to="/app/careers">
                <Button>Choose a career</Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const noRoadmap =
    roadmap.isError && (roadmap.error as { code?: string } | null)?.code === 'NOT_FOUND';

  if (roadmap.isLoading) {
    return (
      <div>
        <PageHeader title="Roadmap" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (noRoadmap) {
    return (
      <div>
        <PageHeader title="Roadmap" />
        <Card>
          <EmptyState
            icon={<Sparkles className="h-8 w-8" />}
            title="No roadmap yet"
            body={`We will build one from your ${roadmap.data?.items.length ?? 'open'} gaps, paced at your weekly study hours, with resources attached free first.`}
            action={
              <Button onClick={() => generate.mutate()} isLoading={generate.isPending}>
                Generate my roadmap
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  if (roadmap.isError || !roadmap.data) {
    return (
      <div>
        <PageHeader title="Roadmap" />
        <ErrorState
          message="We could not load your roadmap."
          onRetry={() => void roadmap.refetch()}
        />
      </div>
    );
  }

  const data = roadmap.data;
  const items = data.items;

  return (
    <div>
      <PageHeader
        title="Roadmap"
        description={`${data.careerName} · ${data.weeklyStudyHours}h per week · ${data.progressPercent}% done`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => generate.mutate()}
              isLoading={generate.isPending}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              {data.version > 1 ? 'Re-plan from my progress' : 'Rebuild'}
            </Button>
            <Link to="/app/what-if">
              <Button variant="outline">What if I improve?</Button>
            </Link>
          </div>
        }
      />

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-critical/30 bg-critical/5 px-4 py-3 text-sm text-critical"
        >
          {error}
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-brand/30 bg-brand-subtle px-4 py-3 text-sm text-brand dark:bg-brand/20"
        >
          {notice}
        </div>
      ) : null}

      {data.changeLog.length > 0 ? (
        <Card className="mb-6 border-brand/30">
          <CardHeader
            title={data.version > 1 ? 'What changed in this version' : 'How this plan was built'}
            description={`Version ${data.version}`}
          />
          <ul className="space-y-2">
            {data.changeLog.map((entry, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                <span>{entry}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Roadmap view">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            onClick={() => setView(v.key)}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium',
              view === v.key
                ? 'bg-brand text-white'
                : 'border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-raised))]',
            )}
          >
            <v.icon className="h-4 w-4" aria-hidden="true" />
            {v.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing planned"
            body="There is nothing to work on for this career right now."
          />
        </Card>
      ) : null}

      {view === 'timeline' && grouped.length > 0 ? (
        <div className="space-y-6">
          {grouped.map(([month, monthItems]) => {
            const done = monthItems.filter((i) => i.status === 'done').length;
            return (
              <section key={month}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Month {month}</h2>
                  <span className="text-sm text-muted">
                    {done} of {monthItems.length} done
                  </span>
                </div>
                <ol className="space-y-2">
                  {monthItems.map((item) => (
                    <li key={item.id}>
                      <ItemCard
                        item={item}
                        onUpdate={updateItem.mutate}
                        isPending={updateItem.isPending}
                      />
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      ) : null}

      {view === 'checklist' ? (
        <div className="space-y-6">
          {[...new Set(items.map((i) => i.month))]
            .sort((a, b) => a - b)
            .map((month) => {
              const monthItems = items.filter((i) => i.month === month);
              return (
                <Card key={month}>
                  <CardHeader
                    title={`Month ${month}`}
                    description={`${monthItems.filter((i) => i.status === 'done').length} of ${monthItems.length} complete`}
                  />
                  <ul className="space-y-2">
                    {monthItems.map((item) => (
                      <li key={item.id}>
                        <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-[rgb(var(--border))] p-3">
                          <input
                            type="checkbox"
                            checked={item.status === 'done'}
                            onChange={(e) =>
                              updateItem.mutate({
                                id: item.id,
                                status: e.target.checked ? 'done' : 'todo',
                              })
                            }
                            className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                'block text-sm font-medium',
                                item.status === 'done' && 'line-through opacity-60',
                              )}
                            >
                              {item.title}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted">
                              {item.estimatedHours}h · Week {item.week}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
        </div>
      ) : null}

      {view === 'kanban' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {(['todo', 'in_progress', 'done'] as const).map((column) => {
            const columnItems = items.filter(
              (i) => (i.status === 'skipped' ? 'todo' : i.status) === column,
            );
            return (
              <Card key={column}>
                <CardHeader
                  title={STATUS_STYLE[column]?.label ?? column}
                  description={`${columnItems.length} item${columnItems.length === 1 ? '' : 's'}`}
                />
                <ul className="space-y-2">
                  {columnItems.map((item) => (
                    <li key={item.id}>
                      <div
                        className={cn(
                          'rounded-lg border border-[rgb(var(--border))] p-3',
                          STATUS_STYLE[column]?.className,
                        )}
                      >
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-1 text-xs text-muted">
                          Month {item.month} · {item.estimatedHours}h
                        </p>
                        <div className="mt-2 flex gap-1">
                          {column !== 'todo' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateItem.mutate({ id: item.id, status: 'todo' })}
                            >
                              To do
                            </Button>
                          ) : null}
                          {column === 'todo' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                updateItem.mutate({ id: item.id, status: 'in_progress' })
                              }
                            >
                              Start
                            </Button>
                          ) : null}
                          {column !== 'done' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateItem.mutate({ id: item.id, status: 'done' })}
                            >
                              Done
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ItemCard({
  item,
  onUpdate,
  isPending,
}: {
  item: {
    id: string;
    title: string;
    description: string;
    estimatedHours: number;
    status: string;
    whyThisOrder: string;
    week: number;
    month: number;
    type: string;
    resourceIds: string[];
  };
  onUpdate: (input: { id: string; status: string }) => void;
  isPending: boolean;
}) {
  return (
    <Card className={cn('transition-opacity', item.status === 'done' && 'opacity-70')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn('text-sm font-semibold', item.status === 'done' && 'line-through')}>
              {item.title}
            </h3>
            <Badge
              color={
                item.type === 'project'
                  ? 'brand'
                  : item.type === 'milestone'
                    ? 'developing'
                    : 'neutral'
              }
            >
              {item.type}
            </Badge>
            {item.status === 'done' ? <Badge color="strong">Done</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted">{item.description}</p>
          <p className="mt-1 text-xs text-muted">
            Week {item.week} · about {item.estimatedHours} hour
            {item.estimatedHours === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex shrink-0 gap-1">
          {item.status !== 'done' ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onUpdate({ id: item.id, status: 'done' })}
              isLoading={isPending}
            >
              Mark done
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onUpdate({ id: item.id, status: 'todo' })}
            >
              Undo
            </Button>
          )}
        </div>
      </div>

      {item.whyThisOrder ? (
        <details className="mt-3">
          <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-brand">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            Why this order?
          </summary>
          <p className="mt-2 rounded-lg bg-[rgb(var(--surface-raised))] p-3 text-sm text-muted">
            {item.whyThisOrder}
          </p>
        </details>
      ) : null}
    </Card>
  );
}
