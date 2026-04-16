import * as THREE from 'three';
import type { GeneratedMap } from './MapGenerator.ts';
import { NavGrid } from './NavGrid.ts';
import {
  createCapitalMesh,
  createNestMesh,
  createObstacleMesh,
} from '../rendering/Silhouettes.ts';

export type PickableType =
  | 'capital'
  | 'slot'
  | 'nest'
  | 'obstacle'
  | 'building'
  | 'hero'
  | 'monster';

export interface PickableUserData {
  type: PickableType;
  id: string;
}

/**
 * Holds the scene root for map entities and rebuilds it from a generated map.
 *
 * M4: capital + nest visuals upgraded to M9 silhouettes (cap keep + dome nests).
 * Obstacles get stone/tree silhouettes by deterministic per-obstacle choice.
 * Build slot markers stay as primitives — the M3 placement pulse relies on
 * MeshBasicMaterial opacity tricks and we keep that intact for now.
 */
export class World {
  readonly root: THREE.Group;
  readonly navGrid: NavGrid;
  map: GeneratedMap;

  private groupCapital: THREE.Group;
  private groupSlots: THREE.Group;
  private groupNests: THREE.Group;
  private groupObstacles: THREE.Group;

  /** Explicit disposables created directly by World (slot disc etc.). */
  private readonly disposables: Array<THREE.Material | THREE.BufferGeometry> = [];

  constructor(map: GeneratedMap) {
    this.map = map;
    this.root = new THREE.Group();
    this.root.name = 'world';

    this.groupCapital = new THREE.Group();
    this.groupCapital.name = 'capital';
    this.groupSlots = new THREE.Group();
    this.groupSlots.name = 'slots';
    this.groupNests = new THREE.Group();
    this.groupNests.name = 'nests';
    this.groupObstacles = new THREE.Group();
    this.groupObstacles.name = 'obstacles';

    this.root.add(this.groupCapital, this.groupSlots, this.groupNests, this.groupObstacles);

    this.navGrid = new NavGrid();
    this.navGrid.applyObstacles(map.obstacles);

    this.build();
  }

  rebuild(map: GeneratedMap): void {
    this.map = map;
    this.clearGroup(this.groupCapital);
    this.clearGroup(this.groupSlots);
    this.clearGroup(this.groupNests);
    this.clearGroup(this.groupObstacles);
    this.navGrid.clear();
    this.navGrid.applyObstacles(map.obstacles);
    this.build();
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    // Silhouette factories create their own materials/geometries per call; walk
    // descendants and dispose on cleanup.
    this.root.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
      else mat.dispose();
    });
  }

  private build(): void {
    // --- Capital: M9 silhouette keep, userData preset by factory; override id.
    {
      const capital = createCapitalMesh();
      capital.position.set(this.map.capital.x, 0, this.map.capital.z);
      capital.name = 'capital';
      (capital.userData as PickableUserData) = { type: 'capital', id: 'capital' };
      // Propagate pickable tag to children so raycaster finds it via leaf meshes.
      tagChildren(capital, 'capital', 'capital');
      this.groupCapital.add(capital);
    }

    // --- Build slots: translucent yellow discs (kept as primitives for M3 pulse).
    {
      const geo = new THREE.CircleGeometry(40, 24);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffe28a,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      });
      for (const s of this.map.slots) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(s.x, 0.8, s.z);
        mesh.name = s.id;
        const ud: PickableUserData = { type: 'slot', id: s.id };
        mesh.userData = ud;
        this.groupSlots.add(mesh);
      }
      this.disposables.push(geo, mat);
    }

    // --- Nests: M9 silhouettes per tier.
    for (const n of this.map.nests) {
      const nestMesh = createNestMesh(n.tier);
      nestMesh.position.set(n.x, 0, n.z);
      nestMesh.name = n.id;
      (nestMesh.userData as PickableUserData) = { type: 'nest', id: n.id };
      tagChildren(nestMesh, 'nest', n.id);
      this.groupNests.add(nestMesh);
    }

    // --- Obstacles: alternating stone / tree silhouettes, centered in rect.
    for (let i = 0; i < this.map.obstacles.length; i++) {
      const r = this.map.obstacles[i]!;
      const w = r.maxX - r.minX;
      const h = r.maxZ - r.minZ;
      const cx = (r.minX + r.maxX) * 0.5;
      const cz = (r.minZ + r.maxZ) * 0.5;
      const id = `obstacle-${i}`;
      const kind: 'stone' | 'tree' = (i % 2 === 0) ? 'stone' : 'tree';
      // Scale the silhouette to roughly fill the rect; base silhouettes are ~120u wide.
      const baseSize = kind === 'stone' ? 120 : 80;
      const scale = Math.max(0.6, Math.min(w, h) / baseSize);
      const obsMesh = createObstacleMesh(kind, scale);
      obsMesh.position.set(cx, 0, cz);
      obsMesh.name = id;
      (obsMesh.userData as PickableUserData) = { type: 'obstacle', id };
      tagChildren(obsMesh, 'obstacle', id);
      this.groupObstacles.add(obsMesh);
    }
  }

  private clearGroup(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children[0]!;
      group.remove(child);
    }
  }
}

/** Stamp userData onto every descendant mesh so raycaster picks on leaves too. */
function tagChildren(root: THREE.Object3D, type: PickableType, id: string): void {
  root.traverse((obj) => {
    if (obj === root) return;
    const existing = obj.userData as Partial<PickableUserData>;
    if (existing && typeof existing.type === 'string' && existing.type.length > 0) return;
    obj.userData = { type, id };
  });
}
