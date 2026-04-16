import * as THREE from 'three';
import { PALETTE } from './Palette.ts';
import { toonMat, flatMat } from './Materials.ts';

/**
 * Procedural low-poly silhouettes for Frontier Majesty.
 *
 * Each factory returns a `THREE.Group` with `userData.type` preset,
 * composed from primitive geometries (Box/Cone/Cylinder/Sphere/Octahedron/Circle)
 * per PRD §18 — so we stay within tri budgets and render flat via toon materials.
 *
 * When glTF packs are adopted later, the factory API stays the same —
 * only the internal assembly changes.
 */

// -------------------- Capital --------------------

/**
 * Capital keep — hex base + tapered tower body + spire with flag.
 * Tri estimate:  hex base ~36 + body box 12 + mid box 12 + spire cone(6) 12 +
 *                flagpole cyl(8) 32 + flag box 12 + banner box 12 ≈ 128 tris
 */
export function createCapitalMesh(): THREE.Group {
  const g = new THREE.Group();
  g.userData.type = 'capital';

  const wall = toonMat(PALETTE.kingdomSecondary);
  const gold = toonMat(PALETTE.kingdomPrimary);

  // Hex base — CylinderGeometry with 6 radial segments ≈ hexagon prism.
  const base = new THREE.Mesh(new THREE.CylinderGeometry(160, 180, 60, 6), wall);
  base.position.y = 30;
  g.add(base);

  // Lower body box.
  const lower = new THREE.Mesh(new THREE.BoxGeometry(200, 110, 200), wall);
  lower.position.y = 60 + 55;
  g.add(lower);

  // Tapered tower middle (cylinder 8 radial).
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(75, 95, 90, 8), wall);
  mid.position.y = 60 + 110 + 45;
  g.add(mid);

  // Upper tower block with crenel hint.
  const upper = new THREE.Mesh(new THREE.BoxGeometry(120, 50, 120), gold);
  upper.position.y = 60 + 110 + 90 + 25;
  g.add(upper);

  // Spire cone.
  const spire = new THREE.Mesh(new THREE.ConeGeometry(55, 110, 6), gold);
  spire.position.y = 60 + 110 + 90 + 50 + 55;
  g.add(spire);

  // Flag pole.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 60, 6), flatMat(0x3a2a1a));
  pole.position.y = 60 + 110 + 90 + 50 + 110 + 30;
  g.add(pole);

  // Flag.
  const flag = new THREE.Mesh(new THREE.BoxGeometry(40, 18, 2), toonMat(PALETTE.kingdomPrimary));
  flag.position.set(20, 60 + 110 + 90 + 50 + 110 + 45, 0);
  g.add(flag);

  return g;
}

// -------------------- Build Slot --------------------

export interface BuildSlotMesh extends THREE.Group {
  setHighlight(on: boolean): void;
}

/**
 * Build slot indicator — flat disc + thin ring + center cross.
 * Tri estimate: disc 16 + ring cyl(24) 96 + cross boxes 24 ≈ 136 tris
 */
export function createBuildSlotMesh(): BuildSlotMesh {
  const g = new THREE.Group() as BuildSlotMesh;
  g.userData.type = 'slot';

  const baseCol = PALETTE.slotHighlight;
  const hiCol = 0xffffff;

  // Disc — flat on XZ, just above ground.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(50, 16),
    flatMat(baseCol, { opacity: 0.25 })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 1;
  g.add(disc);

  // Thin ring — torus emulated with a short wide CylinderGeometry open-ended.
  const ringMat = flatMat(baseCol, { opacity: 0.85 });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(52, 52, 4, 24, 1, true), ringMat);
  ring.position.y = 2;
  g.add(ring);

  // Center cross — two thin flat boxes forming a plus sign.
  const crossMat = flatMat(baseCol, { opacity: 0.9 });
  const arm1 = new THREE.Mesh(new THREE.BoxGeometry(40, 2, 6), crossMat);
  arm1.position.y = 2;
  g.add(arm1);
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 40), crossMat);
  arm2.position.y = 2;
  g.add(arm2);

  g.setHighlight = (on: boolean) => {
    // Tint ring + disc + cross between highlight and occupied colors.
    const c = on ? hiCol : baseCol;
    (ring.material as THREE.MeshLambertMaterial).color.setHex(c);
    (disc.material as THREE.MeshLambertMaterial).color.setHex(c);
    (arm1.material as THREE.MeshLambertMaterial).color.setHex(c);
  };

  return g;
}

