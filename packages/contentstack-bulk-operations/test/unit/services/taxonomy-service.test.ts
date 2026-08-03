import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { TaxonomyService } from '../../../src/services/taxonomy-service';
import type { ManagementStack } from '../../../src/interfaces';

describe('TaxonomyService', () => {
  let sandbox: sinon.SinonSandbox;
  let publishStub: sinon.SinonStub;
  let unpublishStub: sinon.SinonStub;
  let addHeaderStub: sinon.SinonStub;
  let taxonomyInstance: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    publishStub = sandbox.stub().resolves({ job_id: 'job_123', notice: 'notice' });
    unpublishStub = sandbox.stub().resolves({ job_id: 'job_456', notice: 'notice' });
    taxonomyInstance = {
      addHeader: sandbox.stub().returnsThis(),
      publish: publishStub,
      unpublish: unpublishStub,
    };
    addHeaderStub = taxonomyInstance.addHeader;
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should inject api_version 3.2 header via addHeader before publish', async () => {
    const stack = { taxonomy: () => taxonomyInstance } as unknown as ManagementStack;
    const data = {
      locales: ['en-us'],
      environments: ['development'],
      items: [{ uid: 'taxonomy_uid_1' }, { uid: 'taxonomy_uid_2' }],
    };

    const service = new TaxonomyService(stack);
    const result = await service.publish(data);

    expect(addHeaderStub.calledWith('api_version', '3.2')).to.be.true;
    expect(publishStub.calledOnce).to.be.true;
    expect(publishStub.firstCall.args[0]).to.deep.equal(data);
    expect(result.job_id).to.equal('job_123');
  });

  it('should pass branch as params when branch is not main', async () => {
    const stack = { taxonomy: () => taxonomyInstance } as unknown as ManagementStack;
    const data = {
      locales: ['en-us'],
      environments: ['development'],
      items: [{ uid: 'taxonomy_uid_1' }],
    };

    const service = new TaxonomyService(stack);
    await service.publish(data, 'feature-branch');

    expect(addHeaderStub.calledWith('api_version', '3.2')).to.be.true;
    expect(publishStub.firstCall.args[2]).to.deep.equal({ branch: 'feature-branch' });
  });

  it('should omit branch param for main', async () => {
    const stack = { taxonomy: () => taxonomyInstance } as unknown as ManagementStack;
    const data = {
      locales: ['en-us'],
      environments: ['development'],
      items: [{ uid: 'taxonomy_uid_1' }],
    };

    const service = new TaxonomyService(stack);
    await service.publish(data, 'main');

    expect(addHeaderStub.calledWith('api_version', '3.2')).to.be.true;
    expect(publishStub.firstCall.args.length).to.equal(1);
  });

  it('should inject api_version 3.2 header via addHeader before unpublish', async () => {
    const stack = { taxonomy: () => taxonomyInstance } as unknown as ManagementStack;
    const data = {
      locales: ['en-us'],
      environments: ['development'],
      items: [{ uid: 'taxonomy_uid_1' }],
    };

    const service = new TaxonomyService(stack);
    const result = await service.unpublish(data, 'feature-branch');

    expect(addHeaderStub.calledWith('api_version', '3.2')).to.be.true;
    expect(unpublishStub.calledOnce).to.be.true;
    expect(unpublishStub.firstCall.args[0]).to.deep.equal(data);
    expect(unpublishStub.firstCall.args[2]).to.deep.equal({ branch: 'feature-branch' });
    expect(result.job_id).to.equal('job_456');
  });
});
