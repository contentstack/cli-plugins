import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { stub } from 'sinon';
import { cliux } from '@contentstack/cli-utilities';
import BranchGenerateScriptsCommand from '../../../../../src/commands/cm/branches/generate-scripts';
import * as utils from '../../../../../src/utils';

describe('Generate Scripts Command', () => {
  let printStub;
  let loaderStub;
  let errorStub;
  let successStub;
  let isAuthenticatedStub;
  let managementSDKClientStub;
  let getMergeStatusWithContentTypesStub;

  beforeEach(() => {
    printStub = stub(cliux, 'print');
    loaderStub = stub(cliux, 'loaderV2').returns('spinner');
    errorStub = stub(cliux, 'error');
    successStub = stub(cliux, 'success');
    isAuthenticatedStub = stub().returns(true);
    managementSDKClientStub = stub();
    getMergeStatusWithContentTypesStub = stub(utils, 'getMergeStatusWithContentTypes');
  });

  afterEach(() => {
    printStub.restore();
    loaderStub.restore();
    errorStub.restore();
    successStub.restore();
    isAuthenticatedStub.restore();
    managementSDKClientStub.restore();
    getMergeStatusWithContentTypesStub.restore();
  });

  it('should have correct description', () => {
    expect(BranchGenerateScriptsCommand.description).to.equal('Generate entry migration scripts for a completed merge job');
  });

  it('should have correct usage', () => {
    expect(BranchGenerateScriptsCommand.usage).to.equal('cm:branches:generate-scripts -k <value> --merge-uid <value>');
  });

  it('should have example command', () => {
    expect(BranchGenerateScriptsCommand.examples.length).to.be.greaterThan(0);
    expect(BranchGenerateScriptsCommand.examples[0]).to.include('generate-scripts');
    expect(BranchGenerateScriptsCommand.examples[0]).to.include('merge_abc123');
  });

  it('should have required flags', () => {
    expect(BranchGenerateScriptsCommand.flags['stack-api-key'].required).to.be.true;
    expect(BranchGenerateScriptsCommand.flags['merge-uid'].required).to.be.true;
  });
});
