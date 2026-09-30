/**
 * Private file storage for CVs.
 *
 * Rules:
 *   - Files live OUTSIDE any static directory and are served only through an
 *     authorized controller route. There is no public /uploads path.
 *   - Stored names are random, never derived from the uploaded filename.
 *   - Paths are resolved and then checked to be inside the upload directory,
 *     which defeats traversal via a crafted storedFileName.
 *   - Extension comes from an allow-list keyed by MIME type, not from the input.
 */

import { createHash, randomBytes } from 'node:crypto';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

export function allowedExtensions(): string[] {
  return config.uploads.allowedTypes
    .map((mime) => EXTENSION_BY_MIME[mime])
    .filter((ext): ext is string => typeof ext === 'string');
}

export function uploadRoot(): string {
  return path.resolve(process.cwd(), config.uploads.dir);
}

export function buildStoredName(userId: string, mimeType: string): string {
  const extension = EXTENSION_BY_MIME[mimeType] ?? '.bin';
  const random = randomBytes(16).toString('hex');
  const userPart = createHash('sha256').update(userId).digest('hex').slice(0, 8);
  return `${userPart}-${random}${extension}`;
}

/** Resolves inside the upload root or throws. Never trust a stored name. */
export function resolveUploadPath(storedFileName: string): string {
  const root = uploadRoot();
  const resolved = path.resolve(root, path.basename(storedFileName));

  if (
    resolved !== path.join(root, path.basename(resolved)) ||
    !resolved.startsWith(`${root}${path.sep}`)
  ) {
    logger.error('Blocked a path traversal attempt in upload resolution');
    throw new AppError('BAD_REQUEST', 'Invalid file reference');
  }

  return resolved;
}

export async function ensureUploadDir(): Promise<void> {
  await mkdir(uploadRoot(), { recursive: true, mode: 0o700 });
}

export async function deleteStoredFile(storedFileName: string): Promise<void> {
  try {
    await unlink(resolveUploadPath(storedFileName));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return;
    logger.warn('Failed to delete stored file', {
      code,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}

export async function deleteUploadsForUser(docs: { storedFileName: string }[]): Promise<number> {
  let removed = 0;
  for (const doc of docs) {
    if (!doc.storedFileName) continue;
    try {
      await deleteStoredFile(doc.storedFileName);
      removed += 1;
    } catch {
      // A file we cannot delete must not block account deletion.
    }
  }
  return removed;
}
