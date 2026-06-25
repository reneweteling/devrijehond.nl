'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { authDb } from '@devrijehond/db';
import { withContext } from '@devrijehond/server';

/**
 * User-management server actions (ADMIN only).
 *
 * Role changes have their own action in `../actions.ts` (`setUserRole`, with the
 * self-demote and last-admin guard rails). This file adds `updateUser` for
 * editing the editable profile fields (name, handle, role) plus the email, which
 * an ADMIN may read and write. Everything runs through the policy-bound `authDb`
 * (admins hold the `@@allow('all', ADMIN)` grant on User) and writes an
 * `AdminAction` audit row.
 */

type Role = 'USER' | 'MODERATOR' | 'ADMIN';

type UserCtx = Awaited<ReturnType<typeof withContext>>;

/** Admin-only context. Throws 401/403 if the caller is not an ADMIN. */
async function adminOnlyContext(): Promise<UserCtx> {
  const h = await headers();
  return withContext(new Request('http://internal/admin', { headers: h }));
}

/** A nullable string field: trim, treat empty as null. */
function clean(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

const ROLES: Role[] = ['USER', 'MODERATOR', 'ADMIN'];

export type UpdateUserPatch = {
  name?: string | null;
  handle?: string | null;
  email?: string;
  role?: Role;
};

/**
 * Edit a user's profile fields. The handle has a `@unique` constraint; a clash
 * surfaces as a friendly Dutch error instead of a raw Prisma exception. Role
 * changes here honour the same guard rails as `setUserRole`: no self-role-change
 * and never demote the last admin.
 */
export async function updateUser(userId: string, patch: UpdateUserPatch): Promise<void> {
  const ctx = await adminOnlyContext();
  const db = authDb(ctx.user);

  const name = clean(patch.name);
  const handle = clean(patch.handle);
  const email = patch.email?.trim();
  const role = patch.role;

  if (email !== undefined && email === '') {
    throw new Error('E-mail mag niet leeg zijn.');
  }
  if (role !== undefined && !ROLES.includes(role)) {
    throw new Error('Onbekende rol.');
  }

  // Role guard rails (mirror setUserRole): never change your own role here, and
  // never demote the last remaining admin.
  if (role !== undefined) {
    if (ctx.user.id === userId) {
      throw new Error('Je kunt je eigen rol niet wijzigen.');
    }
    if (role !== 'ADMIN') {
      const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (target?.role === 'ADMIN') {
        const admins = await db.user.count({ where: { role: 'ADMIN' } });
        if (admins <= 1) throw new Error('Er moet minstens één beheerder blijven.');
      }
    }
  }

  try {
    await db.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name }),
        ...(handle !== undefined && { handle }),
        ...(email !== undefined && { email }),
        ...(role !== undefined && { role }),
      },
    });
  } catch (e) {
    // ZenStack v3 runs on Kysely, not Prisma, so a unique-constraint violation
    // does not surface as `e.code === 'P2002'`. It surfaces as an ORMError whose
    // `dbErrorCode` is the raw Postgres SQLSTATE: 23505 (unique_violation). The
    // constraint name lives in `dbErrorMessage` (e.g. "...User_handle_key...").
    // Map handle/email clashes to a readable Dutch message instead of leaking a
    // raw 500 to the edit modal.
    const err = e as { dbErrorCode?: unknown; dbErrorMessage?: string };
    if (String(err.dbErrorCode ?? '') === '23505') {
      const detail = (err.dbErrorMessage ?? '').toLowerCase();
      // Only claim a specific field when the patch actually touched it and the
      // constraint name mentions it, so the message can't point at the wrong one.
      if (handle !== undefined && detail.includes('handle')) {
        throw new Error('Deze handle is al in gebruik. Kies een andere.');
      }
      if (email !== undefined && detail.includes('email')) {
        throw new Error('Dit e-mailadres is al in gebruik.');
      }
      throw new Error('Deze waarde is al in gebruik.');
    }
    throw e;
  }

  await db.adminAction.create({
    data: { adminId: ctx.user.id, action: 'EDIT', targetType: 'USER', targetId: userId },
  });
  revalidatePath('/admin/users');
}
