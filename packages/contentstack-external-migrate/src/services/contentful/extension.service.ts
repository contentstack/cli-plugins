import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { MIGRATION_DATA_CONFIG, LIST_EXTENSION_UID, JSON_EDITOR_EXTENSION_UID } from './constants';
import appMeta from './app/index.json';

const {
  CUSTOM_MAPPER_FILE_NAME,
  EXTENSION_APPS_DIR_NAME,
  EXTENSION_APPS_FILE_NAME,
  EXTENSIONS_MAPPER_DIR_NAME,
  MARKETPLACE_APPS_DIR_NAME,
  MARKETPLACE_APPS_FILE_NAME,
} = MIGRATION_DATA_CONFIG;

const writeExtFile = async ({ destinationStackId, extensionData }: any) => {
  const dirPath = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, EXTENSION_APPS_DIR_NAME);
  try {
    await fs.promises.access(dirPath);
  } catch (err) {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (mkdirErr) {
      console.error('fs.mkdir failed:', mkdirErr);
      return;
    }
  }
  try {
    const filePath = path.join(dirPath, EXTENSION_APPS_FILE_NAME);
    await fs.promises.writeFile(filePath, JSON.stringify(extensionData, null, 2));
  } catch (writeErr) {
    console.error('fs.writeFile failed:', writeErr);
  }
};

