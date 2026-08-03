import { expect } from 'chai'
import sinon from 'sinon'
import proxyquire from 'proxyquire'
const invalidJsonOutput = require('../data/invalidRegex.json')
const invalidTableOutput = require('../data/tableData.json')
const regexMessages = require('../../messages/index.json').validateRegex

// jsonexport writes the CSV in an async callback, so let it flush before asserting fs writes.
const tick = () => new Promise((resolve) => setImmediate(resolve))

describe('Generate Output after Stack is Processed', () => {
  let fsStub: { existsSync: sinon.SinonStub; writeFileSync: sinon.SinonStub; mkdirSync: sinon.SinonStub }
  let cliuxPrint: sinon.SinonStub
  let consoleLog: sinon.SinonStub
  let generateOutput: (flags: any, invalidRegex: any, tableData: any) => Promise<void>

  beforeEach(() => {
    fsStub = { existsSync: sinon.stub(), writeFileSync: sinon.stub(), mkdirSync: sinon.stub() }
    cliuxPrint = sinon.stub()
    consoleLog = sinon.stub(console, 'log')
    generateOutput = proxyquire('../../src/utils/generate-output', {
      fs: { ...fsStub, '@noCallThru': true },
      '@contentstack/cli-utilities': {
        cliux: { print: cliuxPrint },
        sanitizePath: (path: string) => path,
        '@noCallThru': true,
      },
    }).default
  })

  afterEach(() => {
    sinon.restore()
  })

  it('Filepath Flag is not set & Invalid Regex is found', async () => {
    await generateOutput({}, invalidJsonOutput, invalidTableOutput)
    expect(consoleLog.callCount).to.equal(1)
    expect(consoleLog.calledWith(regexMessages.output.tableOutput)).to.equal(true)
  })

  it('Filepath Flag is set, Path already exists & Invalid Regex is found', async () => {
    const flags = { filePath: '/path/to/output/directory/' }
    fsStub.existsSync.returns(true)
    await generateOutput(flags, invalidJsonOutput, invalidTableOutput)
    await tick()
    expect(fsStub.existsSync.called).to.equal(true)
    expect(fsStub.writeFileSync.called).to.equal(true)
    expect(consoleLog.callCount).to.equal(1)
    expect(consoleLog.calledWith(regexMessages.output.tableOutput)).to.equal(true)
  })

  it('Filepath Flag is set, Path does not exists & Invalid Regex is found', async () => {
    const flags = { filePath: '/path/to/output/directory/' }
    fsStub.existsSync.returns(false)
    await generateOutput(flags, invalidJsonOutput, invalidTableOutput)
    await tick()
    expect(fsStub.existsSync.called).to.equal(true)
    expect(fsStub.mkdirSync.called).to.equal(true)
    expect(fsStub.writeFileSync.called).to.equal(true)
    expect(consoleLog.callCount).to.equal(1)
    expect(consoleLog.calledWith(regexMessages.output.tableOutput)).to.equal(true)
  })

  it('File is getting saved', async () => {
    await generateOutput({}, invalidJsonOutput, invalidTableOutput)
    await tick()
    expect(consoleLog.callCount).to.equal(1)
    expect(consoleLog.calledWith(regexMessages.output.tableOutput)).to.equal(true)
    expect(fsStub.writeFileSync.called).to.equal(true)
  })

  it('Invalid Regex is not found', async () => {
    await generateOutput({}, [], [])
    expect(consoleLog.callCount).to.equal(0)
  })
})
