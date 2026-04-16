import * as THREE from 'three';
import type { GeneratedMap, NestPlacement } from './MapGenerator.ts';
import { NavGrid } from './NavGrid.ts';

export type PickableType = 'capital' | 'slot' | 'nest' | 'obstacle';

export interface PickableUserData {
  type: PickableType;
  id: string;
}

const NEST_RADIUS: Record<NestPlacement['tier'], number> = {
  near: 44,
  mid: 56,
  far: 72,
};

const NEST_COLOR: Record<NestPlacement['tier'], number> = {
  near: 0xc85040,
  mid: 0xb03030,
  far: 0x881f20,
};

/**
 * Holds the scene root for map entities and rebuilds it from a generated map.
 * Kept lean — subsequent milestones will swap placeholders for glTF (M9).
 */
export class World {
  readonly root: THREE.Group;
  readonly navGrid: NavGrid;
  map: GeneratedMap;

  private groupCapital: THREE.Group;
  private groupSlots: THREE.Group;
  private groupNests: THREE.Group;
  private groupObstacles: THREE.Group;

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
  }

  private build(): void {
    // --- Capital: tall yellow cylinder placeholder.
    {
      const geo = new THREE.CylinderGeometry(70, 80, 140, 18);
      const mat = new THREE.MeshLambertMaterial({ color: 0xffcc55 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(this.map.capital.x, 70, this.map.capital.z);
      mesh.name = 'capital';
      const ud: PickableUserData = { type: 'capital', id: 'capital' };
      mesh.userData = ud;
      this.groupCapital.add(mesh);
      this.disposables.push(geo, mat);
    }

    // --- Build slots: translucent yellow discs.
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

    // --- Nests: red domes, radius by tier.
    {
      // Per-tier shared material; separate geos for each dome size.
      const mats: Record<NestPlacement['tier'], THREE.Material> = {
        near: new THREE.MeshLambertMaterial({ color: NEST_COLOR.near }),
        mid: new THREE.MeshLambertMaterial({ color: NEST_COLOR.mid }),
        far: new THREE.MeshLambertMaterial({ color: NEST_COLOR.far }),
      };
      for (const m of Object.values(mats)) this.disposables.push(m);

      for (const n of this.map.nests) {
        const r = NEST_RADIUS[n.tier];
        const geo = new THREE.SphereGeometry(r, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        this.disposables.push(geo);
        const mesh = new THREE.Mesh(geo, mats[n.tier]);
        mesh.position.set(n.x, 0, n.z);
        mesh.name = n.id;
        const ud: PickableUserData = { type: 'nest', id: n.id };
        mesh.userData = ud;
        this.groupNests.add(mesh);
      }
    }

    // --- Obstacles: grey boxes.
    {
      const mat = new THREE.MeshLambertMaterial({ color: 0x7a8088 });
      this.disposables.push(mat);
      for (let i = 0; i < this.map.obstacles.length; i++) {
        const r = this.map.obstacles[i]!;
        const w = r.maxX - r.minX;
        const h = r.maxZ - r.minZ;
        const geo = new THREE.BoxGeometry(w, 60, h);
        this.disposables.push(geo);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set((r.minX + r.maxX) * 0.5, 30, (r.minZ + r.maxZ) * 0.5);
        mesh.name = `obstacle-${i}`;
        const ud: PickableUserData = { type: 'obstacle', id: `obstacle-${i}` };
        mesh.userData = ud;
        this.groupObstacles.add(mesh);
      }
    }
  }

  private clearGroup(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children[0]!;
      group.remove(child);
    }
  }
}
