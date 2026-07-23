import { ux } from '@contentstack/cli-utilities'
import { expect } from 'chai'
import sinon from 'sinon'
import proxyquire from 'proxyquire'

describe('Get Client from Management SDK, connect with Stack & process Stack', () => {
  let processStackStub: sinon.SinonStub
  let clientStub: sinon.SinonStub
  let connectStack: (flags: any, host: string, tokenDetails: any) => Promise<void>

  beforeEach(() => {
    sinon.stub(ux.action, 'start')
    sinon.stub(ux.action, 'stop')
    processStackStub = sinon.stub().resolves()
    clientStub = sinon.stub()
    connectStack = proxyquire('../../src/utils/connect-stack', {
      '@contentstack/management': { client: clientStub, '@noCallThru': true },
      './process-stack': { default: processStackStub, __esModule: true, '@noCallThru': true },
    }).default
  })

  afterEach(() => {
    sinon.restore()
  })

  it('Token details are Valid', async () => {
    const host = 'api-contentstack.io'
    const tokenDetails = { apiKey: 'blt1234', token: 'blt1234' }
    const flags = { contentType: true, globalField: true }

    const mockStack = sinon.stub().resolves({ stack: {} })
    clientStub.returns({ stack: mockStack })

    await connectStack(flags, host, tokenDetails)
    expect((ux.action.start as sinon.SinonStub).called).to.equal(true)
    expect(processStackStub.called).to.equal(true)
  })

  it('Token details is Invalid', async () => {
    const host = 'api-contentstack.io'
    const tokenDetails = { apiKey: 'blt1234', token: 'blt1234' }
    const flags = { contentType: true, globalField: true }

    const mockStack = sinon.stub().throws(new Error('Invalid stack API Key provided.'))
    clientStub.returns({ stack: mockStack })

    let error: any
    try {
      await connectStack(flags, host, tokenDetails)
    } catch (err) {
      error = err
    }
    expect(error).to.be.an('error')
    expect((ux.action.start as sinon.SinonStub).called).to.equal(true)
  })
})
