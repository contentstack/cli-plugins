/* eslint-disable @typescript-eslint/no-var-requires */

const restrictedKeyWords = require('../utils/restrictedKeyWords');
const appDetails = require('../utils/apps/appDetails.json')

// Wildcard-aware keyword match (mirrors reference contentfulSchema.js):
//   "*_ids" → endsWith "_ids";  "prefix_*" → startsWith "prefix_";  else exact.
const matchesPattern = (fieldId, pattern) => {
  const lowerFieldId = String(fieldId).toLowerCase();
  const lowerPattern = String(pattern).toLowerCase();
  if (lowerPattern.startsWith('*')) return lowerFieldId.endsWith(lowerPattern.substring(1));
  if (lowerPattern.endsWith('*')) return lowerFieldId.startsWith(lowerPattern.slice(0, -1));
  return lowerFieldId === lowerPattern;
};

// Field UID that collides with a Contentstack reserved *entry* keyword gets the
// affix as a SUFFIX (e.g. created_at → created_at_cs), matching the reference.
const applySuffixIfRestricted = (fieldId, prefix) => {
  const entries = restrictedKeyWords?.entries || [];
  for (const keyword of entries) {
    if (matchesPattern(fieldId, keyword)) return `${fieldId}_${prefix}`;
  }
  return fieldId;
};

const uidCorrector = (uid, affix) => {
  if (!uid || typeof uid !== 'string') return uid;
  const prefix = affix || 'cs';
  let newId;
  if (uid === 'title') {
    // Reserved built-in title: affix as prefix (reference getNewId special-case).
    newId = `${prefix}_${uid}`.replace(/[^a-zA-Z0-9]+/g, '_');
  } else {
    newId = applySuffixIfRestricted(uid, prefix);
  }
  return newId.replace(/([A-Z])/g, (match) => `${match?.toLowerCase?.()}`);
};

const expandCharClassForI = (cls) => {
  const startsWithNegation = cls.startsWith('^');
  const body = startsWithNegation ? cls.slice(1) : cls;
  const additions = [];
  const addIfMissing = (s) => {
    if (s && !body.includes(s) && !additions.includes(s)) additions.push(s);
  };
  let i = 0;
  const n = body.length;
  while (i < n) {
    const ch = body[i];
    if (ch === '\\' && i + 1 < n) { i += 2; continue; }
    if (i + 2 < n && body[i + 1] === '-' && body[i + 2] !== ']') {
      const a = body[i], b = body[i + 2];
      if (/[a-zA-Z]/.test(a) && /[a-zA-Z]/.test(b)) {
        addIfMissing(/[a-z]/.test(a)
          ? `${a.toUpperCase()}-${b.toUpperCase()}`
          : `${a.toLowerCase()}-${b.toLowerCase()}`);
      }
      i += 3;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      addIfMissing(ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase());
    }
    i++;
  }
  return (startsWithNegation ? '^' : '') + body + additions.join('');
};

