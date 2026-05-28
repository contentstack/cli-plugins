import fs from 'fs';
import winston from 'winston';
import { expect } from 'chai';
import { runCommand } from '@oclif/test';
import * as sinon from 'sinon';
import { FileTransportInstance } from 'winston/lib/winston/transports';

import { AuditBaseCommand } from '../../../src/audit-base-command';

describe('AuditFix command', () => {
  const fsTransport = class FsTransport {
    filename!: string;
  } as FileTransportInstance;

  describe('AuditFix run method', () => {
    let startSpy: sinon.SinonStub;

    beforeEach(() => {
      sinon.stub(fs, 'rmSync').callsFake(() => {});
      sinon.stub(winston.transports, 'File').callsFake(() => fsTransport);
      sinon.stub(winston, 'createLogger').callsFake(() => ({ log: () => {}, error: () => {} }));
      startSpy = sinon.stub(AuditBaseCommand.prototype, 'start').callsFake(() => {
        return Promise.resolve(true);
      });
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should trigger AuditBaseCommand start method', async () => {
      await runCommand(['cm:stacks:audit:fix', '-d', 'data-dir'], { root: process.cwd() });
      expect(startSpy.args).to.be.eql([['cm:stacks:audit']]);
    });
  });
});
