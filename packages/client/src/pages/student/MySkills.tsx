import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SKILL_LEVEL_DESCRIPTIONS, type SkillLevel } from '@skillmap/shared';
import { Bot, Check, GraduationCap, Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { skillsApi } from '@/lib/endpoints';
import { toUserMessage } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Badge, ErrorState, SkeletonCards } from '@/components/ui/States';
import { Field, Input, Select } from '@/components/ui/Form';
import { cn } from '@/lib/utils';

const LEVELS: SkillLevel[] = [0, 1, 2, 3, 4, 5];

const SOURCE_COPY: Record<
  string,
  { label: string; icon: typeof Check; color: 'neutral' | 'brand' | 'developing' | 'strong' }
> = {
  self_reported: { label: 'You added', icon: Pencil, color: 'neutral' },
  ai_extracted: { label: 'AI extracted — review needed', icon: Bot, color: 'developing' },
  quiz_verified: { label: 'Quiz verified', icon: GraduationCap, color: 'brand' },
  roadmap_completed: { label: 'Completed via roadmap', icon: Check, color: 'strong' },
  project_completed: { label: 'Completed via project', icon: Sparkles, color: 'strong' },
};

const CATEGORIES = ['Technical', 'Analytical', 'Tools', 'Soft skills'];

export default function MySkills() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mine = useQuery({ queryKey: ['user-skills'], queryFn: () => skillsApi.mine() });

  const filtered = useMemo(() => {
    const items = mine.data?.items ?? [];
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !q || item.skillName.toLowerCase().includes(q);
      const matchesCategory = !category || item.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [mine.data, search, category]);

  const updateLevel = useMutation({
    mutationFn: ({ id, level }: { id: string; level: number }) => skillsApi.update(id, { level }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-skills'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => setError(toUserMessage(err, 'Could not save that change.')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => skillsApi.remove(id),
    onSuccess: () => {
      setPendingDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['user-skills'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => setError(toUserMessage(err, 'Could not remove that skill.')),
  });

  return (
    <div>
      <PageHeader
        title="My Skills"
        description="What you can do now. Honest levels beat optimistic ones."
        action={
          <Button onClick={() => setAddOpen(true)} icon={<Plus className="h-4 w-4" />}>
            Add skill
          </Button>
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

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Search your skills" htmlFor="skill-search">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <Input
                id="skill-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                placeholder="SQL, Python…"
              />
            </div>
          </Field>
          <Field label="Category" htmlFor="skill-category">
            <Select
              id="skill-category"
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

      {mine.isLoading ? <SkeletonCards count={3} /> : null}
      {mine.isError ? (
        <ErrorState message="We could not load your skills." onRetry={() => void mine.refetch()} />
      ) : null}

      {mine.data && filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="h-8 w-8" />}
            title={mine.data.items.length === 0 ? 'No skills yet' : 'Nothing matches that filter'}
            body={
              mine.data.items.length === 0
                ? 'Add the skills you have already used, even at a low level. A skill at level 1 is still real progress and changes your map.'
                : 'Try a different search term or clear the category filter.'
            }
            action={
              mine.data.items.length === 0 ? (
                <Button onClick={() => setAddOpen(true)} icon={<Plus className="h-4 w-4" />}>
                  Add your first skill
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setCategory('');
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        </Card>
      ) : null}

      {filtered.length > 0 ? (
        <ul className="space-y-3">
          {filtered.map((item) => {
            const source = SOURCE_COPY[item.source] ?? SOURCE_COPY['self_reported']!;
            return (
              <li key={item.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold">{item.skillName}</h3>
                        <Badge color="neutral">{item.category}</Badge>
                        {item.needsReview ? (
                          <Badge color="developing" icon={<source.icon className="h-3.5 w-3.5" />}>
                            {source.label}
                          </Badge>
                        ) : (
                          <Badge
                            color={source.color}
                            icon={<source.icon className="h-3.5 w-3.5" />}
                          >
                            {source.label}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted">{item.levelDescription}</p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDelete({ id: item.id, name: item.skillName })}
                      aria-label={`Remove ${item.skillName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-4">
                    <div
                      className="flex items-center gap-1"
                      role="radiogroup"
                      aria-label={`${item.skillName} level`}
                    >
                      {LEVELS.map((level) => {
                        const isActive = level <= item.level;
                        return (
                          <button
                            key={level}
                            type="button"
                            role="radio"
                            aria-checked={level === item.level}
                            aria-label={`Level ${level}: ${SKILL_LEVEL_DESCRIPTIONS[level]}`}
                            onClick={() => updateLevel.mutate({ id: item.id, level })}
                            className={cn(
                              'h-9 flex-1 rounded-md border text-xs font-medium transition-colors',
                              isActive
                                ? 'border-brand bg-brand text-white'
                                : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-raised))]',
                            )}
                          >
                            {level}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-1.5 flex justify-between text-[10px] text-muted">
                      <span>Never used</span>
                      <span>Can teach others</span>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}

      {addOpen ? <AddSkillDialog onClose={() => setAddOpen(false)} /> : null}

      {pendingDelete ? (
        <ConfirmDialog
          title={`Remove ${pendingDelete.name}?`}
          body="This only removes it from your skill map. It does not change any past roadmap or achievement record."
          confirmLabel="Remove"
          isDanger
          isLoading={remove.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => remove.mutate(pendingDelete.id)}
        />
      ) : null}
    </div>
  );
}

function AddSkillDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<SkillLevel>(2);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const catalog = useQuery({
    queryKey: ['skill-catalog', search],
    queryFn: () => skillsApi.catalog({ search, limit: 24 }),
    enabled: search.trim().length > 0,
  });

  const add = useMutation({
    mutationFn: () => skillsApi.add({ skillId: selected!.id, level }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-skills'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err) => setError(toUserMessage(err, 'Could not add that skill.')),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add a skill"
    >
      <Card className="w-full max-w-lg">
        <CardHeader title="Add a skill" description="Search the library, then rate it honestly." />

        <Field label="Search" htmlFor="add-skill-search">
          <Input
            id="add-skill-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelected(null);
            }}
            placeholder="Start typing a skill name"
            autoFocus
          />
        </Field>

        {catalog.isLoading ? <p className="mt-3 text-sm text-muted">Searching…</p> : null}

        {catalog.data && catalog.data.items.length > 0 ? (
          <ul
            className="mt-3 max-h-56 space-y-1 overflow-y-auto"
            role="listbox"
            aria-label="Search results"
          >
            {catalog.data.items.map((skill) => (
              <li key={skill.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected?.id === skill.id}
                  onClick={() => setSelected({ id: skill.id, name: skill.name })}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm',
                    selected?.id === skill.id
                      ? 'bg-brand-subtle text-brand dark:bg-brand/20'
                      : 'hover:bg-[rgb(var(--surface-raised))]',
                  )}
                >
                  <span>{skill.name}</span>
                  <span className="text-xs text-muted">{skill.category}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {search.trim() && catalog.data && catalog.data.items.length === 0 && !catalog.isLoading ? (
          <p className="mt-3 text-sm text-muted">
            Nothing in the library matches &ldquo;{search}&rdquo;. Every skill in SkillMap comes
            from the curated library, so try a different word.
          </p>
        ) : null}

        {selected ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm">
              Your level for <strong>{selected.name}</strong>
            </p>
            <div className="flex gap-1" role="radiogroup" aria-label="Level">
              {LEVELS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={level === value}
                  onClick={() => setLevel(value)}
                  className={cn(
                    'h-10 flex-1 rounded-md border text-xs font-medium',
                    level === value
                      ? 'border-brand bg-brand text-white'
                      : 'border-[rgb(var(--border))]',
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">{SKILL_LEVEL_DESCRIPTIONS[level]}</p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 text-sm text-critical">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex gap-2">
          <Button
            onClick={() => add.mutate()}
            disabled={!selected}
            isLoading={add.isPending}
            fullWidth
          >
            Add skill
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  isDanger,
  isLoading,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  isDanger?: boolean;
  isLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <Card className="w-full max-w-md">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <div className="mt-6 flex gap-2">
          <Button
            variant={isDanger ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
            fullWidth
          >
            {confirmLabel}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
