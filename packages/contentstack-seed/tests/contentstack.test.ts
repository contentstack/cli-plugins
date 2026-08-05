// The client wraps the Contentstack management SDK. Mock cli-utilities so its
// real (ESM-heavy) module never loads; we inject a fake SDK client into
// `instance` for each test anyway.
jest.mock('@contentstack/cli-utilities', () => ({
  managementSDKClient: jest.fn(),
  configHandler: { get: jest.fn() },
}));

import ContentstackClient, { CreateStackOptions } from '../src/seed/contentstack/client';
import * as config from './config.json';

const CMA_HOST = 'cs.api.com';
const API_KEY = config.API_KEY;
const ORG_UID = 'org_12345';
const STACK_UID = 'stack_12345';
const ORG_NAME = 'org_name_12345';
const STACK_NAME = 'stack_name_12345';
const MASTER_LOCALE = 'en-us';

// Build a client and swap its `instance` promise for a fake SDK client.
function clientWith(sdk: any): ContentstackClient {
  const client = new ContentstackClient(CMA_HOST, 100);
  client.instance = Promise.resolve(sdk);
  return client;
}

describe('ContentstackClient', () => {
  test('should get Organizations', async () => {
    const organizations = [{ uid: ORG_UID, name: ORG_NAME, enabled: true }];
    const fetchAll = jest.fn().mockResolvedValue({ items: organizations, count: organizations.length });
    const organization = jest.fn().mockReturnValue({ fetchAll });

    const client = clientWith({ organization });
    const result = await client.getOrganizations();

    expect(organization).toHaveBeenCalledWith();
    expect(fetchAll).toHaveBeenCalledWith(expect.objectContaining({ asc: 'name', include_count: true }));
    expect(result).toStrictEqual(organizations);
  });

  test('should get Stacks', async () => {
    const stacks = [
      { uid: STACK_UID, name: STACK_NAME, master_locale: MASTER_LOCALE, api_key: API_KEY, org_uid: ORG_UID },
    ];
    const find = jest.fn().mockResolvedValue({ items: stacks, count: stacks.length });
    const query = jest.fn().mockReturnValue({ find });
    const stack = jest.fn().mockReturnValue({ query });

    const client = clientWith({ stack });
    const result = await client.getStacks(ORG_UID);

    expect(stack).toHaveBeenCalledWith({ organization_uid: ORG_UID });
    expect(result).toStrictEqual(stacks);
  });

  test('should get Content Type count', async () => {
    const find = jest.fn().mockResolvedValue({ count: 2 });
    const query = jest.fn().mockReturnValue({ find });
    const contentType = jest.fn().mockReturnValue({ query });
    const stack = jest.fn().mockReturnValue({ contentType });

    const client = clientWith({ stack });
    const count = await client.getContentTypeCount(API_KEY);

    expect(stack).toHaveBeenCalledWith({ api_key: API_KEY, management_token: undefined });
    expect(query).toHaveBeenCalledWith({ include_count: true });
    expect(count).toBe(2);
  });

  test('should create Stack', async () => {
    const options: CreateStackOptions = {
      description: 'description 12345',
      master_locale: MASTER_LOCALE,
      name: STACK_NAME,
      org_uid: ORG_UID,
    };
    const created = {
      uid: STACK_UID,
      api_key: API_KEY,
      master_locale: MASTER_LOCALE,
      name: STACK_NAME,
      org_uid: ORG_UID,
    };
    const create = jest.fn().mockResolvedValue(created);
    const stack = jest.fn().mockReturnValue({ create });

    const client = clientWith({ stack });
    const result = await client.createStack(options);

    expect(create).toHaveBeenCalledWith(
      { stack: { name: STACK_NAME, description: options.description, master_locale: MASTER_LOCALE } },
      { organization_uid: ORG_UID },
    );
    expect(result).toStrictEqual(created);
  });

  test('should surface SDK errors', async () => {
    const find = jest.fn().mockRejectedValue({ errorMessage: 'error occurred', status: 422 });
    const query = jest.fn().mockReturnValue({ find });
    const contentType = jest.fn().mockReturnValue({ query });
    const stack = jest.fn().mockReturnValue({ contentType });

    const client = clientWith({ stack });

    await expect(client.getContentTypeCount(API_KEY)).rejects.toThrow('error occurred');
  });
});
