import { loadChalk } from '@contentstack/cli-utilities';

/**
 * Ensures the cli-utilities chalk singleton is ready on this plugin's copy of utilities.
 */
export default async function loadChalkHook(): Promise<void> {
  await loadChalk();
}
