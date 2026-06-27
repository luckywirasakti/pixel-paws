// Pixel-art sprites for PixelPaws. Each sprite is a 16x16 grid.
// Legend: '.' transparent, O outline, B body, S shadow, F belly/face,
//         E eye, N nose/pink, W white highlight.

export type Species = "cat" | "dog" | "rabbit";
export type Stage = "baby" | "teen" | "adult";
export type Variant = "sunny" | "normal" | "grumpy";

const CAT = [
  "................",
  "...O........O...",
  "..OBO......OBO..",
  "..OBBO....OBBO..",
  "..OBBBOOOOBBBO..",
  "..OBBBBBBBBBBO..",
  ".OBBEBBBBBBEBBO.",
  ".OBBBBBBBBBBBBO.",
  ".OBBBBBNNBBBBBO.",
  ".OBBBBBBBBBBBBO.",
  ".OBBFFFFFFFFBBO.",
  ".OBFFFFFFFFFFBO.",
  ".OBBFFFFFFFFBBO.",
  "..OBBBBBBBBBBO..",
  "..OBBO.OO.OBBO..",
  "...OO..OO...OO..",
];

const DOG = [
  "................",
  ".OO..........OO.",
  ".OBBO......OBBO.",
  ".OBBBO....OBBBO.",
  ".OBBBBOOOOBBBBO.",
  "..OBBBBBBBBBBO..",
  "..OBEBBBBBBEBO..",
  "..OBBBBBBBBBBO..",
  "..OBBBBNNBBBBO..",
  "..OBBBBNNBBBBO..",
  "..OBBFFFFFFBBO..",
  "..OBFFFFFFFFBO..",
  "..OBBFFFFFFBBO..",
  "...OBBBBBBBBO...",
  "...OBO..OBO.....",
  "....OO....OO....",
];

const RABBIT = [
  "................",
  "...O......O.....",
  "..OBO....OBO....",
  "..OBO....OBO....",
  "..OBBO..OBBO....",
  "..OBBBOOOBBO....",
  "...OBBBBBBBO....",
  "..OBBEBBBEBBO...",
  "..OBBBBNBBBBO...",
  "..OBBBBBBBBBO...",
  "..OBBFFFFFFBBO..",
  "..OBFFFFFFFFBO..",
  "..OBBFFFFFFBBO..",
  "...OBBBBBBBBO...",
  "...OBO..OBO.....",
  "....OO....OO....",
];

export const SPRITES: Record<Species, string[]> = {
  cat: CAT,
  dog: DOG,
  rabbit: RABBIT,
};

// Base palette per species. Variants tweak these at draw time.
type Palette = Record<string, string>;

const PALETTES: Record<Species, Palette> = {
  cat: {
    O: "#3a2a1f",
    B: "#e8924a",
    S: "#c2702f",
    F: "#f7e3c0",
    E: "#2a2a3a",
    N: "#e86a8a",
    W: "#ffffff",
  },
  dog: {
    O: "#332217",
    B: "#b9763f",
    S: "#8f5829",
    F: "#f1ddbf",
    E: "#2a2a3a",
    N: "#3a2a2a",
    W: "#ffffff",
  },
  rabbit: {
    O: "#4a4038",
    B: "#dcd4c8",
    S: "#b3a895",
    F: "#fbf4ea",
    E: "#2a2a3a",
    N: "#e86a8a",
    W: "#ffffff",
  },
};

function mix(hex: string, target: string, amt: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(target.slice(1), 16);
  const ar = (a >> 16) & 255,
    ag = (a >> 8) & 255,
    ab = a & 255;
  const br = (b >> 16) & 255,
    bg = (b >> 8) & 255,
    bb = b & 255;
  const r = Math.round(ar + (br - ar) * amt);
  const g = Math.round(ag + (bg - ag) * amt);
  const bl = Math.round(ab + (bb - ab) * amt);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

function paletteFor(species: Species, variant: Variant): Palette {
  const base = { ...PALETTES[species] };
  if (variant === "sunny") {
    // brighter, warmer
    base.B = mix(base.B, "#ffd27a", 0.25);
    base.F = mix(base.F, "#ffffff", 0.15);
  } else if (variant === "grumpy") {
    // desaturated, dull
    base.B = mix(base.B, "#8a8a8a", 0.45);
    base.S = mix(base.S, "#6a6a6a", 0.45);
    base.F = mix(base.F, "#bcbcbc", 0.3);
  }
  return base;
}

const STAGE_SCALE: Record<Stage, number> = {
  baby: 0.66,
  teen: 0.84,
  adult: 1.0,
};

function normalize(rows: string[]): string[] {
  return rows.map((r) => (r + "................").slice(0, 16));
}

export interface PetVisual {
  species: Species;
  stage: Stage;
  variant: Variant;
}

// Draw a pet sprite at an arbitrary position (top-left origin), pixel cell
// size `px`, optionally flipped horizontally. Used by the room renderer.
export function drawPetSprite(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  px: number,
  visual: PetVisual,
  opts?: { flip?: boolean },
) {
  const { species, stage, variant } = visual;
  const rows = normalize(SPRITES[species]);
  const palette = paletteFor(species, variant);
  const flip = opts?.flip ?? false;
  const ox = Math.round(originX);
  const oy = Math.round(originY);

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const sx = flip ? 15 - x : x;
      const ch = rows[y][sx];
      if (ch === ".") continue;
      ctx.fillStyle = palette[ch] || palette.B;
      ctx.fillRect(ox + x * px, oy + y * px, px, px);
    }
  }

  if (stage === "adult") {
    const cx = ox + 8 * px;
    const by = oy + 14 * px;
    ctx.fillStyle = variant === "grumpy" ? "#7a7a7a" : "#d24b6a";
    ctx.fillRect(cx - 3 * px, by, 3 * px, 2 * px);
    ctx.fillRect(cx, by, 3 * px, 2 * px);
    ctx.fillStyle = "#ffd27a";
    ctx.fillRect(cx - px, by, 2 * px, 2 * px);
  }

  if (variant === "sunny") {
    ctx.fillStyle = "#fff4c2";
    ctx.fillRect(ox + 13 * px, oy + 2 * px, px, px);
    ctx.fillRect(ox + 13 * px, oy + 4 * px, px, px);
    ctx.fillRect(ox + 12 * px, oy + 3 * px, px, px);
    ctx.fillRect(ox + 14 * px, oy + 3 * px, px, px);
  }
}


