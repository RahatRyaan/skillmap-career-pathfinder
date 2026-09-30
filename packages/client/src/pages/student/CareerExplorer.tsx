import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Users } from 'lucide-react';
import { careersApi, profileApi } from '@/lib/endpoints';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { Badge, ErrorState, SkeletonCards } from '@/components/ui/States';
import { Field, Input, Select } from '@/components/ui/Form';
import { formatPercent } from '@/lib/utils';

const CATEGORIES = [
  'Data & AI',
  'Software',
  'Design',
  'Security',
  'Cloud & Infrastructure',
  'Business & Marketing',
];

export default function CareerExplorer() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => profileApi.get() });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const careers = useQuery({
    queryKey: ['careers', search, category],
    queryFn: () => careersApi.list({ search, category, limit: 50 }),
  });

  const targetId = profile.data?.targetCareerId ?? null;

  return (
    <div>
      <PageHeader
        title="Careers"
        description="Pick the one you are working towards. You can change it later."
        action={
          <Link to="/app/careers/compare">
            <Button variant="outline" icon={<Users className="h-4 w-4" />}>
              Compare 2 or 3
            </Button>
          </Link>
        }
      />

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Search" htmlFor="career-search">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <Input
                id="career-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                placeholder="Data, design, security…"
              />
            </div>
          </Field>
          <Field label="Category" htmlFor="career-category">
            <Select
              id="career-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {careers.isLoading ? <SkeletonCards count={4} /> : null}
      {careers.isError ? (
        <ErrorState
          message="We could not load the career list."
          onRetry={() => void careers.refetch()}
        />
      ) : null}

      {careers.data && careers.data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="h-8 w-8" />}
            title="No careers match that"
            body="Try a broader search or clear the category filter."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setCategory('');
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : null}

      {careers.data && careers.data.items.length > 0 ? (
        <>
          <p className="mb-4 text-sm text-muted">
            {careers.data.total} career{careers.data.total === 1 ? '' : 's'}. Alignment appears on
            your cards once you have added skills.
          </p>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {careers.data.items.map((career) => {
              const isTarget = targetId === career.id;
              return (
                <li key={career.id}>
                  <Link to={`/app/careers/${career.id}`} className="block h-full">
                    <Card
                      className={`h-full transition-transform hover:scale-[1.01] ${isTarget ? 'border-brand' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-base font-semibold">{career.name}</h2>
                        {isTarget ? <Badge color="brand">Your target</Badge> : null}
                      </div>
                      <Badge color="neutral" className="mt-2">
                        {career.category}
                      </Badge>
                      <p className="mt-3 line-clamp-3 text-sm text-muted">{career.summary}</p>

                      {career.alignmentPercent !== null ? (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted">Your alignment</span>
                            <span className="font-bold text-brand">
                              {formatPercent(career.alignmentPercent)}
                            </span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[rgb(var(--border))]">
                            <div
                              className="h-full rounded-full bg-brand"
                              style={{ width: `${career.alignmentPercent}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="mt-4 text-xs text-muted">
                          {career.requiredSkillCount} required skills. Add your skills to see your
                          fit.
                        </p>
                      )}

                      {career.topGapSkillNames.length > 0 ? (
                        <p className="mt-3 text-xs text-muted">
                          Biggest gaps: {career.topGapSkillNames.slice(0, 3).join(', ')}
                        </p>
                      ) : null}
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
