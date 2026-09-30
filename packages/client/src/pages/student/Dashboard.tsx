import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Flame,
  Info,
  RefreshCw,
  Target,
  TrendingUp,
} from 'lucide-react';
import { appApi, profileApi } from '@/lib/endpoints';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Badge, ErrorState, SkeletonCards } from '@/components/ui/States';
import { CategoryRadar, AlignmentTrend, SkillBars } from '@/components/charts';
import { cn, formatHours, formatPercent, streakMessage } from '@/lib/utils';

function KpiCard({
  label,
  value,
  hint,
  tone = 'neutral',
  to,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'strong' | 'critical' | 'brand';
  to?: string;
}) {
  const toneClass = {
    neutral: 'text-[rgb(var(--text))]',
    strong: 'text-strong',
    critical: 'text-critical',
    brand: 'text-brand',
  }[tone];

  const body = (
    <Card className="h-full transition-transform hover:scale-[1.01]">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cn('mt-2 text-3xl font-bold', toneClass)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );

  return to ? <Link to={to}>{body}</Link> : body;
}

export default function Dashboard() {
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: () => appApi.dashboard() });
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => profileApi.get() });

  if (dashboard.isLoading) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <SkeletonCards count={4} />
      </div>
    );
  }

  if (dashboard.isError || !dashboard.data) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <ErrorState
          message="We could not load your dashboard. Your data is safe; this is only a display problem."
          onRetry={() => void dashboard.refetch()}
        />
      </div>
    );
  }

  const data = dashboard.data;
  const targetCareer = data.targetCareer;
  const hasCareer = targetCareer !== null;

  return (
    <div>
      <PageHeader
        title={`Hello, ${data.greetingName.split(' ')[0]}`}
        description={
          hasCareer
            ? `Working towards ${targetCareer.name}.`
            : 'Choose a target career to start mapping your skills.'
        }
        action={
          <Button
            variant="outline"
            onClick={() => void dashboard.refetch()}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        }
      />

      {!hasCareer ? (
        <Card className="mb-6 border-brand/30 bg-brand-subtle dark:bg-brand/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">No target career yet</h2>
              <p className="mt-1 text-sm text-muted">{data.nextBestAction?.description}</p>
              <p className="mt-2 text-xs text-muted">Why: {data.nextBestAction?.why}</p>
            </div>
            <div className="flex gap-2">
              <Link to="/app/quiz">
                <Button>Take the quiz</Button>
              </Link>
              <Link to="/app/careers">
                <Button variant="outline">Browse careers</Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Career alignment"
          value={formatPercent(data.kpis.alignmentPercent)}
          hint="Not a prediction of employment"
          tone="brand"
          to="/app/gap"
        />
        <KpiCard
          label="Skills owned"
          value={`${data.kpis.ownedSkillCount} / ${data.kpis.requiredSkillCount}`}
          hint="Against this career's requirements"
          to="/app/skills"
        />
        <KpiCard
          label="Open gaps"
          value={String(data.kpis.gapCount)}
          hint={
            data.kpis.criticalGapCount > 0
              ? `${data.kpis.criticalGapCount} critical`
              : 'None critical'
          }
          tone={data.kpis.criticalGapCount > 0 ? 'critical' : 'neutral'}
          to="/app/gap"
        />
        <KpiCard
          label="Roadmap progress"
          value={`${data.kpis.roadmapProgressPercent}%`}
          hint={data.kpis.roadmapProgressPercent === 0 ? 'Not started' : 'By estimated hours'}
          tone={data.kpis.roadmapProgressPercent > 0 ? 'strong' : 'neutral'}
          to="/app/roadmap"
        />
      </div>

      {data.roadmapChangeNotice ? (
        <Card className="mt-6 border-brand/30 bg-brand-subtle dark:bg-brand/10">
          <div className="flex items-start gap-3">
            <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Your roadmap changed</p>
              <p className="mt-1 text-sm text-muted">{data.roadmapChangeNotice}</p>
              <Link
                to="/app/roadmap"
                className="mt-2 inline-block text-sm font-medium text-brand hover:underline"
              >
                See what changed
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {data.nextBestAction ? (
          <Card className="lg:col-span-2 border-brand/30">
            <CardHeader
              title="Your next best action"
              description="One thing, chosen from your actual gaps."
              action={
                <Badge color="brand">~{formatHours(data.nextBestAction.estimatedHours)}</Badge>
              }
            />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-semibold">{data.nextBestAction.title}</h3>
                <p className="mt-2 text-sm text-muted">{data.nextBestAction.description}</p>
                <details className="mt-3 group">
                  <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-brand">
                    <Info className="h-4 w-4" aria-hidden="true" />
                    Why this one?
                  </summary>
                  <p className="mt-2 rounded-lg bg-[rgb(var(--surface-raised))] p-3 text-sm text-muted">
                    {data.nextBestAction.why}
                  </p>
                </details>
              </div>
              <div className="flex gap-2">
                {data.nextBestAction.roadmapItemId ? (
                  <Link to="/app/roadmap">
                    <Button icon={<ArrowRight className="h-4 w-4" />}>Start</Button>
                  </Link>
                ) : (
                  <Link to="/app/gap">
                    <Button icon={<Target className="h-4 w-4" />}>See my gap</Button>
                  </Link>
                )}
              </div>
            </div>
          </Card>
        ) : null}

        {data.weeklyGoal.minutesTarget > 0 ? (
          <Card>
            <CardHeader
              title="This week"
              description={`${data.weeklyGoal.minutesTarget / 60} hours set as your goal`}
            />
            <div className="flex items-center gap-6">
              <GoalRing percent={data.weeklyGoal.percent} />
              <div className="min-w-0">
                <p className="text-sm text-muted">
                  <strong className="text-[rgb(var(--text))]">
                    {Math.round(data.weeklyGoal.minutesLogged / 60)}h logged
                  </strong>{' '}
                  of {data.weeklyGoal.minutesTarget / 60}h
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-sm">
                  <Flame className="h-4 w-4 text-developing" aria-hidden="true" />
                  {streakMessage(data.weeklyGoal.streakDays)}
                </p>
              </div>
            </div>
          </Card>
        ) : null}

        {data.roadmapMiniTimeline.length > 0 ? (
          <Card>
            <CardHeader
              title="Roadmap"
              description="Progress by month."
              action={
                <Link to="/app/roadmap" className="text-sm font-medium text-brand hover:underline">
                  Open
                </Link>
              }
            />
            <ol className="space-y-2.5">
              {data.roadmapMiniTimeline.map((month) => {
                const percent =
                  month.itemsTotal === 0
                    ? 0
                    : Math.round((month.itemsDone / month.itemsTotal) * 100);
                return (
                  <li key={month.month} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs font-medium text-muted">
                      Month {month.month}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgb(var(--border))]">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${percent}%` }}
                        role="progressbar"
                        aria-valuenow={percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Month ${month.month}: ${month.itemsDone} of ${month.itemsTotal} items done`}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-xs text-muted">
                      {month.itemsDone}/{month.itemsTotal}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>
        ) : null}

        {data.skillBars.length > 0 ? <SkillBars data={data.skillBars} /> : null}
        {data.categoryAverages.length > 0 ? <CategoryRadar data={data.categoryAverages} /> : null}
        {data.alignmentTrend.length > 1 ? <AlignmentTrend data={data.alignmentTrend} /> : null}

        <Card>
          <CardHeader
            title="Recent activity"
            description="What you have actually done."
            action={
              <Link to="/app/progress" className="text-sm font-medium text-brand hover:underline">
                All
              </Link>
            }
          />
          {data.recentActivity.length === 0 ? (
            <EmptyState
              title="Nothing logged yet"
              body="Complete a roadmap item or log a study session and it will show up here."
              icon={<TrendingUp className="h-8 w-8" />}
            />
          ) : (
            <ul className="space-y-3">
              {data.recentActivity.map((event, i) => (
                <li key={`${event.at}-${i}`} className="flex items-start gap-3 text-sm">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-strong"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">{event.text}</span>
                  <time className="shrink-0 text-xs text-muted" dateTime={event.at}>
                    {new Date(event.at).toLocaleDateString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {data.achievements.length > 0 ? (
          <Card className="lg:col-span-2">
            <CardHeader
              title="Achievements"
              description="Earned from what you actually recorded."
              action={
                <Link to="/app/progress" className="text-sm font-medium text-brand hover:underline">
                  All badges
                </Link>
              }
            />
            <div className="flex flex-wrap gap-2">
              {data.achievements.map((achievement) => (
                <Badge
                  key={achievement.id}
                  color={achievement.earnedAt ? 'strong' : 'neutral'}
                  icon={<Award className="h-3.5 w-3.5" />}
                >
                  {achievement.name}
                  {achievement.earnedAt ? '' : ' · locked'}
                </Badge>
              ))}
            </div>
          </Card>
        ) : null}
      </div>

      <p className="mt-8 flex items-start gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-raised))] p-4 text-xs text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {data.disclaimer}
      </p>

      {profile.data && !profile.data.onboarding.finished ? (
        <Card className="mt-6 border-brand/30">
          <p className="text-sm font-medium">Your profile is not finished</p>
          <p className="mt-1 text-sm text-muted">
            Finishing onboarding gives you a more accurate map. Every step can be skipped.
          </p>
          <Link to="/app/onboarding" className="mt-3 inline-block">
            <Button size="sm" variant="outline">
              Continue onboarding
            </Button>
          </Link>
        </Card>
      ) : null}
    </div>
  );
}

function GoalRing({ percent }: { percent: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div className="relative shrink-0">
      <svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        role="img"
        aria-label={`Weekly goal ${clamped} percent complete`}
      >
        <circle cx="40" cy="40" r={radius} fill="none" stroke="rgb(209 213 219)" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          className="text-brand"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          transform="rotate(-90 40 40)"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
        {clamped}%
      </span>
    </div>
  );
}
