import type { StackClient } from '../../../src/types';

export function createStackClient(handlers: {
  contentTypeCount?: unknown;
  contentTypesFind?: unknown;
  localesFind?: unknown;
  entriesCount?: unknown;
  entriesFind?: unknown;
  envFind?: unknown;
  taxonomyFind?: unknown;
  taxonomyFetch?: unknown;
  termsFind?: unknown;
  taxonomyExport?: unknown;
}): StackClient {
  return {
    contentType: (uid?: string) => {
      if (uid) {
        return {
          entry: () => ({
            query: () => ({
              count: () => Promise.resolve(handlers.entriesCount ?? { entries: 3 }),
              find: () => Promise.resolve(handlers.entriesFind ?? { items: [] }),
            }),
          }),
        };
      }
      return {
        query: () => ({
          count: () => Promise.resolve(handlers.contentTypeCount ?? { content_types: 2 }),
          find: () => Promise.resolve(handlers.contentTypesFind ?? { items: [{ title: 'Blog', uid: 'blog' }] }),
        }),
      };
    },
    locale: () => ({
      query: () => ({
        find: () => Promise.resolve(handlers.localesFind ?? { items: [{ name: 'English', code: 'en-us' }] }),
      }),
    }),
    environment: () => ({
      query: () => ({
        find: () => Promise.resolve(handlers.envFind ?? { items: [{ uid: 'env1', name: 'Production' }] }),
      }),
    }),
    taxonomy: (taxonomyUID?: string) => ({
      query: () => ({
        find: () => Promise.resolve(handlers.taxonomyFind ?? { items: [], count: 0 }),
      }),
      fetch: () => Promise.resolve(handlers.taxonomyFetch ?? { uid: taxonomyUID, name: 'Tax' }),
      terms: () => ({
        query: () => ({
          find: () => Promise.resolve(handlers.termsFind ?? { items: [], count: 0 }),
        }),
      }),
      export: () => Promise.resolve(handlers.taxonomyExport ?? 'h1,h2\nv1,v2'),
    }),
  } as unknown as StackClient;
}
