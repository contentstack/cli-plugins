import {configHandler, ux} from '@contentstack/cli-utilities'
import * as contentstackSdk from '@contentstack/management'

import processStack from './process-stack'
const regexMessages = require('../../messages/index.json').validateRegex

export default async function connectStack(
  flags: any,
  host: string,
  tokenDetails: any,
) {
  try {
    const startTime = Date.now()
    ux.action.start(regexMessages.cliAction.connectStackStart)

    const option: contentstackSdk.ContentstackConfig = {
      host,
    }

    // Adding early access headers
    const earlyAccessHeaders = configHandler.get('earlyAccessHeaders')
    if (earlyAccessHeaders && Object.keys(earlyAccessHeaders).length > 0) {
      option.early_access = Object.values(earlyAccessHeaders)
    }

    const client = contentstackSdk.client(option)
    const stackInstance = client.stack({
      api_key: tokenDetails.apiKey,
      management_token: tokenDetails.token,
    })
    await processStack(flags, stackInstance, startTime)
  } catch {
    throw new Error(regexMessages.errors.stack.apiKey)
  }
}
