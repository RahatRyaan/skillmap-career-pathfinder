import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, Search } from 'lucide-react';
import { learningApi } from '@/lib/endpoints';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, EmptyState } from '@/components/ui/Card';
import { Badge, ErrorState, SkeletonCards } from '@/components/ui/States';
import { Field, Input, Select } from '@/components/ui/Form';

const TYPES = ['video', 'article', 'course', 'documentation', 'practice', 'book'];

export default function Resources() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [level, setLevel] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const [language, setLanguage] = useState('');

  const resources = useQuery({
    queryKey: ['resources', search, type, level, freeOnly, language],
    queryFn: () =>
      learningApi.resources({
        search,
        type: type || undefined,
        level: level === '' ? undefined : Number(level),
        free: freeOnly || undefined,
        language: language || undefined,
        limit: 60,
      }),
  });

  return (
    <div>
      <PageHeader
        title="Learning resources"
        description="Free resources are listed first. Everything here is a public link you can open."
      />

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Field label="Search" htmlFor="res-search">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <Input
                  id="res-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  placeholder="SQL, statistics, Git…"
                />
              </div>
            </Field>
          </div>
          <Field label="Type" htmlFor="res-type">
            <Select id="res-type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Any type</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Level" htmlFor="res-level">
            <Select id="res-level" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Any level</option>
              {[0, 1, 2, 3, 4, 5].map((l) => (
                <option key={l} value={l}>
                  Level {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Language" htmlFor="res-lang">
            <Select id="res-lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="">Any language</option>
              <option value="en">English</option>
              <option value="bn">বাংলা</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={freeOnly}
                onChange={(e) => setFreeOnly(e.target.checked)}
                className="h-4 w-4 accent-brand"
              />
              Free only
            </label>
          </div>
        </div>
      </Card>

      {resources.isLoading ? <SkeletonCards count={4} /> : null}
      {resources.isError ? (
        <ErrorState
          message="We could not load the resource list."
          onRetry={() => void resources.refetch()}
        />
      ) : null}

      {resources.data && resources.data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="h-8 w-8" />}
            title="No resources match those filters"
            body="Try removing a filter or searching for a broader term."
          />
        </Card>
      ) : null}

      {resources.data && resources.data.items.length > 0 ? (
        <>
          <p className="mb-4 text-sm text-muted">
            {resources.data.total} resource{resources.data.total === 1 ? '' : 's'}, free first.
          </p>
          <ul className="space-y-3">
            {resources.data.items.map((resource) => (
              <li key={resource.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold">{resource.title}</h2>
                        {resource.isFree ? (
                          <Badge color="strong">Free</Badge>
                        ) : (
                          <Badge color="neutral">Paid</Badge>
                        )}
                        <Badge color="neutral">{resource.type}</Badge>
                        <Badge color="neutral">Level {resource.level}</Badge>
                        {resource.language === 'bn' ? <Badge color="brand">বাংলা</Badge> : null}
                        {resource.isSample ? (
                          <Badge
                            color="developing"
                            icon={<AlertTriangle className="h-3.5 w-3.5" />}
                          >
                            Sample — link not verified
                          </Badge>
                        ) : null}
                      </div>
                      {resource.description ? (
                        <p className="mt-1.5 text-sm text-muted">{resource.description}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted">
                        {resource.skillName}
                        {resource.durationMinutes
                          ? ` · about ${resource.durationMinutes} minutes`
                          : ''}
                      </p>
                    </div>

                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-[rgb(var(--border))] px-4 text-sm font-medium hover:bg-[rgb(var(--surface-raised))]"
                    >
                      Open
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only-focusable">(opens in a new tab)</span>
                    </a>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
