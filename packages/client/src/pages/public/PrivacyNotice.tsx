import { Link } from 'react-router-dom';
import { Map, ShieldCheck } from 'lucide-react';

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: 'What we collect',
    body: [
      'Your account details: name, email address, university, department, academic year, and education level.',
      'The skill levels you record for yourself, and where each one came from.',
      'The career you choose as your target, and the roadmap and progress records generated from it.',
      'Study sessions you log, and achievements you earn.',
      'If you upload a CV, the file itself and the text extracted from it.',
    ],
  },
  {
    heading: 'Your CV is private',
    body: [
      'An uploaded CV is never public. There is no URL that anyone can guess to read your document.',
      'CV files are stored under a randomised name, outside any publicly served folder, and can only be read through an endpoint that checks that you are signed in as the owner.',
      'You can delete a CV at any time. Deleting removes both the stored file and everything extracted from it.',
    ],
  },
  {
    heading: 'What we deliberately do not collect',
    body: [
      'We do not ask for your age, gender, religion, ethnicity, disability status, marital status, or nationality.',
      'We do not infer any of those from your CV, your name, or your activity.',
      'We do not use any of those attributes in recommendations, and our system is built so that no recommendation can depend on one.',
    ],
  },
  {
    heading: 'Deletion',
    body: [
      'You can delete your entire account from your profile page. It requires typing to confirm, because it cannot be undone.',
      'Deleting your account removes your profile, your skills, your CV and its file, your roadmaps, your progress, your study sessions, and your achievements.',
      'To request deletion another way, contact us and we will action it. There is no retention period we will try to talk you out of.',
    ],
  },
  {
    heading: 'Who can see your data',
    body: [
      'Only you. The administrator area shows aggregate counts for the impact report, not your personal records.',
      'Anonymised "common gaps" are only shown when enough students are in the group, so your individual gaps cannot be identified from an admin page.',
      'We do not sell your data, and we do not share it for advertising.',
    ],
  },
  {
    heading: 'What the AI does and does not see',
    body: [
      'In real AI mode, the text of your CV and the text of a job description you paste are sent to the configured AI provider so they can be analysed.',
      'In demo mode, nothing leaves your machine. Analysis is done with deterministic rules.',
      'Your skill levels and target career are sent to the AI provider as grounding context when you use the assistant, so its answers can reflect your real data.',
      'Every AI call is logged with which mode produced it, so you can see what happened.',
    ],
  },
];

export default function PrivacyNotice() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline"
      >
        <Map className="h-4 w-4" aria-hidden="true" />
        Back to SkillMap AI
      </Link>

      <h1 className="mt-8 text-3xl font-bold">Privacy notice</h1>
      <p className="mt-3 text-muted">
        Written to be read, not to be skimmed past. If anything here is unclear, ask us.
      </p>

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-strong/30 bg-strong/5 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-strong" aria-hidden="true" />
        <p className="text-sm">
          The short version: your CV is private, we do not collect anything sensitive about you, and
          you can delete everything with one click.
        </p>
      </div>

      <div className="mt-10 space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-semibold">{section.heading}</h2>
            <ul className="mt-3 space-y-2">
              {section.body.map((paragraph) => (
                <li key={paragraph} className="flex gap-3 text-sm leading-relaxed text-muted">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand"
                  />
                  <span>{paragraph}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-12 text-sm text-muted">
        See also the{' '}
        <Link to="/ai-info" className="font-medium text-brand hover:underline">
          AI information page
        </Link>
        , which explains exactly which parts of this product use a model and which are plain
        arithmetic.
      </p>
    </main>
  );
}
