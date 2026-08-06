/**
 * Content type utiles
 * schema template
 * remove reference fields
 * suppress mandatory fields
 */

import { log } from '@contentstack/cli-utilities';

export const schemaTemplate = {
  content_type: {
    title: 'Seed',
    uid: '',
    schema: [
      {
        display_name: 'Title',
        uid: 'title',
        data_type: 'text',
        field_metadata: {
          _default: true,
        },
        unique: false,
        mandatory: true,
        multiple: false,
      },
      {
        display_name: 'URL',
        uid: 'url',
        data_type: 'text',
        field_metadata: {
          _default: true,
        },
        unique: false,
        multiple: false,
      },
    ],
    options: {
      title: 'title',
      publishable: true,
      is_page: true,
      singleton: false,
      sub_title: ['url'],
      url_pattern: '/:title',
      url_prefix: '/',
    },
  },
};

/*!
 * Contentstack Import
 * Copyright (c) 2026 Contentstack LLC
 * MIT Licensed
 */

export const suppressSchemaReference = function (schema: any, flag: any) {
  log.debug('Starting schema reference suppression process');

  for (var i in schema) {
    if (schema[i].data_type === 'group' || schema[i].data_type === 'global_field') {
      log.debug(`Processing ${schema[i].data_type} field: ${schema[i].uid}`);
      suppressSchemaReference(schema[i].schema, flag);
    } else if (schema[i].data_type === 'blocks') {
      log.debug(`Processing blocks field: ${schema[i].uid}`);
      for (var block in schema[i].blocks) {
        suppressSchemaReference(schema[i].blocks[block].schema, flag);
      }
    } else if (schema[i].data_type === 'reference') {
      log.debug(`Found reference field: ${schema[i].uid}`);
      flag.references = true;
    } else if (schema[i].data_type === 'json' && schema[i]?.field_metadata?.rich_text_type) {
      log.debug(`Found JSON RTE field: ${schema[i].uid}`);
      flag.jsonRte = true;
      if (schema[i].field_metadata.embed_entry === true) {
        log.debug(`JSON RTE field has embedded entries: ${schema[i].uid}`);
        flag.jsonRteEmbeddedEntries = true;
      }
    } else if (schema[i].data_type === 'text' && schema[i]?.field_metadata?.rich_text_type) {
      log.debug(`Found text RTE field: ${schema[i].uid}`);
      flag.rte = true;
      if (schema[i].field_metadata.embed_entry === true) {
        log.debug(`Text RTE field has embedded entries: ${schema[i].uid}`);
        flag.rteEmbeddedEntries = true;
      }
    }

    if (
      (schema[i].hasOwnProperty('mandatory') && schema[i].mandatory) ||
      (schema[i].hasOwnProperty('unique') && schema[i].unique)
    ) {
      if (schema[i].uid !== 'title') {
        log.debug(`Suppressing mandatory/unique constraints for field: ${schema[i].uid}`);
        schema[i].unique = false;
        schema[i].mandatory = false;
        flag.suppressed = true;
      }
    }
  }

  log.debug('Schema reference suppression completed');
};

export const removeReferenceFields = async function (
  schema: any,
  flag = { supressed: false },
  stackAPIClient: any,
): Promise<boolean | void> {
  log.debug('Starting reference field removal process');

  if (schema?.length) {
    for (let i = 0; i < schema.length; i++) {
      if (schema[i].data_type === 'group') {
        log.debug(`Processing group field: ${schema[i].uid}`);
        await removeReferenceFields(schema[i].schema, flag, stackAPIClient);
      } else if (schema[i].data_type === 'blocks') {
        log.debug(`Processing blocks field: ${schema[i].uid}`);
        for (var block in schema[i].blocks) {
          await removeReferenceFields(schema[i].blocks[block].schema, flag, stackAPIClient);
        }
      } else if (schema[i].data_type === 'reference') {
        log.debug(`Processing reference field: ${schema[i].uid}`);
        flag.supressed = true;

        // Check if content-type exists
        // If exists, then no change should be required.
        let isContentTypeError = false;

        for (let j = 0; j < schema[i].reference_to.length; j++) {
          try {
            log.debug(`Checking if content type exists: ${schema[i].reference_to[j]}`);
            await stackAPIClient.contentType(schema[i].reference_to[j]).fetch();
            log.debug(`Content type exists: ${schema[i].reference_to[j]}`);
          } catch (error) {
            // Else warn and modify the schema object.
            isContentTypeError = true;
            log.warn(`Content type ${schema[i].reference_to[j]} does not exist. Removing the field from schema...`);
          }
        }

        if (isContentTypeError) {
          log.debug(`Removing reference field due to missing content types: ${schema[i].uid}`);
          schema.splice(i, 1);
          --i;

          if (schema.length < 1) {
            log.debug('Adding dummy field to prevent empty schema');
            schema.push({
              data_type: 'text',
              display_name: 'dummyTest',
              uid: 'dummy_test',
              field_metadata: {
                description: '',
                default_value: '',
                version: 3,
              },
              format: '',
              error_messages: {
                format: '',
              },
              multiple: false,
              mandatory: false,
              unique: false,
              non_localizable: false,
            });
          }
        }
      } else if (
        // handling entry references in json rte
        schema[i].data_type === 'json' &&
        schema[i].field_metadata.allow_json_rte &&
        schema[i].field_metadata.embed_entry &&
        schema[i].reference_to.length > 1
      ) {
        log.debug(`Restricting JSON RTE field to assets only: ${schema[i].uid}`);
        flag.supressed = true;
        schema[i].reference_to = ['sys_assets'];
      } else if (
        // handling entry references in json rte
        schema[i].data_type === 'json' &&
        schema[i]?.field_metadata?.rich_text_type &&
        schema[i]?.field_metadata?.embed_entry &&
        schema[i]?.reference_to?.length > 1
      ) {
        log.debug(`Restricting JSON RTE field to assets only: ${schema[i].uid}`);
        flag.supressed = true;
        schema[i].reference_to = ['sys_assets'];
      } else if (
        // handling entry references in rte
        schema[i].data_type === 'text' &&
        schema[i]?.field_metadata?.rich_text_type &&
        schema[i]?.field_metadata?.embed_entry &&
        schema[i]?.reference_to?.length >= 1
      ) {
        log.debug(`Restricting text RTE field to assets only: ${schema[i].uid}`);
        flag.supressed = true;
        schema[i].reference_to = ['sys_assets'];
      }
    }
  }

  log.debug('Reference field removal process completed');
};

