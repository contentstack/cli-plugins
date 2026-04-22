import { cliux, managementSDKClient, messageHandler, getChalk } from '@contentstack/cli-utilities';
import { diff } from 'just-diff';
import camelCase from 'lodash/camelCase';
import find from 'lodash/find';
import forEach from 'lodash/forEach';
import isArray from 'lodash/isArray';
import padStart from 'lodash/padStart';
import startCase from 'lodash/startCase';
import unionWith from 'lodash/unionWith';

import config from '../config';
import {
  BranchCompactTextRes,
  BranchDiffPayload,
  BranchDiffRes,
  BranchDiffSummary,
  BranchDiffVerboseRes,
  BranchModifiedDetails,
  ModifiedFieldsInput,
  ModifiedFieldsType,
} from '../interfaces/index';
import { extractValueFromPath, generateCSVDataFromVerbose, getFieldDisplayName } from './csv-utility';

/**
 * Fetch differences between two branches
 * @async
 * @method
 * @param payload
 * @param branchesDiffData
 * @param skip
 * @param limit
 * @returns {*} Promise<any>
 */
async function fetchBranchesDiff(
  payload: BranchDiffPayload,
  branchesDiffData = [],
  skip = config.skip,
  limit = config.limit,
): Promise<any> {
  const branchDiffData = await branchCompareSDK(payload, skip, limit);
  const diffData = branchDiffData?.diff;
  const nextUrl = branchDiffData?.next_url || '';

  if (branchesDiffData?.length) {
    branchesDiffData = [...branchesDiffData, ...diffData];
  } else {
    branchesDiffData = diffData;
  }

  if (nextUrl) {
    skip = skip + limit;
    return await fetchBranchesDiff(payload, branchesDiffData, skip, limit);
  }
  return branchesDiffData;
}

/**
 * branch compare sdk integration
 * @async
 * @method
 * @param payload
 * @param skip
 * @param limit
 * @returns  {*} Promise<any>
 */
async function branchCompareSDK(payload: BranchDiffPayload, skip?: number, limit?: number): Promise<any> {
  const { host } = payload;
  const managementAPIClient = await managementSDKClient({ host });
  const branchQuery = managementAPIClient
    .stack({ api_key: payload.apiKey })
    .branch(payload.baseBranch)
    .compare(payload.compareBranch);

  const queryParams = {};
  if (skip >= 0) queryParams['skip'] = skip;
  if (limit >= 0) queryParams['limit'] = limit;
  if (payload?.uid) queryParams['uid'] = payload.uid;
  const module = payload.module || 'all';

  switch (module) {
    case 'content_types':
    case 'content_type':
      return await branchQuery
        .contentTypes(queryParams)
        .then((data) => data)
        .catch((err) => handleErrorMsg(err, payload.spinner));
    case 'global_fields':
    case 'global_field':
      return await branchQuery
        .globalFields(queryParams)
        .then((data) => data)
        .catch((err) => handleErrorMsg(err, payload.spinner));
    case 'all':
      return await branchQuery
        .all(queryParams)
        .then((data) => data)
        .catch((err) => handleErrorMsg(err, payload.spinner));
    default:
      handleErrorMsg({ errorMessage: 'Invalid module!' }, payload.spinner);
  }
}

function handleErrorMsg(err, spinner) {
  cliux.loaderV2('', spinner);

  if (err?.errorMessage) {
    cliux.print(`Error: ${err.errorMessage}`, { color: 'red' });
  } else if (err?.message) {
    cliux.print(`Error: ${err.message}`, { color: 'red' });
  } else {
    console.log(err);
    cliux.print(`Error: ${messageHandler.parse('CLI_BRANCH_API_FAILED')}`, { color: 'red' });
  }
  process.exit(1);
}

/**
 * filter out differences of two branches on basis of their status and return overall summary
 * @method
 * @param branchesDiffData - differences of two branches
 * @param {string} baseBranch
 * @param {string} compareBranch
 * @returns {*} BranchDiffSummary
 */
function parseSummary(branchesDiffData: any[], baseBranch: string, compareBranch: string): BranchDiffSummary {
  let baseCount = 0,
    compareCount = 0,
    modifiedCount = 0;

  if (branchesDiffData?.length) {
    forEach(branchesDiffData, (diff: BranchDiffRes) => {
      if (diff.status === 'compare_only') compareCount++;
      else if (diff.status === 'base_only') baseCount++;
      else if (diff.status === 'modified') modifiedCount++;
    });
  }

  const branchSummary: BranchDiffSummary = {
    base: baseBranch,
    base_only: baseCount,
    compare: compareBranch,
    compare_only: compareCount,
    modified: modifiedCount,
  };
  return branchSummary;
}

