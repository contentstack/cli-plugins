import { describe, it } from 'mocha';
import { expect } from 'chai';
import BranchMergeStatusCommand from '../../../../../src/commands/cm/branches/merge-status';

describe('Merge Status Command', () => {
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
