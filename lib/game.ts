import type { Species, Stage, Variant } from "./sprites";

export interface Stats {
  hunger: number; // 0 = starving, 100 = full
  energy: number; // 0 = exhausted, 100 = rested
  happiness: number;
  cleanliness: number;
  health: number;
}

export interface PetState {
  name: string;
  species: Species;
  bornAt: number; // epoch ms
  lastTick: number; // epoch ms of last decay calc
  stats: Stats;
  coins: number;
  careScore: number; // accumulates good care, drives variant
  careTicks: number; // number of decay ticks counted
  asleep: boolean;
}

export const SAVE_KEY = "pixelpaws.save.v1";

export const SPECIES_INFO: Record<
  Species,
  { label: string; emoji: string; food: string; blurb: string }
> = {
  cat: {
    label: "Kucing",
    emoji: "🐱",
    food: "Ikan",
    blurb: "Mandiri tapi manja kalau lagi mau.",
  },
  dog: {
    label: "Anjing",
    emoji: "🐶",
    food: "Tulang",
    blurb: "Setia, energik, gampang senang.",
  },
  rabbit: {
    label: "Kelinci",
    emoji: "🐰",
    food: "Wortel",
    blurb: "Lembut, pemalu, suka lompat-lompat.",
  },
};

// Decay per real hour for each stat (gentle — santai).
const DECAY_PER_HOUR: Record<keyof Stats, number> = {
  hunger: 9,
  energy: 7,
  happiness: 6,
  cleanliness: 5,
  health: 0, // health is derived, not decayed directly
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function newPet(name: string, species: Species, now: number): PetState {
  return {
    name: name.trim() || SPECIES_INFO[species].label,
    species,
    bornAt: now,
    lastTick: now,
    stats: {
      hunger: 80,
      energy: 80,
      happiness: 80,
      cleanliness: 90,
      health: 100,
    },
    coins: 20,
    careScore: 0,
    careTicks: 0,
    asleep: false,
  };
}

// Advance the simulation to `now` based on real elapsed time.
export function tick(pet: PetState, now: number): PetState {
  const elapsedMs = Math.max(0, now - pet.lastTick);
  if (elapsedMs < 1000) return pet;
  const hours = elapsedMs / (1000 * 60 * 60);

  const s = { ...pet.stats };

  // Sleeping restores energy and halts hunger/happiness drain.
  if (pet.asleep) {
    s.energy = clamp(s.energy + 24 * hours);
    s.hunger = clamp(s.hunger - DECAY_PER_HOUR.hunger * 0.4 * hours);
    s.cleanliness = clamp(s.cleanliness - DECAY_PER_HOUR.cleanliness * 0.5 * hours);
  } else {
    s.hunger = clamp(s.hunger - DECAY_PER_HOUR.hunger * hours);
    s.energy = clamp(s.energy - DECAY_PER_HOUR.energy * hours);
    s.happiness = clamp(s.happiness - DECAY_PER_HOUR.happiness * hours);
    s.cleanliness = clamp(s.cleanliness - DECAY_PER_HOUR.cleanliness * hours);
  }

  // Health drifts toward the average of the other needs (mercy: never dies).
  const avg = (s.hunger + s.energy + s.happiness + s.cleanliness) / 4;
  const healthTarget = 20 + avg * 0.8; // floor at 20 so pet recovers
  const healthRate = 12 * hours;
  if (s.health < healthTarget) {
    s.health = clamp(Math.min(healthTarget, s.health + healthRate));
  } else {
    s.health = clamp(Math.max(healthTarget, s.health - healthRate));
  }

  // Accumulate care score from this window (how well-kept the pet was).
  const wellbeing = (avg + s.health) / 2;
  const careTicks = pet.careTicks + hours;
  const careScore = pet.careScore + wellbeing * hours;

  return {
    ...pet,
    stats: s,
    lastTick: now,
    careTicks,
    careScore,
    // auto-wake once fully rested
    asleep: pet.asleep && s.energy < 99,
  };
}

// Age thresholds in real hours.
const TEEN_AT = 24; // 1 day
const ADULT_AT = 72; // 3 days

export function stageOf(pet: PetState, now: number): Stage {
  const ageHours = (now - pet.bornAt) / (1000 * 60 * 60);
  if (ageHours >= ADULT_AT) return "adult";
  if (ageHours >= TEEN_AT) return "teen";
  return "baby";
}

export function variantOf(pet: PetState): Variant {
  if (pet.careTicks < 0.5) return "normal";
  const avgCare = pet.careScore / pet.careTicks;
  if (avgCare >= 72) return "sunny";
  if (avgCare <= 45) return "grumpy";
  return "normal";
}

export function ageLabel(pet: PetState, now: number): string {
  const mins = Math.floor((now - pet.bornAt) / 60000);
  if (mins < 60) return `${mins} mnt`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam`;
  const days = Math.floor(hrs / 24);
  return `${days} hari ${hrs % 24} jam`;
}

// ---- In-world interactions (room) ----

export const FOOD_COST = 3;

// Pet/elus: click the animal directly.
export function elus(pet: PetState): { pet: PetState; msg: string } {
  const s = { ...pet.stats };
  s.happiness = clamp(s.happiness + 7);
  s.cleanliness = clamp(s.cleanliness - 1);
  return { pet: { ...pet, stats: s }, msg: "Dielus-elus, seneng banget ❤️" };
}

// Reward when the pet catches the thrown ball.
export function fetchBall(pet: PetState): { pet: PetState; msg: string } {
  const s = { ...pet.stats };
  s.happiness = clamp(s.happiness + 14);
  s.energy = clamp(s.energy - 7);
  s.hunger = clamp(s.hunger - 4);
  return {
    pet: { ...pet, stats: s, coins: pet.coins + 3 },
    msg: "Hap! Bola ketangkep 🎾 +3🪙",
  };
}

// Applied when the pet finishes eating the food bowl.
export function eatMeal(pet: PetState): { pet: PetState; msg: string } {
  const s = { ...pet.stats };
  s.hunger = clamp(s.hunger + 30);
  s.happiness = clamp(s.happiness + 4);
  s.cleanliness = clamp(s.cleanliness - 4);
  return { pet: { ...pet, stats: s }, msg: `Nyam nyam ${SPECIES_INFO[pet.species].food}! 😋` };
}

// Charge coins to place a food bowl. Returns null if too poor.
export function payForFood(pet: PetState): PetState | null {
  if (pet.coins < FOOD_COST) return null;
  return { ...pet, coins: pet.coins - FOOD_COST };
}

// ---- Actions ----



export function clean(pet: PetState): { pet: PetState; msg: string } {
  if (pet.stats.cleanliness > 92) return { pet, msg: "Udah wangi kok ✨" };
  const s = { ...pet.stats };
  s.cleanliness = clamp(s.cleanliness + 35);
  s.happiness = clamp(s.happiness + 3);
  return { pet: { ...pet, stats: s }, msg: "Mandi selesai, bersih & wangi! 🛁" };
}

export function toggleSleep(pet: PetState): { pet: PetState; msg: string } {
  if (pet.asleep) {
    return { pet: { ...pet, asleep: false }, msg: "Bangun! 🌞" };
  }
  return { pet: { ...pet, asleep: true }, msg: "Selamat tidur 😴💤" };
}

// ---- Persistence ----

export function save(pet: PetState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(pet));
  } catch {}
}

export function load(): PetState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PetState;
  } catch {
    return null;
  }
}

export function wipe() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {}
}
