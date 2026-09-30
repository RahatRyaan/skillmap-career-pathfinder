import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Map } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toUserMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Form';

interface Errors {
  name?: string;
  email?: string;
  password?: string;
  university?: string;
  department?: string;
  academicYear?: string;
  interests?: string;
}

export default function Register() {
  const { t } = useTranslation();
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    university: '',
    department: '',
    academicYear: '',
    educationLevel: 'undergraduate' as 'undergraduate' | 'graduation_completed' | 'postgraduate',
    interests: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const validate = (): boolean => {
    const next: Errors = {};
    if (!form.name.trim()) next.name = 'Enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = 'Enter a valid email address.';
    if (form.password.length < 8) next.password = 'Use at least 8 characters.';
    if (!form.university.trim()) next.university = 'Enter your university or college.';
    if (!form.department.trim()) next.department = 'Enter your department.';
    if (!form.academicYear.trim()) next.academicYear = 'For example: Third year, or Final year.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        university: form.university.trim(),
        department: form.department.trim(),
        academicYear: form.academicYear.trim(),
        educationLevel: form.educationLevel,
        interests: form.interests
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 12),
      });
      navigate('/app/onboarding');
    } catch (err) {
      setFormError(toUserMessage(err, 'Could not create your account. Please try again.'));
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <Map className="h-7 w-7 text-brand" aria-hidden="true" />
            <span className="text-xl font-bold">{t('app.name')}</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold">Create your account</h1>
          <p className="mt-2 text-sm text-muted">
            Takes a minute. You can skip most of the next step.
          </p>
        </div>

        {formError ? (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-critical/30 bg-critical/5 px-4 py-3 text-sm text-critical"
          >
            {formError}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="card space-y-4" noValidate>
          <Field label="Full name" htmlFor="reg-name" required error={errors.name}>
            <Input
              id="reg-name"
              value={form.name}
              onChange={update('name')}
              autoComplete="name"
              invalid={Boolean(errors.name)}
            />
          </Field>

          <Field label="Email" htmlFor="reg-email" required error={errors.email}>
            <Input
              id="reg-email"
              type="email"
              value={form.email}
              onChange={update('email')}
              autoComplete="email"
              invalid={Boolean(errors.email)}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="reg-password"
            required
            error={errors.password}
            hint="At least 8 characters."
          >
            <Input
              id="reg-password"
              type="password"
              value={form.password}
              onChange={update('password')}
              autoComplete="new-password"
              invalid={Boolean(errors.password)}
            />
          </Field>

          <Field
            label="University or college"
            htmlFor="reg-university"
            required
            error={errors.university}
          >
            <Input
              id="reg-university"
              value={form.university}
              onChange={update('university')}
              invalid={Boolean(errors.university)}
            />
          </Field>

          <Field label="Department" htmlFor="reg-department" required error={errors.department}>
            <Input
              id="reg-department"
              value={form.department}
              onChange={update('department')}
              invalid={Boolean(errors.department)}
            />
          </Field>

          <Field
            label="Academic year"
            htmlFor="reg-year"
            required
            error={errors.academicYear}
            hint="For example: Third year, or Final year."
          >
            <Input
              id="reg-year"
              value={form.academicYear}
              onChange={update('academicYear')}
              invalid={Boolean(errors.academicYear)}
            />
          </Field>

          <Field label="Education level" htmlFor="reg-level">
            <Select id="reg-level" value={form.educationLevel} onChange={update('educationLevel')}>
              <option value="undergraduate">Undergraduate</option>
              <option value="graduation_completed">Graduation completed</option>
              <option value="postgraduate">Postgraduate</option>
            </Select>
          </Field>

          <Field
            label="Interests"
            htmlFor="reg-interests"
            error={errors.interests}
            hint="Comma separated. Optional, and it helps the career quiz."
          >
            <Input
              id="reg-interests"
              value={form.interests}
              onChange={update('interests')}
              placeholder="data analysis, design, security"
            />
          </Field>

          <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
