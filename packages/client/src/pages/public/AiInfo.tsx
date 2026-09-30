import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Brain, Calculator, Map, Zap } from 'lucide-react';
import { appApi } from '@/lib/endpoints';
import { Badge } from '@/components/ui/States';
import { LoadingState } from '@/components/ui/States';

const MODES = [
  {
    key: 'demo',
    name: 'Demo Mode',
    body: 'Deterministic rules and templates. No model is called, nothing leaves your machine, and the same input always produces the same output. This is the default and the mode a public demo should run in.',
  },
  {
    key: 'local',
    name: 'Local Mode',
    body: 'A small sentence-embedding model runs on the machine you are using, for skill similarity. No API key and no per-request cost. Freeform assistant answers still use templates.',
  },
  {
    key: 'openai',
    name: 'Real AI Mode',
    body: 'An external language model handles CV extraction, job-description analysis, and assistant wording. Every call is logged with its mode and estimated cost, and results are cached by input hash.',
  },
];

const USES_AI = [
  [
    'Extracting skills from a CV',
    'Reading a document and listing the skills, projects, and certifications it mentions.',
  ],
  [
    'Normalising skill names',
    'Mapping "MS Excel" to Excel, or "Postgres" to PostgreSQL, so they do not become two separate skills.',
  ],
  [
    'Judging skill similarity',
    'Deciding whether two differently-named skills are related enough to give partial credit.',
  ],
  [
    'Analysing a job description',
    'Listing the skills a posting asks for, so you can compare them with yours.',
  ],
  [
    'Wording the assistant answers',
    'Choosing how to phrase an explanation. The numbers it reports come from the engine, not the model.',
  ],
];

const IS_ALGORITHM = [
  ['The gap for each skill', 'max(0, required level − your level). A subtraction.'],
  [
    'Career alignment percentage',
    'A weighted average of how much of each required skill you have, where high-importance skills count more.',
  ],
  [
    'The gap label',
    'Strong, Developing, Gap, or Critical — decided by the gap size and the skill importance.',
  ],
  [
    'The order you learn things in',
    'Five weighted factors, then a hard rule that prerequisites always come first.',
  ],
  ['Roadmap pacing', 'Your weekly study hours decide how much fits in a month.'],
];

export default function AiInfo() {
  const {
    data: mode,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['ai-mode'],
    queryFn: appApi.aiMode,
    staleTime: 300_000,
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline"
      >
        <Map className="h-4 w-4" aria-hidden="true" />
        Back to SkillMap AI
      </Link>

      <h1 className="mt-8 text-3xl font-bold">What is AI, and what is not</h1>
      <p className="mt-3 text-lg text-muted">
        This page exists because &ldquo;AI-powered&rdquo; is used to mean very different things.
        Here is exactly what this product does.
      </p>

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-raised))] p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-developing" aria-hidden="true" />
        <p className="text-sm">
          <strong>No model was trained for this project.</strong> Nothing here was fine-tuned, and
          no custom machine learning model was built. Where a model is used, it is a general purpose
          language model or embedding model, used off the shelf.
        </p>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Which mode is active right now</h2>
        {isLoading ? <LoadingState label="Checking" /> : null}
        {isError ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-critical/30 bg-critical/5 p-4 text-sm text-critical"
          >
            Could not reach the server to confirm the mode.{' '}
            <button type="button" onClick={() => void refetch()} className="font-medium underline">
              Try again
            </button>
          </div>
        ) : null}
        {mode ? (
          <div className="mt-4 card">
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                color={mode.mode === 'openai' ? 'brand' : 'developing'}
                icon={<Zap className="h-3.5 w-3.5" />}
              >
                {mode.mode === 'openai'
                  ? 'Real AI mode'
                  : mode.mode === 'local'
                    ? 'Local mode'
                    : 'Demo mode'}
              </Badge>
              {mode.available ? null : <Badge color="critical">Provider unreachable</Badge>}
            </div>
            <p className="mt-3 text-sm text-muted">{mode.description}</p>
            {mode.notice ? (
              <p className="mt-3 rounded-lg bg-developing/10 px-3 py-2 text-xs text-developing">
                {mode.notice}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">The three modes</h2>
        <div className="mt-4 space-y-3">
          {MODES.map((m) => (
            <div key={m.key} className={`card ${mode?.mode === m.key ? 'border-brand' : ''}`}>
              <h3 className="font-semibold">{m.name}</h3>
              <p className="mt-2 text-sm text-muted">{m.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Brain className="h-5 w-5 text-brand" aria-hidden="true" />
          Where AI is used
        </h2>
        <p className="mt-2 text-sm text-muted">
          These are the only parts of the product where a model does the work. Each one either reads
          text or decides whether two names mean the same thing.
        </p>
        <dl className="mt-4 space-y-3">
          {USES_AI.map(([feature, what]) => (
            <div key={feature} className="card-raised">
              <dt className="text-sm font-semibold">{feature}</dt>
              <dd className="mt-1 text-sm text-muted">{what}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Calculator className="h-5 w-5 text-strong" aria-hidden="true" />
          Where it is plain arithmetic
        </h2>
        <p className="mt-2 text-sm text-muted">
          Every number that describes your position comes from these formulas. They are not
          generated, not estimated, and not influenced by a model. You can check them by hand.
        </p>
        <dl className="mt-4 space-y-3">
          {IS_ALGORITHM.map(([feature, how]) => (
            <div key={feature} className="card-raised">
              <dt className="text-sm font-semibold">{feature}</dt>
              <dd className="mt-1 text-sm text-muted">{how}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Why we bother explaining</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          A score that cannot be explained is not useful to a student deciding what to learn next.
          So every score in this product comes with a &ldquo;Why?&rdquo; button, and every priority
          comes with the factors that produced it. If a model suggested something, the interface
          says so, and anything a model extracted from your CV can be corrected or rejected before
          it touches your profile.
        </p>
      </section>

      <p className="mt-10 text-sm text-muted">
        See also the{' '}
        <Link to="/privacy" className="font-medium text-brand hover:underline">
          privacy notice
        </Link>
        .
      </p>
    </main>
  );
}