/**
 * print summary of two branches differences
 * @method
 * @param {BranchDiffSummary} diffSummary - summary of branches diff
 */
function printSummary(diffSummary: BranchDiffSummary): void {
  const totalTextLen = 12;
  forEach(diffSummary, (value, key) => {
    const str = startCase(camelCase(key));
    cliux.print(`${padStart(str, totalTextLen)}:  ${value}`);
  });
}

/**
 * filter out differences of two branches on basis of their status and return compact text details
 * @method
 * @param branchesDiffData
 * @returns {*} BranchCompactTextRes
 */
function parseCompactText(branchesDiffData: any[]): BranchCompactTextRes {
  const listOfModified: BranchDiffRes[] = [],
    listOfAdded: BranchDiffRes[] = [],
    listOfDeleted: BranchDiffRes[] = [];

  if (branchesDiffData?.length) {
    forEach(branchesDiffData, (diff: BranchDiffRes) => {
      if (diff.status === 'compare_only') listOfAdded.push(diff);
      else if (diff.status === 'base_only') listOfDeleted.push(diff);
      else if (diff.status === 'modified') listOfModified.push(diff);
    });
  }

  const branchTextRes: BranchCompactTextRes = {
    added: listOfAdded,
    deleted: listOfDeleted,
    modified: listOfModified,
  };
  return branchTextRes;
}

/**
 * print compact text details of two branches differences
 * @method
 * @param {BranchCompactTextRes} branchTextRes
 */
function printCompactTextView(branchTextRes: BranchCompactTextRes): void {
  if (branchTextRes.modified?.length || branchTextRes.added?.length || branchTextRes.deleted?.length) {
    cliux.print(' ');
    forEach(branchTextRes.added, (diff: BranchDiffRes) => {
      if (diff.merge_strategy !== 'ignore') {
        cliux.print(getChalk().green(`+ '${diff.title}' ${startCase(camelCase(diff.type))}`));
      }
    });

    forEach(branchTextRes.modified, (diff: BranchDiffRes) => {
      if (diff.merge_strategy !== 'ignore') {
        cliux.print(getChalk().blue(`± '${diff.title}' ${startCase(camelCase(diff.type))}`));
      }
    });

    forEach(branchTextRes.deleted, (diff: BranchDiffRes) => {
      if (diff.merge_strategy !== 'ignore') {
        cliux.print(getChalk().red(`- '${diff.title}' ${startCase(camelCase(diff.type))}`));
      }
    });
  }
}

/**
 * filter out text verbose details - deleted, added, modified details
 * @async
 * @method
 * @param branchesDiffData
 * @param {BranchDiffPayload} payload
 * @returns {*} Promise<BranchDiffVerboseRes>
 */
async function parseVerbose(branchesDiffData: any[], payload: BranchDiffPayload): Promise<BranchDiffVerboseRes> {
  const { added, deleted, modified } = parseCompactText(branchesDiffData);
  const modifiedDetailList: BranchModifiedDetails[] = [];

  for (let i = 0; i < modified?.length; i++) {
    const diff: BranchDiffRes = modified[i];
    payload.uid = diff?.uid;
    const branchDiff = await branchCompareSDK(payload);
    if (branchDiff) {
      const { listOfAddedFields, listOfDeletedFields, listOfModifiedFields } = await prepareBranchVerboseRes(
        branchDiff,
      );
      modifiedDetailList.push({
        modifiedFields: {
          added: listOfAddedFields,
          deleted: listOfDeletedFields,
          modified: listOfModifiedFields,
        },
        moduleDetails: diff,
      });
    }
  }

  const verboseRes: BranchDiffVerboseRes = {
    added: added,
    deleted: deleted,
    modified: modifiedDetailList,
  };

  verboseRes.csvData = generateCSVDataFromVerbose(verboseRes);

  return verboseRes;
}

/**
 * check whether fields exists in either base or compare branches.
 * @method
 * @param branchDiff
 * @returns
 */