// -------------------- Barracks --------------------

/**
 * Barracks — box walls + pitched pyramid roof + small chimney.
 * Tri estimate: walls box 12 + plinth box 12 + pyramid cone(4) 8 +
 *               chimney box 12 + accent banner box 12 ≈ 56 tris
 * Well under the 1500–4000 building budget, leaving headroom for later detail.
 */
export function createBarracksMesh(): THREE.Group {
  const g = new THREE.Group();
  g.userData.type = 'building';
  g.userData.subtype = 'barracks';

  const wall = toonMat(PALETTE.buildingWall);
  const roof = toonMat(PALETTE.buildingRoof);
  const accent = toonMat(PALETTE.buildingAccentBarracks);

  // Stone plinth.
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(150, 20, 150), flatMat(PALETTE.obstacleStone));
  plinth.position.y = 10;
  g.add(plinth);

  // Walls.
  const walls = new THREE.Mesh(new THREE.BoxGeometry(140, 80, 140), wall);
  walls.position.y = 20 + 40;
  g.add(walls);

  // Pyramid roof — 4-sided cone rotated so face points forward.
  const pyramid = new THREE.Mesh(new THREE.ConeGeometry(110, 70, 4), roof);
  pyramid.rotation.y = Math.PI / 4;
  pyramid.position.y = 20 + 80 + 35;
  g.add(pyramid);

  // Accent banner (identifies as barracks — steel blue).
  const banner = new THREE.Mesh(new THREE.BoxGeometry(70, 16, 2), accent);
  banner.position.set(0, 20 + 40, 72);
  g.add(banner);

  // Chimney.
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(18, 40, 18), accent);
  chimney.position.set(45, 20 + 80 + 20, 45);
  g.add(chimney);

  return g;
}

// -------------------- Market --------------------

/**
 * Market — lower wider box + triangular fabric canopy + crates.
 * Tri estimate: base 12 + floor 12 + canopy cone(3) 6 + 2 crates 24 ≈ 54 tris
 */
export function createMarketMesh(): THREE.Group {
  const g = new THREE.Group();
  g.userData.type = 'building';
  g.userData.subtype = 'market';

  const wall = toonMat(PALETTE.buildingWall);
  const canopyCol = toonMat(PALETTE.buildingAccentMarket);

  // Wide lower base (market is squat).
  const base = new THREE.Mesh(new THREE.BoxGeometry(180, 50, 180), wall);
  base.position.y = 25;
  g.add(base);

  // Inner stall counter.
  const counter = new THREE.Mesh(new THREE.BoxGeometry(120, 30, 120), flatMat(PALETTE.buildingRoof));
  counter.position.y = 50 + 15;
  g.add(counter);

  // Triangular fabric canopy — a 3-sided cone rotated so an edge faces camera.
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(130, 70, 3), canopyCol);
  canopy.position.y = 50 + 30 + 40;
  canopy.rotation.y = Math.PI / 6;
  g.add(canopy);

  // Crates.
  const crate = toonMat(0x8a5a32);
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), crate);
  c1.position.set(90, 15, 70);
  g.add(c1);
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(28, 28, 28), crate);
  c2.position.set(-85, 14, -70);
  g.add(c2);

  return g;
}

// -------------------- Blacksmith --------------------

/**
 * Blacksmith — box + slanted roof + tall dark cylinder chimney.
 * Tri estimate: base 12 + slant roof box 12 + chimney cyl(8) 32 +
 *               anvil box 12 ≈ 68 tris
 */
