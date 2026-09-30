// Highlight case pleine — pose au sol avec le snap grille (touche G) — extrait de Editor3D.jsx
// (§16.8, PLAN_WORLD_BUILDER_REWORK.md). Genre déjà standard des VTT (Roll20/Foundry) : la case ciblée
// se surligne, pas l'empreinte de l'objet — indépendant de la taille du modèle posé.
export default function TileSnapHighlight({ position }) {
  if (!position || position.placement?.mode !== 'free') return null
  return (
    <mesh position={[position.x, position.y + 0.01, position.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.92, 0.92]} />
      <meshBasicMaterial color="#3ddc84" transparent opacity={0.35} depthWrite={false} />
    </mesh>
  )
}
