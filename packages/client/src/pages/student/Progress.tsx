import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Flame, Lock, Plus, TrendingUp } from 'lucide-react';
import { appApi, roadmapApi } from '@/lib/endpoints';
import { toUserMessage } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Badge, ErrorState, SkeletonCards } from '@/components/ui/States';
import { Field, Input, Select } from '@/components/ui/Form';
import { AlignmentTrend } from '@/components/charts';
import { formatRelative, streakMessage } from '@/lib/utils';

const MINUTES = [15, 30, 45, 60, 90, 120, 180];

export default function Progress() {
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState(30);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const achievements = useQuery({
    queryKey: ['achievements'],
    queryFn: () => appApi.achievements(),
  });
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: async () => appApi.dashboard() });
  const trends = useQuery({ queryKey: ['trends'], queryFn: () => analysisTrends() });

  const log = useMutation({
    mutationFn: () => roadmapApi.logSession({ minutes, note: note || undefined }),
    onSuccess: (result) => {
      const earned = result.newAchievements as { name: string }[];
      setMessage(
        `Logged ${minutes} minutes.${earned.length > 0 ? ` You earned: ${earned.map((a) => a.name).join(', ')}.` : ''}`,
      );
      setNote('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['achievements'] });
    },
    onError: (err) => {
      setError(toUserMessage(err, 'Could not log that session.'));
      setMessage(null);
    },
  });

  const data = dashboard.data;

  return (
    <div>
      <PageHeader
        title="Progress"
        description="What you have actually done, and what it has earned you."
      />

      {message ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-strong/30 bg-strong/5 px-4 py-3 text-sm text-strong"
        >
          {message}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-critical/30 bg-critical/5 px-4 py-3 text-sm text-critical"
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Log a study session"
            description="Any amount counts. Fifteen minutes counts."
          />
          <div className="space-y-4">
            <Field label="How long did you study?" htmlFor="p-minutes">
              <Select
                id="p-minutes"
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              >
                {MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Note" htmlFor="p-note" hint="Optional.">
              <Input
                id="p-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Finished the SQL joins chapter"
              />
            </Field>
            <Button
              onClick={() => log.mutate()}
              isLoading={log.isPending}
              fullWidth
              icon={<Plus className="h-4 w-4" />}
            >
              Log session
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="This week" />
          {data ? (
            <>
              <p className="text-3xl font-bold text-brand">
                {Math.round(data.weeklyGoal.minutesLogged / 60)}h
                <span className="text-lg text-muted">
                  {' '}
                  / {Math.round(data.weeklyGoal.minutesTarget / 60)}h
                </span>
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgb(var(--border))]">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${data.weeklyGoal.percent}%` }}
                />
              </div>
              <p className="mt-3 flex items-center gap-2 text-sm">
                <Flame className="h-4 w-4 text-developing" aria-hidden="true" />
                {streakMessage(data.weeklyGoal.streakDays)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">Loading…</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Alignment trend" description="Each point is a real snapshot." />
          {trends.data && trends.data.length > 1 ? (
            <AlignmentTrend data={trends.data} />
          ) : (
            <EmptyState
              icon={<TrendingUp className="h-8 w-8" />}
              title="Not enough history yet"
              body="Your trend appears once you have changed your skills or generated a roadmap a few times."
            />
          )}
        </Card>
      </div>

      {data && data.recentActivity.length > 0 ? (
        <Card className="mt-6">
          <CardHeader title="Recent activity" description="Everything recorded, newest first." />
          <ul className="space-y-3">
            {data.recentActivity.map((event, i) => (
              <li
                key={`${event.at}-${i}`}
                className="flex items-start justify-between gap-4 text-sm"
              >
                <span>{event.text}</span>
                <time className="shrink-0 text-xs text-muted" dateTime={event.at}>
                  {formatRelative(event.at)}
                </time>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardHeader
          title="Achievements"
          description="Awarded from real counts. Nothing is granted by the interface."
        />
        {achievements.isLoading ? <SkeletonCards count={2} /> : null}
        {achievements.isError ? (
          <ErrorState
            message="We could not load achievements."
            onRetry={() => void achievements.refetch()}
          />
        ) : null}
        {achievements.data ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.data.items.map((achievement) => (
              <li key={achievement.id}>
                <div
                  className={`flex h-full items-start gap-3 rounded-lg border p-3 ${
                    achievement.earnedAt
                      ? 'border-strong/40 bg-strong/5'
                      : 'border-[rgb(var(--border))]'
                  }`}
                >
                  {achievement.earnedAt ? (
                    <Award className="mt-0.5 h-5 w-5 shrink-0 text-strong" aria-hidden="true" />
                  ) : (
                    <Lock className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{achievement.name}</p>
                    <p className="mt-0.5 text-xs text-muted">{achievement.description}</p>
                    {achievement.earnedAt ? (
                      <Badge color="strong" className="mt-2">
                        Earned {formatRelative(achievement.earnedAt)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}

async function analysisTrends() {
  const { analysisApi } = await import('@/lib/endpoints');
  const result = await analysisApi.trends();
  return result.points;
}
