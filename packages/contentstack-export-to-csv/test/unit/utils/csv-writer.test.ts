import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { expect } from 'chai';
import sinon from 'sinon';
import * as cliUtilities from '@contentstack/cli-utilities';
import { csvParse, write } from '../../../src/utils/csv-writer';

describe('csv-writer', () => {
  describe('module exports', () => {
    it('should export write function', async () => {
      const csvWriter = await import('../../../src/utils/csv-writer');
      expect(csvWriter.write).to.be.a('function');
    });

    it('should export csvParse function', async () => {
      const csvWriter = await import('../../../src/utils/csv-writer');
      expect(csvWriter.csvParse).to.be.a('function');
    });
  });

  describe('csvParse', () => {
    it('should parse CSV data and extract headers', async () => {
      const csvData = 'name,value\ntest1,100\ntest2,200';
      const headers: string[] = [];

      const result = await csvParse(csvData, headers);

      expect(headers).to.include('name');
      expect(headers).to.include('value');
      expect(result).to.have.lengthOf(2);
      expect(result[0]).to.deep.equal(['test1', '100']);
      expect(result[1]).to.deep.equal(['test2', '200']);
    });

    it('should not duplicate existing headers', async () => {
      const csvData = 'name,value\ntest,100';
      const headers: string[] = ['name']; // pre-existing header

      await csvParse(csvData, headers);

      // Should only have 2 headers, not 3
      expect(headers).to.have.lengthOf(2);
      expect(headers.filter(h => h === 'name')).to.have.lengthOf(1);
    });

    it('should handle empty CSV', async () => {
      const csvData = '';
      const headers: string[] = [];

      const result = await csvParse(csvData, headers);

      expect(result).to.have.lengthOf(0);
      expect(headers).to.have.lengthOf(0);
    });

    it('should handle CSV with only headers', async () => {
      const csvData = 'col1,col2,col3';
      const headers: string[] = [];

      const result = await csvParse(csvData, headers);

      expect(headers).to.deep.equal(['col1', 'col2', 'col3']);
      expect(result).to.have.lengthOf(0);
    });

    it('should handle CSV with special characters', async () => {
      const csvData = 'name,description\n"Test, Inc","A ""quoted"" value"';
      const headers: string[] = [];

      const result = await csvParse(csvData, headers);

      expect(headers).to.deep.equal(['name', 'description']);
      expect(result).to.have.lengthOf(1);
    });

  });

  describe('write', () => {
    let originalCwd: string;
    let tmpRoot: string;
    let cliuxPrintStub: sinon.SinonStub;

    beforeEach(() => {
      originalCwd = process.cwd();
      tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-writer-test-'));
      process.chdir(tmpRoot);
      cliuxPrintStub = sinon.stub(cliUtilities.cliux, 'print');
    });

    afterEach(() => {
      cliuxPrintStub.restore();
      try {
        process.chdir(originalCwd);
      } catch {
        // ignore
      }
      if (tmpRoot && fs.existsSync(tmpRoot)) {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    async function waitForFile(filePath: string, maxMs = 3000): Promise<void> {
      const start = Date.now();
      while (!fs.existsSync(filePath)) {
        if (Date.now() - start > maxMs) {
          throw new Error(`Timeout waiting for ${filePath}`);
        }
        await new Promise((r) => setImmediate(r));
      }
    }

    it('should create data dir, chdir, print message, and write CSV rows', async () => {
      const rows = [{ a: '1', b: '2' }];
      const fileName = 'out-test.csv';

      write(null, rows as any, fileName, 'test rows', '|');

      expect(cliuxPrintStub.calledOnce).to.equal(true);
      expect(cliuxPrintStub.firstCall.args[0]).to.include('test rows');
      expect(cliuxPrintStub.firstCall.args[0]).to.include(fileName);

      const dataDir = path.join(tmpRoot, 'data');
      expect(fs.existsSync(dataDir)).to.equal(true);
      const written = path.join(dataDir, fileName);
      await waitForFile(written);
      const content = fs.readFileSync(written, 'utf8');
      expect(content).to.include('a');
      expect(content).to.include('|');
    });

    it('should use custom headers when provided', async () => {
      const rows = [{ x: 1 }];
      write(null, rows as any, 'headers.csv', 'with headers', ',', ['x']);

      const written = path.join(tmpRoot, 'data', 'headers.csv');
      await waitForFile(written);
    });
  });
});
