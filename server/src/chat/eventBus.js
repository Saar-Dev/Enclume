// eventBus.js — docs/PLANS/PLAN_CHAT.md §6. Abstraction pub/sub interne au processus serveur.
// Aucun EventEmitter/pub-sub équivalent n'existait dans server/src avant ce module (vérifié
// PLAN_CHAT.md §16) — pas de doublon d'une logique existante.
//
// Phase 1 (ce commit) : le bus existe, personne ne publie ni ne s'abonne encore. Le branchement des
// modules métier (combat, dés, trade, session) est Phase 2 — Strangler Fig, cf. §6.3 du plan.
import { EventEmitter } from 'node:events'

class EventBus {
  constructor() {
    this.emitter = new EventEmitter()
    // Plusieurs listeners attendus par topic à terme (ChatService + éventuels autres consommateurs).
    this.emitter.setMaxListeners(50)
  }

  // validate(payload) est optionnelle et retourne un message d'erreur (string) ou rien si valide.
  // Pas de lib de schéma (Zod) : décision PLAN_CHAT.md §16, aucun autre module serveur n'en utilise.
  publish(topic, payload, validate) {
    if (validate) {
      const error = validate(payload)
      if (error) throw new Error(`[EventBus] payload invalide pour "${topic}" : ${error}`)
    }
    this.emitter.emit(topic, payload)
  }

  subscribe(topic, handler) {
    this.emitter.on(topic, async (payload) => {
      try {
        await handler(payload)
      } catch (error) {
        console.error(`[EventBus] handler en échec pour "${topic}" :`, error)
      }
    })
  }
}

export const eventBus = new EventBus()
