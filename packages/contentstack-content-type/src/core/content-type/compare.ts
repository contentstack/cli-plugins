import cli from 'cli-ux'
import * as fs from 'fs'
import * as tmp from 'tmp'
import * as Diff2html from 'diff2html'
import {createTwoFilesPatch} from 'diff'
import {BuildOutput} from '../../types'

export default async function buildOutput(contentTypeName: string, previous: any, current: any): Promise<BuildOutput> {
  const diffString = buildDiffString(previous, current)
  const diffTree = Diff2html.parse(diffString)
  const diffHtml = Diff2html.html(diffTree, {
    outputFormat: 'side-by-side',
    drawFileList: false,
    matching: 'lines',
  })

  tmp.file({prefix: `${contentTypeName}-compare`, postfix: '.html', keep: true}, async function (err: any, path: any, _fd: any, _cleanupCallback: any) {
    if (err) throw err
    fs.writeFileSync(path, html(diffHtml))
    await cli.open(path)
  })

  return {
    header: null,
    body: 'Please check the browser output.',
    footer: null,
    rows: [],
    hasResults: true,
  }
}

function buildDiffString(previous: any, current: any) {
  return createTwoFilesPatch(
    previous.uid,
    current.uid,
    JSON.stringify(previous, null, 2),
    JSON.stringify(current, null, 2),
    current.updated_at,
    current.updated_at,
  )
}

function html(body: string) {
  return `
  <!DOCTYPE html>
  <html>
      <head>
          <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css" />
          <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/diff2html/bundles/js/diff2html.min.js"></script>
      </head>
      <body>
       ${body}
      </body>
  </html>`
}
