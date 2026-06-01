import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  compareFieldValues,
  compareNonLocalizedFields,
  checkReferenceFieldChanges,
  hasNonLocalizedFields,
  checkNonLocalizedFieldChanges,
  identifyNonLocalizedFields,
} from '../../../src/utils/non-localized-field-handler';

describe('Non-Localized Field Handler Utilities', () => {
  describe('compareFieldValues', () => {
    it('should return false for null and null', () => {
      expect(compareFieldValues(null, null)).to.be.false;
    });

    it('should return false for undefined and undefined', () => {
      expect(compareFieldValues(undefined, undefined)).to.be.false;
    });

    it('should return true for null and undefined mix', () => {
      // null and undefined are treated as different values
      expect(compareFieldValues(null, undefined)).to.be.true;
      expect(compareFieldValues(undefined, null)).to.be.true;
    });

    it('should return true when one is null/undefined and other is value', () => {
      expect(compareFieldValues(null, 'value')).to.be.true;
      expect(compareFieldValues('value', undefined)).to.be.true;
    });

    it('should compare arrays', () => {
      expect(compareFieldValues(['a', 'b'], ['a', 'b'])).to.be.false;
      expect(compareFieldValues(['a'], ['b'])).to.be.true;
      expect(compareFieldValues(['a'], ['a', 'b'])).to.be.true;
    });

    it('should return true if one is array and other is not', () => {
      expect(compareFieldValues(['a'], 'a')).to.be.true;
      expect(compareFieldValues('a', ['a'])).to.be.true;
    });

    it('should compare nested arrays', () => {
      expect(compareFieldValues([['a']], [['a']])).to.be.false;
      expect(compareFieldValues([['a']], [['b']])).to.be.true;
    });

    it('should compare objects', () => {
      expect(compareFieldValues({ a: 1 }, { a: 1 })).to.be.false;
      expect(compareFieldValues({ a: 1 }, { a: 2 })).to.be.true;
    });

    it('should compare primitives', () => {
      expect(compareFieldValues(1, 1)).to.be.false;
      expect(compareFieldValues(1, 2)).to.be.true;
      expect(compareFieldValues('a', 'a')).to.be.false;
      expect(compareFieldValues('a', 'b')).to.be.true;
      expect(compareFieldValues(true, true)).to.be.false;
      expect(compareFieldValues(true, false)).to.be.true;
    });
  });

  describe('compareNonLocalizedFields', () => {
    it('should throw error if source entry is missing', () => {
      expect(() => compareNonLocalizedFields(null, {}, ['field'])).to.throw('Source entry is required');
    });

    it('should return false if fieldNames is empty', () => {
      expect(compareNonLocalizedFields({}, {}, [])).to.be.false;
    });

    it('should return true if target entry is missing', () => {
      expect(compareNonLocalizedFields({}, null, ['field'])).to.be.true;
    });

    it('should compare specified fields', () => {
      const source = { a: 1, b: 2 };
      const target = { a: 1, b: 3 };
      expect(compareNonLocalizedFields(source, target, ['a'])).to.be.false;
      expect(compareNonLocalizedFields(source, target, ['b'])).to.be.true;
    });
  });

  describe('checkReferenceFieldChanges', () => {
    it('should compare single references', () => {
      const ref1 = { uid: 'u1', _content_type_uid: 'ct1' };
      const ref2 = { uid: 'u1', _content_type_uid: 'ct1' };
      const ref3 = { uid: 'u2', _content_type_uid: 'ct1' };
      const ref4 = { uid: 'u1', _content_type_uid: 'ct2' };

      expect(checkReferenceFieldChanges(ref1, ref2)).to.be.false;
      expect(checkReferenceFieldChanges(ref1, ref3)).to.be.true;
      expect(checkReferenceFieldChanges(ref1, ref4)).to.be.true;
    });

    it('should compare arrays of references', () => {
      const arr1 = [{ uid: 'u1', _content_type_uid: 'ct1' }];
      const arr2 = [{ uid: 'u1', _content_type_uid: 'ct1' }];
      const arr3 = [{ uid: 'u2', _content_type_uid: 'ct1' }];

      expect(checkReferenceFieldChanges(arr1, arr2)).to.be.false;
      expect(checkReferenceFieldChanges(arr1, arr3)).to.be.true;
    });

    it('should handle array length mismatch', () => {
      const arr1 = [{ uid: 'u1', _content_type_uid: 'ct1' }];
      const arr2 = [
        { uid: 'u1', _content_type_uid: 'ct1' },
        { uid: 'u2', _content_type_uid: 'ct1' },
      ];
      expect(checkReferenceFieldChanges(arr1, arr2)).to.be.true;
    });

    it('should handle mixed types in array (legacy/weird data)', () => {
      expect(checkReferenceFieldChanges(['a'], ['a'])).to.be.false;
      expect(checkReferenceFieldChanges(['a'], ['b'])).to.be.true;
      // Object vs primitive
      expect(checkReferenceFieldChanges([{ uid: '1' }], ['1'])).to.be.true;
    });

    it('should compare single reference vs array (mismatch)', () => {
      // Since it converts single to array if one is array, let's see logic:
      // if (Array.isArray(ref1) || Array.isArray(ref2)) -> converts both to array
      const ref = { uid: 'u1', _content_type_uid: 'ct1' };
      const arr = [ref];
      // checkReferenceFieldChanges(ref, arr) -> converts ref to [ref] -> compares [ref] vs [ref] -> false
      expect(checkReferenceFieldChanges(ref, arr)).to.be.false;

      const arr2 = [ref, ref];
      expect(checkReferenceFieldChanges(ref, arr2)).to.be.true;
    });

    it('should compare primitive values (fallback)', () => {
      expect(checkReferenceFieldChanges('a', 'a')).to.be.false;
      expect(checkReferenceFieldChanges('a', 'b')).to.be.true;
    });
  });

  describe('hasNonLocalizedFields', () => {
    it('should return false for invalid schema', () => {
      expect(hasNonLocalizedFields(null as any)).to.be.false;
      expect(hasNonLocalizedFields([])).to.be.false;
    });

    it('should detect non-localized fields at top level', () => {
      const schema = [{ uid: 'f1', non_localizable: true }];
      expect(hasNonLocalizedFields(schema)).to.be.true;

      const schema2 = [{ uid: 'f1', localized: false }];
      expect(hasNonLocalizedFields(schema2)).to.be.true;
    });

    it('should return false if all fields are localized', () => {
      const schema = [{ uid: 'f1', localized: true }, { uid: 'f2' }]; // Default is localized=true implicitly? No, check implementation: field.non_localizable === true || field.localized === false. If neither, it returns false.
      // Wait, logic says:
      // const isNonLocalized = field.non_localizable === true || field.localized === false;
      // if (isNonLocalized) return true;
      // So default is "not non-localized" (i.e. localized).
      expect(hasNonLocalizedFields(schema)).to.be.false;
    });

    it('should recurse into groups', () => {
      const schema = [
        {
          uid: 'group',
          data_type: 'group',
          schema: [{ uid: 'sub', localized: false }],
        },
      ];
      expect(hasNonLocalizedFields(schema)).to.be.true;
    });

    it('should recurse into global fields', () => {
      const schema = [
        {
          uid: 'global',
          data_type: 'global_field',
          schema: [{ uid: 'sub', localized: false }],
        },
      ];
      expect(hasNonLocalizedFields(schema)).to.be.true;
    });

    it('should recurse into blocks', () => {
      const schema = [
        {
          uid: 'blocks',
          data_type: 'blocks',
          blocks: [{ uid: 'b1', schema: [{ uid: 'sub', localized: false }] }],
        },
      ];
      expect(hasNonLocalizedFields(schema)).to.be.true;
    });
  });

  describe('identifyNonLocalizedFields', () => {
    it('should throw if schema is missing', () => {
      expect(() => identifyNonLocalizedFields(null)).to.throw('Schema is required');
    });

    it('should return empty array if schema.schema is missing', () => {
      expect(identifyNonLocalizedFields({})).to.deep.equal([]);
    });

    it('should return non-localized fields', () => {
      const schema = {
        schema: [
          { uid: 'f1', localized: false },
          { uid: 'f2', non_localizable: true },
          { uid: 'f3', localized: true },
        ],
      };
      expect(identifyNonLocalizedFields(schema)).to.deep.equal(['f1', 'f2']);
    });
  });

  describe('checkNonLocalizedFieldChanges', () => {
    it('should return false for invalid input', () => {
      expect(checkNonLocalizedFieldChanges(null as any, {}, {})).to.be.false;
    });

    it('should check simple non-localized fields', () => {
      const schema = [{ uid: 'f1', localized: false }];
      expect(checkNonLocalizedFieldChanges(schema, { f1: 'a' }, { f1: 'b' })).to.be.true;
      expect(checkNonLocalizedFieldChanges(schema, { f1: 'a' }, { f1: 'a' })).to.be.false;
    });

    it('should ignore localized fields', () => {
      const schema = [{ uid: 'f1', localized: true }];
      expect(checkNonLocalizedFieldChanges(schema, { f1: 'a' }, { f1: 'b' })).to.be.false;
    });

    it('should handle existence mismatch', () => {
      const schema = [{ uid: 'f1', localized: false }];
      expect(checkNonLocalizedFieldChanges(schema, { f1: 'a' }, {})).to.be.true;
      expect(checkNonLocalizedFieldChanges(schema, {}, { f1: 'a' })).to.be.true;
    });

    it('should handle multiple/array fields', () => {
      const schema = [{ uid: 'f1', localized: false, multiple: true }];
      expect(checkNonLocalizedFieldChanges(schema, { f1: ['a'] }, { f1: ['b'] })).to.be.true;
      expect(checkNonLocalizedFieldChanges(schema, { f1: ['a'] }, { f1: ['a'] })).to.be.false;
    });

    it('should handle reference fields', () => {
      const schema = [{ uid: 'ref', localized: false, data_type: 'reference' }];
      const ref1 = { uid: 'u1', _content_type_uid: 'ct' };
      const ref2 = { uid: 'u2', _content_type_uid: 'ct' };
      expect(checkNonLocalizedFieldChanges(schema, { ref: ref1 }, { ref: ref2 })).to.be.true;
      expect(checkNonLocalizedFieldChanges(schema, { ref: ref1 }, { ref: ref1 })).to.be.false;
    });

    it('should handle nested group fields (single)', () => {
      const schema = [
        {
          uid: 'group',
          data_type: 'group',
          localized: false,
          schema: [{ uid: 'sub', localized: true }], // inheritNonLocalizable should make this checked?
          // "const checkAsNonLocalized = isFieldNonLocalized || inheritNonLocalizable;"
          // Yes.
        },
      ];

      // Group is non-localized, so sub-fields are effectively non-localized
      const master = { group: { sub: 'a' } };
      const local = { group: { sub: 'b' } };
      expect(checkNonLocalizedFieldChanges(schema, master, local)).to.be.true;
    });

    it('should handle nested group fields (multiple)', () => {
      const schema = [
        {
          uid: 'group',
          data_type: 'group',
          localized: false,
          multiple: true,
          schema: [{ uid: 'sub', localized: true }],
        },
      ];

      const master = { group: [{ sub: 'a' }] };
      const local = { group: [{ sub: 'b' }] };
      expect(checkNonLocalizedFieldChanges(schema, master, local)).to.be.true;

      const master2 = { group: [{ sub: 'a' }] };
      const local2 = { group: [{ sub: 'a' }] };
      expect(checkNonLocalizedFieldChanges(schema, master2, local2)).to.be.false;

      // Length mismatch
      const master3 = { group: [{ sub: 'a' }, { sub: 'b' }] };
      const local3 = { group: [{ sub: 'a' }] };
      expect(checkNonLocalizedFieldChanges(schema, master3, local3)).to.be.true;
    });

    it('should handle modular blocks', () => {
      const schema = [
        {
          uid: 'blocks',
          data_type: 'blocks',
          localized: false,
          blocks: [{ uid: 'text_block', schema: [{ uid: 'text', localized: true }] }],
        },
      ];

      const master = { blocks: [{ text_block: { text: 'a' } }] };
      const local = { blocks: [{ text_block: { text: 'b' } }] };
      expect(checkNonLocalizedFieldChanges(schema, master, local)).to.be.true;
    });

    it('should handle inherited non-localizable status', () => {
      // Parent passes inheritNonLocalizable=true
      const schema = [{ uid: 'sub', localized: true }]; // Marked localized, but should be checked if inherited
      // Direct call helper
      expect(checkNonLocalizedFieldChanges(schema, { sub: 'a' }, { sub: 'b' }, true)).to.be.true;
    });
  });
});
