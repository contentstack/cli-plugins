import type { LegacyAdapter } from './types';
import { contentfulAdapter } from './contentful';

const adapters: Record<string, LegacyAdapter> = {
  contentful: contentfulAdapter,
};

export function getAdapter(legacy: string): LegacyAdapter {
  const adapter = adapters[legacy];
  if (!adapter) {
    throw new Error(
      `Unsupported legacy CMS: ${legacy}. Supported: ${Object.keys(adapters).join(', ')}`,
    );
  }
  return adapter;
}
