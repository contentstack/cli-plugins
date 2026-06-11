import path from 'path';
import fs from 'fs';
import { MIGRATION_DATA_CONFIG } from '../constants.js';
import { parseJsonLoose } from '../../../lib/parse-json-loose.js';

const {
  // DIR
  LOCALE_DIR_NAME,
  RTE_REFERENCES_DIR_NAME,
  ASSETS_DIR_NAME,
  // FILE
  LOCALE_MASTER_LOCALE,
  ASSETS_SCHEMA_FILE,
  RTE_REFERENCES_FILE_NAME,

} = MIGRATION_DATA_CONFIG;
type NodeType = string;
type LangType = string;
type StackId = string;

function readFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    return parseJsonLoose(fs.readFileSync(filePath, 'utf-8'));
  }
  return undefined;
}

const parsers: Map<NodeType, (obj: any, lang?: LangType, destination_stack_id?: StackId) => any> = new Map([
  ['document', parseDocument],
  ['paragraph', parseParagraph],
  ['text', parseText],
  ['hr', parseHR],
  ['list-item', parseLI],
  ['unordered-list', parseUL],
  ['ordered-list', parseOL],
  ['embedded-entry-block', parseBlockReference],
  ['embedded-entry-inline', parseInlineReference],
  ['embedded-asset-block', parseBlockAsset],
  ['blockquote', parseBlockquote],
  ['heading-1', parseHeading1],
  ['heading-2', parseHeading2],
  ['heading-3', parseHeading3],
  ['heading-4', parseHeading4],
  ['heading-5', parseHeading5],
  ['heading-6', parseHeading6],
  ['entry-hyperlink', parseEntryHyperlink],
  ['asset-hyperlink', parseAssetHyperlink],
  ['hyperlink', parseHyperlink],
  ['table', parseTable],
  ['table-row', parseTableRow],
  ['head-tr', parseHeadTR],
  ['table-header-cell', parseTableHead],
  ['tbody', parseTBody],
  ['body-tr', parseBodyTR],
  ['table-cell', parseTableBody],
]);

export default function jsonParse(obj: { nodeType: NodeType }, lang?: LangType, destination_stack_id?: StackId,) {
  const parser = parsers.get(obj.nodeType);
  if (parser) {
    return parser(obj, lang, destination_stack_id);
  }
  return null;
}

function generateUID(prefix: string): string {
  return `${prefix}${Math.floor(Math.random() * 100000000000000)}`;
}

const isFilled = (e: any) => !(e === null || e === undefined);

/**
 * Map a node's content into child nodes, flattening a child `paragraph`'s
 * children inline (matching the Team Fury reference). Used by headings, list
 * items, blockquote, list containers, and table cells so a wrapping `<p>` is
 * not nested inside them.
 */
function mapFlattenChildren(content: any[], lang?: LangType, destination_stack_id?: StackId): any[] {
  const out: any[] = [];
  for (const e of content ?? []) {
    const parser = parsers.get(e?.nodeType);
    if (!parser) continue;
    const parsed = parser(e, lang, destination_stack_id);
    if (e?.nodeType === 'paragraph' && e?.content && parsed?.children) {
      out.push(...parsed.children);
    } else if (isFilled(parsed)) {
      out.push(parsed);
    }
  }
  return out.filter(isFilled);
}

function parseDocument(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  const children = (obj.content ?? [])
    .map((e: any) => parsers.get(e.nodeType)?.(e, lang, destination_stack_id))
    .filter(isFilled);

  return {
    type: 'doc',
    attrs: {},
    uid: generateUID('doc'),
    children: [
      {
        type: 'p',
        attrs: {},
        uid: generateUID('p'),
        children: [{ text: '' }],
      },
      ...children,
    ],
    _version: 1,
  };
}

function parseTable(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  const rowCount = obj.content.length;
  const colCount = Math.max(...obj.content.map((e: any) => e.content.length));
  const attrs = {
    rows: rowCount,
    cols: colCount,
    colWidths: Array(colCount).fill(250),
  };
  const children = obj.content
    .map((e: any) => parsers.get(e.nodeType)?.(e, lang, destination_stack_id))
    .concat(parsers.get('tbody')?.(obj, lang, destination_stack_id))
    .filter(isFilled);

  return {
    type: 'table',
    attrs,
    uid: generateUID('table'),
    children,
  };
}

// Reference parses a header row (all cells are table-header-cell) into a
// `thead` > `head-tr`. Body rows return undefined here and are emitted via
// `tbody` instead, so each row appears exactly once.
function parseTableRow(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  const cells = obj.content ?? [];
  const allHeader = cells.length > 0 && cells.every((c: any) => c?.nodeType === 'table-header-cell');
  if (!allHeader) return undefined;

  const children = [parsers.get('head-tr')?.(cells, lang, destination_stack_id)].filter(isFilled);
  return children.length ? { type: 'thead', attrs: {}, uid: generateUID('tabletype'), children } : undefined;
}

