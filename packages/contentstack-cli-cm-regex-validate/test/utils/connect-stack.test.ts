import {ux} from '@contentstack/cli-utilities'
import * as contentstackSdk from '@contentstack/management'
import connectStack from '../../src/utils/connect-stack'
import processStack from '../../src/utils/process-stack'

jest.mock('@contentstack/management')
jest.mock('../../src/utils/generate-output.ts')
jest.mock('../../src/utils/process-stack.ts')

describe('Get Client from Management SDK, connect with Stack & process Stack', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    jest.spyOn(ux.action, 'start').mockImplementation(jest.fn())
    jest.spyOn(ux.action, 'stop').mockImplementation(jest.fn())
  })

  test('Token details are Valid', async () => {
    const host = 'api-contentstack.io'
    const tokenDetails = {
      apiKey: 'blt1234',
      token: 'blt1234',
    }
    const flags = {
      contentType: true,
      globalField: true,
    }

    const mockStack = jest.fn().mockResolvedValue({stack: {}})
    const mockClient = {stack: mockStack};
    (contentstackSdk.client as jest.Mock).mockReturnValue(mockClient)

    await connectStack(flags, host, tokenDetails)
    expect(ux.action.start).toHaveBeenCalled()
    expect(processStack).toHaveBeenCalled()
  })

  test('Token details is Invalid', async () => {
    const host = 'api-contentstack.io'
    const tokenDetails = {
      apiKey: 'blt1234',
      token: 'blt1234',
    }
    const flags = {
      contentType: true,
      globalField: true,
    }

    const mockStack = jest.fn().mockImplementation(() => {
      throw new Error('Invalid stack API Key provided.')
    })
    const mockClient = {stack: mockStack};
    (contentstackSdk.client as jest.Mock).mockReturnValue(mockClient)

    await expect(connectStack(flags, host, tokenDetails)).rejects.toEqual(
      expect.any(Error),
    )

    expect(ux.action.start).toHaveBeenCalled()
  })
})
