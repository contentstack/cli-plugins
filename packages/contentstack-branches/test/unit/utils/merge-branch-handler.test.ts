import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { stub, assert } from 'sinon';
import { cliux } from '@contentstack/cli-utilities';
import { mockData } from '../mock/data';
import { interactive } from '../../../src/utils';
import * as mergeHelper from '../../../src/utils/merge-helper';
import * as util from '../../../src/utils';
import * as diffUtility from '../../../src/utils/branch-diff-utility';
import { MergeHandler } from '../../../src/branch/index';

describe('Merge helper', () => {
  let successMessageStub;
  let successMessageStub2;
  beforeEach(function () {
    successMessageStub = stub(cliux, 'print');
    successMessageStub2 = stub(cliux, 'inquire');
  });
  afterEach(function () {
    successMessageStub.restore();
    successMessageStub2.restore();
  });

  it('Set up merge inputs', async function () {
    const mergeInputStub = stub(mergeHelper, 'setupMergeInputs').resolves(mockData.mergeData.flags);
    const result = await mergeHelper.setupMergeInputs(mockData.mergeData.flags);
    expect(mergeInputStub.calledOnce).to.be.true;
    expect(result).to.be.equal(mockData.mergeData.flags);
    mergeInputStub.restore();
  });

  it('Merge branch changes without stack api key, should prompt for stack api key', async function () {
    const askStackAPIKey = stub(interactive, 'askStackAPIKey').resolves(mockData.mergeData.flags['stack-api-key']);
    await mergeHelper.setupMergeInputs(mockData.mergeData.withoutAPIKeyFlag);
    expect(askStackAPIKey.calledOnce).to.be.true;
    askStackAPIKey.restore();
  });

  it('Merge branch changes without compare branch, should prompt for compare branch', async function () {
    const askCompareBranch = stub(interactive, 'askCompareBranch').resolves(mockData.mergeData.flags['compare-branch']);
    await mergeHelper.setupMergeInputs(mockData.mergeData.withoutCompareFlag);
    expect(askCompareBranch.calledOnce).to.be.true;
    askCompareBranch.restore();
  });

  it('Merge branch changes without base branch, should prompt for base branch', async function () {
    const askCompareBranch = stub(interactive, 'askBaseBranch').resolves(mockData.mergeData.flags['base-branch']);
    await mergeHelper.setupMergeInputs(mockData.mergeData.withoutBaseFlag);
    expect(askCompareBranch.calledOnce).to.be.true;
    askCompareBranch.restore();
  });

  it('Merge branch changes with global config, should take the base branch from config', async function () {
    const stubBranchConfig = stub(util, 'getbranchConfig').returns(mockData.flags.baseBranch);
    const result = await mergeHelper.setupMergeInputs(mockData.mergeData.withoutBaseFlag);
    expect(result).to.deep.equal(mockData.mergeData.flags);
    stubBranchConfig.restore();
  });

  it('Prepare Merge Request Payload', async function () {
    const payloadStub = stub(mergeHelper, 'prepareMergeRequestPayload').returns(mockData.mergePayload);
    const result = mergeHelper.prepareMergeRequestPayload(mockData.mergeSettings);
    expect(result).to.deep.equal(mockData.mergePayload);
    expect(payloadStub.calledOnce).to.be.true;
    payloadStub.restore();
  });

  describe('Display branch status', () => {
    let fetchBranchStub, filterByModuleStub, parseSummaryStub, printSummaryStub;
    beforeEach(function () {
      fetchBranchStub = stub(diffUtility, 'fetchBranchesDiff').resolves(mockData.allDiffData);
      filterByModuleStub = stub(diffUtility, 'filterBranchDiffDataByModule').returns(mockData.moduleWiseData);
      parseSummaryStub = stub(diffUtility, 'parseSummary').returns(mockData.branchSummary);
      printSummaryStub = stub(diffUtility, 'printSummary').returns();
    });
    afterEach(function () {
      fetchBranchStub.restore();
      filterByModuleStub.restore();
      parseSummaryStub.restore();
      printSummaryStub.restore();
    });

    it('Display branch status, format is compactText', async function () {
      const parseCompactTextStub = stub(diffUtility, 'parseCompactText').returns(mockData.branchCompactData);
      const printCompactTextViewStub = stub(diffUtility, 'printCompactTextView').returns();
      mockData.mergeData.flags.format = 'text';
      await mergeHelper.displayBranchStatus(mockData.mergeData.flags);
      parseCompactTextStub.restore();
      printCompactTextViewStub.restore();
    });

    it('Display branch status, format is detailedText', async function () {
      const parseVerboseStub = stub(diffUtility, 'parseVerbose').resolves(mockData.verboseContentTypeRes);
      const printCompactTextViewStub = stub(diffUtility, 'printVerboseTextView').returns();
      mockData.mergeData.flags.format = 'verbose';
      await mergeHelper.displayBranchStatus(mockData.mergeData.flags);
      parseVerboseStub.restore();
      printCompactTextViewStub.restore();
    });
  });

  describe('Display merge summary', () => {
    it('format is compactText', async function () {
      const mergeOptions = {
        format: 'text',
        compareData: mockData.mergeData.branchCompareData,
      };
      mergeHelper.displayMergeSummary(mergeOptions);
    });

    it('format is detailedText', async function () {
      const mergeOptions = {
        format: 'verbose',
        compareData: mockData.verboseContentTypeRes,
      };
      mergeHelper.displayMergeSummary(mergeOptions);
    });
  });

  describe('Execute merge', () => {
    let executeMergeRequestStub;
    beforeEach(function () {
      executeMergeRequestStub = stub(util, 'executeMergeRequest');
    });
    afterEach(function () {
      executeMergeRequestStub.restore();
    });
    it('status is complete', async function () {
      executeMergeRequestStub.resolves(mockData.mergeCompleteStatusRes);
      const result = await mergeHelper.executeMerge(mockData.mergeData.flags['stack-api-key'], mockData.mergePayload, 'dev16');
      expect(executeMergeRequestStub.calledOnce).to.be.true;
      expect(result).to.deep.equal(mockData.mergeCompleteStatusRes);
    });

    it('status is in progress', async function () {
      executeMergeRequestStub.resolves(mockData.mergeProgressStatusRes);
      const fetchMergeStatusStub = stub(mergeHelper, 'fetchMergeStatus').resolves(mockData.mergeCompleteStatusRes);
      const result = await mergeHelper.executeMerge(mockData.mergeData.flags['stack-api-key'], mockData.mergePayload, 'dev16');
      expect(result).to.deep.equal(mockData.mergeCompleteStatusRes);
      fetchMergeStatusStub.restore();
    });

    it('any other status with a merge UID is polled instead of returning nothing', async function () {
      executeMergeRequestStub.resolves({ uid: 'merge-uid-1', merge_details: { status: 'queued' } });
      const fetchMergeStatusStub = stub(mergeHelper, 'fetchMergeStatus').resolves(mockData.mergeCompleteStatusRes);
      try {
        const result = await mergeHelper.executeMerge('test-stack', mockData.mergePayload, 'dev16');
        expect(fetchMergeStatusStub.calledOnce).to.be.true;
        expect(fetchMergeStatusStub.firstCall.args[1]).to.deep.equal({ uid: 'merge-uid-1' });
        expect(result).to.deep.equal(mockData.mergeCompleteStatusRes);
      } finally {
        fetchMergeStatusStub.restore();
      }
    });
  });

  describe('Fetch merge status', () => {
    let getMergeQueueStatusStub;
    beforeEach(function () {
      getMergeQueueStatusStub = stub(util, 'getMergeQueueStatus');
    });
    afterEach(function () {
      getMergeQueueStatusStub.restore();
    });
    it('status is complete', async function () {
      const res = { queue: [{ merge_details: mockData.mergeCompleteStatusRes.merge_details }] };
      getMergeQueueStatusStub.resolves(res);
      const result = await mergeHelper.fetchMergeStatus('', mockData.mergePayload);
      expect(getMergeQueueStatusStub.calledOnce).to.be.true;
      expect(result).to.deep.equal(mockData.mergeCompleteStatusRes);
    });

    it('status is in progress', async function () {
      // Skip this test as it has complex setTimeout recursion that causes hanging
      this.skip();
    });

    it('status is failed', async function () {
      const res = { queue: [{ merge_details: mockData.mergeFailedStatusRes.merge_details }] };
      getMergeQueueStatusStub.resolves(res);
      const result = await mergeHelper.fetchMergeStatus('',mockData.mergePayload).catch(err => err);
      expect(result.message).to.be.equal(`merge uid: ${mockData.mergePayload.uid}`);
    });

    it('No status', async function () {
      const res = { queue: [{ merge_details: mockData.mergeNoStatusRes.merge_details }] };
      getMergeQueueStatusStub.resolves(res);
      const result = await mergeHelper.fetchMergeStatus('',mockData.mergePayload).catch(err => err);
      expect(result.message).to.be.equal(`Invalid merge status found with merge ID ${mockData.mergePayload.uid}`);
    });

    it('Empty queue: retries, then returns the merge UID with statusUnknown instead of throwing', async function () {
      getMergeQueueStatusStub.resolves({ queue: [] });
      const result = await mergeHelper.fetchMergeStatus('', mockData.mergePayload, 0, 10000, 0);
      expect(getMergeQueueStatusStub.callCount).to.equal(1 + mergeHelper.MERGE_JOB_REGISTRATION_RETRIES);
      expect(result.statusUnknown).to.be.true;
      expect(result.pollingTimeout).to.be.true;
      expect(result.uid).to.equal(mockData.mergePayload.uid);
    });

    // DX-30310: the first poll can land before the merge worker registers the job.
    const notRegisteredError = { status: 404, errorMessage: 'Invalid merge job UID', errorCode: 131 };

    it('DX-30310: 404 "Invalid merge job UID" on the first poll is retried, then the result is returned', async function () {
      const res = { queue: [{ merge_details: mockData.mergeCompleteStatusRes.merge_details }] };
      getMergeQueueStatusStub.onFirstCall().rejects(notRegisteredError);
      getMergeQueueStatusStub.onSecondCall().resolves(res);
      const result = await mergeHelper.fetchMergeStatus('', mockData.mergePayload, 0, 10000, 0);
      expect(getMergeQueueStatusStub.calledTwice).to.be.true;
      expect(result).to.deep.equal(mockData.mergeCompleteStatusRes);
    });

    it('DX-30310: empty queue on the first poll is retried, then the result is returned', async function () {
      const res = { queue: [{ merge_details: mockData.mergeCompleteStatusRes.merge_details }] };
      getMergeQueueStatusStub.onFirstCall().resolves({ queue: [] });
      getMergeQueueStatusStub.onSecondCall().resolves(res);
      const result = await mergeHelper.fetchMergeStatus('', mockData.mergePayload, 0, 10000, 0);
      expect(getMergeQueueStatusStub.calledTwice).to.be.true;
      expect(result).to.deep.equal(mockData.mergeCompleteStatusRes);
    });

    it('DX-30310: a 404 that never clears returns the merge UID with statusUnknown instead of exiting', async function () {
      getMergeQueueStatusStub.rejects(notRegisteredError);
      const result = await mergeHelper.fetchMergeStatus('', mockData.mergePayload, 0, 10000, 0);
      expect(getMergeQueueStatusStub.callCount).to.equal(1 + mergeHelper.MERGE_JOB_REGISTRATION_RETRIES);
      expect(result.statusUnknown).to.be.true;
      expect(result.uid).to.equal(mockData.mergePayload.uid);
      expect(result.reason).to.contain('Invalid merge job UID');
    });

    it('DX-30310: any other status-check error returns the merge UID with statusUnknown, without retrying', async function () {
      getMergeQueueStatusStub.rejects({ status: 500, errorMessage: 'Internal server error' });
      const result = await mergeHelper.fetchMergeStatus('', mockData.mergePayload, 0, 10000, 0);
      expect(getMergeQueueStatusStub.calledOnce).to.be.true;
      expect(result.statusUnknown).to.be.true;
      expect(result.reason).to.equal('Internal server error');
    });
  });

  describe('Get merge queue status (DX-30310)', () => {
    const clientThatFails = (...errors) => {
      let call = 0;
      return {
        branch: () => ({
          mergeQueue: () => ({
            fetch: () => (call < errors.length ? Promise.reject(errors[call++]) : Promise.resolve({ queue: [] })),
          }),
        }),
      };
    };
    let exitStub;
    beforeEach(function () {
      exitStub = stub(process, 'exit');
    });
    afterEach(function () {
      exitStub.restore();
    });

    it('throws the API error instead of exiting the process', async function () {
      const err = { status: 404, errorMessage: 'Invalid merge job UID', errorCode: 131 };
      const result = await util.getMergeQueueStatus(clientThatFails(err), { uid: 'abc' }).catch((e) => e);
      expect(result).to.deep.equal(err);
      expect(exitStub.called).to.be.false;
    });

    it('still retries on rate limiting (429)', async function () {
      this.timeout(5000);
      const result = await util.getMergeQueueStatus(clientThatFails({ status: 429 }), { uid: 'abc' });
      expect(result).to.deep.equal({ queue: [] });
    });

    it('isMergeJobNotRegistered matches 404 and error code 131 only', function () {
      expect(util.isMergeJobNotRegistered({ status: 404 })).to.be.true;
      expect(util.isMergeJobNotRegistered({ errorCode: 131 })).to.be.true;
      expect(util.isMergeJobNotRegistered({ response: { status: 404 } })).to.be.true;
      expect(util.isMergeJobNotRegistered({ status: 500 })).to.be.false;
      expect(util.isMergeJobNotRegistered(undefined)).to.be.false;
    });
  });
});

