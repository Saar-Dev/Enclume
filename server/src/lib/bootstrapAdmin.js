import db from '../db/knex.js'

// Promotion admin par variable d'environnement, propre à chaque instance (jamais un email en dur
// dans une migration versionnée — deux instances = deux jeux de comptes distincts, voir
// docs/PLANS/PLAN_ADMIN.md §0.8). Même patron que REGISTRATION_CODE (routes/auth.js).
// Idempotent : ne re-déclenche rien une fois le compte déjà promu. Silencieux si la variable
// n'est pas définie sur cette instance (comportement sûr par défaut).
export async function bootstrapAdminFromEnv() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL
  if (!email) return

  const updated = await db('users')
    .where({ email })
    .andWhere('role', '!=', 'admin')
    .update({ role: 'admin', role_granted_at: db.fn.now() })

  if (updated > 0) {
    console.log(`[BOOTSTRAP-ADMIN] ${email} promu admin.`)
    return
  }

  // updated === 0 : soit l'email n'existe pas (vraie mauvaise config, à signaler), soit le compte
  // est déjà admin (état stable normal à chaque redémarrage — ne pas avertir à chaque boot).
  const exists = await db('users').where({ email }).first('id')
  if (!exists) {
    console.warn(`[BOOTSTRAP-ADMIN] Aucun compte "${email}" trouvé.`)
  }
}
