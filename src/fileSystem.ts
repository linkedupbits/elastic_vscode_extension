import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export function generateId(): string {
  return crypto.randomUUID();
}

/** Characters/segments that are not safe to use as a file or folder name. */
const INVALID_NAME_CHARS = /[\\/:*?"<>|]/;

export function validateArtifactName(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Name is required.';
  }
  if (INVALID_NAME_CHARS.test(trimmed)) {
    return 'Name cannot contain \\ / : * ? " < > |';
  }
  if (trimmed === '.' || trimmed === '..') {
    return 'Name is not valid.';
  }
  if (trimmed !== name) {
    return 'Name cannot have leading or trailing whitespace.';
  }
  return undefined;
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/** Absolute paths of the *.json files directly inside `dir` (non-recursive). Returns [] if `dir` does not exist. */
export async function listJsonFiles(dir: string): Promise<string[]> {
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.json'))
    .map((e) => path.join(dir, e.name));
}

/** Immediate subdirectories of `dir`. Returns [] if `dir` does not exist. */
export async function listSubdirectories(dir: string): Promise<string[]> {
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.filter((e) => e.isDirectory()).map((e) => path.join(dir, e.name));
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export async function deleteFile(filePath: string): Promise<void> {
  await fs.rm(filePath, { force: true });
}

export async function deleteFolderRecursive(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { force: true, recursive: true });
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  await ensureDir(path.dirname(newPath));
  await fs.rename(oldPath, newPath);
}

export async function renameFolder(oldPath: string, newPath: string): Promise<void> {
  await ensureDir(path.dirname(newPath));
  await fs.rename(oldPath, newPath);
}
