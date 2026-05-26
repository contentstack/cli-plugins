import {ux} from '@contentstack/cli-utilities'
import safeRegex from './safe-regex'
import generateOutput from './generate-output'
const regexMessages = require('../../messages/index.json').validateRegex

export default async function processStack(flags: any, stack: any, startTime: number) {
  ux.action.stop(regexMessages.cliAction.connectStackStop + (Date.now() - startTime) + ' ms')
  const processTime = Date.now()
  ux.action.start(regexMessages.cliAction.processStackStart)
  const query = {}
  const invalidRegex: object[] = []
  const tableData: object[] = []
  if (flags.contentType) {
    const contentTypes = stack.contentType().query(query).find()
    await contentTypes.then((contentTypesObject: any) => {
      contentTypesObject.items.forEach((contentType: any) => {
        safeRegex(contentType, invalidRegex, tableData, 'Content Type')
      })
    }).catch(() => {
      throw new Error(regexMessages.errors.stack.contentTypes)
    })
  }

  if (flags.globalField) {
    const globalFields = stack.globalField().query(query).find()
    await globalFields.then((globalFieldsObject: any) => {
      globalFieldsObject.items.forEach((globalField: any) => {
        safeRegex(globalField, invalidRegex, tableData, 'Global Field')
      })
    }).catch(() => {
      throw new Error(regexMessages.errors.stack.globalFields)
    })
  }

  ux.action.stop(regexMessages.cliAction.processStackStop + (Date.now() - processTime) + ' ms')
  await generateOutput(flags, invalidRegex, tableData)
}