const getExtension = ({ uid, destinationStackId }: any) => {
  if (uid === LIST_EXTENSION_UID) {
    return {
      stackHeaders: { api_key: destinationStackId },
      urlPath: `/extensions/${destinationStackId}`,
      uid: LIST_EXTENSION_UID,
      created_at: '2025-02-18T14:45:22.630Z',
      updated_at: '2025-02-18T14:45:22.630Z',
      created_by: 'bltba052dc70a273dd2',
      updated_by: 'bltba052dc70a273dd2',
      tags: [],
      _version: 1,
      title: 'Key-value Field',
      config: {},
      type: 'field',
      data_type: 'json',
      multiple: false,
      srcdoc:
        '<!doctype html>\n<html ng-app="keyValuePair">\n\n<head>\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <script src="https://cdnjs.cloudflare.com/ajax/libs/angular.js/1.4.4/angular.min.js"></script>\n    <script src="https://cdnjs.cloudflare.com/ajax/libs/angular-ui-tree/2.22.6/angular-ui-tree.min.js"></script>\n    <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/angular-ui-tree/2.22.6/angular-ui-tree.min.css"/>\n    <script\n    src="https://unpkg.com/@contentstack/ui-extensions-sdk@2.2.1/dist/ui-extension-sdk.js"\n    integrity="sha512-Zvd/rx8MHdudDeY916W50kakd+G/7Z/L4VvG0A/NBWVtmAlD7FPHcWDHc5a4WpGSXoXDgy2SLLDVrASxM7IpNQ=="\n    crossorigin="anonymous"></script>\n    <link\n    rel="stylesheet"\n    type="text/css"\n    href="https://unpkg.com/@contentstack/ui-extensions-sdk@2.2.1/dist/ui-extension-sdk.css"\n    integrity="sha512-YFrH8bTpkhIRTf8jgGmJDWvd56LA9GnRzirfMr/K78ldxsyrfedaMxMCZMC9A9d0LzuVFhkkHWo10HWEoAgjjg=="\n    crossorigin="anonymous"/>\n    <style>\n        .cs-text-box {\n            margin-bottom: 5px;\n            margin-left: 10px;\n        }\n\n        .sort-list {\n            display: inline-block;\n            width: 100%;\n            position: relative;\n        }\n\n        .sort-list:hover>.drag-icon {\n            visibility: visible;\n        }\n\n        .main-div {\n            width: 450px;\n        }\n        .ml-0 {\n           margin-left: 0;\n        }\n    </style>\n</head>\n\n<body>\n    <div ng-controller="keyValueCtrl">\n        <div ui-tree="treeOptions">\n            <div ui-tree-nodes ng-model="list.value" class="main-div">\n                <div ui-tree-node data-ng-repeat="x in list.value" class="sort-list">\n                    <input type="text" class="cs-text-box" ng-model="x.key" ng-change="setValue()" ng-focus="setFocus()" placeholder="Key" ng-value="x.key"\n                    /> :\n                    <input type="text" class="cs-text-box ml-0" ng-model="x.value" ng-change="setValue()" ng-focus="setFocus()" placeholder="Value"\n                        ng-value="x.value" />\n                    <i ng-click="removeKey($index);setFocus()" class="minus-sign" ng-show="list.value.length !== 1"></i>\n                    <i ng-click="addMoreKey();setFocus()" class="plus-sign" ng-show="$last"></i>\n                    <div class="drag-icon" ng-show="list.value.length !== 1" ui-tree-handle></div>\n                </div>\n            </div>\n        </div>\n\n    </div>\n    <script>\n        var app = angular.module("keyValuePair", [\'ui.tree\']);\n        app.controller("keyValueCtrl", function ($scope, $timeout) {\n\n            $scope.addMoreKey = function () {\n                $scope.list.value.push({ "key": "", "value": "" });\n                $scope.setValue();\n            };\n\n            $scope.removeKey = function (index) {\n                $scope.list.value.splice(index, 1);\n                $scope.setValue();\n            };\n\n            $scope.setFocus = function () {\n                extensionField.field.setFocus();\n            };\n\n            $scope.setValue = function () {\n                extensionField.field.setData($scope.list);\n\n            };\n\n            $scope.treeOptions = {\n                dragStop: function () {\n                    $timeout(function () {\n                        $scope.setValue();\n                    }, 10);\n                }\n            };\n\n\n\n            ContentstackUIExtension.init().then(function (extension) {\n                extensionField = extension;\n                $scope.$apply(function () {\n                    $scope.list = (extension && extension.field && extension.field.getData()) ? extension.field.getData() : {};\n                    if (angular.equals($scope.list, {})) {\n                        $scope.list = {\n                            "value": [{ "key": "", "value": "" }]\n                        }\n                    }\n                })\n\n                extensionField.window.updateHeight();\n                extensionField.window.enableAutoResizing();\n            })\n        });\n\n    </script>\n</body>\n\n</html>',
    };
  }
  if (uid === JSON_EDITOR_EXTENSION_UID) {
    return {
      stackHeaders: { api_key: destinationStackId },
      urlPath: `/extensions/${destinationStackId}`,
      uid: JSON_EDITOR_EXTENSION_UID,
      created_at: '2026-06-04T12:19:05.651Z',
      updated_at: '2026-06-04T12:19:05.651Z',
      created_by: 'bltba052dc70a273dd2',
      updated_by: 'bltba052dc70a273dd2',
      tags: [],
      _version: 1,
      title: 'JSON Editor',
      config: {},
      type: 'field',
      data_type: 'json',
      multiple: false,
      srcdoc:
        '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8"/>\n    <title>Ace Editor Extension</title>\n    <style>\n      body { margin: 0; }\n    </style>\n    <!--\n    Load the Extensions API that is used to communicate with the containing app.\n    -->\n    <script src="https://www.contentstack.com/sdks/contentstack-ui-extensions/dist/latest/ui-extension-sdk.js"></script>\n    <!--\n    We use lodash.throttle to avoid spamming the API with changes\n    -->\n    <script src="https://cdn.jsdelivr.net/npm/lodash@4.17.4/lodash.min.js"></script>\n    \n    <!-- load a custom version of Ace editor -->\n    <script src="https://cdnjs.cloudflare.com/ajax/libs/ace/1.2.6/ace.js"></script>\n   \n    <link href="https://assets.contentstack.io/v3/assets/blt30b41f7b9a5d7467/bltb6bb4f7db098181f/5b39e605fda2af4e7866b92c/jsoneditor.min.css" rel="stylesheet" type="text/css">\n    <script src="https://assets.contentstack.io/v3/assets/blt30b41f7b9a5d7467/blte7fe106cc93cf2bf/5b33888fcfc846f95726af6f/jsoneditor.min.js"></script>\n   \n  </head>\n  <body  onclick="setFocus()">\n    <div id="jsoneditor"></div>\n    \n    <script>\n        // initialise Field Extension\n        window.extensionField = {};\n        \n        // find jsoneditor element\n        var jsoneditorElement = document.getElementById("jsoneditor");\n        \n        // initialise variable for json editor plugin\n        var jsonEditor = {};\n    \n        \n        ContentstackUIExtension.init().then(function(extension) {\n            \n            // make extension object globally available\n            extensionField = extension;\n            \n            \n            // update the field height \n            extensionField.window.updateHeight(220);\n            \n            // Get current Json editor field value from Contentstack and update the element\n            var value = extensionField.field.getData() || {};\n            \n            \n            // Configure Json editor\n            var options = {\n                modes: [\'text\', \'code\', \'tree\', \'form\', \'view\'],\n                mode: \'code\',\n                ace: ace,\n                onChange : function(){\n                    updateFieldValue();\n                }\n            };\n            \n            jsonEditor = new JSONEditor(jsoneditorElement, options);\n            jsonEditor.set(value);\n            \n            \n            \n      \n            \n        })\n        \n        function setFocus(){\n            extensionField.field.setFocus();\n        }\n        \n        function updateFieldValue () {\n          var value = jsonEditor.get();\n          extensionField.field.setData(value).then(function(){\n            \t\tconsole.log(\'data set on child\')\n            \t}).catch(function(error){\n            \t\tconsole.log(\'error in setting data\',error)\n            \t})\n        }\n    </script>\n  </body>\n</html>',
    };
  }
  return null;
};

