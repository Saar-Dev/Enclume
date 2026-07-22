export const normalizedBlueprintText = blueprint => [
  blueprint?.label,
  blueprint?.name,
  blueprint?.category,
  blueprint?.builtin_key,
  blueprint?.glb_url,
].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()

export function isDoorConnectorBlueprint(blueprint) {
  const connectorType = blueprint?.geometry?.connectorType
  if (connectorType === 'hatch') return false
  if (connectorType === 'door') return true
  const text = normalizedBlueprintText(blueprint)
  return text.includes('futuristic_doors')
    || text.includes('porte')
    || text.includes('door')
    || text.includes('sas')
}
