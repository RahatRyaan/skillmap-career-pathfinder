import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, FileText, Loader2, Trash2, Upload, X } from 'lucide-react';
import { cvApi } from '@/lib/endpoints';
import { toUserMessage } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Badge, ErrorState, SkeletonCards } from '@/components/ui/States';
import { Select } from '@/components/ui/Form';
import { cn, formatDate } from '@/lib/utils';
import { ConfirmDialog } from './MySkills';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['.pdf', '.docx'];

type Decision = 'accept' | 'reject';

export default function CvUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const list = useQuery({ queryKey: ['cv-list'], queryFn: () => cvApi.list() });
  const current = list.data?.items[0] ?? null;
  const samples = useQuery({ queryKey: ['cv-samples'], queryFn: () => cvApi.samples() });

  const upload = useMutation({
    mutationFn: (file: File) => cvApi.upload(file),
    onSuccess: () => {
      setDecisions({});
      setError(null);
      void list.refetch();
    },
    onError: (err) => setError(toUserMessage(err, 'The upload failed.')),
  });

  const loadSample = useMutation({
    mutationFn: (slug: string) => cvApi.loadSample(slug),
    onSuccess: () => {
      setDecisions({});
      setError(null);
      void list.refetch();
    },
    onError: (err) => setError(toUserMessage(err, 'Could not load that sample.')),
  });

  const review = useMutation({
    mutationFn: (id: string) =>
      cvApi.review(
        id,
        Object.entries(decisions).map(([extractionId, decision]) => ({
          extractionId,
          decision,
          ...(levels[extractionId] !== undefined ? { level: levels[extractionId] } : {}),
        })),
      ),
    onSuccess: () => {
      setDecisions({});
      void list.refetch();
    },
    onError: (err) => setError(toUserMessage(err, 'Could not save your review.')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => cvApi.remove(id),
    onSuccess: () => {
      setPendingDelete(null);
      void list.refetch();
    },
    onError: (err) => setError(toUserMessage(err, 'Could not delete that CV.')),
  });

  const validateFile = (file: File): string | null => {
    const lower = file.name.toLowerCase();
    if (!ACCEPTED.some((ext) => lower.endsWith(ext))) {
      return 'That file type is not supported. Upload a PDF or a DOCX.';
    }
    if (file.size > MAX_BYTES) {
      return `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 5MB.`;
    }
    return null;
  };

  const handleFile = (file: File) => {
    const problem = validateFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    upload.mutate(file);
  };

  if (list.isLoading) {
    return (
      <div>
        <PageHeader title="CV Upload" />
        <SkeletonCards count={2} />
      </div>
    );
  }

  if (list.isError) {
    return (
      <div>
        <PageHeader title="CV Upload" />
        <ErrorState message="We could not load your CVs." onRetry={() => void list.refetch()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="CV Upload"
        description="Upload a CV and review what was found. Nothing reaches your profile until you accept it."
      />

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-critical/30 bg-critical/5 px-4 py-3 text-sm text-critical"
        >
          {error}
        </div>
      ) : null}

      {current && current.status !== 'reviewed' ? (
        <Card className="mb-6 border-developing/40">
          <CardHeader
            title="Review what was found"
            description={`Uploaded ${formatDate(current.createdAt)}. Accept, edit, or reject each item.`}
            action={
              <Button
                onClick={() => review.mutate(current.id)}
                isLoading={review.isPending}
                disabled={Object.keys(decisions).length === 0}
                icon={<Check className="h-4 w-4" />}
              >
                Save {Object.keys(decisions).length} decision
                {Object.keys(decisions).length === 1 ? '' : 's'}
              </Button>
            }
          />

          <div className="mb-4 flex items-start gap-2 rounded-lg bg-developing/10 px-3 py-2 text-xs text-developing">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Nothing has been added to your profile yet. Items marked low confidence are ones the
              extractor was unsure about — read them before accepting.
            </span>
          </div>

          {current.items.length === 0 ? (
            <EmptyState
              title="Nothing was extracted"
              body="We could not find any recognisable skills in that document. If it is a scanned image rather than a text PDF, we cannot read it yet."
              icon={<FileText className="h-8 w-8" />}
            />
          ) : (
            <ul className="max-h-[32rem] space-y-2 overflow-y-auto">
              {current.items.map((item) => {
                const decision = decisions[item.extractionId];
                return (
                  <li
                    key={item.extractionId}
                    className={cn(
                      'rounded-lg border p-3 transition-colors',
                      item.lowConfidence
                        ? 'border-developing/40 bg-developing/5'
                        : 'border-[rgb(var(--border))]',
                      decision === 'reject' && 'opacity-50',
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">
                            {item.normalizedSkillName ?? item.rawValue}
                          </span>
                          <Badge color="neutral">{item.type.replace('_', ' ')}</Badge>
                          {item.lowConfidence ? (
                            <Badge
                              color="developing"
                              icon={<AlertTriangle className="h-3.5 w-3.5" />}
                            >
                              Low confidence {Math.round(item.confidence * 100)}%
                            </Badge>
                          ) : null}
                        </div>
                        {item.context ? (
                          <p className="mt-1 truncate text-xs text-muted">
                            Found in: “{item.context}”
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant={decision === 'accept' ? 'primary' : 'outline'}
                          onClick={() =>
                            setDecisions((prev) => ({ ...prev, [item.extractionId]: 'accept' }))
                          }
                          aria-pressed={decision === 'accept'}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant={decision === 'reject' ? 'danger' : 'outline'}
                          onClick={() =>
                            setDecisions((prev) => ({ ...prev, [item.extractionId]: 'reject' }))
                          }
                          aria-pressed={decision === 'reject'}
                          aria-label={`Reject ${item.rawValue}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {decision === 'accept' && item.type === 'skill' ? (
                      <div className="mt-3 flex items-center gap-3">
                        <label
                          htmlFor={`level-${item.extractionId}`}
                          className="text-xs font-medium"
                        >
                          Level
                        </label>
                        <Select
                          id={`level-${item.extractionId}`}
                          className="h-9 w-28"
                          value={levels[item.extractionId] ?? item.suggestedLevel ?? 2}
                          onChange={(e) =>
                            setLevels((prev) => ({
                              ...prev,
                              [item.extractionId]: Number(e.target.value),
                            }))
                          }
                        >
                          {[0, 1, 2, 3, 4, 5].map((level) => (
                            <option key={level} value={level}>
                              Level {level}
                            </option>
                          ))}
                        </Select>
                        <span className="text-xs text-muted">
                          Change it if the suggestion is wrong.
                        </span>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className={cn(
            'border-2 border-dashed',
            dragging ? 'border-brand bg-brand-subtle' : 'border-[rgb(var(--border))]',
          )}
        >
          <CardHeader title="Upload a CV" description="PDF or DOCX, up to 5MB." />
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx"
            className="sr-only-focusable"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            {upload.isPending ? (
              <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden="true" />
            ) : (
              <Upload className="h-8 w-8 text-muted" aria-hidden="true" />
            )}
            <p className="text-sm text-muted">
              {upload.isPending ? 'Reading your document…' : 'Drag a file here, or choose one'}
            </p>
            <Button onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
              Choose file
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Your documents"
            description="Stored privately. Never public, and deletable at any time."
          />
          {(list.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              icon={<FileText className="h-8 w-8" />}
              title="No CV uploaded"
              body="You can add skills by hand instead, or upload a CV and let us read it for you."
            />
          ) : (
            <ul className="space-y-3">
              {list.data?.items.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[rgb(var(--border))] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{doc.fileName}</p>
                    <p className="text-xs text-muted">
                      {(doc.sizeBytes / 1024).toFixed(0)}KB · {formatDate(doc.createdAt)} ·{' '}
                      {doc.status === 'reviewed' ? 'Reviewed' : 'Awaiting review'} ·{' '}
                      {doc.extractionMode} mode
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingDelete(doc.id)}
                    aria-label={`Delete ${doc.fileName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {samples.data ? (
        <Card className="mt-6">
          <CardHeader title="Try it with a sample" description={samples.data.notice} />
          <div className="flex flex-wrap gap-3">
            {samples.data.samples.map((sample) => (
              <Button
                key={sample.slug}
                variant="outline"
                onClick={() => loadSample.mutate(sample.slug)}
                isLoading={loadSample.isPending && loadSample.variables === sample.slug}
              >
                {sample.title}
              </Button>
            ))}
          </div>
        </Card>
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this CV?"
          body="The stored file and everything extracted from it are removed. Your profile is not affected, but this cannot be undone."
          confirmLabel="Delete CV"
          isDanger
          isLoading={remove.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => remove.mutate(pendingDelete)}
        />
      ) : null}
    </div>
  );
}
