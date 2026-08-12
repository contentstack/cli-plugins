import {
  OFFICIAL_SEED_OWNER,
  OFFICIAL_SEED_STACKS,
} from '../../src/seed/seed-stacks';

describe('seed-stacks', () => {
  const expectedRepos = [
    'kickstart-stack-seed',
    'kickstart-veda-seed',
    'compass-starter-stack',
  ];

  it('exports a catalog of three stacks', () => {
    expect(Array.isArray(OFFICIAL_SEED_STACKS)).toBe(true);
    expect(OFFICIAL_SEED_STACKS).toHaveLength(3);
  });

  it('has exact repo slugs under contentstack', () => {
    const repos = OFFICIAL_SEED_STACKS.map((s) => s.repo).sort();
    expect(repos).toEqual([...expectedRepos].sort());
  });

  it('uses contentstack as owner for every entry', () => {
    for (const entry of OFFICIAL_SEED_STACKS) {
      expect(entry.owner).toBe(OFFICIAL_SEED_OWNER);
    }
  });

  it('has non-empty display names', () => {
    for (const entry of OFFICIAL_SEED_STACKS) {
      expect(entry.displayName.trim().length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate repo slugs', () => {
    const repos = OFFICIAL_SEED_STACKS.map((s) => s.repo);
    expect(new Set(repos).size).toBe(3);
  });

  it('has stable display names', () => {
    expect(OFFICIAL_SEED_STACKS.map((s) => s.displayName)).toEqual([
      'Kickstart stack seed',
      'Kickstart Veda',
      'Compass starter stack',
    ]);
  });
});
