router.put('/:id', requireAuth, requireRole('gm'), async (req, res) => {
  const { name, status, default_battlemap_id, dice_config, default_token_glb_url, settings } = req.body
  const updates = {}
  if (name !== undefined) updates.name = name
  if (status !== undefined) updates.status = status
  if (default_battlemap_id !== undefined) updates.default_battlemap_id = default_battlemap_id

  if (dice_config !== undefined) {
    validateDiceConfig(dice_config)
    updates.dice_config = dice_config === null ? null : JSON.stringify(dice_config)
  }

  if (default_token_glb_url !== undefined) {
    updates.default_token_glb_url = default_token_glb_url === null ? null : String(default_token_glb_url)
  }

  // settings — validation + merge JSONB
  if (settings !== undefined) {
    if (typeof settings !== 'object' || Array.isArray(settings)) {
      throw new AppError(400, 'settings must be a JSON object')
    }

    const ALLOWED_SETTINGS = {
      ambiance: 'string',
      feminin_bonus: 'boolean',
      random_mutations: 'boolean',
      polaris_latent: 'boolean',
      random_pro_advantages: 'boolean',
      revers: 'boolean',
      skill_prerequisites: 'boolean',
      skill_max_level: 'boolean',
      skill_natural_prog: 'boolean',
      young_penalty: 'boolean',
      celebrity: 'boolean',
      pnj_unlimited_ammo: 'boolean',
      reload_mode: 'string',
      action_timer_sec: 'number',
      shock_auto_stun: 'boolean',
      allow_los_cancel: 'boolean',
    }

    for (const [key, value] of Object.entries(settings)) {
      if (!(key in ALLOWED_SETTINGS)) {
        throw new AppError(400, `Clé settings inconnue : ${key}`)
      }
      const expectedType = ALLOWED_SETTINGS[key]
      if (typeof value !== expectedType) {
        throw new AppError(400, `Type invalide pour settings.${key} : attendu ${expectedType}, reçu ${typeof value}`)
      }
      if (key === 'reload_mode' && !['magazine', 'topup'].includes(value)) {
        throw new AppError(400, `settings.reload_mode doit être "magazine" ou "topup"`)
      }
      if (key === 'action_timer_sec' && (!Number.isInteger(value) || value < 0)) {
        throw new AppError(400, 'settings.action_timer_sec doit être un entier ≥ 0')
      }
      if (key === 'ambiance' && !['REALISTE', 'INTERMEDIAIRE', 'HEROIQUE'].includes(value)) {
        throw new AppError(400, `settings.ambiance doit être REALISTE, INTERMEDIAIRE ou HEROIQUE`)
      }
    }

    const current = await db('campaigns').where({ id: req.params.id }).select('settings').first()
    const merged = { ...(current?.settings || {}), ...settings }
    updates.settings = JSON.stringify(merged)
  }

  updates.updated_at = db.fn.now()

  const [campaign] = await db('campaigns')
    .where({ id: req.params.id })
    .update(updates)
    .returning(['id', 'name', 'status', 'invite_code', 'default_battlemap_id', 'dice_config', 'settings', 'default_token_glb_url', 'created_at', 'updated_at'])
  req.app.get('io').to(req.params.id).emit(WS.CAMPAIGN_SETTINGS_UPDATED, { campaign })
  res.json({ campaign })
})