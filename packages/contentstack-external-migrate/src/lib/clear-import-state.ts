import fs from 'fs';
import path from 'path';

/**
 * `csdx cm:stacks:import` is idempotent via a local `mapper/` directory it writes
 * into the data-dir (e.g. `mapper/webhooks/uid-mapping.json`). On a RE-import of
 * the same bundle it then skips any object recorded there as "already exists" —
 * even when the target is a brand-new, EMPTY stack — silently dropping webhooks,
 * custom-roles, etc. (the "5 of 15 webhooks" bug). It also litters the CWD with
 * `_backup_<n>` copies.
 *
 * Clearing csdx's runtime state before each import makes every run start clean so
 * nothing is falsely skipped. We remove ONLY csdx-generated state:
 *   - `<dataDir>/mapper`  — the DIRECTORY csdx writes; NEVER our convert's
 *                            `mapper.json` FILE (different name, untouched).
 *   - `<cwd>/_backup_*`   — csdx import backup copies.
 */
export function clearStaleImportState(dataDir: string): void {
  try {
    const csdxMapperDir = path.join(dataDir, 'mapper');
    // Guard on isDirectory so a stray mapper.json file can never be removed.
    if (fs.existsSync(csdxMapperDir) && fs.statSync(csdxMapperDir).isDirectory()) {
      fs.rmSync(csdxMapperDir, { recursive: true, force: true });
    }
  } catch {
    // best-effort
  }
  try {
    const cwd = process.cwd();
    for (const name of fs.readdirSync(cwd)) {
      if (/^_backup_\d+$/.test(name)) {
        fs.rmSync(path.join(cwd, name), { recursive: true, force: true });
      }
    }
  } catch {
    // best-effort
  }
}
