export const OFFICIAL_SEED_OWNER = 'contentstack';

export interface OfficialSeedStack {
  displayName: string;
  owner: string;
  repo: string;
}

export const OFFICIAL_SEED_STACKS: OfficialSeedStack[] = [
  {
    displayName: 'Kickstart stack seed',
    owner: OFFICIAL_SEED_OWNER,
    repo: 'kickstart-stack-seed',
  },
  {
    displayName: 'Kickstart Veda',
    owner: OFFICIAL_SEED_OWNER,
    repo: 'kickstart-veda-seed',
  },
  {
    displayName: 'Compass starter stack',
    owner: OFFICIAL_SEED_OWNER,
    repo: 'compass-starter-stack',
  },
  {
    displayName: 'Starter app',
    owner: OFFICIAL_SEED_OWNER,
    repo: 'stack-starter-app',
  },
];