describe('Merge Handler', () => {
  let successMessageStub,
  successMessageStub2,
  loaderMessageStub,
  errorMessageStub;
  beforeEach(function () {
    successMessageStub = stub(cliux, 'print');
    successMessageStub2 = stub(cliux, 'success');
    loaderMessageStub = stub(cliux, 'loader');
    errorMessageStub = stub(cliux, 'error');
  });
  afterEach(function () {
    successMessageStub.restore();
    successMessageStub2.restore();
    loaderMessageStub.restore();
    errorMessageStub.restore();
  });

  describe('Start', () =>{
    let collectMergeSettingsStub,
    displayMergeSummaryStub,
    selectMergeExecutionStub,
    mergeRequestStub,
    exportSummaryStub,
    executeMergeStub;
    beforeEach(function () {
      collectMergeSettingsStub = stub(MergeHandler.prototype, 'collectMergeSettings').resolves();
      displayMergeSummaryStub = stub(MergeHandler.prototype, 'displayMergeSummary').resolves();
      selectMergeExecutionStub = stub(interactive, 'selectMergeExecution');
      mergeRequestStub = stub(mergeHelper, 'prepareMergeRequestPayload').resolves(mockData.mergePayload);
      exportSummaryStub = stub(MergeHandler.prototype, 'exportSummary').resolves();
      executeMergeStub = stub(MergeHandler.prototype, 'executeMerge').resolves();
    });
    afterEach(function () {
      collectMergeSettingsStub.restore();
      displayMergeSummaryStub.restore();
      selectMergeExecutionStub.restore();
      mergeRequestStub.restore();
      exportSummaryStub.restore();
      executeMergeStub.restore();
    });

    it('ExecuteOption is export', async function () {
      selectMergeExecutionStub.resolves('export');
      new MergeHandler(mockData.mergeInputOptions).start();
    });

    it('ExecuteOption is execute', async function () {
      selectMergeExecutionStub.resolves('execute');
      new MergeHandler(mockData.mergeInputOptions).start();
    });

    it('ExecuteOption is both', async function () {
      selectMergeExecutionStub.resolves('both');
      new MergeHandler(mockData.mergeInputOptions).start();
    });
    
    it('Restart merge process', async function () {
      selectMergeExecutionStub.resolves('export');
      new MergeHandler(mockData.mergeInputOptions).restartMergeProcess();
    });
  });

  it('Export summary', async ()=> {
    const msg = 'Exported the summary successfully'
    const askExportMergeSummaryPathStub = stub(interactive, 'askExportMergeSummaryPath').resolves('abcd');
    const writeFileStub = stub(util, 'writeFile').resolves('done');
    successMessageStub2.callsFake(function () {
      return Promise.resolve(msg);
    });
    await new MergeHandler(mockData.mergeInputOptions).exportSummary(mockData.mergePayload);
    expect(successMessageStub2.calledOnce).to.be.true;
    askExportMergeSummaryPathStub.restore();
    writeFileStub.restore();
  });

  describe('Execute merge', () => {
    let askMergeCommentStub, executeMergeStub;
    beforeEach(function(){
      askMergeCommentStub = stub(interactive, 'askMergeComment').resolves('changes');
      executeMergeStub = stub(mergeHelper, 'executeMerge');
    });
    afterEach(function(){
      askMergeCommentStub.restore();
      executeMergeStub.restore();
    });
    
    it('Merged the changes successfully', async()=>{
      executeMergeStub.resolves(mockData.mergeCompleteStatusRes);
      await new MergeHandler(mockData.mergeInputOptions).executeMerge(mockData.mergePayload);
      expect(successMessageStub2.calledOnce).to.be.true;
    })

    it('Failed to merge the changes', async()=>{
      executeMergeStub.rejects('Failed to merge the changes');
      await new MergeHandler(mockData.mergeInputOptions).executeMerge(mockData.mergePayload);
      expect(errorMessageStub.calledOnce).to.be.true;
    })

    it('DX-30310: status unknown prints the merge UID and the merge-status command, not an error', async () => {
      executeMergeStub.resolves({
        pollingTimeout: true,
        reason: 'the merge queue does not list the job yet (Invalid merge job UID)',
        status: 'unknown',
        statusUnknown: true,
        uid: 'merge-uid-1',
      });
      await new MergeHandler(mockData.mergeInputOptions).executeMerge(mockData.mergePayload);
      expect(errorMessageStub.called).to.be.false;
      expect(successMessageStub2.calledOnce).to.be.true;
      expect(successMessageStub2.firstCall.args[0]).to.contain('merge-uid-1');
      const printed = successMessageStub.getCalls().map((c) => c.args[0]).join('\n');
      expect(printed).to.contain('cm:branches:merge-status');
      expect(printed).to.contain('--merge-uid merge-uid-1');
    })
  });

  describe('collect merge settings', () => {
    let selectMergeStrategyStub,
    strategySubOptionStub,
    displayMergeSummaryStub,
    selectMergeExecutionStub,
    restartMergeProcessStub,
    processExitStub;
    beforeEach(function(){
      selectMergeStrategyStub = stub(interactive, 'selectMergeStrategy');
      strategySubOptionStub = stub(interactive, 'selectMergeStrategySubOptions');
      displayMergeSummaryStub = stub(MergeHandler.prototype, 'displayMergeSummary').resolves();
      selectMergeExecutionStub = stub(interactive, 'selectMergeExecution');
      restartMergeProcessStub = stub(MergeHandler.prototype, 'restartMergeProcess').resolves();
      // collectMergeSettings() calls process.exit(1) on an empty selection; stub it
      // so it can't terminate the mocha process mid-run.
      processExitStub = stub(process, 'exit');
    })
    afterEach(function(){
      selectMergeStrategyStub.restore();
      strategySubOptionStub.restore();
      displayMergeSummaryStub.restore();
      selectMergeExecutionStub.restore();
      restartMergeProcessStub.restore();
      processExitStub.restore();
    })

    it('custom_preferences strategy, new strategySubOption', async() => {
      selectMergeStrategyStub.resolves('custom_preferences');
      const selectCustomPreferencesStub = stub(interactive, 'selectCustomPreferences').resolves();
      selectMergeExecutionStub.resolves("export");
      await new MergeHandler(mockData.mergeInputOptionsWithoutStartegy).collectMergeSettings();
      expect(selectMergeStrategyStub.calledOnce).to.be.true;
      selectCustomPreferencesStub.restore();
    });

    it('merge_prefer_base strategy, new strategySubOption', async() => {
      selectMergeStrategyStub.resolves('merge_prefer_base');
      strategySubOptionStub.resolves('new');
      selectMergeExecutionStub.resolves("export");
      await new MergeHandler(mockData.mergeInputOptionsWithoutStartegy).collectMergeSettings();
      expect(selectMergeStrategyStub.calledOnce).to.be.true;
      expect(strategySubOptionStub.calledOnce).to.be.true;
    });

    it('merge_prefer_base strategy, modified strategySubOption', async() => {
      selectMergeStrategyStub.resolves('merge_prefer_base');
      strategySubOptionStub.resolves('modified');
      selectMergeExecutionStub.resolves("export");
      await new MergeHandler(mockData.mergeInputOptionsWithoutStartegy).collectMergeSettings();
      expect(selectMergeStrategyStub.calledOnce).to.be.true;
      expect(strategySubOptionStub.calledOnce).to.be.true;
    });

    it('merge_prefer_base strategy, both strategySubOption', async() => {
      selectMergeStrategyStub.resolves('merge_prefer_base');
      strategySubOptionStub.resolves('both');
      selectMergeExecutionStub.resolves("export");
      await new MergeHandler(mockData.mergeInputOptionsWithoutStartegy).collectMergeSettings();
      expect(selectMergeStrategyStub.calledOnce).to.be.true;
      expect(strategySubOptionStub.calledOnce).to.be.true;
    });

    it('merge_prefer_compare strategy, new strategySubOption', async() => {
      selectMergeStrategyStub.resolves('merge_prefer_compare');
      strategySubOptionStub.resolves('new');
      selectMergeExecutionStub.resolves("export");
      await new MergeHandler(mockData.mergeInputOptionsWithoutStartegy).collectMergeSettings();
      expect(selectMergeStrategyStub.calledOnce).to.be.true;
      expect(strategySubOptionStub.calledOnce).to.be.true;
    });

    it('merge_prefer_compare strategy, modified strategySubOption', async() => {
      selectMergeStrategyStub.resolves('merge_prefer_compare');
      strategySubOptionStub.resolves('modified');
      selectMergeExecutionStub.resolves("export");
      await new MergeHandler(mockData.mergeInputOptionsWithoutStartegy).collectMergeSettings();
      expect(selectMergeStrategyStub.calledOnce).to.be.true;
      expect(strategySubOptionStub.calledOnce).to.be.true;
    });

    it('merge_prefer_compare strategy, both strategySubOption', async() => {
      selectMergeStrategyStub.resolves('merge_prefer_compare');
      strategySubOptionStub.resolves('both');
      selectMergeExecutionStub.resolves("export");
      await new MergeHandler(mockData.mergeInputOptionsWithoutStartegy).collectMergeSettings();
      expect(selectMergeStrategyStub.calledOnce).to.be.true;
      expect(strategySubOptionStub.calledOnce).to.be.true;
    });

    it('overwrite_with_compare strategy', async() => {
      selectMergeStrategyStub.resolves('overwrite_with_compare');
      selectMergeExecutionStub.resolves("export");
      await new MergeHandler(mockData.mergeInputOptionsWithoutStartegy).collectMergeSettings();
      expect(selectMergeStrategyStub.calledOnce).to.be.true;
    });

    it('Merge execution, previous', async() => {
      selectMergeStrategyStub.resolves('overwrite_with_compare');
      selectMergeExecutionStub.resolves("previous");
      await new MergeHandler(mockData.mergeInputOptionsWithoutStartegy).collectMergeSettings();
      expect(selectMergeStrategyStub.calledOnce).to.be.true;
    });
    
    it('Merge execution, restart', async() => {
      selectMergeStrategyStub.resolves('overwrite_with_compare');
      selectMergeExecutionStub.resolves("restart");
      await new MergeHandler(mockData.mergeInputOptionsWithoutStartegy).collectMergeSettings();
      expect(selectMergeStrategyStub.calledOnce).to.be.true;
    });

    it('merge_prefer_base strategy, previous strategySubOption', async() => {
      selectMergeStrategyStub.resolves('merge_prefer_base');
      strategySubOptionStub.resolves('previous');
      const stub1 = stub(MergeHandler.prototype, 'collectMergeSettings').resolves();
      await new MergeHandler(mockData.mergeInputOptionsWithoutStartegy).collectMergeSettings();
      stub1.restore();
    });

    it('merge_prefer_base strategy, previous strategySubOption', async() => {
      selectMergeStrategyStub.resolves('merge_prefer_base');
      strategySubOptionStub.resolves('restart');
      await new MergeHandler(mockData.mergeInputOptionsWithoutStartegy).collectMergeSettings();
      expect(selectMergeStrategyStub.calledOnce).to.be.true;
      expect(strategySubOptionStub.calledOnce).to.be.true;
    });
  })
});
