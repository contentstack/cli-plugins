import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { stub } from 'sinon';
import { cliux } from '@contentstack/cli-utilities';
import BranchMergeStatusCommand from '../../../../../src/commands/cm/branches/merge-status';
import * as utils from '../../../../../src/utils';

describe('Merge Status Command', () => {
  let printStub;
  let loaderStub;
  let isAuthenticatedStub;
  let managementSDKClientStub;
  let displayMergeStatusDetailsStub;

  beforeEach(() => {
    printStub = stub(cliux, 'print');
    loaderStub = stub(cliux, 'loaderV2').returns('spinner');
    isAuthenticatedStub = stub().returns(true);
    managementSDKClientStub = stub();
    displayMergeStatusDetailsStub = stub(utils, 'displayMergeStatusDetails');
  });

  afterEach(() => {
    printStub.restore();
    loaderStub.restore();
    isAuthenticatedStub.restore();
    managementSDKClientStub.restore();
    displayMergeStatusDetailsStub.restore();
  });

  it('should have correct description', () => {
    expect(BranchMergeStatusCommand.description).to.equal('Check the status of a branch merge job');
  });

  it('should have correct usage', () => {
    expect(BranchMergeStatusCommand.usage).to.equal('cm:branches:merge-status -k <value> --merge-uid <value>');
  });

  it('should have example command', () => {
    expect(BranchMergeStatusCommand.examples.length).to.be.greaterThan(0);
    expect(BranchMergeStatusCommand.examples[0]).to.include('merge-status');
    expect(BranchMergeStatusCommand.examples[0]).to.include('merge_abc123');
  });

  it('should have required flags', () => {
    expect(BranchMergeStatusCommand.flags['stack-api-key'].required).to.be.true;
    expect(BranchMergeStatusCommand.flags['merge-uid'].required).to.be.true;
  });
});