async function prepareBranchVerboseRes(branchDiff: any) {
  const listOfModifiedFields = [],
    listOfDeletedFields = [],
    listOfAddedFields = [];

  if (branchDiff?.diff?.status === 'modified') {
    let unionOfBaseAndCompareBranch: any[] = [];
    const baseBranchDiff = branchDiff.diff?.base_branch?.differences;
    const compareBranchDiff = branchDiff.diff?.compare_branch?.differences;

    if (baseBranchDiff && compareBranchDiff) {
      unionOfBaseAndCompareBranch = unionWith(baseBranchDiff, compareBranchDiff, customComparator);
    }

    forEach(unionOfBaseAndCompareBranch, (diffData) => {
      const baseBranchFieldExists = find(baseBranchDiff, (item) =>
        item?.uid && diffData.uid ? item.uid === diffData.uid : item.path === diffData.path,
      );
      const compareBranchFieldExists = find(compareBranchDiff, (item) =>
        item?.uid && diffData.uid ? item.uid === diffData.uid : item.path === diffData.path,
      );
      baseAndCompareBranchDiff({
        baseBranchFieldExists,
        compareBranchFieldExists,
        diffData,
        listOfAddedFields,
        listOfDeletedFields,
        listOfModifiedFields,
      });
    });
  }

  return { listOfAddedFields, listOfDeletedFields, listOfModifiedFields };
}

/**
 * filter out the fields from the module that are deleted, added, or modified. Modules having a modified status.
 * @method
 * @param params
 */
async function baseAndCompareBranchDiff(params: {
  baseBranchFieldExists: any;
  compareBranchFieldExists: any;
  diffData: any;
  listOfAddedFields: any[];
  listOfDeletedFields: any[];
  listOfModifiedFields: any[];
}) {
  const { baseBranchFieldExists, compareBranchFieldExists } = params;
  if (baseBranchFieldExists && compareBranchFieldExists) {
    await prepareModifiedDiff(params);
  } else if (baseBranchFieldExists && !compareBranchFieldExists) {
    let displayName = baseBranchFieldExists?.display_name;
    let path = baseBranchFieldExists?.path || baseBranchFieldExists?.uid;
    let field = baseBranchFieldExists?.data_type;
    if (baseBranchFieldExists.path === 'description') {
      displayName = 'Description';
      path = baseBranchFieldExists?.path;
      field = 'metadata';
    }
    params.listOfDeletedFields.push({
      displayName: displayName,
      field: field,
      path: path,
      uid: baseBranchFieldExists?.uid,
    });
  } else if (!baseBranchFieldExists && compareBranchFieldExists) {
    let displayName = compareBranchFieldExists?.display_name;
    let path = compareBranchFieldExists?.path || compareBranchFieldExists?.uid;
    let field = compareBranchFieldExists?.data_type;
    if (compareBranchFieldExists.path === 'description') {
      displayName = 'Description';
      path = compareBranchFieldExists?.path;
      field = 'metadata';
    }
    params.listOfAddedFields.push({
      displayName: displayName,
      field: field,
      path: path,
      uid: compareBranchFieldExists?.uid,
    });
  }
}

async function prepareModifiedDiff(params: {
  baseBranchFieldExists: any;
  compareBranchFieldExists: any;
  listOfAddedFields: any[];
  listOfDeletedFields: any[];
  listOfModifiedFields: any[];
}) {
  const { baseBranchFieldExists, compareBranchFieldExists } = params;
  if (
    compareBranchFieldExists.path === 'description' ||
    compareBranchFieldExists.path === 'title' ||
    compareBranchFieldExists.path === 'options.singleton'
  ) {
    let displayName: string;
    let changeDetails = '';
    if (baseBranchFieldExists.path === 'options.singleton') {
      if (compareBranchFieldExists.value) {
        displayName = 'Single';
        changeDetails = `Changed from Multiple to Single`;
      } else {
        displayName = 'Multiple';
        changeDetails = `Changed from Single to Multiple`;
      }
    } else if (baseBranchFieldExists.path === 'description') {
      displayName = 'Description';
      const oldDesc = baseBranchFieldExists.value || 'undefined';
      const newDesc = compareBranchFieldExists.value || 'undefined';
      changeDetails = `Changed from "${oldDesc}" to "${newDesc}"`;
    } else if (baseBranchFieldExists.path === 'title') {
      displayName = 'Display Name';
      const oldTitle = baseBranchFieldExists.value || 'undefined';
      const newTitle = compareBranchFieldExists.value || 'undefined';
      changeDetails = `Changed from "${oldTitle}" to "${newTitle}"`;
    }
    params.listOfModifiedFields.push({
      changeDetails,
      displayName: displayName,
      field: 'changed',
      newValue: compareBranchFieldExists.value,
      oldValue: baseBranchFieldExists.value,
      path: '',
      uid: baseBranchFieldExists.path,
    });
  } else {
    const fieldDisplayName = getFieldDisplayName(compareBranchFieldExists);

    const { added, deleted, modified } = await deepDiff(baseBranchFieldExists, compareBranchFieldExists);
    for (const field of Object.values(added)) {
      if (field) {
        params.listOfAddedFields.push({
          displayName: getFieldDisplayName(field),
          field: field['fieldType'] || field['data_type'] || 'field',
          path: field['path'],
          uid: field['uid'],
        });
      }
    }

    for (const field of Object.values(deleted)) {
      if (field) {
        params.listOfDeletedFields.push({
          displayName: getFieldDisplayName(field),
          field: field['fieldType'] || field['data_type'] || 'field',
          path: field['path'],
          uid: field['uid'],
        });
      }
    }

    for (const field of Object.values(modified)) {
      if (field) {
        params.listOfModifiedFields.push({
          changeCount: field['changeCount'],
          displayName: field['displayName'] || field['display_name'] || fieldDisplayName,
          field: `${field['fieldType'] || field['data_type'] || compareBranchFieldExists?.data_type || 'field'} field`,
          path: field['path'],
          propertyChanges: field['propertyChanges'],
          uid: field['uid'] || compareBranchFieldExists?.uid,
        });
      }
    }
  }
}