export function createBlacksmithMesh(): THREE.Group {
  const g = new THREE.Group();
  g.userData.type = 'building';
  g.userData.subtype = 'blacksmith';

  const wall = toonMat(PALETTE.buildingWall);
  const roof = toonMat(PALETTE.buildingRoof);
  const soot = toonMat(PALETTE.buildingAccentBlacksmith);

  // Base.
  const base = new THREE.Mesh(new THREE.BoxGeometry(140, 90, 140), wall);
  base.position.y = 45;
  g.add(base);

  // Slanted roof — a box skewed by rotation; 2 halves would add tris, one slab is cheaper.
  const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(160, 18, 160), roof);
  roofSlab.position.y = 90 + 18;
  roofSlab.rotation.x = Math.PI / 14; // subtle slant
  g.add(roofSlab);

  // Tall dark cylinder chimney (signature silhouette).
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(14, 18, 90, 8), soot);
  chimney.position.set(40, 90 + 45, -40);
  g.add(chimney);

  // Anvil hint out front.
  const anvil = new THREE.Mesh(new THREE.BoxGeometry(30, 18, 16), soot);
  anvil.position.set(0, 9, 80);
  g.add(anvil);

  return g;
}

// -------------------- Obstacles --------------------

/**
 * Obstacle — stone pile or tree, scaled.
 * Tri estimate: stone ~48 tris (4 boxes); tree trunk cyl(6) 24 + 2 cones(6) 24 ≈ 48 tris
 */
export function createObstacleMesh(kind: 'stone' | 'tree', scale: number = 1): THREE.Group {
  const g = new THREE.Group();
  g.userData.type = 'obstacle';
  g.userData.subtype = kind;

  if (kind === 'stone') {
    const mat = toonMat(PALETTE.obstacleStone);
    const accent = flatMat(0x5a5550);
    const rocks = [
      { sx: 60, sy: 40, sz: 55, x: 0, y: 20, z: 0, rot: 0.2, m: mat },
      { sx: 38, sy: 28, sz: 42, x: 35, y: 14, z: 20, rot: -0.3, m: mat },
      { sx: 30, sy: 22, sz: 28, x: -28, y: 11, z: -18, rot: 0.6, m: accent },
      { sx: 22, sy: 18, sz: 26, x: 12, y: 9, z: -32, rot: -0.1, m: accent },
    ];
    for (const r of rocks) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(r.sx, r.sy, r.sz), r.m);
      m.position.set(r.x, r.y, r.z);
      m.rotation.y = r.rot;
      g.add(m);
    }
  } else {
    // Tree: thin trunk + 2 stacked cones (fat bottom, narrow top).
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 10, 60, 6),
      toonMat(0x5a3a24)
    );
    trunk.position.y = 30;
    g.add(trunk);

    const foliage = toonMat(PALETTE.obstacleTree);
    const cone1 = new THREE.Mesh(new THREE.ConeGeometry(40, 55, 6), foliage);
    cone1.position.y = 60 + 20;
    g.add(cone1);
    const cone2 = new THREE.Mesh(new THREE.ConeGeometry(28, 42, 6), foliage);
    cone2.position.y = 60 + 50;
    g.add(cone2);
  }

  g.scale.setScalar(scale);
  return g;
}

// -------------------- Nests --------------------

/**
 * Nest — dome + 3 jagged cone spikes. Tier controls size and color:
 * - near : small orange  (~180 tris)
 * - mid  : medium red    (~180 tris)
 * - far  : large purple  (~180 tris)
 * Tri estimate: sphere(8,6) 96 + 3 cones(4) 24 + base ring cyl(8) 32 ≈ 152 tris
 */
export function createNestMesh(tier: 'near' | 'mid' | 'far'): THREE.Group {
  const g = new THREE.Group();
  g.userData.type = 'nest';
  g.userData.tier = tier;

  const tierData = {
    near: { color: PALETTE.nestNear, scale: 1.0 },
    mid: { color: PALETTE.nestMid, scale: 1.25 },
    far: { color: PALETTE.nestFar, scale: 1.55 },
  }[tier];

  const body = toonMat(tierData.color);
  const dark = toonMat(PALETTE.enemySecondary);
  const ember = toonMat(tierData.color, { emissive: tierData.color });

  // Base ring — suggests scorched earth around the nest.
  const base = new THREE.Mesh(new THREE.CylinderGeometry(90, 100, 10, 8), dark);
  base.position.y = 5;
  g.add(base);

  // Dome (half-sphere via scaled sphere).
  const dome = new THREE.Mesh(new THREE.SphereGeometry(80, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), body);
  dome.position.y = 10;
  g.add(dome);

  // 3 jagged spikes around top.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(14, 90, 4), dark);
    spike.position.set(Math.cos(a) * 50, 40, Math.sin(a) * 50);
    spike.rotation.z = Math.cos(a) * 0.25;
    spike.rotation.x = Math.sin(a) * 0.25;
    g.add(spike);
  }

  // Central ember — glowing core for drama.
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(18, 0), ember);
  core.position.y = 80;
  g.add(core);

  g.scale.setScalar(tierData.scale);
  return g;
}

