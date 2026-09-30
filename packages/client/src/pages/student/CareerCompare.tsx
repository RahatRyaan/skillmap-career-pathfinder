import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, Users } from 'lucide-react';
import { careersApi, profileApi } from '@/lib/endpoints';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { ErrorState, SkeletonCards } from '@/components/ui/States';
import { formatPercent } from '@/lib/utils';

export default function CareerCompare() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => profileApi.get() });
  const all = useQuery({
    queryKey: ['careers', '', ''],
    queryFn: () => careersApi.list({ limit: 50 }),
  });
  const [selected, setSelected] = useState<string[]>([]);

  const comparison = useQuery({
    queryKey: ['career-compare', selected],
    queryFn: () => careersApi.compare(selected),
    enabled: selected.length >= 2,
  });

  const selectedCareers = useMemo(
    () => (all.data?.items ?? []).filter((c) => selected.includes(c.id)),
    [all.data, selected],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((c) => c !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  return (
    <div>
      <PageHeader
        title="Compare careers"
        description="Pick two or three to see them side by side against your own skills."
        action={
          <Link to="/app/careers" className="text-sm font-medium text-brand hover:underline">
            Back to all careers
          </Link>
        }
      />

      {all.isLoading ? <SkeletonCards count={2} /> : null}
      {all.isError ? (
        <ErrorState
          message="We could not load the career list."
          onRetry={() => void all.refetch()}
        />
      ) : null}

      {all.data ? (
        <Card className="mb-6">
          <CardHeader
            title="Choose careers"
            description={`${selected.length} of 3 selected. Pick at least two.`}
          />
          <ul className="flex flex-wrap gap-2">
            {all.data.items.map((career) => {
              const isSelected = selected.includes(career.id);
              const isTarget = profile.data?.targetCareerId === career.id;
              return (
                <li key={career.id}>
                  <button
                    type="button"
                    onClick={() => toggle(career.id)}
                    aria-pressed={isSelected}
                    className={`inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium ${
                      isSelected
                        ? 'border-brand bg-brand text-white'
                        : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-raised))]'
                    }`}
                  >
                    {isSelected ? <Check className="h-4 w-4" /> : null}
                    {career.name}
                    {isTarget ? <span className="text-xs opacity-75">(target)</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {selected.length < 2 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="Pick at least two"
            body="Select two or three careers above and the comparison will appear here."
          />
        </Card>
      ) : null}

      {selected.length >= 2 && comparison.isLoading ? <SkeletonCards count={2} /> : null}
      {selected.length >= 2 && comparison.isError ? (
        <ErrorState
          message="We could not compare those careers."
          onRetry={() => void comparison.refetch()}
        />
      ) : null}

      {comparison.data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {comparison.data.careers.map((career) => (
              <Card
                key={career.id}
                className={profile.data?.targetCareerId === career.id ? 'border-brand' : ''}
              >
                <h2 className="text-lg font-semibold">{career.name}</h2>
                <p className="mt-1 text-xs text-muted">{career.category}</p>

                {career.alignmentPercent !== null ? (
                  <div className="mt-4">
                    <p className="text-4xl font-bold text-brand">
                      {formatPercent(career.alignmentPercent)}
                    </p>
                    <p className="text-xs text-muted">your alignment</p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgb(var(--border))]">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${career.alignmentPercent}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted">Add skills to see your fit.</p>
                )}

                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">Required skills</dt>
                    <dd className="font-medium">{career.requiredSkillCount}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Missing</dt>
                    <dd className="font-medium">{career.missingSkillCount ?? 0}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">You already have</dt>
                    <dd className="font-medium">{career.sharedSkillCount}</dd>
                  </div>
                </dl>

                {career.topGaps.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-muted">Biggest gaps</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {career.topGaps.map((gap) => (
                        <li key={gap.skillName}>
                          {gap.skillName} <span className="text-xs text-muted">gap {gap.gap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <Link to={`/app/careers/${career.id}`} className="mt-4 inline-block">
                  <Button size="sm" variant="outline">
                    See full requirements
                  </Button>
                </Link>
              </Card>
            ))}
          </div>

          {comparison.data.sharedSkillCount > 0 ? (
            <Card className="mt-6">
              <CardHeader
                title={`${comparison.data.sharedSkillCount} skills appear in all of these roles`}
                description="Learning these helps whichever you end up choosing."
              />
            </Card>
          ) : null}

          <p className="mt-6 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-raised))] p-4 text-xs text-muted">
            {comparison.data.disclaimer}
          </p>
        </>
      ) : null}

      {selectedCareers.length > 0 && selected.length < 2 ? (
        <p className="mt-4 text-sm text-muted">
          You picked {selectedCareers.map((c) => c.name).join(' and ')}. Pick one more to compare.
        </p>
      ) : null}
    </div>
  );
}