// Walk a schema array and collect any `extension_uid` values from any depth
// (groups, modular blocks, and global fields all nest a `schema` array).
const collectExtensionUidsFromSchema = (schema: any[], out: Set<string>) => {
  if (!Array.isArray(schema)) return;
  for (const f of schema) {
    if (f?.extension_uid && typeof f.extension_uid === 'string') out.add(f.extension_uid);
    if (Array.isArray(f?.schema)) collectExtensionUidsFromSchema(f.schema, out);
    if (Array.isArray(f?.blocks)) {
      for (const b of f.blocks) collectExtensionUidsFromSchema(b?.schema ?? [], out);
    }
  }
};

const createExtension = async ({ destinationStackId }: any) => {
  const stackRoot = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId);
  const uniqueExtUids = new Set<string>();

  // 1) custmon-mapper.json entries written by content-type-creator (existing path).
  //    These appends race, so this file may be incomplete — content-type scan
  //    below covers what's missing.
  const extMapper: any = await fs.promises
    .readFile(path.join(stackRoot, CUSTOM_MAPPER_FILE_NAME), 'utf-8')
    .catch(() => undefined);
  if (extMapper !== undefined) {
    try {
      const extJson = JSON.parse(extMapper);
      for (const item of extJson ?? []) {
        if (item?.extensionUid) uniqueExtUids.add(item.extensionUid);
      }
    } catch {
      // ignore malformed file; fall through to content-type scan
    }
  }

  // 2) Scan the just-written content_types/*.json for every `extension_uid`
  //    actually referenced. Robust to the saveAppMapper race in step 1.
  const ctDir = path.join(stackRoot, 'content_types');
  try {
    const files = await fs.promises.readdir(ctDir);
    for (const f of files) {
      if (!f.endsWith('.json') || f === 'schema.json') continue;
      try {
        const ct = JSON.parse(await fs.promises.readFile(path.join(ctDir, f), 'utf8'));
        collectExtensionUidsFromSchema(ct?.schema ?? [], uniqueExtUids);
      } catch {
        // skip unreadable file
      }
    }
  } catch {
    // no content_types dir → nothing to scan
  }

  if (uniqueExtUids.size === 0) return;

  const extensionData: any = {};
  for (const extUid of uniqueExtUids) {
    const extData = getExtension({ uid: extUid, destinationStackId });
    if (extData) {
      extensionData[extUid] = extData;
    }
  }
  if (Object.keys(extensionData).length > 0) {
    await writeExtFile({ destinationStackId, extensionData });
  }
};

/**
 * Write marketplace_apps.json so `app`-type fields work on a fresh stack.
 *
 * `app` fields reference a marketplace app's custom-field extension_uid
 * (`<appExtensionUid>-cs.cm.stack.custom_field`), which only exists once the app
 * is installed. The `app` case in content-type-creator records each app's
 * (appUid, extensionUid) in extension-mapper.json; this turns those into an
 * install manifest the native csdx import can act on.
 *
 * NOTE: the exact marketplace_apps shape csdx import accepts should be validated
 * against a real `csdx cm:stacks:import` run; installation also requires an org
 * with the app available. Without this file, app fields break silently.
 */
const createMarketplaceApps = async ({ destinationStackId }: any) => {
  const stackRoot = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId);

  const raw = await fs.promises
    .readFile(path.join(stackRoot, EXTENSIONS_MAPPER_DIR_NAME), 'utf-8')
    .catch(() => undefined);
  if (raw === undefined) return;

  let appEntries: any[] = [];
  try {
    appEntries = JSON.parse(raw) ?? [];
  } catch {
    return; // malformed mapper → nothing to install
  }

  const appUids = new Set<string>();
  for (const item of appEntries) {
    if (item?.appUid) appUids.add(item.appUid);
  }
  if (appUids.size === 0) return;

  const marketplaceApps: any[] = [];
  for (const appUid of appUids) {
    const meta = (appMeta as any)?.entries?.find((e: any) => e?.app_uid === appUid);
    const name = meta?.title ?? 'Custom App';
    marketplaceApps.push({
      uid: uuidv4(),
      manifest: { uid: appUid, name },
      title: name,
      configuration: {},
      server_configuration: {},
      ui_location: { locations: [] },
      target: { type: 'stack' },
    });
  }

  const dirPath = path.join(stackRoot, MARKETPLACE_APPS_DIR_NAME);
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
    await fs.promises.writeFile(
      path.join(dirPath, MARKETPLACE_APPS_FILE_NAME),
      JSON.stringify(marketplaceApps, null, 2),
    );
  } catch (writeErr) {
    console.error('fs.writeFile marketplace_apps failed:', writeErr);
  }
};

export const extensionService = {
  createExtension,
  createMarketplaceApps,
};
