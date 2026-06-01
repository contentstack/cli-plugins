import { cliux, sanitizePath } from '@contentstack/cli-utilities';
import Table from 'cli-table3';
import * as fs from 'fs';
import jsonexport from 'jsonexport';
import * as path from 'path';
const regexMessages = require('../../messages/index.json').validateRegex;

export default async function generateOutput(flags: any, invalidRegex: any, tableData: any) {
  if (invalidRegex.length > 0) {
    const resultFile = 'results.csv';
    let storagePath = path.resolve(__dirname, '../../results');
    if (flags.filePath) {
      storagePath = flags.filePath;
    }

    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }

    storagePath = path.resolve(sanitizePath(storagePath), sanitizePath(resultFile));
    jsonexport(invalidRegex, (error: any, csv: any) => {
      if (error) {
        throw new Error(regexMessages.errors.csvOutput);
      }

      fs.writeFileSync(storagePath, csv);
    });
    console.log(regexMessages.output.tableOutput);
    const table = new Table({
      head: ['Module', 'Title', 'UID', 'Invalid Regex Count'],
    });
    tableData.forEach((row: any) => {
      table.push(row);
    });
    const messageAndPath = `${regexMessages.output.csvOutput} ${storagePath}`;
    cliux.print(table.toString());
    cliux.print(messageAndPath);
    cliux.print(regexMessages.output.docsLink);
  } else {
    cliux.print(regexMessages.output.noInvalidRegex);
  }
}
