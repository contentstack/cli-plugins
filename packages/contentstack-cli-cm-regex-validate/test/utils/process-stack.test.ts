import { ux } from '@contentstack/cli-utilities'
import { expect } from 'chai'
import sinon from 'sinon'
import proxyquire from 'proxyquire'
const validDocument = require('../data/validDocument.json')
const regexMessages = require('../../messages/index.json').validateRegex

describe('Process Stack', () => {
  let generateOutputStub: sinon.SinonStub
  let processStack: (flags: any, stack: any, startTime: number) => Promise<void>

  beforeEach(() => {
    sinon.stub(ux.action, 'start')
    sinon.stub(ux.action, 'stop')
    generateOutputStub = sinon.stub().resolves()
    processStack = proxyquire('../../src/utils/process-stack', {
      './generate-output': { default: generateOutputStub, __esModule: true, '@noCallThru': true },
    }).default
  })

  afterEach(() => {
    sinon.restore()
  })

  it('Process Stack with Content Type & Global Field selected & valid Data', async () => {
    const stack = {
      name: 'stack',
      contentType: sinon.stub().returns({
        query: sinon.stub().returns({ find: sinon.stub().resolves({ items: [validDocument] }) }),
      }),
      globalField: sinon.stub().returns({
        query: sinon.stub().returns({ find: sinon.stub().resolves({ items: [validDocument] }) }),
      }),
    }
    const startTime = Date.now()
    await processStack({ contentType: true }, stack, startTime)
    await processStack({ globalField: true }, stack, startTime)
    expect((ux.action.stop as sinon.SinonStub).called).to.equal(true)
    expect((ux.action.start as sinon.SinonStub).called).to.equal(true)
    expect(generateOutputStub.called).to.equal(true)
  })

  it('Process Stack with Content Type selected & invalid Content Type Data', async () => {
    const contentTypeData = { title: 'Regex Fields', uid: 'regex_fields' }
    const stack = {
      name: 'stack',
      contentType: sinon.stub().returns({
        query: sinon.stub().returns({ find: sinon.stub().resolves({ items: [contentTypeData] }) }),
      }),
    }
    try {
      const startTime = Date.now()
      await processStack({ contentType: true }, stack, startTime)
      expect((ux.action.stop as sinon.SinonStub).called).to.equal(true)
      expect((ux.action.start as sinon.SinonStub).called).to.equal(true)
      expect(generateOutputStub.called).to.equal(false)
    } catch (error: any) {
      expect(error.message).to.equal(regexMessages.errors.stack.contentTypes)
    }
  })

  it('Process Stack with Global Field selected & Invalid Global Field Data', async () => {
    const globalFieldData = { title: 'Regex Fields', uid: 'regex_fields' }
    const stack = {
      name: 'stack',
      globalField: sinon.stub().returns({
        query: sinon.stub().returns({ find: sinon.stub().resolves({ items: [globalFieldData] }) }),
      }),
    }
    try {
      const startTime = Date.now()
      await processStack({ globalField: true }, stack, startTime)
      expect((ux.action.stop as sinon.SinonStub).called).to.equal(true)
      expect((ux.action.start as sinon.SinonStub).called).to.equal(true)
      expect(generateOutputStub.called).to.equal(false)
    } catch (error: any) {
      expect(error.message).to.equal(regexMessages.errors.stack.globalFields)
    }
  })
})
