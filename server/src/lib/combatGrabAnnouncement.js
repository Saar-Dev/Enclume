// server/src/lib/combatGrabAnnouncement.js — l'ANNONCE de « Permuter » (docs/Old/PLAN_PRISE_EN_MAIN.md).
//
// Extrait de socketCombatAnnouncement.js (gestionnaire de plus de 1 000 lignes, impossible à tester seul) : la validation de la
// déclaration, l'acceptation de l'objet entrant comme « en main » pour une attaque du même Tour, et la ligne `combat_actions`.
// L'annonce ne refuse que le STRUCTURELLEMENT impossible (`.claude/rules/combat.md`) : main libre, Sac, capacité et « la ligne à
// remplacer est-elle encore en main ? » se décident à la RÉSOLUTION (combatGrabService → swapItemInHand).
//
// Contrat : `mapActions.grab = { itemId, replaceItemId? }` — `itemId` = l'objet entrant (Sac / Ceinture), `replaceItemId` = la ligne
// d'objet tenu à remplacer (absent = « Mains nues », une main libre). Messages en français littéral, comme les autres refus
// d'annonce (dette existante `COMBAT_DECLARE_ERROR`, voir PLAN_PRISE_EN_MAIN.md §8) ; la résolution, elle, utilise des clés i18n.

import { describeGrabCandidate, itemBelongsToCharacter } from '../services/inventoryService.js'
import { GRAB_REFUSAL, getGrabConflictReasons, getGrabCost } from '../../../shared/combatGrabItem.js'
import { getSlotInfo } from '../../../shared/weaponSlots.js'

const REFUSAL_TEXT = Object.freeze({
  [GRAB_REFUSAL.NOT_FOUND]:    'objet introuvable',
  [GRAB_REFUSAL.NOT_CARRIED]:  'l\'objet n\'est ni dans le Sac ni à la Ceinture',
  [GRAB_REFUSAL.EQUIPPED]:     'l\'objet est déjà porté',
  [GRAB_REFUSAL.NOT_HOLDABLE]: 'cet objet ne se tient pas à la main',
})

/**
 * @param {object} p
 * @param {*} p.grab  `mapActions.grab` tel que reçu du client (jamais fiable : forme, types, propriétaire)
 * @param {{ id: string }} p.character  le personnage qui déclare
 * @param {object} p.mapActions  la déclaration complète (exclusivité de l'Action simple)
 * @param {boolean} p.isDrone
 * @param {boolean} p.isExo
 * @param {object} [deps]  accès injectables pour les tests
 * @returns {Promise<{ ok: false, message: string } | { ok: true, declaration: { itemId: string, container: string, replaceItemId: string|null, targetSlots: string[] } }>}
 */
export async function validateGrabDeclaration(
  { grab, character, mapActions, isDrone = false, isExo = false },
  { describe = describeGrabCandidate, belongs = itemBelongsToCharacter } = {},
) {
  const refuse = (message) => ({ ok: false, message })
  if (isDrone || isExo) return refuse('Permuter : réservé aux personnages (ni drone ni exo-armure)')
  // R9 : une seule permutation par Tour — un seul objet `grab` par déclaration (un token ne déclare qu'une fois par Tour,
  // `has_announced`, garde du gestionnaire).
  if (Array.isArray(grab) || grab === null || typeof grab !== 'object') return refuse('Permuter : une seule permutation par Tour')
  if (typeof grab.itemId !== 'string' || (grab.replaceItemId != null && typeof grab.replaceItemId !== 'string')) return refuse('Permuter : objet invalide')

  const candidate = await describe(character.id, grab.itemId)
  if (!candidate.ok) return refuse(`Permuter : ${REFUSAL_TEXT[candidate.reason] ?? 'objet inutilisable'}`)
  if (candidate.alreadyInHand) return refuse('Permuter : cet objet est déjà en main')

  // Ligne à remplacer : doit appartenir au personnage (jamais l'objet d'un autre) et différer de l'objet entrant. Qu'elle soit encore
  // en main à la résolution n'est PAS vérifié ici : si elle a disparu, l'objet entrant prend une main libre.
  if (grab.replaceItemId != null && (grab.replaceItemId === grab.itemId || !(await belongs(character.id, grab.replaceItemId)))) {
    return refuse('Permuter : objet à remplacer introuvable')
  }

  const conflicts = getGrabConflictReasons({ container: candidate.container, mapActions })
  if (conflicts.length > 0) return refuse(`Prendre un objet dans le Sac occupe l'action du Tour — impossible avec : ${conflicts.join(', ')}`)

  return {
    ok: true,
    declaration: {
      itemId: candidate.itemId,
      container: candidate.container,
      replaceItemId: grab.replaceItemId ?? null,
      // Emplacements de main que l'objet entrant occupera : une main → MG ou MD ; deux mains (2M/Tr compris) → 2M.
      targetSlots: getSlotInfo(candidate.refLocation).type === '1H' ? ['MG', 'MD'] : ['2M'],
    },
  }
}

/**
 * Une attaque déclarée avec l'objet qu'une permutation du MÊME Tour met en main est valide : la permutation est résolue AVANT
 * l'entrée d'attaque du token (actions simples d'abord, socketCombatResolution.js). Depuis le Sac c'est déjà exclu (Action simple,
 * `getGrabConflictReasons`). `allowedSlots` : les emplacements légitimes pour ce site d'annonce (une arme secondaire refuse un deux-mains).
 *
 * @param {{ itemId: string, targetSlots: string[] }|null} declaration  null = pas de permutation déclarée
 * @param {string|null|undefined} invId  l'objet que l'attaque veut utiliser
 * @param {string[]} allowedSlots
 */
export function isGrabbedInHand(declaration, invId, allowedSlots) {
  return declaration != null
    && invId === declaration.itemId
    && declaration.targetSlots.some(slot => allowedSlots.includes(slot))
}

/** Ligne `combat_actions` de la permutation : type `micro` existant (aucune migration), `sequence` 2 = résolue avant l'entrée complexe. */
export function buildGrabActionRow(declaration, { campaignId, tokenId }) {
  return {
    campaign_id: campaignId, token_id: tokenId,
    action_key: 'grab_item', type: 'micro', sequence: 2,
    modifiers: JSON.stringify({
      ini_mod: getGrabCost(declaration.container).iniCost,
      itemId: declaration.itemId, container: declaration.container, replaceItemId: declaration.replaceItemId,
    }),
    status: 'pending',
  }
}
