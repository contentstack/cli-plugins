/* eslint-disable max-statements-per-line */
/* eslint-disable no-console */
/* eslint-disable no-empty */
/*!
 * Contentstack Import
 * Copyright (c) 2026 Contentstack LLC
 * MIT Licensed
 */

import { authHandler, log, managementSDKClient } from '@contentstack/cli-utilities';

import { ExternalConfig } from '../types';

const login = async (config: ExternalConfig): Promise<any> => {
  const client = await managementSDKClient(config);
  if (config.email && config.password) {
    const response = await client.login({ email: config.email, password: config.password }).catch(Promise.reject);
    if (response?.user?.authtoken) {
      config.headers = {
        'X-User-Agent': 'contentstack-export/v',
        access_token: config.access_token,
        api_key: config.source_stack,
        authtoken: response.user.authtoken,
      };
      await authHandler.setConfigData('basicAuth', response.user);
      log.success(`Contentstack account authenticated successfully!`, config.context);
      return config;
    } else {
      log.error(`Failed to log in!`, config.context);
      // CLI: exit after unrecoverable auth failure (same behavior as before lint pass)
      // eslint-disable-next-line n/no-process-exit -- intentional CLI termination
      process.exit(1);
    }
  } else if (!config.email && !config.password && config.source_stack && config.access_token) {
    log.info(
      `Content types, entries, assets, labels, global fields, extensions modules will be exported`,
      config.context,
    );
    log.info(
      `Email, password, or management token is not set in the config, cannot export Webhook and label modules`,
      config.context,
    );
    config.headers = {
      'X-User-Agent': 'contentstack-export/v',
      access_token: config.access_token,
      api_key: config.source_stack,
    };
    return config;
  }
};

export default login;
