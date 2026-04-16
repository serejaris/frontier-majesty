import type { PerkDef } from '../progression/Perks.ts';

/**
 * V1 pool of 12 perks — mirrors PRD §16.2 exactly.
 *
 * Effects are written into a shared `PerkMods` struct read by gameplay systems
 * in later milestones (M3 economy, M4 hiring/XP, M5 shop, M6 combat, M8 nest events).
 * Identifiers are kebab-case and stable — treat them as save-game keys.
 */
export const PERK_POOL: readonly PerkDef[] = [
  {
    id: 'royal-tax',
    title: 'Royal Tax',
    description: 'Kingdom gold tick +20%.',
    apply: (m) => {
      m.goldTickMultiplier *= 1.2;
    },
  },
  {
    id: 'smith-subsidy',
    title: 'Smith Subsidy',
    description: "Every hero's first blacksmith upgrade costs 30% less.",
    apply: (m) => {
      m.firstSmithUpgradeDiscount = 0.3;
    },
  },
  {
    id: 'merchant-guild',
    title: 'Merchant Guild',
    description: 'Potions are 20% cheaper.',
    apply: (m) => {
      m.potionPriceMultiplier *= 0.8;
    },
  },
  {
    id: 'veterans',
    title: 'Veterans',
    description: 'New heroes start at Level 2.',
    apply: (m) => {
      m.heroStartLevel = Math.max(m.heroStartLevel, 2);
    },
  },
  {
    id: 'training-grounds',
    title: 'Training Grounds',
    description: 'All heroes gain +25% XP.',
    apply: (m) => {
      m.xpMultiplier *= 1.25;
    },
  },
  {
    id: 'fast-muster',
    title: 'Fast Muster',
    description: 'Every 3rd hero hire is free.',
    apply: (m) => {
      m.freeHirePeriod = 3;
    },
  },
  {
    id: 'shield-wall',
    title: 'Shield Wall',
    description: 'Warriors adjacent to another warrior gain +10% damage reduction.',
    apply: (m) => {
      m.warriorAdjacencyDamageReduction = 0.1;
    },
  },
  {
    id: 'deadeye',
    title: 'Deadeye',
    description: 'Archers deal +20% damage to targets below 50% HP.',
    apply: (m) => {
      m.archerLowHpDamageBonus = 0.2;
    },
  },
  {
    id: 'battle-rhythm',
    title: 'Battle Rhythm',
    description: 'After a kill, the hero gains +15% attack speed for 4s.',
    apply: (m) => {
      m.onKillAttackSpeedBuff = { percent: 0.15, duration: 4 };
    },
  },
  {
    id: 'quartermaster',
    title: 'Quartermaster',
    description: 'Potion carry limit +1.',
    apply: (m) => {
      m.potionCarryBonus += 1;
    },
  },
  {
    id: 'siege-training',
    title: 'Siege Training',
    description: 'All heroes deal +35% damage to nests.',
    apply: (m) => {
      m.nestDamageMultiplier *= 1.35;
    },
  },
  {
    id: 'triumph',
    title: 'Triumph',
    description: 'When a nest is destroyed, all living heroes heal 25%.',
    apply: (m) => {
      m.onNestDestroyHealPercent = Math.max(m.onNestDestroyHealPercent, 0.25);
    },
  },
];