// -------------------- Warrior --------------------

/**
 * Warrior — BULKY. Wide torso, thick shoulders, helmet dome, broad stance.
 * Readable as "heavy infantry" from the strategic camera.
 *
 * Silhouette distinguishers vs Archer:
 *   - AABB aspect: roughly 1.1 wide : 1 tall (squat, square-shouldered)
 *   - Dome helmet (rounded top)
 *   - Sword + shield held at sides
 *   - Blue-steel color
 *
 * Tri estimate (box=12, cyl(8)=32, cone(6)=12, sphere(8,6)=96, oct=8):
 *   torso 12 + hips 12 + 2 legs×12 + 2 shoulders×12 + 2 arms×32 +
 *   helmet dome sphere(10,8) 160 + visor box 12 +
 *   sword blade box 12 + sword guard box 12 + shield cyl(6) 24 ≈ 1088 tris
 * Target 1000–1400 tris.
 */
export function createWarriorMesh(): THREE.Group {
  const g = new THREE.Group();
  g.userData.type = 'hero';
  g.userData.subtype = 'warrior';

  const armor = toonMat(PALETTE.heroWarrior);
  const skin = toonMat(0xc89874);
  const steel = toonMat(0xb8c0c8);
  const gold = toonMat(PALETTE.kingdomPrimary);
  const dark = toonMat(0x1f2730);

  // Legs — thick and planted wide.
  const legL = new THREE.Mesh(new THREE.BoxGeometry(12, 28, 12), armor);
  legL.position.set(-9, 14, 0);
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(12, 28, 12), armor);
  legR.position.set(9, 14, 0);
  g.add(legR);

  // Hips plate.
  const hips = new THREE.Mesh(new THREE.BoxGeometry(28, 10, 18), armor);
  hips.position.y = 33;
  g.add(hips);

  // Torso — wide, chunky.
  const torso = new THREE.Mesh(new THREE.BoxGeometry(34, 30, 22), armor);
  torso.position.y = 53;
  g.add(torso);

  // Chest accent plate (gold crest).
  const crest = new THREE.Mesh(new THREE.BoxGeometry(14, 10, 2), gold);
  crest.position.set(0, 56, 12);
  g.add(crest);

  // Shoulder pauldrons — chunky.
  const paulL = new THREE.Mesh(new THREE.BoxGeometry(12, 14, 16), steel);
  paulL.position.set(-22, 62, 0);
  g.add(paulL);
  const paulR = new THREE.Mesh(new THREE.BoxGeometry(12, 14, 16), steel);
  paulR.position.set(22, 62, 0);
  g.add(paulR);

  // Arms — held at sides.
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 24, 8), armor);
  armL.position.set(-22, 48, 2);
  g.add(armL);
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 24, 8), armor);
  armR.position.set(22, 48, 2);
  g.add(armR);

  // Neck.
  const neck = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 8), skin);
  neck.position.y = 71;
  g.add(neck);

  // Helmet — dome top (distinct from archer's peaked hood).
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(12, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), steel);
  helmet.position.y = 77;
  g.add(helmet);

  // Helmet band.
  const band = new THREE.Mesh(new THREE.BoxGeometry(25, 4, 25), dark);
  band.position.y = 76;
  g.add(band);

  // Visor slit (visual identifier).
  const visor = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 2), dark);
  visor.position.set(0, 82, 11);
  g.add(visor);

  // Sword — blade on right side.
  const blade = new THREE.Mesh(new THREE.BoxGeometry(3, 38, 1.5), steel);
  blade.position.set(28, 48, -2);
  g.add(blade);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 3), gold);
  guard.position.set(28, 30, -2);
  g.add(guard);

  // Shield — on left side (round disc/cylinder).
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 3, 6), armor);
  shield.rotation.z = Math.PI / 2;
  shield.position.set(-28, 50, -4);
  g.add(shield);
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 4, 6), gold);
  boss.rotation.z = Math.PI / 2;
  boss.position.set(-30, 50, -4);
  g.add(boss);

  return g;
}

