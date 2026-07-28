import inquirer from 'inquirer'
import { expect } from 'chai'
import sinon from 'sinon'
import { inquireAlias, inquireModule, validateAlias, validateModule } from '../../src/utils/interactive'
const regexMessages = require('../../messages/index.json').validateRegex

describe('Interactive', () => {
  afterEach(() => {
    sinon.restore()
  })

  it('Alias Token Flag is Set', async () => {
    const flags = { alias: 'Test Token' }
    const response = await inquireAlias(flags)
    expect(response).to.be.undefined
  })

  it('Alias Token is not Entered', async () => {
    const alias = ''
    const response = await validateAlias(alias)
    expect(response).to.equal(regexMessages.interactive.required)
  })

  it('Alias Token is Entered', async () => {
    const alias = 'Test Token'
    const flags = {}
    const response = await validateAlias(alias)
    expect(response).to.equal(true)
    sinon.stub(inquirer as any, 'prompt').resolves({ alias })
    await inquireAlias(flags)
  })

  it('Module Flags are Set', async () => {
    async function testModuleFlags(flags: object) {
      const response = await inquireModule(flags)
      expect(response).to.be.undefined
    }

    await testModuleFlags({ contentType: true })
    await testModuleFlags({ globalField: true })
    await testModuleFlags({ contentType: true, globalField: true })
  })

  it('Module is not Selected', async () => {
    const choice: string[] = []
    const response = await validateModule(choice)
    expect(response).to.equal(regexMessages.interactive.selectOne)
  })

  it('Content Type Module is Selected', async () => {
    const choice: string[] = ['contentType']
    const response = await validateModule(choice)
    expect(response).to.equal(true)
    sinon.stub(inquirer as any, 'prompt').resolves({ choice })
    await inquireModule(choice)
  })

  it('Global Field Module is Selected', async () => {
    const choice: string[] = ['globalField']
    const response = await validateModule(choice)
    expect(response).to.equal(true)
    sinon.stub(inquirer as any, 'prompt').resolves({ choice })
    await inquireModule(choice)
  })

  it('Both Modules are Selected', async () => {
    const choice: string[] = ['contentType', 'globalField']
    const response = await validateModule(choice)
    expect(response).to.equal(true)
    sinon.stub(inquirer as any, 'prompt').resolves({ choice })
    await inquireModule(choice)
  })
})
