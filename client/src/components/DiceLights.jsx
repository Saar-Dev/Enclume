// Rig lumière identique à Canvas3D.jsx:889-892 — dupliqué volontairement dans un composant à part
// (jamais consommé par Canvas3D.jsx lui-même, qui garde ses 3 lignes inline intactes).
export default function DiceLights() {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={0.6} />
    </>
  )
}
