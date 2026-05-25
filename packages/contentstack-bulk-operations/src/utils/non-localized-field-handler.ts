/**
 * Non-localized field handler utilities
 * Provides functions to identify and compare non-localized fields
 */

/**
 * Compare two field values for equality
 * @param value1 - First value to compare
 * @param value2 - Second value to compare
 * @returns true if values are different, false if they are the same
 */
export function compareFieldValues(value1: any, value2: any): boolean {
  // Handle null and undefined cases
  if (value1 === null && value2 === null) {
    return false;
  }
  if (value1 === undefined && value2 === undefined) {
    return false;
  }
  if ((value1 === null || value1 === undefined) !== (value2 === null || value2 === undefined)) {
    return true;
  }

  // Handle arrays
  if (Array.isArray(value1) || Array.isArray(value2)) {
    if (!Array.isArray(value1) || !Array.isArray(value2)) {
      return true;
    }
    if (value1.length !== value2.length) {
      return true;
    }
    for (let i = 0; i < value1.length; i++) {
      if (compareFieldValues(value1[i], value2[i])) {
        return true;
      }
    }
    return false;
  }

  // Handle objects (use JSON comparison as expected by tests)
  if (typeof value1 === 'object' && typeof value2 === 'object') {
    return JSON.stringify(value1) !== JSON.stringify(value2);
  }

  // Handle primitive values
  return value1 !== value2;
}

/**
 * Compare specific fields between two entries
 * @param sourceEntry - Source entry to compare from
 * @param targetEntry - Target entry to compare to
 * @param fieldNames - Array of field names to compare
 * @returns true if any fields differ, false if all are identical
 */