/**
 * A global field rule is a field rule whose conditions/actions reference fields of an embedded
 * global field via dotted paths (e.g. `global_field.reference`). Such rules cannot be validated
 * while the embedded global field schema is still incomplete on the stack, so they are skipped
 * during the content type update and re-applied once all global fields are fully created.
 * This predicate is the single source of truth for identifying them.
 */
export const isGlobalFieldRule = (rule: any): boolean => Boolean(rule?.is_global_field_rule);

/**
 * Returns the content type's field rules filtered to those safe to apply at the current import
 * stage. Two kinds of rules are dropped:
 *
 *  1. Reference-condition rules — a condition whose operand is a `reference`-type field. Their
 *     `value` holds entry uids that do not exist until entries are imported, so they are always
 *     deferred to the entries module (entries.updateFieldRules), which re-applies them with the
 *     entry-uid mapping. These are dropped in every mode.
 *  2. Global field rules (`is_global_field_rule`) — their operand/target are dotted paths into an
 *     embedded global field (e.g. `global_field.reference`) that cannot be validated until that
 *     global field's schema is complete on the stack. Dropped during the content type update; once
 *     the global fields are complete they are re-applied via `keepGlobalFieldRules: true`.
 *
 * @param contentType the content type whose `field_rules` to filter
 * @param options.keepGlobalFieldRules when true, global field rules are retained (reference-condition
 *   rules are still dropped). Used after global fields are complete to apply the GF rules without
 *   prematurely resurrecting the reference-condition rules that entries owns.
 */
export const updateFieldRules = function (
  contentType: any,
  options: { keepGlobalFieldRules?: boolean } = {},
) {
  const { keepGlobalFieldRules = false } = options;
  log.debug(`Starting field rules update for content type: ${contentType.uid}`);

  const fieldDataTypeMap: { [key: string]: string } = {};
  for (let i = 0; i < contentType.schema.length; i++) {
    const field = contentType.schema[i];
    fieldDataTypeMap[field.uid] = field.data_type;
  }

  log.debug(`Created field data type mapping for ${Object.keys(fieldDataTypeMap).length} fields.`);

  const fieldRules = [...contentType.field_rules];
  let len = fieldRules.length;
  let removedRules = 0;

  // Looping backwards as we need to delete elements as we move.
  for (let i = len - 1; i >= 0; i--) {
    // Global field rules reference embedded global field sub-fields via dotted paths
    // (e.g. `global_field.reference`), which cannot be validated while the embedded global field
    // schema is still incomplete and would fail the whole content type update with
    // "Invalid field UID". Dropped during the content type update; re-applied later (see
    // updateGFFieldRules) with keepGlobalFieldRules once all global fields are complete.
    if (!keepGlobalFieldRules && isGlobalFieldRule(fieldRules[i])) {
      log.debug(`Skipping global field rule from content type update`);
      fieldRules.splice(i, 1);
      removedRules++;
      continue;
    }

    const conditions = fieldRules[i].conditions;
    let isReference = false;

    for (let j = 0; j < conditions.length; j++) {
      const field = conditions[j].operand_field;
      if (fieldDataTypeMap[field] === 'reference') {
        log.debug(`Found reference field in rule condition: ${field}`);
        isReference = true;
      }
    }

    if (isReference) {
      log.debug(`Removing field rule with reference condition`);
      fieldRules.splice(i, 1);
      removedRules++;
    }
  }

  log.debug(`Field rules update completed. Removed ${removedRules} rules`);
  return fieldRules;
};
