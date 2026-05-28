import fs from 'fs';
import winston from 'winston';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { FileTransportInstance } from 'winston/lib/winston/transports';

import AuditFix from '../../../src/commands/cm/stacks/audit/fix';
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
      sinon.stub(winston, 'createLogger').callsFake(() => ({ log: () => {}, error: () => {} } as any));
      startSpy = sinon.stub(AuditBaseCommand.prototype, 'start').resolves(true as any);
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should trigger AuditBaseCommand start method', async () => {
      await AuditFix.prototype.run.call({ flags: {}, start: startSpy, sharedConfig: {} } as any);
      expect(startSpy.args).to.be.eql([['cm:stacks:audit:fix']]);
    });
  });
});
