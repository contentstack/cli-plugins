import sinon from 'sinon';
import { expect } from 'chai';
import * as path from 'path';
import {
  getLogFolderPath,
  getLogPaths,
  ensureLogFolder,
  readSuccessLog,
  readFailedLog,
  readBulkSuccessLog,
  readBulkFailedLog,
  readSingleSuccessLog,
  readSingleFailedLog,
  writeBulkSuccessLog,
  writeBulkFailedLog,
  writeSingleSuccessLog,
  writeSingleFailedLog,
  clearLogs,
} from '../../../src/utils/bulk-operation-log-handler';
import { BulkModeLogEntry, SingleModeLogEntry } from '../../../src/interfaces';

describe('Bulk Operation Log Handler', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(process, 'cwd').returns('/home/user/project');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getLogFolderPath', () => {
    it('should return default folder path when no argument provided', () => {
      const result = getLogFolderPath();
      expect(result).to.equal('/home/user/project/bulk-operation');
    });

    it('should return absolute path when provided', () => {
      const absolutePath = '/var/logs/bulk-ops';
      const result = getLogFolderPath(absolutePath);
      expect(result).to.equal(absolutePath);
    });

    it('should convert relative path to absolute', () => {
      const relativePath = 'logs/bulk';
      const result = getLogFolderPath(relativePath);
      expect(result).to.equal('/home/user/project/logs/bulk');
    });

    it('should handle empty string as folder path', () => {
      // Empty string is falsy, so it uses default folder
      const result = getLogFolderPath('');
      expect(result).to.equal('/home/user/project/bulk-operation');
    });

    it('should handle folder path with trailing slash', () => {
      const result = getLogFolderPath('logs/bulk/');
      expect(result).to.equal('/home/user/project/logs/bulk/');
    });
  });

  describe('getLogPaths', () => {
    it('should return log paths with default folder', () => {
      const result = getLogPaths();

      expect(result).to.deep.equal({
        folder: '/home/user/project/bulk-operation',
        bulkSuccess: '/home/user/project/bulk-operation/bulk-success.json',
        bulkFailed: '/home/user/project/bulk-operation/bulk-failed.json',
        singleSuccess: '/home/user/project/bulk-operation/single-success.json',
        singleFailed: '/home/user/project/bulk-operation/single-failed.json',
      });
    });

    it('should return log paths with custom folder', () => {
      const customFolder = 'custom-logs';
      const result = getLogPaths(customFolder);

      expect(result).to.deep.equal({
        folder: '/home/user/project/custom-logs',
        bulkSuccess: '/home/user/project/custom-logs/bulk-success.json',
        bulkFailed: '/home/user/project/custom-logs/bulk-failed.json',
        singleSuccess: '/home/user/project/custom-logs/single-success.json',
        singleFailed: '/home/user/project/custom-logs/single-failed.json',
      });
    });

    it('should return log paths with absolute custom folder', () => {
      const absoluteFolder = '/var/app/logs';
      const result = getLogPaths(absoluteFolder);

      expect(result).to.deep.equal({
        folder: absoluteFolder,
        bulkSuccess: path.join(absoluteFolder, 'bulk-success.json'),
        bulkFailed: path.join(absoluteFolder, 'bulk-failed.json'),
        singleSuccess: path.join(absoluteFolder, 'single-success.json'),
        singleFailed: path.join(absoluteFolder, 'single-failed.json'),
      });
    });

    it('should handle nested folder paths', () => {
      const nestedFolder = 'logs/operations/bulk';
      const result = getLogPaths(nestedFolder);

      expect(result.folder).to.equal('/home/user/project/logs/operations/bulk');
      expect(result.bulkSuccess).to.include('logs/operations/bulk/bulk-success.json');
      expect(result.bulkFailed).to.include('logs/operations/bulk/bulk-failed.json');
    });
  });

  describe('ensureLogFolder', () => {
    let mkdirStub: sinon.SinonStub;
    let existsStub: sinon.SinonStub;

    beforeEach(() => {
      const fs = require('fs');
      mkdirStub = sandbox.stub(fs, 'mkdirSync');
      existsStub = sandbox.stub(fs, 'existsSync').returns(false);
    });

    it('should return correct path and handle folder creation', () => {
      const result = ensureLogFolder();
      expect(result).to.equal('/home/user/project/bulk-operation');
      expect(mkdirStub.calledOnce).to.be.true;
    });

    it('should handle custom folder path', () => {
      const customFolder = 'my-logs';
      const result = ensureLogFolder(customFolder);
      expect(result).to.equal('/home/user/project/my-logs');
    });

    it('should handle nested folder paths', () => {
      const nestedFolder = 'logs/operations/bulk';
      const result = ensureLogFolder(nestedFolder);
      expect(result).to.equal('/home/user/project/logs/operations/bulk');
    });

    it('should handle absolute paths', () => {
      const absolutePath = '/var/logs';
      const result = ensureLogFolder(absolutePath);
      expect(result).to.equal(absolutePath);
    });

    it('should not create folder if it already exists', () => {
      existsStub.returns(true);
      mkdirStub.resetHistory();

      const result = ensureLogFolder();

      expect(result).to.equal('/home/user/project/bulk-operation');
      expect(mkdirStub.called).to.be.false;
    });
  });

  describe('readBulkSuccessLog', () => {
    let existsSyncStub: sinon.SinonStub;
    let readFileSyncStub: sinon.SinonStub;
    let consoleErrorStub: sinon.SinonStub;

    beforeEach(() => {
      const fs = require('fs');
      existsSyncStub = sandbox.stub(fs, 'existsSync');
      readFileSyncStub = sandbox.stub(fs, 'readFileSync');
      consoleErrorStub = sandbox.stub(console, 'error');
    });

    it('should return empty array if bulk success log file does not exist', () => {
      existsSyncStub.returns(false);

      const result = readBulkSuccessLog();

      expect(result).to.deep.equal([]);
    });

    it('should return empty array and log error if JSON parsing fails', () => {
      existsSyncStub.returns(true);
      readFileSyncStub.returns('invalid json');

      const result = readBulkSuccessLog();

      expect(result).to.deep.equal([]);
      expect(consoleErrorStub.called).to.be.true;
    });

    it('should return parsed entries when valid JSON exists', () => {
      const mockEntries = [
        {
          mode: 'bulk',
          jobId: 'job-1',
          batchNumber: 1,
          operation: 'publish',
          timestamp: '2024-01-09T10:00:00Z',
          environments: ['prod'],
          locales: ['en-us'],
          items: [{ uid: 'entry1' }],
          status: 'success',
          apiKey: 'test-key',
          branch: 'main',
        },
      ];

      existsSyncStub.returns(true);
      readFileSyncStub.returns(JSON.stringify(mockEntries));

      const result = readBulkSuccessLog();

      expect(result).to.deep.equal(mockEntries);
    });
  });

  describe('readBulkFailedLog', () => {
    let existsSyncStub: sinon.SinonStub;
    let readFileSyncStub: sinon.SinonStub;
    let consoleErrorStub: sinon.SinonStub;

    beforeEach(() => {
      const fs = require('fs');
      existsSyncStub = sandbox.stub(fs, 'existsSync');
      readFileSyncStub = sandbox.stub(fs, 'readFileSync');
      consoleErrorStub = sandbox.stub(console, 'error');
    });

    it('should return empty array if bulk failed log file does not exist', () => {
      existsSyncStub.returns(false);

      const result = readBulkFailedLog();

      expect(result).to.deep.equal([]);
    });

    it('should return empty array and log error if JSON parsing fails', () => {
      existsSyncStub.returns(true);
      readFileSyncStub.returns('not valid json');

      const result = readBulkFailedLog();

      expect(result).to.deep.equal([]);
      expect(consoleErrorStub.called).to.be.true;
    });

    it('should return parsed entries when valid JSON exists', () => {
      const mockEntries = [
        {
          mode: 'bulk',
          jobId: 'job-1',
          batchNumber: 1,
          operation: 'publish',
          timestamp: '2024-01-09T10:00:00Z',
          environments: ['prod'],
          locales: ['en-us'],
          items: [{ uid: 'entry1' }],
          status: 'failed',
          error: 'Network error',
          apiKey: 'test-key',
          branch: 'main',
        },
      ];

      existsSyncStub.returns(true);
      readFileSyncStub.returns(JSON.stringify(mockEntries));

      const result = readBulkFailedLog();

      expect(result).to.deep.equal(mockEntries);
    });
  });

  describe('readSuccessLog (combined)', () => {
    let existsSyncStub: sinon.SinonStub;
    let readFileSyncStub: sinon.SinonStub;

    beforeEach(() => {
      const fs = require('fs');
      existsSyncStub = sandbox.stub(fs, 'existsSync');
      readFileSyncStub = sandbox.stub(fs, 'readFileSync');
    });

    it('should return empty array when no log files exist', () => {
      existsSyncStub.returns(false);

      const result = readSuccessLog();

      expect(result).to.deep.equal([]);
    });

    it('should combine bulk and single success logs', () => {
      const bulkLog = [{ mode: 'bulk', jobId: 'job-1' }];
      const singleLog = [{ mode: 'single', uid: 'entry1' }];

      existsSyncStub.callsFake((path: string) => {
        return path.includes('bulk-success') || path.includes('single-success');
      });

      readFileSyncStub.callsFake((path: string) => {
        if (path.includes('bulk-success')) return JSON.stringify(bulkLog);
        if (path.includes('single-success')) return JSON.stringify(singleLog);
        return '[]';
      });

      const result = readSuccessLog();

      expect(result).to.have.length(2);
    });
  });

  describe('readFailedLog (combined)', () => {
    let existsSyncStub: sinon.SinonStub;

    beforeEach(() => {
      const fs = require('fs');
      existsSyncStub = sandbox.stub(fs, 'existsSync');
      sandbox.stub(fs, 'readFileSync');
    });

    it('should return empty array when no log files exist', () => {
      existsSyncStub.returns(false);

      const result = readFailedLog();

      expect(result).to.deep.equal([]);
    });
  });

  describe('readSingleSuccessLog', () => {
    let existsSyncStub: sinon.SinonStub;
    let readFileSyncStub: sinon.SinonStub;
    let consoleErrorStub: sinon.SinonStub;

    beforeEach(() => {
      const fs = require('fs');
      existsSyncStub = sandbox.stub(fs, 'existsSync');
      readFileSyncStub = sandbox.stub(fs, 'readFileSync');
      consoleErrorStub = sandbox.stub(console, 'error');
    });

    it('should return empty array if file does not exist', () => {
      existsSyncStub.returns(false);
      const result = readSingleSuccessLog();
      expect(result).to.deep.equal([]);
    });

    it('should return parsed entries when valid JSON exists', () => {
      const mockEntries: SingleModeLogEntry[] = [
        {
          mode: 'single',
          operation: 'publish',
          timestamp: '2024-01-09T10:00:00Z',
          item: { uid: 'entry1', type: 'entry', locale: 'en-us' },
          environments: ['prod'],
          status: 'success',
          apiKey: 'test-key',
          branch: 'main',
        },
      ];

      existsSyncStub.returns(true);
      readFileSyncStub.returns(JSON.stringify(mockEntries));

      const result = readSingleSuccessLog();
      expect(result).to.deep.equal(mockEntries);
    });

    it('should return empty array on parse error', () => {
      existsSyncStub.returns(true);
      readFileSyncStub.returns('invalid json');

      const result = readSingleSuccessLog();
      expect(result).to.deep.equal([]);
      expect(consoleErrorStub.called).to.be.true;
    });
  });

  describe('readSingleFailedLog', () => {
    let existsSyncStub: sinon.SinonStub;
    let readFileSyncStub: sinon.SinonStub;

    beforeEach(() => {
      const fs = require('fs');
      existsSyncStub = sandbox.stub(fs, 'existsSync');
      readFileSyncStub = sandbox.stub(fs, 'readFileSync');
      sandbox.stub(console, 'error');
    });

    it('should return empty array if file does not exist', () => {
      existsSyncStub.returns(false);
      const result = readSingleFailedLog();
      expect(result).to.deep.equal([]);
    });

    it('should return parsed entries when valid JSON exists', () => {
      const mockEntries: SingleModeLogEntry[] = [
        {
          mode: 'single',
          operation: 'publish',
          timestamp: '2024-01-09T10:00:00Z',
          item: { uid: 'entry1', type: 'entry', locale: 'en-us' },
          environments: ['prod'],
          status: 'failed',
          error: 'Network error',
          apiKey: 'test-key',
          branch: 'main',
        },
      ];

      existsSyncStub.returns(true);
      readFileSyncStub.returns(JSON.stringify(mockEntries));

      const result = readSingleFailedLog();
      expect(result).to.deep.equal(mockEntries);
    });
  });

  describe('writeBulkSuccessLog', () => {
    let existsSyncStub: sinon.SinonStub;
    let readFileSyncStub: sinon.SinonStub;
    let writeFileSyncStub: sinon.SinonStub;
    let mkdirSyncStub: sinon.SinonStub;
    let consoleErrorStub: sinon.SinonStub;

    beforeEach(() => {
      const fs = require('fs');
      existsSyncStub = sandbox.stub(fs, 'existsSync');
      readFileSyncStub = sandbox.stub(fs, 'readFileSync');
      writeFileSyncStub = sandbox.stub(fs, 'writeFileSync');
      mkdirSyncStub = sandbox.stub(fs, 'mkdirSync');
      consoleErrorStub = sandbox.stub(console, 'error');
    });

    it('should create folder and write new log file', () => {
      existsSyncStub.returns(false);

      const entry: BulkModeLogEntry = {
        mode: 'bulk',
        jobId: 'job-1',
        batchNumber: 1,
        operation: 'publish',
        timestamp: '2024-01-09T10:00:00Z',
        environments: ['prod'],
        locales: ['en-us'],
        items: [{ uid: 'entry1', type: 'entry', locale: 'en-us' }],
        status: 'success',
        apiKey: 'test-key',
        branch: 'main',
      };

      writeBulkSuccessLog(entry, './test-logs');

      expect(mkdirSyncStub.called).to.be.true;
      expect(writeFileSyncStub.called).to.be.true;
    });

    it('should append to existing log file', () => {
      const existingLogs = [{ mode: 'bulk', jobId: 'old-job' }];
      existsSyncStub.callsFake((p: string) => p.includes('bulk-success.json'));
      readFileSyncStub.returns(JSON.stringify(existingLogs));

      const entry: BulkModeLogEntry = {
        mode: 'bulk',
        jobId: 'job-2',
        batchNumber: 2,
        operation: 'publish',
        timestamp: '2024-01-09T10:00:00Z',
        environments: ['prod'],
        locales: ['en-us'],
        items: [],
        status: 'success',
        apiKey: 'test-key',
        branch: 'main',
      };

      writeBulkSuccessLog(entry, './test-logs');

      const writtenData = JSON.parse(writeFileSyncStub.firstCall.args[1]);
      expect(writtenData).to.have.length(2);
      expect(writtenData[1].jobId).to.equal('job-2');
    });

    it('should handle write errors gracefully', () => {
      existsSyncStub.returns(false);
      writeFileSyncStub.throws(new Error('Write error'));

      const entry: BulkModeLogEntry = {
        mode: 'bulk',
        jobId: 'job-1',
        batchNumber: 1,
        operation: 'publish',
        timestamp: '2024-01-09T10:00:00Z',
        environments: [],
        locales: [],
        items: [],
        status: 'success',
        apiKey: 'test-key',
        branch: 'main',
      };

      // Should not throw
      writeBulkSuccessLog(entry);
      expect(consoleErrorStub.called).to.be.true;
    });
  });

  describe('writeBulkFailedLog', () => {
    let existsSyncStub: sinon.SinonStub;
    let writeFileSyncStub: sinon.SinonStub;

    beforeEach(() => {
      const fs = require('fs');
      existsSyncStub = sandbox.stub(fs, 'existsSync');
      sandbox.stub(fs, 'readFileSync');
      writeFileSyncStub = sandbox.stub(fs, 'writeFileSync');
      sandbox.stub(fs, 'mkdirSync');
    });

    it('should write failed log entry', () => {
      existsSyncStub.returns(false);

      const entry: BulkModeLogEntry = {
        mode: 'bulk',
        jobId: 'job-1',
        batchNumber: 1,
        operation: 'publish',
        timestamp: '2024-01-09T10:00:00Z',
        environments: ['prod'],
        locales: ['en-us'],
        items: [],
        status: 'failed',
        error: 'API Error',
        apiKey: 'test-key',
        branch: 'main',
      };

      writeBulkFailedLog(entry);

      expect(writeFileSyncStub.called).to.be.true;
      const writePath = writeFileSyncStub.firstCall.args[0];
      expect(writePath).to.include('bulk-failed.json');
    });
  });

  describe('writeSingleSuccessLog', () => {
    let existsSyncStub: sinon.SinonStub;
    let readFileSyncStub: sinon.SinonStub;
    let writeFileSyncStub: sinon.SinonStub;

    beforeEach(() => {
      const fs = require('fs');
      existsSyncStub = sandbox.stub(fs, 'existsSync');
      readFileSyncStub = sandbox.stub(fs, 'readFileSync');
      writeFileSyncStub = sandbox.stub(fs, 'writeFileSync');
      sandbox.stub(fs, 'mkdirSync');
    });

    it('should write single success log entry', () => {
      existsSyncStub.returns(false);

      const entry: SingleModeLogEntry = {
        mode: 'single',
        operation: 'publish',
        timestamp: '2024-01-09T10:00:00Z',
        item: { uid: 'entry1', type: 'entry', locale: 'en-us' },
        environments: ['prod'],
        status: 'success',
        apiKey: 'test-key',
        branch: 'main',
      };

      writeSingleSuccessLog(entry);

      expect(writeFileSyncStub.called).to.be.true;
      const writePath = writeFileSyncStub.firstCall.args[0];
      expect(writePath).to.include('single-success.json');
    });

    it('should append to existing single success log', () => {
      const existingLogs = [{ mode: 'single', item: { uid: 'old-entry' } }];
      existsSyncStub.callsFake((p: string) => p.includes('single-success.json'));
      readFileSyncStub.returns(JSON.stringify(existingLogs));

      const entry: SingleModeLogEntry = {
        mode: 'single',
        operation: 'publish',
        timestamp: '2024-01-09T10:00:00Z',
        item: { uid: 'new-entry', type: 'entry', locale: 'en-us' },
        environments: ['prod'],
        status: 'success',
        apiKey: 'test-key',
        branch: 'main',
      };

      writeSingleSuccessLog(entry);

      const writtenData = JSON.parse(writeFileSyncStub.firstCall.args[1]);
      expect(writtenData).to.have.length(2);
    });
  });

  describe('writeSingleFailedLog', () => {
    let existsSyncStub: sinon.SinonStub;
    let writeFileSyncStub: sinon.SinonStub;
    let consoleErrorStub: sinon.SinonStub;

    beforeEach(() => {
      const fs = require('fs');
      existsSyncStub = sandbox.stub(fs, 'existsSync');
      sandbox.stub(fs, 'readFileSync');
      writeFileSyncStub = sandbox.stub(fs, 'writeFileSync');
      sandbox.stub(fs, 'mkdirSync');
      consoleErrorStub = sandbox.stub(console, 'error');
    });

    it('should write single failed log entry', () => {
      existsSyncStub.returns(false);

      const entry: SingleModeLogEntry = {
        mode: 'single',
        operation: 'publish',
        timestamp: '2024-01-09T10:00:00Z',
        item: { uid: 'entry1', type: 'entry', locale: 'en-us' },
        environments: ['prod'],
        status: 'failed',
        error: 'Publish failed',
        apiKey: 'test-key',
        branch: 'main',
      };

      writeSingleFailedLog(entry);

      expect(writeFileSyncStub.called).to.be.true;
      const writePath = writeFileSyncStub.firstCall.args[0];
      expect(writePath).to.include('single-failed.json');
    });

    it('should handle write errors gracefully', () => {
      existsSyncStub.returns(false);
      writeFileSyncStub.throws(new Error('Write error'));

      const entry: SingleModeLogEntry = {
        mode: 'single',
        operation: 'publish',
        timestamp: '2024-01-09T10:00:00Z',
        item: { uid: 'entry1', type: 'entry', locale: 'en-us' },
        environments: [],
        status: 'failed',
        apiKey: 'test-key',
        branch: 'main',
      };

      // Should not throw
      writeSingleFailedLog(entry);
      expect(consoleErrorStub.called).to.be.true;
    });
  });

  describe('clearLogs', () => {
    let existsSyncStub: sinon.SinonStub;
    let writeFileSyncStub: sinon.SinonStub;
    let mkdirSyncStub: sinon.SinonStub;
    let consoleErrorStub: sinon.SinonStub;

    beforeEach(() => {
      const fs = require('fs');
      existsSyncStub = sandbox.stub(fs, 'existsSync');
      writeFileSyncStub = sandbox.stub(fs, 'writeFileSync');
      mkdirSyncStub = sandbox.stub(fs, 'mkdirSync');
      consoleErrorStub = sandbox.stub(console, 'error');
    });

    it('should clear all log files by writing empty arrays', () => {
      existsSyncStub.returns(false);

      clearLogs('./test-logs');

      // Should write 4 files (bulk-success, bulk-failed, single-success, single-failed)
      expect(writeFileSyncStub.callCount).to.equal(4);

      // Each file should be written with empty array
      writeFileSyncStub.getCalls().forEach((call) => {
        expect(call.args[1]).to.equal('[]');
      });
    });

    it('should use default folder path when none provided', () => {
      existsSyncStub.returns(false);

      clearLogs();

      expect(mkdirSyncStub.called).to.be.true;
      expect(writeFileSyncStub.callCount).to.equal(4);
    });

    it('should handle write errors gracefully', () => {
      existsSyncStub.returns(false);
      writeFileSyncStub.throws(new Error('Write error'));

      // Should not throw
      clearLogs('./test-logs');
      expect(consoleErrorStub.called).to.be.true;
    });
  });
});
