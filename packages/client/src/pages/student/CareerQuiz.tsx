import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Sparkles } from 'lucide-react';
import { appApi, profileApi } from '@/lib/endpoints';
import { toUserMessage } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { ErrorState, SkeletonCards } from '@/components/ui/States';
import { cn, formatPercent } from '@/lib/utils';

export default function CareerQuiz() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const questions = useQuery({
    queryKey: ['quiz-questions'],
    queryFn: () => appApi.quizQuestions(),
  });

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      appApi.submitQuiz(
        Object.entries(answers).map(([questionId, optionIndex]) => ({ questionId, optionIndex })),
      ),
    onSuccess: (result) => {
      setIndex(-1);
      void result;
    },
    onError: (err) => setError(toUserMessage(err, 'Could not score the quiz.')),
  });

  const choose = useMutation({
    mutationFn: (careerId: string) => profileApi.update({ targetCareerId: careerId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate('/app/gap');
    },
    onError: (err) => setError(toUserMessage(err, 'Could not set that career.')),
  });

  if (questions.isLoading) {
    return (
      <div>
        <PageHeader title="Career quiz" />
        <SkeletonCards count={2} />
      </div>
    );
  }

  if (questions.isError) {
    return (
      <div>
        <PageHeader title="Career quiz" />
        <ErrorState
          message="We could not load the quiz questions."
          onRetry={() => void questions.refetch()}
        />
      </div>
    );
  }

  const list = questions.data ?? [];
  const suggestions = submit.data?.suggestions ?? [];
  const current = list[index];

  if (submit.isSuccess) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Three careers worth a look" description="Based on your answers." />
        {suggestions.length === 0 ? (
          <Card>
            <EmptyState
              title="No clear suggestions"
              body="Your answers were spread across many careers. Browse the full list and pick the one that interests you most."
              action={<Button onClick={() => navigate('/app/careers')}>Browse careers</Button>}
            />
          </Card>
        ) : (
          <ul className="space-y-4">
            {suggestions.map((suggestion) => (
              <li key={suggestion.careerId}>
                <Card className="border-brand/30">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold">{suggestion.careerName}</h2>
                      <p className="mt-2 text-sm text-muted">{suggestion.explanation}</p>
                    </div>
                    {suggestion.matchPercent > 0 ? (
                      <div className="text-right">
                        <p className="text-2xl font-bold text-brand">
                          {formatPercent(suggestion.matchPercent)}
                        </p>
                        <p className="text-xs text-muted">quiz match</p>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      onClick={() => choose.mutate(suggestion.careerId)}
                      isLoading={choose.isPending && choose.variables === suggestion.careerId}
                      icon={<ArrowRight className="h-4 w-4" />}
                    >
                      Choose this career
                    </Button>
                    <LinkButton to={`/app/careers/${suggestion.careerId}`}>
                      See requirements
                    </LinkButton>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Career quiz" />
        <Card>
          <EmptyState title="No questions available" body="The quiz has not been set up yet." />
        </Card>
      </div>
    );
  }

  const selected = answers[current.id];
  const isLast = index === list.length - 1;
  const allAnswered = Object.keys(answers).length === list.length;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Career quiz"
        description="About two minutes. There are no wrong answers."
      />

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-critical/30 bg-critical/5 px-4 py-3 text-sm text-critical"
        >
          {error}
        </div>
      ) : null}

      <div className="mb-4 flex items-center justify-between text-sm text-muted">
        <span>
          Question {index + 1} of {list.length}
        </span>
        <span>{Object.keys(answers).length} answered</span>
      </div>
      <div
        className="mb-6 h-2 overflow-hidden rounded-full bg-[rgb(var(--border))]"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={list.length}
        aria-label={`Question ${index + 1} of ${list.length}`}
      >
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${((index + 1) / list.length) * 100}%` }}
        />
      </div>

      <Card>
        <fieldset>
          <legend className="text-lg font-semibold">{current.prompt}</legend>
          <div className="mt-4 space-y-2">
            {current.options.map((option, optionIndex) => {
              const isSelected = selected === optionIndex;
              return (
                <label
                  key={optionIndex}
                  className={cn(
                    'flex min-h-12 cursor-pointer items-center rounded-lg border px-4 py-3 text-sm transition-colors',
                    isSelected
                      ? 'border-brand bg-brand-subtle font-medium dark:bg-brand/20'
                      : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-raised))]',
                  )}
                >
                  <input
                    type="radio"
                    name={current.id}
                    value={optionIndex}
                    checked={isSelected}
                    onChange={() => setAnswers((prev) => ({ ...prev, [current.id]: optionIndex }))}
                    className="mr-3 h-4 w-4 accent-brand"
                  />
                  {option.text}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-6 flex items-center justify-between border-t border-[rgb(var(--border))] pt-4">
          <Button variant="ghost" onClick={() => navigate('/app/careers')} disabled={index === 0}>
            Back
          </Button>
          {isLast ? (
            <Button
              onClick={() => submit.mutate()}
              isLoading={submit.isPending}
              disabled={!allAnswered}
              icon={<Sparkles className="h-4 w-4" />}
            >
              See my suggestions
            </Button>
          ) : (
            <Button onClick={() => setIndex((i) => i + 1)} disabled={selected === undefined}>
              Next
            </Button>
          )}
        </div>
        {!allAnswered && isLast ? (
          <p className="mt-3 text-xs text-muted">Answer every question to see suggestions.</p>
        ) : null}
      </Card>
    </div>
  );
}

function LinkButton({ to, children }: { to: string; children: React.ReactNode }) {
  // A plain anchor avoids pulling the router into this small component while
  // still doing a client-side navigation on reload.
  return (
    <a
      href={to}
      className="inline-flex h-11 items-center rounded-lg border border-[rgb(var(--border))] px-4 text-sm font-medium hover:bg-[rgb(var(--surface-raised))]"
    >
      {children}
    </a>
  );
}

export { CardHeader };