function parseHeadTR(obj: any[], lang?: LangType, destination_stack_id?: StackId): any {
  const children = obj.map((e: any) => parsers.get(e.nodeType)?.(e, lang, destination_stack_id)).filter(isFilled);
  return {
    type: 'tr',
    attrs: {},
    uid: generateUID('tr'),
    children,
  };
}

function parseTableHead(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  return {
    type: 'th',
    attrs: {},
    uid: generateUID('th'),
    children: mapFlattenChildren(obj.content, lang, destination_stack_id),
  };
}

function parseTBody(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  const children = obj.content.map((e: any) => parsers.get('body-tr')?.(e, lang, destination_stack_id)).filter(isFilled);
  return {
    type: 'tbody',
    attrs: {},
    uid: generateUID('tbody'),
    children,
  };
}

function parseBodyTR(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  const children = obj.content
    .filter((e: any) => e.nodeType === 'table-cell')
    .map((e: any) => parsers.get('table-cell')?.(e, lang, destination_stack_id))
    .filter(isFilled);
  return children.length ? { type: 'tr', attrs: {}, uid: generateUID('tr'), children } : null;
}

function parseTableBody(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  const children = mapFlattenChildren(obj.content, lang, destination_stack_id);
  return children.length ? { type: 'td', attrs: {}, uid: generateUID('td'), children } : null;
}

function parseParagraph(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  const children = obj.content.map((e: any) => parsers.get(e.nodeType)?.(e, lang, destination_stack_id)).filter(isFilled);
  return {
    type: 'p',
    attrs: {},
    uid: generateUID('p'),
    children,
  };
}

function parseText(obj: any): any {
  const result: { text: string;[key: string]: boolean | string } = { text: obj.value };
  obj.marks.forEach((e: any) => {
    result[e.type.replace('code', 'inlineCode')] = true;
  });
  return result;
}

function parseHR(): any {
  return {
    type: 'hr',
    attrs: {},
    uid: generateUID('hr'),
    children: [{ text: '' }],
  };
}

function parseUL(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  return {
    uid: generateUID('ul'),
    type: 'ul',
    children: mapFlattenChildren(obj.content, lang, destination_stack_id),
    id: generateUID('ul'),
    attrs: {},
  };
}

function parseOL(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  return {
    uid: generateUID('ol'),
    type: 'ol',
    children: mapFlattenChildren(obj.content, lang, destination_stack_id),
    id: generateUID('ul'),
    attrs: {},
  };
}

function parseLI(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  return {
    type: 'li',
    attrs: {},
    uid: generateUID('li'),
    children: mapFlattenChildren(obj.content, lang, destination_stack_id),
  };
}

function parseBlockReference(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  const entryId: { [key: string]: any } = (destination_stack_id && readFile(path.join(MIGRATION_DATA_CONFIG.DATA, destination_stack_id, RTE_REFERENCES_DIR_NAME, RTE_REFERENCES_FILE_NAME))) || {};
  const defaultLocale = (destination_stack_id && readFile(path.join(MIGRATION_DATA_CONFIG.DATA, destination_stack_id, LOCALE_DIR_NAME, LOCALE_MASTER_LOCALE))) || {};
  const masterLocale = Object.values(defaultLocale).map((localeId: any) => localeId?.code).filter(Boolean).join();

  if (masterLocale === lang || lang) {
    for (const [arrayKey, arrayValue] of Object.entries(entryId)) {
      if (arrayValue?.[obj?.data?.target?.sys?.id]?._content_type_uid && lang === arrayKey) {
        return {
          type: 'reference',
          attrs: {
            'display-type': 'block',
            type: 'entry',
            'class-name': 'embedded-entry redactor-component block-entry',
            'entry-uid': obj.data.target.sys.id,
            locale: arrayKey,
            'content-type-uid': arrayValue[obj.data.target.sys.id]._content_type_uid,
          },
          uid: generateUID('reference'),
          children: [{ text: '' }],
        };
      }
    }
  }
  return {
    type: 'p',
    attrs: {},
    uid: generateUID('reference'),
    children: [{ text: '' }],
  };
}

function parseInlineReference(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  const entryId: { [key: string]: any } = destination_stack_id && readFile(path.join(MIGRATION_DATA_CONFIG.DATA,destination_stack_id, RTE_REFERENCES_DIR_NAME, RTE_REFERENCES_FILE_NAME));
  const entry = entryId && Object.entries(entryId).find(([arrayKey, arrayValue]) => arrayKey === lang && arrayValue[obj.data.target.sys.id]);

  if (entry) {
    const [arrayKey, arrayValue] = entry;
    if (arrayValue?.[obj?.data?.target?.sys?.id]?._content_type_uid && arrayKey) {
      return {
        type: 'reference',
        attrs: {
          'display-type': 'block',
          type: 'entry',
          'class-name': 'embedded-entry redactor-component block-entry',
          'entry-uid': obj.data.target.sys.id,
          locale: arrayKey,
          'content-type-uid': arrayValue?.[obj?.data?.target?.sys?.id]?._content_type_uid,
        },
        uid: generateUID('reference'),
        children: [{ text: '' }],
      };
    }
  }

  return {
    type: 'p',
    attrs: {},
    uid: generateUID('reference'),
    children: [{ text: '' }],
  };
}

