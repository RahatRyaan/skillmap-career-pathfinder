import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BarChart3, Compass, Map, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { appApi } from '@/lib/endpoints';
import { Button } from '@/components/ui/Button';

const PIPELINE = [
  { label: 'Current skills', icon: BarChart3 },
  { label: 'Target career', icon: Compass },
  { label: 'Skill gap', icon: Target },
  { label: 'Personalised roadmap', icon: Map },
  { label: 'Progress tracking', icon: Sparkles },
];

export default function Landing() {
  const { t } = useTranslation();
  const { data: aiMode } = useQuery({
    queryKey: ['ai-mode'],
    queryFn: appApi.aiMode,
    staleTime: 300_000,
  });

  return (
    <main className="min-h-screen">
      <header className="border-b border-[rgb(var(--border))]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Map className="h-6 w-6 text-brand" aria-hidden="true" />
            <span className="font-bold">{t('app.name')}</span>
          </div>
          <nav className="flex items-center gap-2" aria-label="Account">
            <Link to="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link to="/register">
              <Button>Get started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16 text-center lg:py-24">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight lg:text-5xl">
          {t('app.tagline')}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          SkillMap AI shows you the distance between the skills you have and the skills a career
          actually requires, then builds a learning roadmap that adapts as you progress.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/register">
            <Button size="lg" icon={<ArrowRight className="h-4 w-4" />}>
              Build your skill map
            </Button>
          </Link>
          <Link to="/ai-info">
            <Button size="lg" variant="outline">
              What is AI here?
            </Button>
          </Link>
        </div>

        <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] px-4 py-2 text-xs">
          <ShieldCheck className="h-4 w-4 text-strong" aria-hidden="true" />
          {aiMode
            ? aiMode.mode === 'openai'
              ? `Real AI mode is active. Calls are logged and results are cached.`
              : `Demo Mode is active. Results are produced by transparent rules, not by a trained model.`
            : 'Checking which AI mode is active…'}
        </p>
      </section>

      <section className="border-y border-[rgb(var(--border))] bg-[rgb(var(--surface-raised))] py-12">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold">How it works</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                step: '1',
                title: 'Map what you have',
                body: 'Add skills you already have, or upload a CV and review what was found before anything is saved.',
              },
              {
                step: '2',
                title: 'See the honest gap',
                body: 'Every score is a visible calculation. You see the numbers behind it, not a black box.',
              },
              {
                step: '3',
                title: 'Follow a plan that adapts',
                body: 'The roadmap is paced to your available study hours and re-plans when you make progress.',
              },
            ].map((item) => (
              <li key={item.step} className="card">
                <span className="text-sm font-bold text-brand">{item.step}</span>
                <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold">The pipeline</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted">
          Each step does one job. Some steps are algorithms you can inspect; some use AI. The
          product tells you which is which.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {PIPELINE.map((stage, index) => (
            <div key={stage.label} className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3 text-sm font-medium">
                <stage.icon className="h-4 w-4 text-brand" aria-hidden="true" />
                {stage.label}
              </div>
              {index < PIPELINE.length - 1 ? (
                <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[rgb(var(--border))] py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold">What this product will not do</h2>
          <ul className="mx-auto mt-6 max-w-xl space-y-3 text-left">
            {[
              'We do not quote salaries, because they vary by employer, location, and time.',
              'We do not claim a job is guaranteed, and we do not give a probability of being hired.',
              'We do not invent statistics, resources, or URLs.',
              'We do not infer your age, gender, religion, or any other protected attribute.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-strong" aria-hidden="true" />
                <span className="text-sm text-muted">{item}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/ai-info"
            className="mt-6 inline-block text-sm font-medium text-brand hover:underline"
          >
            Read the full AI and privacy notices
          </Link>
        </div>
      </section>

      <footer className="border-t border-[rgb(var(--border))] py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-muted">
          <span>SkillMap AI — built for students in Bangladesh.</span>
          <nav className="flex gap-4" aria-label="Legal">
            <Link to="/privacy" className="hover:underline">
              Privacy
            </Link>
            <Link to="/ai-info" className="hover:underline">
              AI Info
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
