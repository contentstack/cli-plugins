import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { TaxonomyService } from '../../../src/services/taxonomy-service';
import type { ManagementStack } from '../../../src/interfaces';

describe('TaxonomyService', () => {
  let sandbox: sinon.SinonSandbox;
  let publishStub: sinon.SinonStub;
  let unpublishStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    publishStub = sandbox.stub().resolves({ job_id: 'job_123', notice: 'notice' });
    unpublishStub = sandbox.stub().resolves({ job_id: 'job_456', notice: 'notice' });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should call taxonomy().publish with data and api version', async () => {
    const stack = {
      taxonomy: () => ({ publish: publishStub }),
    } as unknown as ManagementStack;

    const data = {
      locales: ['en-us'],
      environments: ['development'],
      items: [{ uid: 'taxonomy_uid_1' }, { uid: 'taxonomy_uid_2' }],
    };

    const service = new TaxonomyService(stack);
    const result = await service.publish(data, '3.2');

    expect(publishStub.calledOnce).to.equal(true);
    expect(publishStub.firstCall.args[0]).to.deep.equal(data);
    expect(publishStub.firstCall.args[1]).to.equal('3.2');
    expect(result.job_id).to.equal('job_123');
  });

  it('should pass branch as third argument when branch is not main', async () => {
    const stack = {
      taxonomy: () => ({ publish: publishStub }),
    } as unknown as ManagementStack;

    const data = {
      locales: ['en-us'],
      environments: ['development'],
      items: [{ uid: 'taxonomy_uid_1' }],
    };

    const service = new TaxonomyService(stack);
    await service.publish(data, '3.2', 'feature-branch');

    expect(publishStub.args[0][2]).to.deep.equal({ branch: 'feature-branch' });
  });

  it('should omit branch param for main', async () => {
    const stack = {
      taxonomy: () => ({ publish: publishStub }),
    } as unknown as ManagementStack;

    const data = {
      locales: ['en-us'],
      environments: ['development'],
      items: [{ uid: 'taxonomy_uid_1' }],
    };

    const service = new TaxonomyService(stack);
    await service.publish(data, '3.2', 'main');

    expect(publishStub.args[0].length).to.equal(2);
  });

  it('should call taxonomy().unpublish when operation is unpublish', async () => {
    const stack = {
      taxonomy: () => ({ publish: publishStub, unpublish: unpublishStub }),
    } as unknown as ManagementStack;

    const data = {
      locales: ['en-us'],
      environments: ['development'],
      items: [{ uid: 'taxonomy_uid_1' }],
    };

    const service = new TaxonomyService(stack);
    const result = await service.unpublish(data, '3.2', 'feature-branch');

    expect(unpublishStub.calledOnce).to.equal(true);
    expect(unpublishStub.firstCall.args[0]).to.deep.equal(data);
    expect(unpublishStub.firstCall.args[1]).to.equal('3.2');
    expect(unpublishStub.firstCall.args[2]).to.deep.equal({ branch: 'feature-branch' });
    expect(result.job_id).to.equal('job_456');
  });
});
