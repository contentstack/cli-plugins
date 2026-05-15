import messageHandler from './messages';
export interface Configuration {
  starterApps: Array<any>;
  sampleApps: any;
  appLevelConfig: any;
}

export interface AppConfig {
  source: string;
  stack: string;
  private?: boolean;
  branch?: string;
  appConfigKey?: string;
  master_locale?: string;
}

const config: Configuration = {
  sampleApps: [],
  starterApps: [
    { displayName: 'Compass App', configKey: 'compass-app' },
    { displayName: 'Kickstart Next.js', configKey: 'kickstart-next' },
    { displayName: 'Kickstart Next.js SSR', configKey: 'kickstart-next-ssr' },
    { displayName: 'Kickstart Next.js SSG', configKey: 'kickstart-next-ssg' },
    { displayName: 'Kickstart Next.js GraphQL', configKey: 'kickstart-next-graphql' },
    { displayName: 'Kickstart Next.js Middleware', configKey: 'kickstart-next-middleware' },
    { displayName: 'Kickstart NuxtJS', configKey: 'kickstart-nuxt' },
    { displayName: 'Kickstart NuxtJS SSR', configKey: 'kickstart-nuxt-ssr' },
  ],
  appLevelConfig: {
    'kickstart-next': {
      source: 'contentstack/kickstart-next',
      stack: 'contentstack/kickstart-stack-seed',
    },

    'kickstart-next-ssr': {
      source: 'contentstack/kickstart-next-ssr',
      stack: 'contentstack/kickstart-stack-seed',
    },

    'kickstart-next-ssg': {
      source: 'contentstack/kickstart-next-ssg',
      stack: 'contentstack/kickstart-stack-seed',
    },

    'kickstart-next-graphql': {
      source: 'contentstack/kickstart-next-graphql',
      stack: 'contentstack/kickstart-stack-seed',
    },

    'kickstart-next-middleware': {
      source: 'contentstack/kickstart-next-middleware',
      stack: 'contentstack/kickstart-stack-seed',
    },

    'kickstart-nuxt': {
      source: 'contentstack/kickstart-nuxt',
      stack: 'contentstack/kickstart-stack-seed',
    },
    'kickstart-nuxt-ssr': {
      source: 'contentstack/kickstart-nuxt-ssr',
      stack: 'contentstack/kickstart-stack-seed',
    },
    'compass-app': {
      source: 'contentstack/compass-starter-app',
      stack: 'contentstack/compass-starter-stack',
      master_locale: 'en',
    },
  },
};
export default config;

export function getAppLevelConfigByName(appConfigKey: string): any {
  if (!config.appLevelConfig.hasOwnProperty(appConfigKey)) {
    throw new Error(messageHandler.parse('CLI_BOOTSTRAP_INVALID_APP_NAME'));
  }
  config.appLevelConfig[appConfigKey].appConfigKey = appConfigKey;
  return config.appLevelConfig[appConfigKey];
}
