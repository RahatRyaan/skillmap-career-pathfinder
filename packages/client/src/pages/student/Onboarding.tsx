import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Plus } from 'lucide-react';
import { profileApi, skillsApi } from '@/lib/endpoints';
import { toUserMessage } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Form';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'profile', label: 'Profile' },
  { key: 'skills', label: 'Skills' },
  { key: 'cv', label: 'CV' },
  { key: 'career', label: 'Career' },
  { key: 'done', label: 'Done' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

export default function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => profileApi.get() });

  const [step, setStep] = useState<StepKey>('profile');
  const [completed, setCompleted] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Resume where the student left off rather than restarting.
  useEffect(() => {
    if (!profile.data) return;
    const saved = profile.data.onboarding.currentStep as StepKey;
    if (STEPS.some((s) => s.key === saved)) setStep(saved);
    setCompleted(profile.data.onboarding.completedSteps);
  }, [profile.data]);

  const persist = useMutation({
    mutationFn: (next: { currentStep: StepKey; completedSteps: string[] }) =>
      profileApi.updateOnboarding(next),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['profile'] }),
    onError: (err) => setError(toUserMessage(err, 'Could not save your progress.')),
  });

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const advance = (next: StepKey) => {
    const nextCompleted = completed.includes(step) ? completed : [...completed, step];
    setCompleted(nextCompleted);
    setStep(next);
    persist.mutate({ currentStep: next, completedSteps: nextCompleted });
  };

  const skip = () => {
    const next = STEPS[Math.min(stepIndex + 1, STEPS.length - 1)];
    if (next) advance(next.key);
  };

  if (profile.isLoading) {
    return (
      <div>
        <PageHeader title="Getting started" />
        <Card className="h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Getting started"
        description="Four short steps. Skip anything you do not want to do now; you can come back."
      />

      <ol className="mb-8 flex items-center gap-2" aria-label="Onboarding progress">
        {STEPS.map((s, i) => {
          const isCurrent = s.key === step;
          const isDone = completed.includes(s.key) || i < stepIndex;
          return (
            <li key={s.key} className="flex flex-1 items-center gap-2">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                    isDone
                      ? 'bg-strong text-white'
                      : isCurrent
                        ? 'bg-brand text-white'
                        : 'bg-[rgb(var(--border))] text-muted',
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isDone ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span
                  className={cn(
                    'text-[10px]',
                    isCurrent ? 'font-semibold text-brand' : 'text-muted',
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 ? (
                <div className="mb-5 h-0.5 flex-1 bg-[rgb(var(--border))]" />
              ) : null}
            </li>
          );
        })}
      </ol>

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-critical/30 bg-critical/5 px-4 py-3 text-sm text-critical"
        >
          {error}
        </div>
      ) : null}

      <Card>
        {step === 'profile' && profile.data ? (
          <ProfileStep onDone={() => advance('skills')} />
        ) : null}
        {step === 'skills' ? <SkillsStep onDone={() => advance('cv')} /> : null}
        {step === 'cv' ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Upload a CV?</h2>
            <p className="text-sm text-muted">
              We can read a PDF or DOCX and suggest the skills it mentions. You review every
              suggestion before anything is saved to your profile, and you can do it later instead.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate('/app/cv')}>Go to CV upload</Button>
              <Button variant="outline" onClick={() => advance('career')}>
                I will do this later
              </Button>
            </div>
          </div>
        ) : null}
        {step === 'career' ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Pick a target career</h2>
            <p className="text-sm text-muted">
              Everything else depends on this. If you are not sure, the quiz takes about two minutes
              and suggests three careers with reasons.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate('/app/quiz')}>Take the quiz</Button>
              <Button variant="outline" onClick={() => navigate('/app/careers')}>
                Browse all careers
              </Button>
            </div>
          </div>
        ) : null}
        {step === 'done' ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">You are set up</h2>
            <p className="text-sm text-muted">
              Your dashboard will show your alignment as soon as you have a target career and a few
              skills. Everything stays skippable from the profile page.
            </p>
            <Button onClick={() => navigate('/app')} icon={<ChevronRight className="h-4 w-4" />}>
              Go to dashboard
            </Button>
          </div>
        ) : null}

        {step !== 'done' ? (
          <div className="mt-6 flex items-center justify-between border-t border-[rgb(var(--border))] pt-4">
            <Button variant="ghost" onClick={skip}>
              Skip for now
            </Button>
            {stepIndex > 0 ? (
              <Button
                variant="outline"
                onClick={() => {
                  const prev = STEPS[stepIndex - 1];
                  if (prev) setStep(prev.key);
                }}
              >
                Back
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function ProfileStep({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => profileApi.get() });
  const [form, setForm] = useState({ university: '', department: '', academicYear: '' });
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (profile.data && !initialised) {
      setForm({
        university: profile.data.university,
        department: profile.data.department,
        academicYear: profile.data.academicYear,
      });
      setInitialised(true);
    }
  }, [profile.data, initialised]);

  const save = useMutation({
    mutationFn: () => profileApi.update(form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      onDone();
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Confirm your study details</h2>
      <p className="text-sm text-muted">
        You entered these at sign-up. Change anything that is wrong.
      </p>
      <Field label="University or college" htmlFor="ob-university">
        <Input
          id="ob-university"
          value={form.university}
          onChange={(e) => setForm((p) => ({ ...p, university: e.target.value }))}
        />
      </Field>
      <Field label="Department" htmlFor="ob-department">
        <Input
          id="ob-department"
          value={form.department}
          onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
        />
      </Field>
      <Field label="Academic year" htmlFor="ob-year">
        <Input
          id="ob-year"
          value={form.academicYear}
          onChange={(e) => setForm((p) => ({ ...p, academicYear: e.target.value }))}
        />
      </Field>
      <Button onClick={() => save.mutate()} isLoading={save.isPending} fullWidth>
        Save and continue
      </Button>
    </div>
  );
}

function SkillsStep({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const mine = useQuery({ queryKey: ['user-skills'], queryFn: () => skillsApi.mine() });
  const catalog = useQuery({
    queryKey: ['skill-catalog', ''],
    queryFn: () => skillsApi.catalog({ limit: 60 }),
  });
  const [search, setSearch] = useState('');

  const add = useMutation({
    mutationFn: (skillId: string) => skillsApi.add({ skillId, level: 2 }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['user-skills'] }),
  });

  const owned = useMemo(() => new Set((mine.data?.items ?? []).map((i) => i.skillId)), [mine.data]);
  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (catalog.data?.items ?? [])
      .filter((s) => !owned.has(s.id))
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [catalog.data, owned, search]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Add a few skills you already have</h2>
      <p className="text-sm text-muted">
        Even skills you have only tried once count. You can fine-tune the levels later.
      </p>

      {mine.data && mine.data.items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {mine.data.items.map((item) => (
            <span
              key={item.id}
              className="rounded-full bg-[rgb(var(--surface-raised))] px-3 py-1.5 text-sm"
            >
              {item.skillName} · {item.level}
            </span>
          ))}
        </div>
      ) : null}

      <Field label="Search the library" htmlFor="ob-skill-search">
        <Input
          id="ob-skill-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Excel, Python, SQL…"
        />
      </Field>

      <ul className="space-y-1">
        {available.map((skill) => (
          <li key={skill.id}>
            <button
              type="button"
              onClick={() => add.mutate(skill.id)}
              className="flex w-full items-center justify-between rounded-lg border border-[rgb(var(--border))] px-3 py-2.5 text-left text-sm hover:bg-[rgb(var(--surface-raised))]"
            >
              <span>
                {skill.name} <span className="text-xs text-muted">· {skill.category}</span>
              </span>
              <Plus className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <Button onClick={onDone} fullWidth>
        Continue
      </Button>
    </div>
  );
}

export { Select };
