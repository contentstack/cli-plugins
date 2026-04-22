export interface BranchOptions {
  authToken?: string;
  baseBranch?: string;
  compareBranch: string;
  csvPath?: string;
  format: string;
  host?: string;
  module: string;
  stackAPIKey: string;
}

export interface BranchDiffRes {
  merge_strategy?: string;
  status: string;
  title: string;
  type: string;
  uid: string;
}

export interface BranchDiffSummary {
  base: string;
  base_only: number;
  compare: string;
  compare_only: number;
  modified: number;
}

export interface BranchCompactTextRes {
  added?: BranchDiffRes[];
  deleted?: BranchDiffRes[];
  modified?: BranchDiffRes[];
}

export interface MergeSummary {
  requestPayload: MergeSummaryRequestPayload;
}

type MergeSummaryRequestPayload = {
  base_branch: string;
  compare_branch: string;
  default_merge_strategy: string;
  item_merge_strategies?: any[];
  merge_comment?: string;
  no_revert?: boolean;
};
export interface MergeInputOptions {
  baseBranch: string;
  branchCompareData: any;
  compareBranch: string;
  enableEntryExp: boolean;
  executeOption?: string;
  exportSummaryPath?: string;
  format?: string;
  host: string;
  mergeComment?: string;
  mergeSummary?: MergeSummary;
  noRevert?: boolean;
  stackAPIKey: string;
  strategy: string;
  strategySubOption: string;
}

export interface ModifiedFieldsType {
  changeCount?: number;
  changeDetails?: string;
  displayName: string;
  field: string;
  newValue?: any;
  oldValue?: any;
  path: string;
  propertyChanges?: PropertyChange[];
  uid: string;
}

export interface PropertyChange {
  changeType: 'added' | 'deleted' | 'modified';
  newValue?: any;
  oldValue?: any;
  property: string;
}

export interface CSVRow {
  contentTypeName: string;
  fieldName: string;
  fieldPath: string;
  operation: string;
  sourceBranchValue: string;
  srNo: number;
  targetBranchValue: string;
}

export interface AddCSVRowParams {
  contentTypeName: string;
  fieldName: string;
  fieldType: string;
  sourceValue: string;
  srNo: number;
  targetValue: string;
}

export const FIELD_TYPES = ['modified', 'added', 'deleted'] as const;

export const CSV_HEADER = 'Sr No,Content Type Name,Field Name,Field Path,Operation,Source Branch Value,Target Branch Value\n';

export interface ContentTypeItem {
  title?: string;
  uid?: string;
}

export interface ModifiedFieldsInput {
  added?: ModifiedFieldsType[];
  deleted?: ModifiedFieldsType[];
  modified?: ModifiedFieldsType[];
}

export interface BranchModifiedDetails {
  modifiedFields: ModifiedFieldsInput;
  moduleDetails: BranchDiffRes;
}

export interface BranchDiffVerboseRes {
  added?: BranchDiffRes[];
  csvData?: CSVRow[]; // Pre-processed CSV data
  deleted?: BranchDiffRes[];
  modified?: BranchModifiedDetails[];
}

export interface BranchDiffPayload {
  apiKey: string;
  baseBranch: string;
  compareBranch: string;
  filter?: string;
  host?: string;
  module: string;
  spinner?: any;
  uid?: string;
  url?: string;
}

export type MergeStrategy =
  | 'ignore'
  | 'merge_modified_only_prefer_base'
  | 'merge_modified_only_prefer_compare'
  | 'merge_new_only'
  | 'merge_prefer_base'
  | 'merge_prefer_compare'
  | 'overwrite_with_compare';

export interface MergeParams {
  base_branch: string;
  compare_branch: string;
  default_merge_strategy: MergeStrategy;
  merge_comment: string;
  no_revert?: boolean;
}

export interface MergeStatusOptions {
  host?: string;
  mergeUID: string;
  stackAPIKey: string;
}

export interface GenerateScriptsOptions {
  host?: string;
  mergeUID: string;
  stackAPIKey: string;
}

export interface MergeJobStatusResponse {
  errors?: Array<{ details?: string; field?: string; message: string }>;
  merge_details: {
    completed_at?: string;
    completion_percentage?: number;
    created_at: string;
    status: string;
    updated_at: string;
  };
  merge_summary: {
    content_types: { added: number; deleted: number; modified: number };
    global_fields: { added: number; deleted: number; modified: number };
  };
  pollingTimeout?: boolean;
  status: 'complete' | 'failed' | 'in_progress' | 'unknown';
  uid: string;
}