export function compareNonLocalizedFields(sourceEntry: any, targetEntry: any, fieldNames: string[]): boolean {
  // Input validation
  if (!sourceEntry) {
    throw new Error('Source entry is required');
  }

  // Return false for empty field list
  if (!fieldNames || fieldNames.length === 0) {
    return false;
  }

  // Return true if target entry is null
  if (!targetEntry) {
    return true;
  }

  // Compare each field
  for (const fieldName of fieldNames) {
    const sourceValue = sourceEntry[fieldName];
    const targetValue = targetEntry[fieldName];

    // Check if values are different
    if (compareFieldValues(sourceValue, targetValue)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if reference field values differ
 * Handles both arrays and single references
 * @private
 */
export function checkReferenceFieldChanges(ref1: any, ref2: any): boolean {
  // Handle arrays
  if (Array.isArray(ref1) || Array.isArray(ref2)) {
    const arr1 = Array.isArray(ref1) ? ref1 : [ref1];
    const arr2 = Array.isArray(ref2) ? ref2 : [ref2];

    if (arr1.length !== arr2.length) {
      return true;
    }

    for (let i = 0; i < arr1.length; i++) {
      const item1 = arr1[i];
      const item2 = arr2[i];

      if (typeof item1 === 'object' && typeof item2 === 'object') {
        if (item1.uid !== item2.uid || item1._content_type_uid !== item2._content_type_uid) {
          return true;
        }
      } else if (item1 !== item2) {
        return true;
      }
    }

    return false;
  }

  // Handle single reference
  if (typeof ref1 === 'object' && typeof ref2 === 'object') {
    return ref1.uid !== ref2.uid || ref1._content_type_uid !== ref2._content_type_uid;
  }

  return ref1 !== ref2;
}

/**
 * Check if schema has non-localized fields (recursively checks nested fields)
 * Checks both legacy (non_localizable) and modern (localized: false) properties
 * @param schema - Content type schema
 * @returns Array of non-localized field UIDs
 */
export function hasNonLocalizedFields(schema: any[]): boolean {
  if (!schema || !Array.isArray(schema)) {
    return false;
  }

  return schema.some((field) => {
    // Check both property names for compatibility
    const isNonLocalized = field.non_localizable === true || field.localized === false;

    if (isNonLocalized) {
      return true;
    }

    // Recursively check nested fields
    if (field.data_type === 'group' || field.data_type === 'global_field') {
      if (field.schema && Array.isArray(field.schema)) {
        return hasNonLocalizedFields(field.schema);
      }
    }

    if (field.data_type === 'blocks' && field.blocks) {
      return field.blocks.some((block: any) => {
        if (block.schema && Array.isArray(block.schema)) {
          return hasNonLocalizedFields(block.schema);
        }
        return false;
      });
    }

    return false;
  });
}

/**
 * Recursively check non-localized field changes
 * Handles groups, blocks, global fields, and references
 * @private
 */
export function checkNonLocalizedFieldChanges(
  schema: any[],
  masterEntry: any,
  localizedEntry: any,
  inheritNonLocalizable: boolean = false
): boolean {
  if (!schema || !Array.isArray(schema)) {
    return false;
  }

  for (const field of schema) {
    const isFieldNonLocalized = field.non_localizable === true || field.localized === false;
    const checkAsNonLocalized = isFieldNonLocalized || inheritNonLocalizable;

    // Skip if this is a localized field and parent is not non-localized
    if (!checkAsNonLocalized) {
      continue;
    }

    const fieldUid = field.uid;
    const masterValue = masterEntry[fieldUid];
    const localizedValue = localizedEntry[fieldUid];

    // Handle simple fields (not nested)
    if (!field.schema && !field.blocks) {
      // Check if one exists and other doesn't
      if ((masterValue && !localizedValue) || (!masterValue && localizedValue)) {
        return true;
      }

      if (masterValue && localizedValue) {
        // Handle multiple/array fields
        if (field.multiple) {
          if (JSON.stringify(masterValue) !== JSON.stringify(localizedValue)) {
            return true;
          }
          continue;
        }

        // Handle reference fields
        if (field.data_type === 'reference') {
          if (checkReferenceFieldChanges(masterValue, localizedValue)) {
            return true;
          }
          continue;
        }

        // Handle primitive fields
        if (masterValue !== localizedValue) {
          return true;
        }
      }
      continue;
    }

    // Handle group or global_field
    if (field.data_type === 'group' || field.data_type === 'global_field') {
      if (field.multiple) {
        // Array of groups
        const masterArray = masterValue || [];
        const localizedArray = localizedValue || [];

        // Check each item in the array
        const maxLength = Math.max(masterArray.length, localizedArray.length);
        for (let i = 0; i < maxLength; i++) {
          const masterItem = masterArray[i] || {};
          const localizedItem = localizedArray[i] || {};

          if (checkNonLocalizedFieldChanges(field.schema, masterItem, localizedItem, checkAsNonLocalized)) {
            return true;
          }
        }
      } else {
        // Single group
        const masterGroup = masterValue || {};
        const localizedGroup = localizedValue || {};

        if (checkNonLocalizedFieldChanges(field.schema, masterGroup, localizedGroup, checkAsNonLocalized)) {
          return true;
        }
      }
      continue;
    }

    // Handle blocks (modular blocks)
    if (field.data_type === 'blocks' && field.blocks) {
      const masterBlocks = masterValue || [];
      const localizedBlocks = localizedValue || [];

      for (const block of field.blocks) {
        // Filter blocks by block UID
        const masterBlockItems = masterBlocks.filter(
          (item: any) => Object.prototype.hasOwnProperty.call(item, block.uid) && item[block.uid]
        );
        const localizedBlockItems = localizedBlocks.filter(
          (item: any) => Object.prototype.hasOwnProperty.call(item, block.uid) && item[block.uid]
        );

        const maxLength = Math.max(masterBlockItems.length, localizedBlockItems.length);
        for (let i = 0; i < maxLength; i++) {
          const masterBlockData = masterBlockItems[i] ? masterBlockItems[i][block.uid] : {};
          const localizedBlockData = localizedBlockItems[i] ? localizedBlockItems[i][block.uid] : {};

          if (checkNonLocalizedFieldChanges(block.schema, masterBlockData, localizedBlockData, checkAsNonLocalized)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Identify non-localized fields from content type schema
 * Checks both legacy (non_localizable) and modern (localized: false) properties
 * @param schema - Content type schema
 * @returns Array of non-localized field UIDs
 */
export function identifyNonLocalizedFields(schema: any): string[] {
  if (!schema) {
    throw new Error('Schema is required');
  }

  if (!schema.schema || !Array.isArray(schema.schema)) {
    return [];
  }

  const nonLocalizedFields = schema.schema
    .filter((field: any) => field.non_localizable === true || field.localized === false)
    .map((field: any) => field.uid);

  return nonLocalizedFields;
}
