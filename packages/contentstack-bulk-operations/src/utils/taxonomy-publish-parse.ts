import type { TaxonomyPublishItem } from '../interfaces';

/**
 * Each segment becomes `{ uid: "<taxonomy_uid>" }`. Term-level publish is not supported by the API.
 */
export function parseTaxonomyPublishItems(input: string): TaxonomyPublishItem[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  const items: TaxonomyPublishItem[] = [];

  for (const segment of trimmed.split(',')) {
    const part = segment.trim();
    if (!part) {
      continue;
    }

    if (part.includes(':')) {
      throw new Error(
        'Invalid items format. Use comma-separated taxonomy UIDs only. Example: my_taxonomy,other_taxonomy'
      );
    }

    items.push({ uid: part });
  }

  return items;
}