function customComparator(a: any, b: any): boolean {
  return a?.uid && b?.uid ? a.uid === b.uid : a.path === b.path;
}

/**
 * print detail text view of two branches differences - deleted, added and modified fields
 * @param {BranchDiffVerboseRes} branchTextRes
 */
function printVerboseTextView(branchTextRes: BranchDiffVerboseRes): void {
  if (branchTextRes.modified?.length || branchTextRes.added?.length || branchTextRes.deleted?.length) {
    cliux.print(' ');
    forEach(branchTextRes.added, (diff: BranchDiffRes) => {
      cliux.print(getChalk().green(`+ '${diff.title}' ${startCase(camelCase(diff.type))}`));
    });

    forEach(branchTextRes.modified, (diff: BranchModifiedDetails) => {
      cliux.print(getChalk().blue(`± '${diff.moduleDetails.title}' ${startCase(camelCase(diff.moduleDetails.type))}`));
      printModifiedFields(diff.modifiedFields);
    });

    forEach(branchTextRes.deleted, (diff: BranchDiffRes) => {
      cliux.print(getChalk().red(`- '${diff.title}' ${startCase(camelCase(diff.type))}`));
    });
  }
}

/**
 * print detail text view of modified fields
 * @method
 * @param {ModifiedFieldsInput} modfiedFields
 */
function printModifiedFields(modfiedFields: ModifiedFieldsInput): void {
  if (modfiedFields.modified?.length || modfiedFields.added?.length || modfiedFields.deleted?.length) {
    forEach(modfiedFields.modified, (diff: ModifiedFieldsType) => {
      const field: string = diff.field ? `${diff.field}` : 'field';
      const fieldDetail = diff.path ? `(${diff.path}) ${field}` : `${field}`;
      cliux.print(`   ${getChalk().blue(`± "${diff.displayName}" ${fieldDetail}`)}`);
    });

    forEach(modfiedFields.added, (diff: ModifiedFieldsType) => {
      const field: string = diff.field ? `${diff.field} field` : 'field';
      cliux.print(`   ${getChalk().green(`+ "${diff.displayName}" (${diff.path}) ${field}`)}`);
    });

    forEach(modfiedFields.deleted, (diff: ModifiedFieldsType) => {
      const field: string = diff.field ? `${diff.field} field` : 'field';
      cliux.print(`   ${getChalk().red(`- "${diff.displayName}" (${diff.path}) ${field}`)}`);
    });
  }
}

/**
 * filter out branch differences on basis of module like content_types, global_fields
 * @param branchDiffData
 * @returns
 */
function filterBranchDiffDataByModule(branchDiffData: any[]) {
  const moduleRes = {
    content_types: [],
    global_fields: [],
  };

  forEach(branchDiffData, (item) => {
    if (item.type === 'content_type' || item.type === 'content_types') moduleRes.content_types.push(item);
    else if (item.type === 'global_field' || item.type === 'global_fields') moduleRes.global_fields.push(item);
  });
  return moduleRes;
}

const buildPath = (path, key) => (path === '' ? key : `${path}.${key}`);

