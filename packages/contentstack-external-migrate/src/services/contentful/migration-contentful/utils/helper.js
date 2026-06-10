/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * External module Dependencies.
 */
const mkdirp = require('mkdirp');
const path = require('path');
const fs = require('fs');

// Tolerant JSON cleanup — strict parse first, then strip the breakage real
// exports carry. Conservative: no mojibake substitution (would corrupt data).
const cleanJsonContent = function (raw) {
  let s = raw;
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); // strip BOM
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // control chars, keep \t \n \r
  s = s.replace(/,(\s*[}\]])/g, '$1'); // trailing commas
  return s;
};

const parseJsonLoose = function (raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    return JSON.parse(cleanJsonContent(raw));
  }
};

const readFile = function (filePath, parse) {
  parse = typeof parse == 'undefined' ? true : parse;
  filePath = path.resolve(filePath);
  let data;
  if (fs.existsSync(filePath)) data = parse ? parseJsonLoose(fs.readFileSync(filePath, 'utf-8')) : data;
  return data;
};

const writeFile = function (filePath, data) {
  filePath = path.resolve(filePath);
  data = typeof data == 'object' ? JSON.stringify(data) : data || '{}';
  fs.writeFileSync(filePath, data, 'utf-8');
};

const appendFile = function (filePath, data) {
  filePath = path.resolve(filePath);
  fs.appendFileSync(filePath, data);
};

const makeDirectory = function () {
  for (let key in arguments) {
    let dirname = path.resolve(arguments[key]);
    if (!fs.existsSync(dirname)) mkdirp.sync(dirname);
  }
};

function deleteFolderSync(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const currentPath = path.join(folderPath, file);
      if (fs.lstatSync(currentPath).isDirectory()) {
        // Recurse
        deleteFolderSync(currentPath);
      } else {
        // Delete file
        fs.unlinkSync(currentPath);
      }
    });
    // Delete now-empty folder
    fs.rmdirSync(folderPath);
  }
}

module.exports = {
  readFile,
  writeFile,
  appendFile,
  makeDirectory,
  deleteFolderSync,
  parseJsonLoose,
  cleanJsonContent
};
