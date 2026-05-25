const { expect } = require('chai');
const { setupEnvironments } = require('../lib/bootstrap/utils');
const tmp = require('tmp');
const fs = require('fs');
const path = require('path');

function getDirectory() {
  return new Promise((resolve, reject) => {
    tmp.dir(function (err, _path) {
      if (err) reject(err);
      resolve(_path);
    });
  });
}

function getDirFiles(_path) {
  return new Promise((resolve, reject) => {
    fs.readdir(_path, function (err, files) {
      if (err) reject(err);
      resolve(files);
    });
  });
}

function getFileContent(_path) {
  return new Promise((resolve, reject) => {
    fs.readFile(_path, 'utf-8', function (err, data) {
      if (err) reject(err);
      resolve(data);
    });
  });
}

function normalizeEnvContent(content) {
  return content.replace(/\n/g, ',');
}

function createManagementAPIClient(environments, token) {
  return {
    stack: () => ({
      environment: () => ({
        query: () => ({
          find: () => Promise.resolve(environments),
        }),
      }),
      managementToken: () => ({
        create: () => Promise.resolve({ uid: 'mock-management-token-uid', token: 'mock-management-token' }),
      }),
      deliveryToken: () => ({
        create: () => Promise.resolve({ token, preview_token: 'mock_preview_token' }),
      }),
    }),
  };
}

const region = {
  name: 'AWS-NA',
  cda: 'https://cdn.contentstack.com',
  cma: 'https://api.contentstack.com',
  uiHost: 'https://app.contentstack.com',
};

describe('Utils', function () {
  describe('#setupEnvironments', () => {
    it('Create env file for a stack with live preview enabled', async () => {
      const environments = { items: [{ name: 'production' }, { name: 'development' }] };
      const appConfig = { appConfigKey: 'kickstart-next' };
      const clonedDirectory = await getDirectory();
      const managementAPIClient = createManagementAPIClient(environments, 'mock-delivery-token');

      await setupEnvironments(
        managementAPIClient,
        'mock-api-key',
        appConfig,
        clonedDirectory,
        region,
        true,
      );

      const files = await getDirFiles(clonedDirectory);
      expect(files).to.have.length(1);
      const envFile = normalizeEnvContent(await getFileContent(path.join(clonedDirectory, '.env')));
      expect(envFile).to.equal(
        'NEXT_PUBLIC_CONTENTSTACK_API_KEY=mock-api-key,NEXT_PUBLIC_CONTENTSTACK_DELIVERY_TOKEN=mock-delivery-token,NEXT_PUBLIC_CONTENTSTACK_PREVIEW_TOKEN=mock_preview_token,NEXT_PUBLIC_CONTENTSTACK_ENVIRONMENT=development,NEXT_PUBLIC_CONTENTSTACK_REGION=aws-na,NEXT_PUBLIC_CONTENTSTACK_PREVIEW=true,NEXT_PUBLIC_CONTENTSTACK_CONTENT_DELIVERY = cdn.contentstack.com,NEXT_PUBLIC_CONTENTSTACK_CONTENT_APPLICATION = app.contentstack.com,NEXT_PUBLIC_CONTENTSTACK_PREVIEW_HOST = rest-preview.contentstack.com,NEXT_PUBLIC_CONTENTSTACK_IMAGE_HOSTNAME=images.contentstack.com',
      );
    });

    it('Create env file for a stack with live preview disabled', async () => {
      const environments = { items: [{ name: 'production' }, { name: 'development' }] };
      const appConfig = { appConfigKey: 'kickstart-next' };
      const clonedDirectory = await getDirectory();
      const managementAPIClient = createManagementAPIClient(environments, 'mock-delivery-token');

      await setupEnvironments(
        managementAPIClient,
        'mock-api-key',
        appConfig,
        clonedDirectory,
        region,
        false,
      );

      const files = await getDirFiles(clonedDirectory);
      expect(files).to.have.length(1);
      const envFile = normalizeEnvContent(await getFileContent(path.join(clonedDirectory, '.env')));
      expect(envFile).to.equal(
        'NEXT_PUBLIC_CONTENTSTACK_API_KEY=mock-api-key,NEXT_PUBLIC_CONTENTSTACK_DELIVERY_TOKEN=mock-delivery-token,NEXT_PUBLIC_CONTENTSTACK_PREVIEW_TOKEN=mock_preview_token,NEXT_PUBLIC_CONTENTSTACK_ENVIRONMENT=development,NEXT_PUBLIC_CONTENTSTACK_REGION=aws-na,NEXT_PUBLIC_CONTENTSTACK_PREVIEW=false,NEXT_PUBLIC_CONTENTSTACK_CONTENT_DELIVERY = cdn.contentstack.com,NEXT_PUBLIC_CONTENTSTACK_CONTENT_APPLICATION = app.contentstack.com,NEXT_PUBLIC_CONTENTSTACK_PREVIEW_HOST = rest-preview.contentstack.com,NEXT_PUBLIC_CONTENTSTACK_IMAGE_HOSTNAME=images.contentstack.com',
      );
    });

    it('Create env with invalid environments, should throw an error', async () => {
      const environments = {};
      const appConfig = { appConfigKey: 'kickstart-next' };
      const clonedDirectory = await getDirectory();
      const managementAPIClient = createManagementAPIClient(environments, 'mock-delivery-token');

      try {
        await setupEnvironments(managementAPIClient, 'mock-api-key', appConfig, clonedDirectory, region);
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
    });

    it('Create env with invalid app config, should throw an error', async () => {
      const environments = { items: [{ name: 'production' }] };
      const appConfig = { appConfigKey: 'invalid-app' };
      const clonedDirectory = await getDirectory();
      const managementAPIClient = createManagementAPIClient(environments, 'mock-delivery-token');

      await setupEnvironments(managementAPIClient, 'mock-api-key', appConfig, clonedDirectory, region, false);

      const files = await getDirFiles(clonedDirectory);
      expect(files).to.have.length(0);
    });

    it('Create env with one invalid environment, should not create env file for invalid one', async () => {
      const environments = { items: [{ name: 'production' }, { name: null }] };
      const appConfig = { appConfigKey: 'kickstart-next' };
      const clonedDirectory = await getDirectory();
      const managementAPIClient = createManagementAPIClient(environments, 'mock-delivery-token');

      await setupEnvironments(managementAPIClient, 'mock-api-key', appConfig, clonedDirectory, region, false);

      const files = await getDirFiles(clonedDirectory);
      expect(files).to.have.length(1);
      const envFile = normalizeEnvContent(await getFileContent(path.join(clonedDirectory, '.env')));
      expect(envFile).to.include('NEXT_PUBLIC_CONTENTSTACK_ENVIRONMENT=production');
    });
  });
});