async function deepDiff(baseObj, compareObj) {
  const changes = {
    added: {},
    deleted: {},
    modified: {},
  };
  function baseAndCompareSchemaDiff(baseObj, compareObj, path = '') {
    const { path: basePath, schema: baseSchema, ...restBaseObj } = baseObj;
    const { path: comparePath, schema: compareSchema, ...restCompareObj } = compareObj;
    const currentPath = buildPath(path, baseObj['uid']);
    if (restBaseObj['uid'] === restCompareObj['uid']) {
      prepareModifiedField({
        changes,
        currentPath,
        fullFieldContext: baseObj,
        parentContext: baseObj,
        restBaseObj,
        restCompareObj,
      });
    }

    //case1:- base & compare schema both exists
    if (baseSchema?.length && compareSchema?.length && isArray(baseSchema) && isArray(compareSchema)) {
      const unionOfBaseAndCompareBranch = unionWith(baseSchema, compareSchema, (a, b) => a?.uid === b?.uid);
      forEach(unionOfBaseAndCompareBranch, (diffData, key) => {
        const baseBranchField = find(baseSchema, (item) => item.uid === diffData.uid);
        const compareBranchField = find(compareSchema, (item) => item.uid === diffData.uid);
        let newPath: string;
        if (baseBranchField && !compareBranchField) {
          newPath = `${currentPath}.${baseBranchField['uid']}`;
          prepareDeletedField({ baseField: baseBranchField, changes, path: newPath });
        } else if (compareBranchField && !baseBranchField) {
          newPath = `${currentPath}.${compareBranchField['uid']}`;
          prepareAddedField({ changes, compareField: compareBranchField, path: newPath });
        } else if (compareBranchField && baseBranchField) {
          baseAndCompareSchemaDiff(baseBranchField, compareBranchField, currentPath);
        }
      });
    }

    //case2:- base schema  exists only
    if (baseSchema?.length && !compareSchema?.length && isArray(baseSchema)) {
      forEach(baseSchema, (base, key) => {
        const newPath = `${currentPath}.${base['uid']}`;
        prepareDeletedField({ baseField: base, changes, path: newPath });
      });
    }
    //case3:- compare schema  exists only
    if (!baseSchema?.length && compareSchema?.length && isArray(compareSchema)) {
      forEach(compareSchema, (compare, key) => {
        const newPath = `${currentPath}.${compare['uid']}`;
        prepareAddedField({ changes, compareField: compare, path: newPath });
      });
    }
  }
  baseAndCompareSchemaDiff(baseObj, compareObj);
  return changes;
}

function prepareAddedField(params: { changes: any; compareField: any; path: string }) {
  const { changes, compareField, path } = params;
  if (!changes.added[path]) {
    const obj = {
      displayName: compareField['display_name'],
      fieldType: compareField['data_type'],
      newValue: compareField,
      oldValue: undefined,
      path: path,
      uid: compareField['uid'],
    };
    changes.added[path] = obj;
  }
}

function prepareDeletedField(params: { baseField: any; changes: any; path: string }) {
  const { baseField, changes, path } = params;
  if (!changes.added[path]) {
    const obj = {
      displayName: baseField['display_name'],
      fieldType: baseField['data_type'],
      path: path,
      uid: baseField['uid'],
    };
    changes.deleted[path] = obj;
  }
}

function prepareModifiedField(params: {
  changes: any;
  currentPath: string;
  fullFieldContext: any;
  parentContext: any;
  restBaseObj: any;
  restCompareObj: any;
}) {
  const { changes, currentPath, fullFieldContext, restBaseObj, restCompareObj } = params;
  const differences = diff(restBaseObj, restCompareObj);
  if (differences.length) {
    const modifiedField = {
      changeCount: differences.length,
      displayName: getFieldDisplayName(fullFieldContext) || getFieldDisplayName(restCompareObj) || 'Field',
      fieldType: restCompareObj['data_type'] || 'field',
      path: currentPath,
      propertyChanges: differences.map((diff) => {
        let oldValue = 'from' in diff ? diff.from : undefined;
        const newValue = diff.value;
        if (!('from' in diff) && fullFieldContext && diff.path && diff.path.length > 0) {
          const contextValue = extractValueFromPath(fullFieldContext, diff.path);
          if (contextValue !== undefined) {
            oldValue = contextValue;
          }
        }

        return {
          changeType: diff.op === 'add' ? 'added' : diff.op === 'remove' ? 'deleted' : 'modified',
          newValue: newValue,
          oldValue: oldValue,
          property: diff.path.join('.'),
        };
      }),
      uid: fullFieldContext['uid'] || restCompareObj['uid'],
    };
    if (!changes.modified[currentPath]) changes.modified[currentPath] = modifiedField;
  }
}

export {
  branchCompareSDK,
  deepDiff,
  fetchBranchesDiff,
  filterBranchDiffDataByModule,
  parseCompactText,
  parseSummary,
  parseVerbose,
  prepareBranchVerboseRes,
  prepareModifiedDiff,
  printCompactTextView,
  printSummary,
  printVerboseTextView,
};
