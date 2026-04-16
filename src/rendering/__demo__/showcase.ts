import * as THREE from 'three';
import {
  createCapitalMesh,
  createBuildSlotMesh,
  createBarracksMesh,
  createMarketMesh,
  createBlacksmithMesh,
  createObstacleMesh,
  createNestMesh,
  createWarriorMesh,
  createArcherMesh,
  createMonsterMesh,
} from '../Silhouettes.ts';
import { createBlobShadow } from '../BlobShadows.ts';

/**
 * Dev-only showcase: drops one of every silhouette across x = -1500..+1500
 * with a blob shadow underneath so we can eyeball them from the strategic
 * camera distance.
 *
 * Not wired into Game.ts — that happens post-merge when M9 integrates with
 * the live world.
 */
export function buildShowcase(scene: THREE.Scene): void {
  const group = new THREE.Group();
  group.name = 'm9-showcase';

  const entries: Array<{ mesh: THREE.Group; shadowRadius: number; label: string }> = [
    { mesh: createCapitalMesh(), shadowRadius: 180, label: 'capital' },
    { mesh: createBuildSlotMesh(), shadowRadius: 55, label: 'slot' },
    { mesh: createBarracksMesh(), shadowRadius: 95, label: 'barracks' },
    { mesh: createMarketMesh(), shadowRadius: 100, label: 'market' },
    { mesh: createBlacksmithMesh(), shadowRadius: 90, label: 'blacksmith' },
    { mesh: createObstacleMesh('stone', 1), shadowRadius: 45, label: 'stone' },
    { mesh: createObstacleMesh('tree', 1), shadowRadius: 35, label: 'tree' },
    { mesh: createNestMesh('near'), shadowRadius: 90, label: 'nest-near' },
    { mesh: createNestMesh('mid'), shadowRadius: 115, label: 'nest-mid' },
    { mesh: createNestMesh('far'), shadowRadius: 140, label: 'nest-far' },
    { mesh: createWarriorMesh(), shadowRadius: 30, label: 'warrior' },
    { mesh: createArcherMesh(), shadowRadius: 26, label: 'archer' },
    { mesh: createMonsterMesh(), shadowRadius: 24, label: 'monster' },
  ];

  const xStart = -1500;
  const xEnd = 1500;
  const step = (xEnd - xStart) / Math.max(entries.length - 1, 1);

  entries.forEach((entry, i) => {
    const x = xStart + step * i;
    entry.mesh.position.x = x;

    const shadow = createBlobShadow(entry.shadowRadius);
    shadow.position.x = x;

    entry.mesh.name = `showcase-${entry.label}`;
    group.add(shadow);
    group.add(entry.mesh);
  });

  scene.add(group);
}