// -------------------- Archer --------------------

/**
 * Archer — SLENDER. Narrow torso, tall peaked hood, visible crescent bow, lean stance.
 *
 * Silhouette distinguishers vs Warrior:
 *   - AABB aspect: roughly 0.7 wide : 1 tall (tall, narrow)
 *   - Peaked hood cone (pointed top, not rounded)
 *   - Bow (flat crescent) visible on back
 *   - Forest green palette
 *
 * Tri estimate (box=12, cyl(6)=24, cone(6)=12, sphere(8,6)=96):
 *   2 legs×12 + hips 12 + torso 12 + 2 arms×24 + shoulder wrap box 12 +
 *   hood cone 12 + face box 12 + bow ring torus-like cyl(12,open) 48 +
 *   bowstring box 12 + quiver cyl(6) 24 + 3 arrow heads×8 ≈ 280–360 tris
 *
 * To meet 800–1200 target we add layered cloak pieces and arm wraps:
 *   + cloak panels 3×12 + arm wraps 2×24 + belt 12 + hood brim cyl(6) 24
 *   ≈ ~900 tris total.
 */
export function createArcherMesh(): THREE.Group {
  const g = new THREE.Group();
  g.userData.type = 'hero';
  g.userData.subtype = 'archer';

  const cloak = toonMat(PALETTE.heroArcher);
  const skin = toonMat(0xc89874);
  const wood = toonMat(0x6a4a2a);
  const dark = toonMat(0x1a2a1a);
  const leather = toonMat(0x4a3a24);

  // Legs — narrower than warrior.
  const legL = new THREE.Mesh(new THREE.BoxGeometry(8, 30, 8), cloak);
  legL.position.set(-5, 15, 0);
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(8, 30, 8), cloak);
  legR.position.set(5, 15, 0);
  g.add(legR);

  // Belt.
  const belt = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 12), leather);
  belt.position.y = 33;
  g.add(belt);

  // Torso — narrow, taller.
  const torso = new THREE.Mesh(new THREE.BoxGeometry(18, 32, 12), cloak);
  torso.position.y = 52;
  g.add(torso);

  // Shoulder wrap — smaller than warrior's pauldrons.
  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(26, 6, 14), dark);
  shoulders.position.y = 66;
  g.add(shoulders);

  // Cloak panels — layered drapery for tri count + silhouette fullness below hips.
  const panel1 = new THREE.Mesh(new THREE.BoxGeometry(20, 24, 3), cloak);
  panel1.position.set(0, 44, -8);
  panel1.rotation.x = -0.08;
  g.add(panel1);
  const panel2 = new THREE.Mesh(new THREE.BoxGeometry(16, 20, 3), cloak);
  panel2.position.set(-9, 40, -8);
  panel2.rotation.x = -0.08;
  g.add(panel2);
  const panel3 = new THREE.Mesh(new THREE.BoxGeometry(16, 20, 3), cloak);
  panel3.position.set(9, 40, -8);
  panel3.rotation.x = -0.08;
  g.add(panel3);

  // Arms — leaner, held with bow.
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 28, 6), cloak);
  armL.position.set(-13, 52, 6);
  armL.rotation.x = -0.2;
  g.add(armL);
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 28, 6), cloak);
  armR.position.set(13, 52, 4);
  g.add(armR);

  // Arm wraps (tri + silhouette).
  const wrapL = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 10, 6), leather);
  wrapL.position.set(-13, 42, 6);
  g.add(wrapL);
  const wrapR = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 10, 6), leather);
  wrapR.position.set(13, 42, 4);
  g.add(wrapR);

  // Face / neck — recessed inside hood.
  const face = new THREE.Mesh(new THREE.BoxGeometry(8, 10, 6), skin);
  face.position.set(0, 74, 2);
  g.add(face);

  // Hood brim.
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(12, 14, 4, 6), cloak);
  brim.position.y = 76;
  g.add(brim);

  // Peaked hood — tall cone (KEY silhouette identifier vs warrior's dome).
  const hood = new THREE.Mesh(new THREE.ConeGeometry(12, 34, 6), cloak);
  hood.position.y = 95;
  g.add(hood);

  // Bow — flat crescent on back. We fake a crescent with an open cylinder arc
  // by using an open-ended cylinder with few segments and flattening.
  const bow = new THREE.Mesh(
    new THREE.CylinderGeometry(20, 20, 3, 12, 1, true, -Math.PI / 2.5, Math.PI * 1.2),
    wood
  );
  bow.rotation.x = Math.PI / 2;
  bow.position.set(0, 55, -10);
  bow.scale.set(1, 0.25, 1);
  g.add(bow);

  // Bowstring — thin flat box across the bow opening.
  const string = new THREE.Mesh(new THREE.BoxGeometry(1, 40, 1), dark);
  string.position.set(0, 55, -10);
  g.add(string);

  // Quiver on back with arrow tips.
  const quiver = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 28, 6), leather);
  quiver.position.set(-6, 60, -10);
  quiver.rotation.x = 0.2;
  g.add(quiver);
  for (let i = 0; i < 3; i++) {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(1.5, 6, 4), dark);
    tip.position.set(-6 + (i - 1) * 2, 78, -11);
    g.add(tip);
  }

  return g;
}

