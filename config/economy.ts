// Economy configuration for Cladhunter

export const TON_TO_ENERGY_RATE = 100000;

export const ENERGY_PER_AD = {
  short: 10,
  long: 25,
  promo: 50,
};

export interface Boost {
  level: number;
  name: string;
  multiplier: number;
  costTon: number;
  durationDays?: number;
}

export const BOOSTS: Boost[] = [
  { level: 0, name: "Base", multiplier: 1, costTon: 0 },
  { level: 1, name: "Bronze", multiplier: 1.25, costTon: 0.5, durationDays: 7 },
  { level: 2, name: "Silver", multiplier: 1.5, costTon: 1.2, durationDays: 14 },
  { level: 3, name: "Gold", multiplier: 2, costTon: 2.8, durationDays: 30 },
  { level: 4, name: "Diamond", multiplier: 3, costTon: 6, durationDays: 60 },
];

export const DAILY_VIEW_LIMIT = 200;

export const AD_COOLDOWN_SECONDS = 30;

export function boostMultiplier(level: number): number {
  return BOOSTS.find((b) => b.level === level)?.multiplier || 1;
}

export function getBoostByLevel(level: number): Boost | undefined {
  return BOOSTS.find((b) => b.level === level);
}

export function energyToTon(energy: number): number {
  return energy / TON_TO_ENERGY_RATE;
}

export function tonToEnergy(ton: number): number {
  return ton * TON_TO_ENERGY_RATE;
}
