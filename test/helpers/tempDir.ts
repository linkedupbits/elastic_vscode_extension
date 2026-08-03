import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export function makeTempDir(prefix = 'elastic-ext-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function removeTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}