function parseBlockAsset(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  const assetId = (destination_stack_id && readFile(path.join(MIGRATION_DATA_CONFIG.DATA,destination_stack_id, ASSETS_DIR_NAME, ASSETS_SCHEMA_FILE))) || {};
  const asset = assetId?.[obj?.data?.target?.sys?.id];

  if (asset) {
    return {
      type: 'reference',
      attrs: {
        'display-type': 'download',
        'asset-uid': obj.data.target.sys.id,
        'content-type-uid': 'sys_assets',
        'asset-link': asset?.url,
        'asset-name': asset?.filename,
        'asset-type': asset?.content_type,
        type: 'asset',
        'class-name': 'embedded-asset',
        inline: false,
        width: 443,
        height: 266,
      },
      uid: generateUID('reference'),
      children: [{ text: '' }],
    };
  }

  return {
    type: 'p',
    attrs: {},
    uid: generateUID('reference'),
    children: [{ text: '' }],
  };
}

function parseBlockquote(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  return {
    type: 'blockquote',
    attrs: {},
    uid: generateUID('blockquote'),
    children: mapFlattenChildren(obj.content, lang, destination_stack_id),
  };
}

function parseHeading1(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  return {
    type: 'h1',
    attrs: {},
    uid: generateUID('h1'),
    children: mapFlattenChildren(obj.content, lang, destination_stack_id),
  };
}

function parseHeading2(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  return {
    type: 'h2',
    attrs: {},
    uid: generateUID('h2'),
    children: mapFlattenChildren(obj.content, lang, destination_stack_id),
  };
}

function parseHeading3(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  return {
    type: 'h3',
    attrs: {},
    uid: generateUID('h3'),
    children: mapFlattenChildren(obj.content, lang, destination_stack_id),
  };
}

function parseHeading4(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  return {
    type: 'h4',
    attrs: {},
    uid: generateUID('h4'),
    children: mapFlattenChildren(obj.content, lang, destination_stack_id),
  };
}

function parseHeading5(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  return {
    type: 'h5',
    attrs: {},
    uid: generateUID('h5'),
    children: mapFlattenChildren(obj.content, lang, destination_stack_id),
  };
}

function parseHeading6(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  return {
    type: 'h6',
    attrs: {},
    uid: generateUID('h6'),
    children: mapFlattenChildren(obj.content, lang, destination_stack_id),
  };
}

// Aligned with Team Fury reference jsonRTE.js: entry-hyperlink → reference
// (block entry), asset-hyperlink → reference (asset link), hyperlink → `a`.
function parseEntryHyperlink(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  const entryId: { [key: string]: any } =
    (destination_stack_id &&
      readFile(
        path.join(MIGRATION_DATA_CONFIG.DATA, destination_stack_id, RTE_REFERENCES_DIR_NAME, RTE_REFERENCES_FILE_NAME),
      )) ||
    {};
  const targetId = obj?.data?.target?.sys?.id;
  let attrs: any = {};
  for (const [arrayKey, arrayValue] of Object.entries(entryId)) {
    const hit = (arrayValue as any)?.[targetId];
    if (hit?._content_type_uid) {
      attrs = {
        'display-type': 'block',
        type: 'entry',
        'class-name': 'embedded-entry redactor-component block-entry',
        'entry-uid': targetId,
        locale: arrayKey,
        'content-type-uid': hit._content_type_uid,
      };
    }
  }
  const children = (obj?.content ?? [])
    .map((e: any) => parsers.get(e.nodeType)?.(e, lang, destination_stack_id))
    .filter(isFilled);
  return { uid: generateUID('reference'), type: 'reference', attrs, children };
}

function parseAssetHyperlink(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  const assetId =
    (destination_stack_id &&
      readFile(path.join(MIGRATION_DATA_CONFIG.DATA, destination_stack_id, ASSETS_DIR_NAME, ASSETS_SCHEMA_FILE))) ||
    {};
  const targetId = obj?.data?.target?.sys?.id;
  const asset = assetId?.[targetId];
  if (asset) {
    const children = (obj?.content ?? [])
      .map((e: any) => parsers.get(e.nodeType)?.(e, lang, destination_stack_id))
      .filter(isFilled);
    return {
      uid: generateUID('reference'),
      type: 'reference',
      attrs: {
        'display-type': 'link',
        type: 'asset',
        'class-name': 'embedded-entry redactor-component undefined-entry',
        'asset-uid': targetId,
        'content-type-uid': 'sys_assets',
        target: '_blank',
        href: asset.url,
      },
      children,
    };
  }
  // Reference returns an empty paragraph (not null) when the asset is missing.
  return { type: 'p', attrs: {}, uid: generateUID('reference'), children: [{ text: '' }] };
}

function parseHyperlink(obj: any, lang?: LangType, destination_stack_id?: StackId): any {
  const children = (obj?.content ?? [])
    .map((e: any) => parsers.get(e.nodeType)?.(e, lang, destination_stack_id))
    .filter(isFilled);
  return {
    uid: generateUID('a'),
    type: 'a',
    attrs: { url: obj?.data?.uri, target: '_blank' },
    children,
  };
}
