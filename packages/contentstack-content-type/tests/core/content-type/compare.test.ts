jest.mock('cli-ux', () => ({
  __esModule: true,
  default: {
    open: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('tmp', () => ({
  file: jest.fn(
    (
      _opts: unknown,
      cb: (err: Error | null, path: string, fd: number, cleanup: () => void) => void
    ) => {
      cb(null, '/tmp/fake-compare.html', 0, jest.fn())
    }
  ),
}))

jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
}))

jest.mock('diff2html', () => ({
  parse: jest.fn(() => [{ value: 'parsed' }]),
  html: jest.fn(() => '<div class="d2h">diff-html</div>'),
}))

import fs from 'fs'
import * as Diff2html from 'diff2html'

import buildOutput from '../../../src/core/content-type/compare'

describe('compare buildOutput', () => {
  const prev = { uid: 'ct', updated_at: '2020-01-01' }
  const curr = { uid: 'ct', updated_at: '2021-01-01' }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns BuildOutput and writes HTML file with diff2html body', async () => {
    const out = await buildOutput('my-ct', prev, curr)

    expect(out.hasResults).toBe(true)
    expect(out.body).toBe('Please check the browser output.')
    expect(out.header).toBeNull()
    expect(fs.writeFileSync).toHaveBeenCalled()
    const written = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
    expect(written).toContain('<!DOCTYPE html>')
    expect(written).toContain('diff-html')
    expect(written).toContain('diff2html')
  })

  it('feeds diff2html a unified patch with file headers and the changed lines', async () => {
    await buildOutput('my-ct', prev, curr)

    const patch = (Diff2html.parse as jest.Mock).mock.calls[0][0] as string
    expect(patch).toContain(`--- ${prev.uid}\t${curr.updated_at}`)
    expect(patch).toContain(`+++ ${curr.uid}\t${curr.updated_at}`)
    expect(patch).toMatch(/^@@ .* @@$/m)
    expect(patch).toContain('-  "updated_at": "2020-01-01"')
    expect(patch).toContain('+  "updated_at": "2021-01-01"')
  })

  it('produces a patch with no hunks when both versions are identical', async () => {
    await buildOutput('my-ct', prev, prev)

    const patch = (Diff2html.parse as jest.Mock).mock.calls[0][0] as string
    expect(patch).not.toContain('@@')
    expect(patch).not.toContain('undefined')
  })
})