const applyRegexFlagsInline = (pattern, flags) => {
  if (!pattern || typeof pattern !== 'string') return pattern;
  if (!flags || !flags.includes('i')) return pattern;
  let out = '';
  let i = 0;
  const n = pattern.length;
  while (i < n) {
    const ch = pattern[i];
    if (ch === '\\' && i + 1 < n) {
      out += ch + pattern[i + 1];
      i += 2;
      continue;
    }
    if (ch === '[') {
      let inner = '';
      let depth = 1;
      i++;
      while (i < n && depth > 0) {
        if (pattern[i] === '\\' && i + 1 < n) {
          inner += pattern[i] + pattern[i + 1];
          i += 2;
          continue;
        }
        if (pattern[i] === ']') { depth--; if (depth === 0) break; }
        inner += pattern[i];
        i++;
      }
      i++;
      out += '[' + expandCharClassForI(inner) + ']';
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      out += `[${ch.toLowerCase()}${ch.toUpperCase()}]`;
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
};

const extractAdvancedFields = (
  item,
  referenceFields = [],
) => {
  const defaultText = item.defaultValue ? Object.values(item.defaultValue)[0] : undefined;
  const validation = item.validations?.[0] || {};
  const uniqueValue = validation?.unique;
  const regexpValidation = (item.validations || []).find((v) => v && v.regexp);
  const regexPattern = regexpValidation?.regexp?.pattern;
  const regexFlags = regexpValidation?.regexp?.flags;
  const regrexValue = applyRegexFlagsInline(regexPattern, regexFlags);
  const validationErrorMessage = regexpValidation?.message ?? validation?.message;
  const rangeValidation = (item.validations || []).find((v) => v && v.range)?.range;
  const numberMin = typeof rangeValidation?.min === 'number' ? rangeValidation.min : undefined;
  const numberMax = typeof rangeValidation?.max === 'number' ? rangeValidation.max : undefined;
  let singleRef = false;
  if (['Link', 'Array'].includes(item.type)) {
    singleRef = !['assetLinkEditor', 'entryLinkEditor', 'entryCardEditor'].includes(item.widgetId);
  }
  // Field instruction = the field's OWN help text only. The content-type
  // description belongs on the content type, not smeared across every field.
  let description = item?.settings?.helpText || '';
  if (description.length > 255) {
    description = description.slice(0, 255);
  }

  return {
    default_value: defaultText,
    validationRegex: regrexValue,
    mandatory: item?.required,
    multiple: singleRef,
    unique: uniqueValue,
    nonLocalizable: !(item?.localized === true),
    validationErrorMessage: validationErrorMessage,
    embedObjects: referenceFields.length ? referenceFields : undefined,
    description: description,
    numberMin: numberMin,
    numberMax: numberMax,
  };
};

const createFieldObject = (item, contentstackFieldType, backupFieldType, referenceFields = []) => ({
  uid: item?.id,
  otherCmsField: item?.name,
  otherCmsType: item?.widgetId,
  contentstackField: item?.name,
  contentstackFieldUid: uidCorrector(item?.id, item?.prefix),
  contentstackFieldType: contentstackFieldType,
  backupFieldType: backupFieldType,
  backupFieldUid: uidCorrector(item?.id, item?.prefix),
  advanced: extractAdvancedFields(item, referenceFields, contentstackFieldType, backupFieldType)
});

const createDropdownOrRadioFieldObject = (item, fieldType) => {
  let choices = [];
  if (item?.items?.validations?.length) {
    item?.items?.validations?.forEach?.((valid) => {
      valid.in?.forEach((value) => choices.push({ value: ["Symbol", "Text", "Array"].includes(item?.items?.type) ? `${value}` : value, key: `${value}` }));
    })
  } else {
    if (!item?.validations?.length) {
      choices.push({ value: 'value', key: 'key' });
    } else {
      item.validations.forEach((valid) => {
        valid.in?.forEach((value) => choices.push({ value: ["Symbol", "Text", "Array"].includes(item.type) ? `${value}` : value, key: `${value}` }));
      });
    }
  }
  return {
    ...createFieldObject(item, fieldType, fieldType),
    advanced: {
      ...extractAdvancedFields(item),
      options: choices
    }
  };
};



const arrangeRte = (itemData, item) => {
  const foundItem = itemData.find((element) => element?.nodes)
  const refs = [];
  if (foundItem?.nodes?.['embedded-entry-inline']) {
    const contentType = foundItem?.nodes?.['embedded-entry-inline']?.find((element) => element?.linkContentType);
    if (contentType?.linkContentType?.length) {
      refs?.push(...contentType?.linkContentType ?? [])
    }
  }
  if (foundItem?.nodes?.['embedded-entry-block']) {
    const contentType = foundItem?.nodes?.['embedded-entry-block']?.find((element) => element?.linkContentType);
    if (contentType?.linkContentType?.length) {
      refs?.push(...contentType?.linkContentType ?? [])
    }
  }
  if (foundItem?.nodes?.["entry-hyperlink"]) {
    const contentType = foundItem?.nodes?.['entry-hyperlink']?.find((element) => element?.linkContentType);
    if (contentType?.linkContentType?.length) {
      refs?.push(...contentType?.linkContentType ?? [])
    }
  }
  if (foundItem?.nodes?.["hyperlink"]) {
    const contentType = foundItem?.nodes?.['hyperlink']?.find((element) => element?.linkContentType);
    if (contentType?.linkContentType?.length) {
      refs?.push(...contentType?.linkContentType ?? [])
    }
  }
  if (refs?.length) {
    const replaceUids = [];
    for (const uid of refs ?? []) {
      replaceUids?.push(uidCorrector(uid, item?.prefix))
    }
    return replaceUids;
  }
  return refs;
}

// When the Contentful export omits `widgetId` (some spaces emit empty controls),
// derive Contentful's default editor from the field type so the inner switches
// below have something to match. Mirrors inferContentfulDefaultWidgetId() in
// src/services/contentful/contentful.service.ts.
const inferDefaultWidgetId = (item) => {
  switch (item.type) {
    case 'Symbol': return 'singleLine';
    case 'Text': return 'multipleLine';
    case 'Integer':
    case 'Number': return 'numberEditor';
    case 'Object': return 'objectEditor';
    case 'Array': {
      const itemsType = item?.items?.type;
      if (itemsType === 'Symbol' || itemsType === 'Text') return 'tagEditor';
      return undefined; // Link items handled by the existing Array/Link branch
    }
    default: return undefined;
  }
};

const contentTypeMapper = (data, entries) => {
  // Contentstack has ONE built-in URL field per content type. If a Contentful
  // content type has several slug fields, only the FIRST becomes the URL field;
  // the rest become single-line text (keeping their own uid) so they don't all
  // collapse into `url` and get lost.
  let slugAssigned = false;
  const schemaArray = data.reduce((acc, item) => {
    if (!item.widgetId) {
      const inferred = inferDefaultWidgetId(item);
      if (inferred) item.widgetId = inferred;
    }
    switch (item.type) {
      case 'RichText': {
        const refsUids = arrangeRte(item?.validations, item);
        const referenceFields = refsUids ?? (item.contentNames?.slice(0, 9) || []);
        acc.push(createFieldObject(item, 'json', 'json', referenceFields));
        break;
      }
      case 'Symbol':
      case 'Text':
        switch (item.widgetId) {
          case 'singleLine':
            acc.push(createFieldObject(item, 'single_line_text', 'single_line_text'));
            break;
          case 'urlEditor':
            // Contentful URL field → Contentstack Link field (title + href).
            acc.push(createFieldObject(item, 'link', 'link'));
            break;
          case 'slugEditor': {
            if (!slugAssigned) {
              // First slug → Contentstack built-in URL field (uid 'url').
              // Forcing the uid to 'url' makes it dedupe with the auto-added url
              // field so there is a single URL field; the entry value is sourced
              // from this slug in createEntry (otherCmsType stays 'slugEditor').
              const slugField = createFieldObject(item, 'url', 'url');
              slugField.contentstackFieldUid = 'url';
              slugField.backupFieldUid = 'url';
              acc.push(slugField);
              slugAssigned = true;
            } else {
              // Additional slug fields can't all be the URL field → keep them as
              // single-line text with their own uid so no field is lost.
              acc.push(createFieldObject(item, 'single_line_text', 'single_line_text'));
            }
            break;
          }
          case 'multipleLine':
            acc.push(createFieldObject(item, 'multi_line_text', 'multi_line_text'));
            break;
          case 'markdown':
            acc.push(createFieldObject(item, 'markdown', 'markdown'));
            break;
          case 'dropdown':
          case 'radio':
            acc.push(createDropdownOrRadioFieldObject(item, item.widgetId));
            break;
          case 'tagEditor':
          case 'listInput':
            // Short-text tags/list → listview_extension (same as the Array branch).
            // Previously only logged, dropping the field and its entry values.
            acc.push(createFieldObject(item, 'extension', 'extension'));
            break;
        }
        break;
      case 'Integer':
      case 'Number':
        switch (item.widgetId) {
          case 'numberEditor':
            acc.push(createFieldObject(item, 'number', 'number'));
            break;
          case 'dropdown':
            item.widgetId = 'dropdownNumber';
            acc.push(createDropdownOrRadioFieldObject(item, 'dropdown'));
            break;
          case 'radio':
            item.widgetId = 'radioNumber';
            acc.push(createDropdownOrRadioFieldObject(item, 'radio'));
            break;
          case 'rating': {
            item.widgetId = 'ratingNumber';
            const starsRaw = Number(item?.settings?.stars);
            const stars = Number.isFinite(starsRaw) && starsRaw > 0 ? Math.floor(starsRaw) : 5;
            item.validations = [{ in: Array.from({ length: stars }, (_, i) => i + 1) }];
            acc.push(createDropdownOrRadioFieldObject(item, 'dropdown'));
            break;
          }
        }
        break;
      case 'Date':
        acc.push(createFieldObject(item, 'isodate', 'isodate'));
        break;

      case 'Array':
      case 'Link': {
        if (!item.widgetId) {
          if (item.type === 'Link') {
            if (item.linkType === 'Asset') item.widgetId = 'assetLinkEditor';
            else if (item.linkType === 'Entry') item.widgetId = 'entryLinkEditor';
          } else if (item.type === 'Array') {
            const itemsLinkType = item?.items?.linkType;
            if (itemsLinkType === 'Asset') item.widgetId = 'assetLinksEditor';
            else if (itemsLinkType === 'Entry') item.widgetId = 'entryLinksEditor';
          }
        }
        switch (item.widgetId) {
          case 'assetLinkEditor':
          case 'assetLinksEditor':
          case 'assetGalleryEditor':
            if (item.type === 'Array') {
              const data = createFieldObject(item, 'file', 'file');
              data.advanced.multiple = true;
              acc.push(data);
            } else {
              acc.push(createFieldObject(item, 'file', 'file'));
            }
            break;

          case 'entryLinksEditor':
          case 'entryLinkEditor':
          case 'entryCardEditor':
          case 'entryCardsEditor': {
            let referenceFields = [];
            let commonRef = [];

            const processLinkContentType = (linkContentType) => {
              return linkContentType
                .filter((e) =>
                  item.contentNames.includes(e.replace(/([A-Z])/g, '_$1').toLowerCase())
                )
                .map((e) => e.replace(/([A-Z])/g, '_$1').toLowerCase());
            };

            const processReferenceFromEntries = (entries, contentTypeUid) => {
              const contentTypeRefs = [];
              const allEntries = entries?.find((entry)=>{
                return entry?.sys?.contentType?.sys?.id === contentTypeUid
              });

              // allEntries is undefined when the referenced content type has no
              // entries in this environment — guard so Object.values doesn't throw.
              const entriesArray = allEntries ? Object.values(allEntries) : [];
              if (entriesArray?.length > 0) {
                entriesArray.forEach((field) => {
                  if (field?.[item?.id]) {
                    const ids = Object.values(field?.[item?.id])
                      .map(localeEntry => localeEntry?.sys?.id)
                      .filter(Boolean);
                    const contentTypesRef = entries?.find((entry)=>{
                      return entry?.sys?.id === ids?.[0];
                    })?.sys?.contentType?.sys?.id?.replace(/([A-Z])/g, "_$1")?.toLowerCase();
                    contentTypeRefs?.push(contentTypesRef)

                  }
                });
              }

              return contentTypeRefs;

            }

            if (!item?.items) {
              if (item?.validations?.length > 0) {
                item.validations.forEach((entries) => {
                  if (entries?.linkContentType?.length) {
                    commonRef = processLinkContentType(entries?.linkContentType);
                    referenceFields =
                      commonRef?.length > 0 ? commonRef : item?.contentNames?.slice(0, 9);
                  }
                });
              } else {
                referenceFields = processReferenceFromEntries(entries,item?.contentfulID);
              }
            } else {
              const firstValidation = item.items.validations?.[0];
              if (firstValidation) {
                commonRef = processLinkContentType(firstValidation.linkContentType);
                referenceFields = commonRef.length > 0 ? commonRef : item.contentNames?.slice(0, 9);
              } else if (item.validations?.length > 0) {
                item.validations.forEach((entries) => {
                  if (entries.linkContentType?.length) {
                    referenceFields = entries?.linkContentType;
                  }
                });
              } else {
                referenceFields = processReferenceFromEntries(entries,item?.contentfulID);
              }
            }
            const refFieldData = createFieldObject(item, 'reference', 'reference', referenceFields)
            refFieldData.refrenceTo = referenceFields;
            acc.push(refFieldData);
            break;
          }
          case 'checkbox':
            acc.push(createDropdownOrRadioFieldObject(item, item.widgetId));
            break;
          case 'tagEditor':
          case 'listInput': {
            acc.push(createFieldObject(item, 'extension', 'extension'))
            break;
          }
          default: {
            // Unrecognized widget (e.g. a custom app) on an Array/Link — don't
            // drop the field. An Array of Symbol/Text → multi single-line text
            // (preserves the list of strings, no extension dependency); anything
            // else → extension so it still lands for review.
            const itemsType = item?.items?.type;
            if (item.type === 'Array' && (itemsType === 'Symbol' || itemsType === 'Text')) {
              const data = createFieldObject(item, 'single_line_text', 'single_line_text');
              data.advanced.multiple = true;
              acc.push(data);
            } else {
              acc.push(createFieldObject(item, 'extension', 'extension'));
            }
            break;
          }
        }

        break;
      }
      case 'Boolean':
        acc.push(createFieldObject(item, 'boolean', 'boolean'));
        break;
      case 'Object': {
        if (item?.widgetId === 'objectEditor') {
          // Plain JSON Object editor → Contentstack JSON field (jsonobject_extension).
          // content-type-creator.ts case 'json' selects jsonobject_extension when
          // otherCmsType is 'Object'/'Array'.
          const data = createFieldObject(item, 'json', 'json');
          data.otherCmsType = 'Object';
          acc.push(data);
        } else {
          const findAppMeta = appDetails?.items?.find((ele) => ele?.sys?.id === item?.widgetId);
          item.name = `${item?.name} (${findAppMeta?.name}-App)`;
          acc.push(createFieldObject(item, 'app', 'app'));
        }
        break;
      }
      case 'Location': {
        acc.push(createFieldObject(item, 'group', 'group'));
        acc.push({
          uid: `${item.id}.lat`,
          otherCmsField: `${item.name} > lat`,
          otherCmsType: 'Number',
          contentstackField: `${item.name} > lat`,
          contentstackFieldUid: `${uidCorrector(item?.id, item?.prefix)}.lat`,
          contentstackFieldType: 'number',
          backupFieldType: 'number',
          backupFieldUid: `${uidCorrector(item?.id, item?.prefix)}.lat`,
          advanced: {
            mandatory: item?.required,
            unique: false,
            nonLocalizable: !(item?.localized === true) || false
          }
        });
        acc.push({
          uid: `${item.id}.lon`,
          otherCmsField: `${item.name} > lon`,
          otherCmsType: 'Number',
          contentstackField: `${item.name} > lon`,
          contentstackFieldUid: `${uidCorrector(item?.id, item?.prefix)}.lon`,
          contentstackFieldType: 'number',
          backupFieldType: 'number',
          backupFieldUid: `${uidCorrector(item?.id, item?.prefix)}.lon`,
          advanced: {
            mandatory: item?.required,
            unique: false,
            nonLocalizable: !(item?.localized === true) || false
          }
        });
        break;
      }
    }
    return acc;
  }, []);
  return schemaArray;
};
module.exports = contentTypeMapper;
