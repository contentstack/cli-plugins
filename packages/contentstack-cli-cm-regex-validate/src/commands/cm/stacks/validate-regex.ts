import {Command} from '@contentstack/cli-command'
import {flags} from '@contentstack/cli-utilities'

import connectStack from '../../../utils/connect-stack'
import {inquireAlias, inquireModule} from '../../../utils/interactive'
const regexMessages = require('../../../../messages/index.json').validateRegex

export default class ValidateRegex extends Command {
  static description = regexMessages.command.description
  static examples = [
    '$ csdx cm:stacks:validate-regex',
    '$ csdx cm:stacks:validate-regex -a <management_token_alias>',
    '$ csdx cm:stacks:validate-regex --contentType',
    '$ csdx cm:stacks:validate-regex --globalField',
    '$ csdx cm:stacks:validate-regex --filePath <path/to/the/directory>',
    '$ csdx cm:stacks:validate-regex -a <management_token_alias> --contentType --globalField',
    '$ csdx cm:stacks:validate-regex -a <management_token_alias> --contentType --globalField --filePath <path/to/the/directory>',
  ]
  static flags: any = {
    alias: flags.string({
      char: 'a',
      description: regexMessages.command.alias,
    }),
    contentType: flags.boolean({
      description: regexMessages.command.contentTypes,
    }),
    filePath: flags.string({
      description: regexMessages.command.filePath,
    }),
    globalField: flags.boolean({
      description: regexMessages.command.globalFields,
    }),
  }

  async run() {
    const commandObject = await this.parse(ValidateRegex)
    await inquireAlias(commandObject.flags)

    let tokenDetails: any
    try {
      tokenDetails = await this.getToken(commandObject.flags.alias)
    } catch {
      this.error(regexMessages.errors.tokenNotFound, {
        ref: regexMessages.command.addManagementToken,
      })
    }

    await inquireModule(commandObject.flags)

    try {
      await connectStack(commandObject.flags, this.cmaHost, tokenDetails)
    } catch {
      this.error(regexMessages.errors.stack.fetch)
    }
  }
}
