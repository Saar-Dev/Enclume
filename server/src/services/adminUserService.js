import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'

// Jamais password_hash — même réflexe que GET /auth/me (routes/auth.js).
export async function listUsers() {
  return db('users')
    .select('id', 'username', 'email', 'role', 'created_at')
    .orderBy('username')
}

// Garde dernier admin (docs/PLANS/PLAN_ADMIN.md §4.1, précédent better-auth#3651) : bloque toute
// rétrogradation admin→user qui ferait tomber le nombre total d'admins à zéro. Écrite comme un
// invariant général (compte les admins, sans regarder qui demande) plutôt qu'un cas particulier
// "auto-rétrogradation" — avec le seul point d'entrée actuel (requireAdmin exige déjà que l'acteur
// soit admin), acteur ≠ cible implique mathématiquement ≥2 admins avant l'opération, donc la garde
// ne se déclenche aujourd'hui que sur une auto-rétrogradation ; elle reste générale pour rester
// correcte si un futur appelant ne garantissait plus cette hypothèse (adminUserService.test.mjs).
export async function changeUserRole(actorId, targetId, newRole) {
  if (!['user', 'admin'].includes(newRole)) {
    throw new AppError(400, 'role doit être "user" ou "admin"')
  }

  const target = await db('users').where({ id: targetId }).first()
  if (!target) {
    throw new AppError(404, 'Utilisateur introuvable')
  }

  if (newRole === 'user' && target.role === 'admin') {
    const { count } = await db('users').where({ role: 'admin' }).count('* as count').first()
    if (Number(count) <= 1) {
      throw new AppError(409, 'Impossible de rétrograder le dernier administrateur')
    }
  }

  const [updated] = await db('users')
    .where({ id: targetId })
    .update({ role: newRole, role_granted_by: actorId, role_granted_at: db.fn.now() })
    .returning(['id', 'username', 'email', 'role'])

  return updated
}
