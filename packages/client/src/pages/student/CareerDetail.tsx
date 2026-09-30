import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Info, Target } from 'lucide-react';
import { careersApi, profileApi } from '@/lib/endpoints';
import { toUserMessage } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, ErrorState, SkeletonCards } from '@/components/ui/States';
import { formatPercent, GAP_LABEL_COPY } from '@/lib/utils';

export default function CareerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const profile = useQuery({ queryKey: ['profile'], queryFn: () => profileApi.get() });

  const career = useQuery({
    queryKey: ['career', id],
    queryFn: () => careersApi.detail(id!),
    enabled: Boolean(id),
  });

  // Choosing a career has to be possible from the career itself, not only by
  // hunting through the explorer list.
  const setTarget = useMutation({
    mutationFn: () => profileApi.update({ targetCareerId: id! }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['career', id] });
      setMessage('This is now your target career. Your skill map has been recalculated.');
    },
    onError: (err) => setMessage(toUserMessage(err, 'Could not set that as your target.')),
  });

  if (career.isLoading) {
    return (
      <div>
        <PageHeader title="Career" />
        <SkeletonCards count={3} />
      </div>
    );
  }

  if (career.isError || !career.data) {
    return (
      <div>
        <PageHeader title="Career" />
        <ErrorState
          message="We could not load that career."
          onRetry={() => void career.refetch()}
        />
      </div>
    );
  }

  const data = career.data;
  const core = data.skills.filter((s) => s.isCore);
  const optional = data.skills.filter((s) => !s.isCore);

  return (
    <div>
      <Link
        to="/app/careers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All careers
      </Link>

      <PageHeader
        title={data.name}
        description={data.description}
        action={
          <div className="flex flex-wrap items-center gap-4">
            {data.alignmentPercent !== null ? (
              <div className="text-right">
                <p className="text-3xl font-bold text-brand">
                  {formatPercent(data.alignmentPercent)}
                </p>
                <p className="text-xs text-muted">your alignment</p>
              </div>
            ) : null}
            {profile.data?.targetCareerId === data.id ? (
              <span className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-subtle px-4 text-sm font-medium text-brand dark:bg-brand/20">
                <Check className="h-4 w-4" aria-hidden="true" />
                Your target
              </span>
            ) : (
              <Button
                onClick={() => setTarget.mutate()}
                isLoading={setTarget.isPending}
                icon={<Target className="h-4 w-4" />}
              >
                Make this my target
              </Button>
            )}
          </div>
        }
      />

      {message ? (
        <div
          role="status"
          className="mb-6 rounded-lg border border-brand/30 bg-brand-subtle px-4 py-3 text-sm text-brand dark:bg-brand/20"
        >
          {message}{' '}
          <button
            type="button"
            onClick={() => navigate('/app/gap')}
            className="font-medium underline"
          >
            See my skill gap
          </button>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge color="brand">{data.category}</Badge>
        <Badge color="neutral">{data.skills.length} required skills</Badge>
        {data.missingSkillCount > 0 ? (
          <Badge color="developing">{data.missingSkillCount} skills missing</Badge>
        ) : null}
        <Link to="/app/gap">
          <Button size="sm" icon={<Target className="h-4 w-4" />}>
            See my skill gap
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="What the role involves" />
          <ul className="space-y-2">
            {data.responsibilities.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-muted">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Typical projects" />
          <ul className="space-y-3">
            {data.typicalProjects.map((project) => (
              <li key={project.title} className="rounded-lg bg-[rgb(var(--surface-raised))] p-3">
                <p className="text-sm font-medium">{project.title}</p>
                <p className="mt-1 text-sm text-muted">{project.description}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Core skills" description="The ones this role cannot work without." />
          <SkillTable skills={core} />
        </Card>

        {optional.length > 0 ? (
          <Card className="lg:col-span-2">
            <CardHeader
              title="Additional skills"
              description="Useful, but not essential to start."
            />
            <SkillTable skills={optional} />
          </Card>
        ) : null}
      </div>

      <p className="mt-6 flex items-start gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-raised))] p-4 text-xs text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {data.disclaimer} This page deliberately shows no salary figures, because they vary by
        employer, location, and time.
      </p>
    </div>
  );
}

function SkillTable({
  skills,
}: {
  skills: {
    skillId: string;
    skillName: string;
    requiredLevel: number;
    importance: string;
    isCore: boolean;
    prerequisites: { skillId: string; skillName: string }[];
    estimatedEffortHours: number;
    studentLevel: number | null;
    gap: number;
    label: string;
  }[];
}) {
  if (skills.length === 0) return <p className="text-sm text-muted">None listed.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Required skills, your level, and the gap</caption>
        <thead>
          <tr className="border-b border-[rgb(var(--border))] text-left">
            <th scope="col" className="py-2 pr-4 font-medium">
              Skill
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Required
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Yours
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Gap
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Status
            </th>
            <th scope="col" className="py-2 font-medium">
              Effort
            </th>
          </tr>
        </thead>
        <tbody>
          {skills.map((skill) => {
            const copy = GAP_LABEL_COPY[skill.label] ?? GAP_LABEL_COPY['gap']!;
            return (
              <tr
                key={skill.skillId}
                className="border-b border-[rgb(var(--border))] last:border-0"
              >
                <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                  {skill.skillName}
                  {skill.prerequisites.length > 0 ? (
                    <span className="block text-xs text-muted">
                      after {skill.prerequisites.map((p) => p.skillName).join(', ')}
                    </span>
                  ) : null}
                </th>
                <td className="py-2.5 pr-4">{skill.requiredLevel}</td>
                <td className="py-2.5 pr-4">{skill.studentLevel ?? 0}</td>
                <td className="py-2.5 pr-4 font-medium">{skill.gap}</td>
                <td className="py-2.5 pr-4">
                  <Badge
                    color={
                      skill.label === 'strong'
                        ? 'strong'
                        : skill.label === 'critical'
                          ? 'critical'
                          : skill.label === 'gap'
                            ? 'gap'
                            : 'developing'
                    }
                  >
                    {copy.label}
                  </Badge>
                </td>
                <td className="py-2.5 text-muted">{skill.estimatedEffortHours}h</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