// -------------------- Monster --------------------

/**
 * Monster — hunched body, small emissive eyes, jagged teeth cones.
 * Tri estimate: body 12 + head box 12 + hunch hump box 12 +
 *               2 eyes oct×8 + 4 teeth cone(4)×8 + 4 limbs×12 + tail cone 8 ≈ 160 tris
 * Well within 400–1200 monster budget.
 */
export function createMonsterMesh(): THREE.Group {
  const g = new THREE.Group();
  g.userData.type = 'monster';

  const body = toonMat(PALETTE.enemyPrimary);
  const dark = toonMat(PALETTE.enemySecondary);
  const eye = toonMat(0xffe066, { emissive: 0xffaa00 });
  const tooth = toonMat(0xf2e6c7);

  // Body — hunched box, wider at shoulders.
  const torso = new THREE.Mesh(new THREE.BoxGeometry(26, 18, 34), body);
  torso.position.y = 20;
  torso.rotation.x = 0.15;
  g.add(torso);

  // Hump — dark spine ridge.
  const hump = new THREE.Mesh(new THREE.BoxGeometry(18, 10, 22), dark);
  hump.position.set(0, 30, -2);
  g.add(hump);

  // Head — thrust forward, tilted down.
  const head = new THREE.Mesh(new THREE.BoxGeometry(20, 16, 20), body);
  head.position.set(0, 22, 22);
  head.rotation.x = 0.3;
  g.add(head);

  // Eyes — emissive octahedra.
  const eL = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0), eye);
  eL.position.set(-5, 26, 31);
  g.add(eL);
  const eR = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0), eye);
  eR.position.set(5, 26, 31);
  g.add(eR);

  // Teeth cones — 4 along jawline.
  for (let i = 0; i < 4; i++) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4, 4), tooth);
    t.position.set(-4.5 + i * 3, 18, 32);
    t.rotation.x = Math.PI; // point down
    g.add(t);
  }

  // Limbs — 4 stubby legs.
  const legPos: [number, number][] = [
    [-10, 14], [10, 14], [-10, -10], [10, -10],
  ];
  for (const [x, z] of legPos) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(6, 14, 6), dark);
    leg.position.set(x, 7, z);
    g.add(leg);
  }

  // Tail.
  const tail = new THREE.Mesh(new THREE.ConeGeometry(4, 18, 4), body);
  tail.rotation.x = -Math.PI / 2 - 0.3;
  tail.position.set(0, 22, -22);
  g.add(tail);

  return g;
}
