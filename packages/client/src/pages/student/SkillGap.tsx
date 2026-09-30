import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Info, SlidersHorizontal, Target } from 'lucide-react';
import { analysisApi, profileApi } from '@/lib/endpoints';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Badge, ErrorState, SkeletonCards } from '@/components/ui/States';
import { Select } from '@/components/ui/Form';
import { CategoryRadar, GapDistribution, SkillBars } from '@/components/charts';
import { cn, formatPercent, GAP_LABEL_COPY } from '@/lib/utils';

type LabelFilter = 'all' | 'strong' | 'developing' | 'gap' | 'critical';

export default function SkillGap() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => profileApi.get() });
  const careerId = profile.data?.targetCareerId ?? null;

  const gap = useQuery({
    queryKey: ['skill-gap', careerId],
    queryFn: () => analysisApi.gap(careerId!),
    enabled: Boolean(careerId),
  });

  const [filter, setFilter] = useState<LabelFilter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const priorities = useQuery({
    queryKey: ['priorities', careerId],
    queryFn: () => analysisApi.priorities(careerId!),
    enabled: Boolean(careerId),
  });

  const filteredGaps = useMemo(() => {
    if (!gap.data) return [];
    return filter === 'all' ? gap.data.gaps : gap.data.gaps.filter((g) => g.label === filter);
  }, [gap.data, filter]);

  if (!careerId) {
    return (
      <div>
        <PageHeader title="Skill gap" />
        <Card>
          <EmptyState
            icon={<Target className="h-8 w-8" />}
            title="No target career yet"
            body="Your skill gap is measured against a specific career's requirements. Choose one first."
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

  if (gap.isLoading) {
    return (
      <div>
        <PageHeader title="Skill gap" />
        <SkeletonCards count={4} />
      </div>
    );
  }

  if (gap.isError || !gap.data) {
    return (
      <div>
        <PageHeader title="Skill gap" />
        <ErrorState message="We could not calculate your gap." onRetry={() => void gap.refetch()} />
      </div>
    );
  }

  const data = gap.data;
  const counts = data.alignment.gapsByLabel;

  return (
    <div>
      <PageHeader
        title="Skill gap"
        description={`How far you are from ${data.careerName}, and exactly why.`}
        action={
          <div className="flex gap-2">
            <Link to="/app/what-if">
              <Button variant="outline" icon={<SlidersHorizontal className="h-4 w-4" />}>
                What if I improve?
              </Button>
            </Link>
            <Link to="/app/roadmap">
              <Button>Build my roadmap</Button>
            </Link>
          </div>
        }
      />

      <Card className="mb-6 border-brand/30">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-sm text-muted">Career alignment</p>
            <p className="mt-1 text-5xl font-bold text-brand">
              {formatPercent(data.alignment.percent)}
            </p>
            <p className="mt-2 text-xs text-muted">
              {data.alignment.ownedCount} of {data.alignment.skillCount} required skills recorded
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['strong', 'developing', 'gap', 'critical'] as const).map((label) => (
              <div
                key={label}
                className="rounded-lg border border-[rgb(var(--border))] p-3 text-center"
              >
                <p className="text-2xl font-bold">{counts[label]}</p>
                <p className="text-xs text-muted">{GAP_LABEL_COPY[label]?.label ?? label}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {data.transferableNotes.length > 0 ? (
        <Card className="mb-6 border-developing/40">
          <CardHeader
            title="Partial credit applied"
            description="Related skills gave you a small amount of credit. It is capped, so it can never close a gap on its own."
          />
          <ul className="space-y-2">
            {data.transferableNotes.map((note) => (
              <li key={note.skillId} className="text-sm text-muted">
                <strong className="text-[rgb(var(--text))]">{note.skillName}</strong> gained{' '}
                {note.credit} level{note.credit === 1 ? '' : 's'} because you already have{' '}
                {note.source}.
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <SkillBars
          data={data.gaps.map((g) => ({
            skillName: g.skillName,
            currentLevel: g.currentLevel,
            requiredLevel: g.requiredLevel,
            label: g.label,
          }))}
        />
        <CategoryRadar data={data.categoryAverages} />
        <GapDistribution
          data={(['strong', 'developing', 'gap', 'critical'] as const).map((label) => ({
            label,
            count: counts[label],
          }))}
        />
      </div>

      {priorities.data && priorities.data.items.length > 0 ? (
        <Card className="mt-6">
          <CardHeader
            title="What to learn, in order"
            description="Ranked by five factors. Prerequisites always come first."
          />
          <ol className="space-y-2">
            {priorities.data.items.map((item) => (
              <li key={item.skillId} className="rounded-lg border border-[rgb(var(--border))] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {item.rank}. {item.skillName}
                      </span>
                      <Badge
                        color={
                          item.importance === 'high'
                            ? 'critical'
                            : item.importance === 'medium'
                              ? 'developing'
                              : 'neutral'
                        }
                      >
                        {item.importance} importance
                      </Badge>
                      <Badge color="neutral">gap {item.gap}</Badge>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-brand">{Math.round(item.score)}</span>
                </div>
                <details
                  className="mt-2"
                  open={expanded === item.skillId}
                  onToggle={(e) =>
                    setExpanded((e.currentTarget as HTMLDetailsElement).open ? item.skillId : null)
                  }
                >
                  <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-brand">
                    <Info className="h-3.5 w-3.5" aria-hidden="true" />
                    Why this order?
                  </summary>
                  <p className="mt-2 rounded-lg bg-[rgb(var(--surface-raised))] p-3 text-sm text-muted">
                    {item.reason}
                  </p>
                </details>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardHeader
          title="Every required skill"
          description="Tap a row to see how its number was calculated."
          action={
            <Select
              aria-label="Filter by gap label"
              className="h-9 w-40"
              value={filter}
              onChange={(e) => setFilter(e.target.value as LabelFilter)}
            >
              <option value="all">All statuses</option>
              <option value="critical">Critical only</option>
              <option value="gap">Gap only</option>
              <option value="developing">Developing only</option>
              <option value="strong">Strong only</option>
            </Select>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Required skills with your level, gap, and status</caption>
            <thead>
              <tr className="border-b border-[rgb(var(--border))] text-left">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Skill
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Yours
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Required
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Gap
                </th>
                <th scope="col" className="py-2 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredGaps.map((item) => {
                const copy = GAP_LABEL_COPY[item.label] ?? GAP_LABEL_COPY['gap']!;
                return (
                  <tr
                    key={item.skillId}
                    className="border-b border-[rgb(var(--border))] last:border-0"
                  >
                    <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                      {item.skillName}
                    </th>
                    <td className="py-2.5 pr-4">{item.currentLevel}</td>
                    <td className="py-2.5 pr-4">{item.requiredLevel}</td>
                    <td
                      className={cn(
                        'py-2.5 pr-4 font-medium',
                        item.gap > 0 ? copy.color : 'text-strong',
                      )}
                    >
                      {item.gap}
                    </td>
                    <td className="py-2.5">
                      <Badge
                        color={
                          item.label === 'strong'
                            ? 'strong'
                            : item.label === 'critical'
                              ? 'critical'
                              : item.label === 'gap'
                                ? 'gap'
                                : 'developing'
                        }
                      >
                        {copy.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-6 flex items-start gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-raised))] p-4 text-xs text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {data.disclaimer}
      </p>
    </div>
  );
}
