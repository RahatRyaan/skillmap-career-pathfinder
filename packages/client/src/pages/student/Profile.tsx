import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Save, Target, Trash2 } from 'lucide-react';
import { authApi, profileApi } from '@/lib/endpoints';
import { tokenStore, toUserMessage } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState, SkeletonCards } from '@/components/ui/States';
import { Field, Input, Select, Textarea } from '@/components/ui/Form';
import { ConfirmDialog } from './MySkills';

export default function Profile() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => profileApi.get() });

  const [form, setForm] = useState({
    name: '',
    university: '',
    department: '',
    academicYear: '',
    educationLevel: 'undergraduate',
    graduationYear: '',
    interests: '',
    bio: '',
  });
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => {
    if (profile.data && !ready) {
      setForm({
        name: profile.data.name,
        university: profile.data.university,
        department: profile.data.department,
        academicYear: profile.data.academicYear,
        educationLevel: profile.data.educationLevel,
        graduationYear: profile.data.graduationYear?.toString() ?? '',
        interests: profile.data.interests.join(', '),
        bio: profile.data.bio ?? '',
      });
      setReady(true);
    }
  }, [profile.data, ready]);

  const save = useMutation({
    mutationFn: () =>
      profileApi.update({
        name: form.name.trim(),
        university: form.university.trim(),
        department: form.department.trim(),
        academicYear: form.academicYear.trim(),
        educationLevel: form.educationLevel as
          'undergraduate' | 'graduation_completed' | 'postgraduate',
        ...(form.graduationYear ? { graduationYear: Number(form.graduationYear) } : {}),
        interests: form.interests
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        ...(form.bio ? { bio: form.bio } : {}),
      }),
    onSuccess: () => {
      setMessage('Saved.');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      setError(toUserMessage(err, 'Could not save your profile.'));
      setMessage(null);
    },
  });

  const removeAccount = useMutation({
    mutationFn: () => authApi.deleteAccount(),
    onSuccess: () => {
      tokenStore.clear();
      navigate('/');
    },
    onError: (err) => setError(toUserMessage(err, 'Could not delete your account.')),
  });

  if (profile.isLoading) {
    return (
      <div>
        <PageHeader title="Profile" />
        <SkeletonCards count={2} />
      </div>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <div>
        <PageHeader title="Profile" />
        <ErrorState
          message="We could not load your profile."
          onRetry={() => void profile.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Profile" description="Your details and your target career." />

      <Card>
        <CardHeader
          title="Target career"
          description="Every score on your dashboard is measured against this."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/app/careers')}
              icon={<Target className="h-4 w-4" />}
            >
              {profile.data.targetCareerName ? 'Change' : 'Choose'}
            </Button>
          }
        />
        {profile.data.targetCareerName ? (
          <div className="flex items-center justify-between rounded-lg bg-brand-subtle px-4 py-3 dark:bg-brand/20">
            <span className="font-semibold text-brand">{profile.data.targetCareerName}</span>
            <a href={`/app/gap`} className="text-sm font-medium text-brand hover:underline">
              See my gap
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted">
            No target career yet. Choose one and SkillMap can map your skills against it.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title="Your details" />
        {message ? <p className="mb-3 text-sm text-strong">{message}</p> : null}
        {error ? (
          <p role="alert" className="mb-3 text-sm text-critical">
            {error}
          </p>
        ) : null}

        <div className="space-y-4">
          <Field label="Full name" htmlFor="p-name">
            <Input
              id="p-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </Field>
          <Field
            label="Email"
            htmlFor="p-email"
            hint="Your sign-in address cannot be changed here."
          >
            <Input id="p-email" value={profile.data.email} disabled />
          </Field>
          <Field label="University or college" htmlFor="p-university">
            <Input
              id="p-university"
              value={form.university}
              onChange={(e) => setForm((p) => ({ ...p, university: e.target.value }))}
            />
          </Field>
          <Field label="Department" htmlFor="p-department">
            <Input
              id="p-department"
              value={form.department}
              onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Academic year" htmlFor="p-year">
              <Input
                id="p-year"
                value={form.academicYear}
                onChange={(e) => setForm((p) => ({ ...p, academicYear: e.target.value }))}
              />
            </Field>
            <Field label="Education level" htmlFor="p-level">
              <Select
                id="p-level"
                value={form.educationLevel}
                onChange={(e) => setForm((p) => ({ ...p, educationLevel: e.target.value }))}
              >
                <option value="undergraduate">Undergraduate</option>
                <option value="graduation_completed">Graduation completed</option>
                <option value="postgraduate">Postgraduate</option>
              </Select>
            </Field>
          </div>
          <Field label="Graduation year" htmlFor="p-grad" hint="Optional.">
            <Input
              id="p-grad"
              type="number"
              min={1950}
              max={2100}
              value={form.graduationYear}
              onChange={(e) => setForm((p) => ({ ...p, graduationYear: e.target.value }))}
            />
          </Field>
          <Field label="Interests" htmlFor="p-interests" hint="Comma separated.">
            <Input
              id="p-interests"
              value={form.interests}
              onChange={(e) => setForm((p) => ({ ...p, interests: e.target.value }))}
            />
          </Field>
          <Field label="Short bio" htmlFor="p-bio" hint="Optional, up to 600 characters.">
            <Textarea
              id="p-bio"
              maxLength={600}
              value={form.bio}
              onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
            />
          </Field>
        </div>

        <Button
          className="mt-6"
          onClick={() => save.mutate()}
          isLoading={save.isPending}
          icon={<Save className="h-4 w-4" />}
        >
          Save changes
        </Button>
      </Card>

      <Card className="border-critical/40">
        <CardHeader title="Delete your account" description="This cannot be undone." />
        <div className="flex items-start gap-3 rounded-lg bg-critical/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-critical" aria-hidden="true" />
          <div className="text-sm">
            <p>
              Deleting removes your profile, your skills, your CV and its file, every roadmap, all
              your progress, and your achievements.
            </p>
            <p className="mt-2 text-muted">Nothing is kept in a backup you cannot reach.</p>
          </div>
        </div>
        <Button
          variant="danger"
          className="mt-4"
          onClick={() => setDeleteOpen(true)}
          icon={<Trash2 className="h-4 w-4" />}
        >
          Delete my account
        </Button>
      </Card>

      {deleteOpen ? (
        <ConfirmDialog
          title="Delete your account?"
          body={`Type DELETE to confirm. This permanently removes your account and all of your data, including your CV file.`}
          confirmLabel={deleteConfirm === 'DELETE' ? 'Permanently delete' : 'Type DELETE first'}
          isDanger
          isLoading={removeAccount.isPending}
          onCancel={() => {
            setDeleteOpen(false);
            setDeleteConfirm('');
          }}
          onConfirm={() => {
            if (deleteConfirm === 'DELETE') removeAccount.mutate();
          }}
        />
      ) : null}

      {deleteOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-[rgb(var(--surface))] p-4">
            <label htmlFor="delete-confirm" className="mb-2 block text-sm font-medium">
              Type DELETE to confirm
            </label>
            <Input
              id="delete-confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
