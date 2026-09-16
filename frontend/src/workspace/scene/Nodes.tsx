import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { SceneNode } from "./graph";
import { labelTexture } from "./labels";
import type { ScenePalette } from "./palette";

/**
 * One sphere per data-structure node.
 *
 * All per-frame work happens through refs and direct material mutation — React
 * never re-renders during playback, it only re-renders when the graph's shape
 * changes. Geometry is shared process-wide; each node owns one material for the
 * lifetime of its mount so it can fade independently.
 */

const SPHERE = new THREE.SphereGeometry(0.62, 40, 28);
const LABEL_PLANE = new THREE.PlaneGeometry(1.05, 0.52);

export interface NodeVisual extends SceneNode {
  active: boolean;
  selected: boolean;
  /** Set while the node fades out after leaving the trace state. */
  exiting: boolean;
}

interface NodeMeshProps {
  node: NodeVisual;
  palette: ScenePalette;
  onSelect: (id: string) => void;
  onExited: (id: string) => void;
}

function NodeMesh({ node, palette, onSelect, onExited }: NodeMeshProps) {
  const group = useRef<THREE.Group>(null);
  const labelRef = useRef<THREE.Mesh>(null);
  const progress = useRef(0);
  const target = useRef(new THREE.Vector3(...node.position));

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.node.clone(),
        roughness: 0.55,
        metalness: 0.04,
        transparent: true,
        opacity: 0
      }),
    []
  );

  const labelMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    []
  );

  // Label content changes rarely; swapping the cached texture is cheap.
  labelMaterial.map = labelTexture(node.label, palette.label);

  target.current.set(...node.position);

  useFrame((_, delta) => {
    const mesh = group.current;
    if (!mesh) return;

    // Ease presence toward 1 on enter, 0 on exit. Frame-rate independent.
    const goal = node.exiting ? 0 : 1;
    const rate = node.exiting ? 6 : 4.5;
    progress.current += (goal - progress.current) * Math.min(1, delta * rate);

    if (node.exiting && progress.current < 0.02) {
      onExited(node.id);
      return;
    }

    const eased = progress.current * progress.current * (3 - 2 * progress.current);
    const emphasis = node.active ? 1.16 : node.selected ? 1.08 : 1;
    const scale = eased * emphasis;
    mesh.scale.setScalar(scale);

    // Positions ease rather than snap, so structural reshuffles read as motion.
    mesh.position.lerp(target.current, Math.min(1, delta * 6));

    material.opacity = eased;
    labelMaterial.opacity = eased * (node.active ? 1 : 0.62);

    // The node the current step touched turns to ink; everything else stays paper.
    const color = node.active ? palette.nodeActive : node.selected ? palette.nodeSelected : palette.node;
    material.color.lerp(color, Math.min(1, delta * 8));

    if (labelRef.current) {
      labelRef.current.visible = eased > 0.35;
    }
  });

  return (
    <group ref={group} position={node.position} scale={0}>
      <mesh
        geometry={SPHERE}
        material={material}
        castShadow
        onClick={(event) => {
          event.stopPropagation();
          onSelect(node.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      />
      <Billboard position={[0, 1.02, 0]}>
        <mesh ref={labelRef} geometry={LABEL_PLANE} material={labelMaterial} />
      </Billboard>
    </group>
  );
}

interface NodesProps {
  nodes: NodeVisual[];
  palette: ScenePalette;
  onSelect: (id: string) => void;
  onExited: (id: string) => void;
}

export default function Nodes({ nodes, palette, onSelect, onExited }: NodesProps) {
  return (
    <>
      {nodes.map((node) => (
        <NodeMesh key={node.id} node={node} palette={palette} onSelect={onSelect} onExited={onExited} />
      ))}
    </>
  );
}
