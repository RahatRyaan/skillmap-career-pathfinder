import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, Info, RotateCcw, Target } from 'lucide-react';
import { analysisApi, profileApi } from '@/lib/endpoints';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Badge, ErrorState, SkeletonCards } from '@/components/ui/States';
import { RangeSlider } from '@/components/ui/Form';
import { SKILL_LEVEL_DESCRIPTIONS } from '@skillmap/shared';
import { formatPercent } from '@/lib/utils';

function levelDescription(level: number): string {
  const entry = Object.entries(SKILL_LEVEL_DESCRIPTIONS).find(([key]) => Number(key) === level);
  return entry ? entry[1] : '';
}

export default function WhatIf() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => profileApi.get() });
  const careerId = profile.data?.targetCareerId ?? null;

  const gap = useQuery({
    queryKey: ['skill-gap', careerId],
    queryFn: () => analysisApi.gap(careerId!),
    enabled: Boolean(careerId),
  });

  // Sliders start at the student's real levels, so nothing is applied until moved.
  const [levels, setLevels] = useState<Record<string, number>>({});

  const changed = useMemo(() => {
    if (!gap.data) return [];
    return gap.data.gaps
      .filter((g) => g.gap > 0)
      .map((g) => {
        const current = levels[g.skillId] ?? g.currentLevel;
        return {
          skillId: g.skillId,
          skillName: g.skillName,
          from: g.currentLevel,
          to: current,
          changed: current !== g.currentLevel,
        };
      })
      .filter((c) => c.changed);
  }, [gap.data, levels]);

  const simulate = useMutation({
    mutationFn: () =>
      analysisApi.simulate(
        careerId!,
        changed.map((c) => ({ skillId: c.skillId, newLevel: c.to })),
      ),
  });

  if (!careerId) {
    return (
      <div>
        <PageHeader title="What if I improve?" />
        <Card>
          <EmptyState
            icon={<Target className="h-8 w-8" />}
            title="No target career yet"
            body="The simulator measures hypothetical changes against a specific career's requirements."
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
        <PageHeader title="What if I improve?" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (gap.isError || !gap.data) {
    return (
      <div>
        <PageHeader title="What if I improve?" />
        <ErrorState
          message="We could not load your skill map."
          onRetry={() => void gap.refetch()}
        />
      </div>
    );
  }

  const openGaps = gap.data.gaps.filter((g) => g.gap > 0);
  const result = simulate.data;

  return (
    <div>
      <PageHeader
        title="What if I improve?"
        description="Move a slider to see exactly what each change would do. Nothing is saved."
        action={
          <Button
            variant="outline"
            onClick={() => {
              setLevels({});
              simulate.reset();
            }}
            icon={<RotateCcw className="h-4 w-4" />}
            disabled={Object.keys(levels).length === 0}
          >
            Reset
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Your open gaps"
            description="Each slider is one skill's level. Move it to try a scenario."
          />
          {openGaps.length === 0 ? (
            <EmptyState title="No open gaps" body="You meet every requirement for this career." />
          ) : (
            <div className="space-y-5">
              {openGaps.map((g) => {
                const value = levels[g.skillId] ?? g.currentLevel;
                const isChanged = value !== g.currentLevel;
                return (
                  <div
                    key={g.skillId}
                    className={isChanged ? 'rounded-lg bg-brand-subtle p-3 dark:bg-brand/10' : ''}
                  >
                    <RangeSlider
                      label={g.skillName}
                      value={value}
                      min={g.currentLevel}
                      max={5}
                      step={1}
                      valueLabel={`Level ${value} (needs ${g.requiredLevel})`}
                      onChange={(next) => setLevels((prev) => ({ ...prev, [g.skillId]: next }))}
                      hint={
                        isChanged
                          ? `Would change from ${g.currentLevel} to ${value}. ${levelDescription(value)}`
                          : undefined
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="border-brand/30">
            <CardHeader title="Projected result" />
            {changed.length === 0 ? (
              <p className="text-sm text-muted">
                Move a slider to see the effect. This is a calculation, not a prediction of
                anything.
              </p>
            ) : (
              <>
                <Button onClick={() => simulate.mutate()} isLoading={simulate.isPending} fullWidth>
                  Calculate the effect of {changed.length} change{changed.length === 1 ? '' : 's'}
                </Button>

                {result ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-[rgb(var(--surface-raised))] p-4">
                      <div>
                        <p className="text-sm text-muted">Alignment</p>
                        <p className="text-3xl font-bold">
                          {formatPercent(result.baselinePercent)}{' '}
                          <ArrowRight className="inline h-4 w-4" aria-hidden="true" />{' '}
                          <span className="text-brand">
                            {formatPercent(result.projectedPercent)}
                          </span>
                        </p>
                      </div>
                      <Badge color={result.deltaPercent > 0 ? 'strong' : 'neutral'}>
                        {result.deltaPercent > 0 ? '+' : ''}
                        {formatPercent(result.deltaPercent)}
                      </Badge>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <caption className="sr-only">Effect of each change on its own</caption>
                        <thead>
                          <tr className="border-b border-[rgb(var(--border))] text-left">
                            <th scope="col" className="py-2 pr-3 font-medium">
                              Skill
                            </th>
                            <th scope="col" className="py-2 pr-3 font-medium">
                              Change
                            </th>
                            <th scope="col" className="py-2 font-medium">
                              Effect alone
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.perChange.map((change) => (
                            <tr
                              key={change.skillId}
                              className="border-b border-[rgb(var(--border))] last:border-0"
                            >
                              <th scope="row" className="py-2 pr-3 text-left font-normal">
                                {change.skillName}
                              </th>
                              <td className="py-2 pr-3 text-muted">
                                {change.fromLevel} → {change.toLevel}
                              </td>
                              <td className="py-2 font-medium text-strong">
                                +{formatPercent(change.deltaPercent)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <p className="text-xs text-muted">
                      Each row shows what that change does on its own. The headline number above
                      applies all of them together.
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </Card>

          <Card>
            <CardHeader title="What would change in your plan" />
            {result && result.projectedPriorities.length > 0 ? (
              <ol className="space-y-2">
                {result.projectedPriorities.slice(0, 5).map((item, i) => (
                  <li key={item.skillId} className="flex items-start gap-2 text-sm">
                    <span className="font-bold text-brand">{i + 1}.</span>
                    <span>
                      <strong>{item.skillName}</strong>
                      <span className="block text-xs text-muted">{item.reason}</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">
                Move a slider and calculate to see which skills would move up your list.
              </p>
            )}
          </Card>
        </div>
      </div>

      <p className="mt-6 flex items-start gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-raised))] p-4 text-xs text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {result?.disclaimer ?? gap.data.disclaimer} This simulator does not save anything. To make
        the change real, update the skill level on your{' '}
        <Link to="/app/skills" className="font-medium text-brand hover:underline">
          skills page
        </Link>
        .
      </p>
    </div>
  );
}
