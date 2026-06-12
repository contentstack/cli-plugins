import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { MIGRATION_DATA_CONFIG } from '../constants.js';
import { parseJsonLoose } from '../../../lib/parse-json-loose.js';

const { CUSTOM_ROLES_DIR_NAME, CUSTOM_ROLES_FILE_NAME } = {
  CUSTOM_ROLES_DIR_NAME: 'custom-roles',
  CUSTOM_ROLES_FILE_NAME: 'custom-roles.json',
};

type Acl = {
  read?: boolean;
  create?: boolean;
  update?: boolean;
  delete?: boolean;
  publish?: boolean;
};

/**
 * Contentful role name → Contentstack built-in role. When a source role maps to
 * a built-in (which already exists in every stack), we do NOT create a custom
 * role — we just record the mapping. Everything else becomes a custom role.
 */
const BUILTIN_SYNONYMS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  administrator: 'Admin',
  developer: 'Developer',
  dev: 'Developer',
  'content manager': 'Content Manager',
  'content-manager': 'Content Manager',
  editor: 'Content Manager',
  author: 'Content Manager',
};

export function matchBuiltin(name: string): string | null {
  const key = String(name || '').trim().toLowerCase();
  return BUILTIN_SYNONYMS[key] ?? null;
}

/** Contentful policy `actions` ("all" or a list) → a Contentstack ACL. */
function actionsToAcl(actions: any): Acl {
  if (actions === 'all') {
    return { read: true, create: true, update: true, delete: true, publish: true };
  }
  const list: string[] = Array.isArray(actions) ? actions : actions ? [actions] : [];
  const acl: Acl = {};
  for (const a of list) {
    switch (a) {
      case 'read':
        acl.read = true;
        break;
      case 'create':
        acl.create = true;
        acl.read = true;
        break;
      case 'update':
        acl.update = true;
        acl.read = true;
        break;
      case 'delete':
        acl.delete = true;
        break;
      case 'publish':
        acl.publish = true;
        break;
      default:
        break;
    }
  }
  return acl;
}

function mergeAcl(a: Acl, b: Acl): Acl {
  return {
    read: a.read || b.read || undefined,
    create: a.create || b.create || undefined,
    update: a.update || b.update || undefined,
    delete: a.delete || b.delete || undefined,
    publish: a.publish || b.publish || undefined,
  };
}

function hasAcl(acl: Acl): boolean {
  return Object.values(acl).some(Boolean);
}

/** Walk a Contentful policy `constraint` for what it targets. */
function readConstraint(constraint: any): { sysType?: string; contentTypeIds: string[] } {
  const contentTypeIds: string[] = [];
  let sysType: string | undefined;
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.equals)) {
      const [lhs, rhs] = node.equals;
      const docPath = lhs?.doc;
      if (docPath === 'sys.type' && typeof rhs === 'string') sysType = rhs;
      if (docPath === 'sys.contentType.sys.id' && typeof rhs === 'string') contentTypeIds.push(rhs);
    }
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === 'object') visit(v);
    }
  };
  visit(constraint);
  return { sysType, contentTypeIds };
}

export interface RoleMappingEntry {
  source: string;
  /** 'built-in' (mapped to an existing stack role) or 'custom' (created). */
  kind: 'built-in' | 'custom';
  target: string;
}

/**
 * Translate a Contentful export's `roles` into a Contentstack custom-roles
 * bundle (`<bundle>/custom-roles/custom-roles.json`) consumed by csdx import.
 *
 * - Roles whose name matches a Contentstack built-in (Owner/Admin/Developer/
 *   Content Manager, incl. synonyms like Editor/Author) are mapped to that
 *   built-in and NOT recreated.
 * - Every other role becomes a custom role whose rules are derived from the
 *   Contentful `permissions` + `policies` (honoring per-content-type constraints
 *   when present; otherwise granting across all migrated content types).
 *
 * `ctMap` maps Contentful content-type id → Contentstack content-type uid.
 * Returns the source→target mapping report.
 */
export function createCustomRoles(
  exportPath: string,
  destinationStackId: string,
  ctMap: Record<string, string>,
): RoleMappingEntry[] {
  const mapping: RoleMappingEntry[] = [];
  let roles: any[] = [];
  try {
    roles = parseJsonLoose(fs.readFileSync(exportPath, 'utf8'))?.roles ?? [];
  } catch {
    return mapping;
  }
  if (!Array.isArray(roles) || roles.length === 0) return mapping;

  const customRoles: Record<string, any> = {};

  for (const role of roles) {
    const name = role?.name;
    if (!name) continue;

    const builtin = matchBuiltin(name);
    if (builtin) {
      mapping.push({ source: name, kind: 'built-in', target: builtin });
      continue;
    }

    // Build ACLs from permissions + policies.
    let ctAcl: Acl = {};
    let assetAcl: Acl = {};
    const scopedCtIds = new Set<string>();
    let ctScoped = false;

    // permissions.ContentModel → content-type ACL (read/create/update/delete).
    const cm: string[] = role?.permissions?.ContentModel ?? [];
    if (cm.length) ctAcl = mergeAcl(ctAcl, actionsToAcl(cm));

    for (const policy of role?.policies ?? []) {
      if (policy?.effect && policy.effect !== 'allow') continue; // CS has no field-level deny
      const acl = actionsToAcl(policy?.actions);
      const { sysType, contentTypeIds } = readConstraint(policy?.constraint);
      if (sysType === 'Asset') {
        assetAcl = mergeAcl(assetAcl, acl);
      } else {
        // Entry (or unspecified) → governs entries via the content_type rule.
        ctAcl = mergeAcl(ctAcl, acl);
        if (contentTypeIds.length) {
          ctScoped = true;
          for (const cfId of contentTypeIds) {
            const uid = ctMap[cfId];
            if (uid) scopedCtIds.add(uid);
          }
        }
      }
    }

    if (!hasAcl(ctAcl)) ctAcl = { read: true };

    // Contentstack wants the literal ['$all'] token for "all content types";
    // a per-constraint subset uses the specific content-type uids.
    const contentTypes = ctScoped && scopedCtIds.size ? [...scopedCtIds] : ['$all'];
    const rules: any[] = [
      { module: 'content_type', content_types: contentTypes, acl: ctAcl },
    ];
    // Asset rule rejects 'create' ("Cannot set Create permission for ... assets").
    delete assetAcl.create;
    if (hasAcl(assetAcl)) rules.push({ module: 'asset', acl: assetAcl });
    // branch rule is required by csdx import (it auto-adds one, but be explicit).
    rules.push({ module: 'branch', branches: ['main'], acl: { read: true } });

    const uid = uuidv4().replace(/-/g, '').slice(0, 24);
    customRoles[uid] = { name, description: role?.description ?? '', rules };
    mapping.push({ source: name, kind: 'custom', target: name });
  }

  if (Object.keys(customRoles).length > 0) {
    const dir = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, CUSTOM_ROLES_DIR_NAME);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, CUSTOM_ROLES_FILE_NAME),
      `${JSON.stringify(customRoles, null, 2)}\n`,
      'utf8',
    );
  }

  return mapping;
}
