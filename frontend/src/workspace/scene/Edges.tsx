import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SceneEdge } from "./graph";
import type { ScenePalette } from "./palette";

/**
 * Dotted connectors in 3D.
 *
 * Every dash across every edge is one instance of a single cylinder mesh, so the
 * whole edge set costs one draw call regardless of node count. Transforms are
 * recomputed only when the graph changes — never per frame.
 */

const DASH = 0.17;
const GAP = 0.15;
const NODE_RADIUS = 0.62;
const UP = new THREE.Vector3(0, 1, 0);

const CYLINDER = new THREE.CylinderGeometry(0.035, 0.035, 1, 6);

interface EdgesProps {
  edges: SceneEdge[];
  positions: Map<string, [number, number, number]>;
  activeEdges: Set<string>;
  palette: ScenePalette;
}

interface Dash {
  matrix: THREE.Matrix4;
  active: boolean;
}

export default function Edges({ edges, positions, activeEdges, palette }: EdgesProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const opacity = useRef(0);

  const dashes = useMemo<Dash[]>(() => {
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const midpoint = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, DASH, 1);
    const built: Dash[] = [];

    for (const edge of edges) {
      const start = positions.get(edge.from);
      const end = positions.get(edge.to);
      if (!start || !end) continue;

      from.set(...start);
      to.set(...end);
      direction.subVectors(to, from);

      const span = direction.length();
      // Leave the sphere surfaces clear at both ends.
      const usable = span - NODE_RADIUS * 2;
      if (usable <= DASH) continue;

      direction.normalize();
      quaternion.setFromUnitVectors(UP, direction);

      const stride = DASH + GAP;
      const count = Math.max(1, Math.floor(usable / stride));
      // Centre the dash run so both gaps at the ends match.
      const lead = NODE_RADIUS + (usable - (count * stride - GAP)) / 2;
      const active = activeEdges.has(edge.id);

      for (let index = 0; index < count; index += 1) {
        const distance = lead + index * stride + DASH / 2;
        midpoint.copy(from).addScaledVector(direction, distance);
        built.push({
          matrix: new THREE.Matrix4().compose(midpoint.clone(), quaternion.clone(), scale),
          active
        });
      }
    }

    return built;
  }, [edges, positions, activeEdges]);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;

    dashes.forEach((dash, index) => {
      instanced.setMatrixAt(index, dash.matrix);
      instanced.setColorAt(index, dash.active ? palette.edgeActive : palette.edge);
    });

    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
    instanced.count = dashes.length;
  }, [dashes, palette]);

  useFrame((_, delta) => {
    if (!material.current) return;
    // Edges fade in with the structure rather than snapping on.
    opacity.current += (0.92 - opacity.current) * Math.min(1, delta * 4);
    material.current.opacity = opacity.current;
  });

  if (!dashes.length) return null;

  return (
    <instancedMesh
      // Remount when the instance budget changes; three cannot grow a buffer.
      key={dashes.length}
      ref={mesh}
      args={[CYLINDER, undefined, dashes.length]}
      castShadow
    >
      <meshStandardMaterial ref={material} roughness={0.75} metalness={0} transparent opacity={0} />
    </instancedMesh>
  );
}
