import fs from 'fs';
import path from 'path';
import { fetchContentfulMembers } from '../../adapters/contentful/export';
import { matchBuiltin } from './contentful/roles';
import {
  fetchStackRoles,
  shareStackWithUsers,
  type StackInvite,
} from '../../lib/create-stack';

export interface UserMigrationEntry {
  email: string;
  name?: string;
  /** Contentful roles the member held (or 'admin'). */
  contentfulRoles: string[];
  /** Contentstack role names resolved for this member. */
  contentstackRoles: string[];
  /** Contentstack role uids assigned on invite. */
  roleUids: string[];
  /** Why a member was skipped (no email, or no role mapped). */
  skippedReason?: string;
}

export interface UserMigrationResult {
  total: number;
  /** Members that will/did get invited (have at least one mapped role). */
  invitable: UserMigrationEntry[];
  /** Members skipped — no Contentstack role could be mapped, so we do NOT
   *  invite them (would otherwise grant a default/unintended role). */
  skipped: UserMigrationEntry[];
  /** Populated only when invites were actually sent. */
  invited?: string[];
  failed?: Array<{ email: string; error: string }>;
}

/**
 * Map a Contentful member's roles to Contentstack role uids, assigning EXACTLY
 * the equivalent roles — never a default. A space admin → the Admin role. Other
 * members → each Contentful role mapped to a built-in (synonyms) or a same-name
 * custom role, resolved against the stack's actual roles. Members with no
 * resolvable role are returned as skipped (the caller does not invite them).
 */
function planMember(
  member: { email: string; firstName?: string; lastName?: string; admin: boolean; roleNames: string[] },
  stackRoles: Record<string, string>,
): UserMigrationEntry {
  const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || undefined;
  const cfRoles = member.admin ? ['admin'] : member.roleNames;

  // Resolve each Contentful role → a Contentstack role NAME.
  const csRoleNames = new Set<string>();
  if (member.admin) {
    csRoleNames.add('Admin');
  } else {
    for (const rn of member.roleNames) {
      const target = matchBuiltin(rn) || rn; // built-in synonym, else same-name custom role
      csRoleNames.add(target);
    }
  }

  // Resolve names → uids against the stack's actual roles. Drop any with no uid.
  const roleUids: string[] = [];
  const resolvedNames: string[] = [];
  for (const rn of csRoleNames) {
    const uid = stackRoles[rn];
    if (uid) {
      roleUids.push(uid);
      resolvedNames.push(rn);
    }
  }

  const entry: UserMigrationEntry = {
    email: member.email,
    name,
    contentfulRoles: cfRoles,
    contentstackRoles: resolvedNames,
    roleUids,
  };
  if (!roleUids.length) {
    entry.skippedReason =
      'no matching Contentstack role (role not migrated / name mismatch) — not invited to avoid granting unintended access';
  }
  return entry;
}

/**
 * Migrate Contentful space members → Contentstack stack users, inviting each
 * with exactly their mapped role(s). Always writes a report to
 * `<bundle>/users/users-mapping.json`. Sends invites only when `invite` is true.
 *
 * Requires the LIVE Contentful Management API (space memberships are not in the
 * static export), so it runs only when a space id + token are available.
 */
export async function migrateUsers(opts: {
  spaceId: string;
  managementToken?: string;
  apiKey: string;
  bundleDir: string;
  invite?: boolean;
}): Promise<UserMigrationResult> {
  const members = await fetchContentfulMembers(opts.spaceId, opts.managementToken);
  const stackRoles = await fetchStackRoles(opts.apiKey);

  const entries = members.map((m) => planMember(m, stackRoles));
  const invitable = entries.filter((e) => e.roleUids.length);
  const skipped = entries.filter((e) => !e.roleUids.length);

  const result: UserMigrationResult = { total: members.length, invitable, skipped };

  // Always write the mapping report so the operator has a record.
  try {
    const dir = path.join(opts.bundleDir, 'users');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'users-mapping.json'),
      `${JSON.stringify({ invitable, skipped }, null, 2)}\n`,
      'utf8',
    );
  } catch {
    // best-effort
  }

  if (opts.invite && invitable.length) {
    const invites: StackInvite[] = invitable.map((e) => ({ email: e.email, roleUids: e.roleUids }));
    const sent = await shareStackWithUsers(opts.apiKey, invites);
    result.invited = sent.invited;
    result.failed = sent.failed;
  }

  return result;
}
