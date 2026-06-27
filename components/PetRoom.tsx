"use client";

import { useEffect, useRef } from "react";
import { drawPetSprite, Species, Stage, Variant } from "@/lib/sprites";

export type Tool = "hand" | "ball" | "food" | "soap";

interface Props {
  species: Species;
  stage: Stage;
  variant: Variant;
  asleep: boolean;
  tool: Tool;
  onPet: () => void;
  onCatch: () => void;
  onEat: () => void;
  onTryFood: () => boolean; // returns true if coins were spent & bowl allowed
  onClean: () => void;
}

// Floor bounds the pet can roam within will be calculated dynamically.
const STAGE_PX: Record<Stage, number> = { baby: 4, teen: 5, adult: 6 };
const SPEED = 74; // px per second

type AI = "idle" | "walk" | "chase" | "goEat" | "eat" | "sleep" | "bath";

interface World {
  x: number;
  y: number;
  face: number; // -1 left, 1 right
  ai: AI;
  aiT: number; // time in current state
  animT: number; // walk anim phase
  time: number;
  tx: number; // current move target
  ty: number;
  idleUntil: number;
  lastPet: number;
  ball: { x: number; y: number; spawn: number } | null;
  food: { x: number; y: number } | null;
  callMark: { x: number; y: number; t: number } | null;
  emotes: { x: number; y: number; t: number; txt: string }[];
}

function rand(min: number, max: number) {
  // Date-free pseudo randomness seeded by world time; good enough for wander.
  return min + (max - min) * Math.abs(Math.sin((min + max) * 999.13 + max));
}

export default function PetRoom(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const worldRef = useRef<World>({
    x: 240,
    y: 200,
    face: 1,
    ai: "idle",
    aiT: 0,
    animT: 0,
    time: 0,
    tx: 480 / 2,
    ty: 200,
    idleUntil: 1.2,
    lastPet: -1,
    ball: null,
    food: null,
    callMark: null,
    emotes: [],
  });

  // ---- input ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toWorld = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((clientX - r.left) / r.width) * 480,
        y: ((clientY - r.top) / r.height) * 320,
      };
    };

    const handle = (clientX: number, clientY: number) => {
      const w = worldRef.current;
      const p = propsRef.current;
      const { x, y } = toWorld(clientX, clientY);

      // Hit test the pet sprite box first → elus.
      const px = STAGE_PX[p.stage];
      const half = (16 * px) / 2;
      if (
        x > w.x - half &&
        x < w.x + half &&
        y > w.y - 16 * px - 8 &&
        y < w.y + 6
      ) {
        if (p.asleep) return;
        
        if (p.tool === "soap") {
          if (w.time - w.lastPet > 0.4) {
            w.lastPet = w.time;
            w.ai = "bath";
            w.aiT = 0;
            p.onClean();
          }
        } else {
          if (w.time - w.lastPet > 0.4) {
            w.lastPet = w.time;
            w.emotes.push({ x: w.x, y: w.y - 16 * px, t: 0, txt: "❤️" });
            p.onPet();
          }
        }
        return;
      }

      if (p.asleep) return;

      const FLOOR = { left: 30, right: 480 - 30, top: 104, bottom: 320 - 28 };
      
      // Clamp to floor.
      const fx = Math.max(FLOOR.left, Math.min(FLOOR.right, x));
      const fy = Math.max(FLOOR.top, Math.min(FLOOR.bottom, y));

      if (p.tool === "ball") {
        w.ball = { x: fx, y: fy, spawn: w.time };
      } else if (p.tool === "food") {
        if (p.onTryFood()) {
          w.food = { x: fx, y: fy };
        }
      } else if (p.tool === "soap") {
        w.emotes.push({ x: fx, y: fy, t: 0, txt: "❓" });
      } else {
        // hand → call pet to walk here
        w.tx = fx;
        w.ty = fy;
        w.ai = "walk";
        w.aiT = 0;
        w.callMark = { x: fx, y: fy, t: 0 };
        w.emotes.push({ x: w.x, y: w.y - 16 * STAGE_PX[p.stage], t: 0, txt: "❗" });
      }
    };

    const onClick = (e: MouseEvent) => handle(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      e.preventDefault();
      handle(e.touches[0].clientX, e.touches[0].clientY);
    };
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("touchstart", onTouch, { passive: false });
    return () => {
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("touchstart", onTouch);
    };
  }, []);

  // ---- game loop ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    let raf = 0;
    let last = 0;

    const step = (ts: number) => {
      if (!last) last = ts;
      let dt = (ts - last) / 1000;
      last = ts;
      if (dt > 0.05) dt = 0.05; // clamp after tab switch
      
      canvas.width = 480;
      canvas.height = 320;
      
      update(dt);
      render(ctx);
      raf = requestAnimationFrame(step);
    };

    const moveToward = (w: World, tx: number, ty: number, dt: number) => {
      const dx = tx - w.x;
      const dy = ty - w.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) return true;
      const stepLen = Math.min(d, SPEED * dt);
      w.x += (dx / d) * stepLen;
      w.y += (dy / d) * stepLen;
      if (Math.abs(dx) > 0.5) w.face = dx < 0 ? -1 : 1;
      w.animT += dt * 2.4;
      return false;
    };

    const update = (dt: number) => {
      const w = worldRef.current;
      const p = propsRef.current;
      w.time += dt;
      w.aiT += dt;

      // emotes & marks
      w.emotes = w.emotes.filter((e) => {
        e.t += dt;
        return e.t < 1;
      });
      if (w.callMark) {
        w.callMark.t += dt;
        if (w.callMark.t > 0.8) w.callMark = null;
      }

      // keep pet within dynamic bounds
      const FLOOR = { left: 30, right: 480 - 30, top: 104, bottom: 320 - 28 };
      w.x = Math.max(FLOOR.left, Math.min(FLOOR.right, w.x));
      w.y = Math.max(FLOOR.top, Math.min(FLOOR.bottom, w.y));

      if (p.asleep) {
        w.ai = "sleep";
        return;
      }
      if (w.ai === "sleep") w.ai = "idle";
      
      if (w.ai === "bath") {
        if (Math.floor(w.aiT / 0.15) > Math.floor((w.aiT - dt) / 0.15)) {
          w.emotes.push({ 
            x: w.x + rand(-20, 20), 
            y: w.y - rand(5, 16 * STAGE_PX[p.stage]), 
            t: 0, 
            txt: "🫧" 
          });
        }
        if (w.aiT > 1.5) {
          w.ai = "idle";
          w.idleUntil = w.time + 0.5;
        }
        return;
      }

      // Priorities: ball > food > called-walk > wander
      if (w.ball) {
        w.ai = "chase";
        const reached = moveToward(w, w.ball.x, w.ball.y, dt);
        if (reached) {
          w.emotes.push({ x: w.x, y: w.y - 60, t: 0, txt: "❤️" });
          w.ball = null;
          w.ai = "idle";
          w.idleUntil = w.time + 0.6;
          p.onCatch();
        }
        return;
      }

      if (w.food) {
        if (w.ai !== "eat") w.ai = "goEat";
        if (w.ai === "goEat") {
          const reached = moveToward(w, w.food.x, w.food.y - 4, dt);
          if (reached) {
            w.ai = "eat";
            w.aiT = 0;
          }
        } else if (w.ai === "eat") {
          if (w.time % 0.25 < dt)
            w.emotes.push({ x: w.x + 6, y: w.y - 30, t: 0, txt: "✨" });
          if (w.aiT > 1.3) {
            w.food = null;
            w.ai = "idle";
            w.idleUntil = w.time + 0.5;
            p.onEat();
          }
        }
        return;
      }

      if (w.ai === "walk") {
        const reached = moveToward(w, w.tx, w.ty, dt);
        if (reached) {
          w.ai = "idle";
          w.idleUntil = w.time + rand(1, 3);
        }
        return;
      }

      // idle / wander
      w.ai = "idle";
      if (w.time > w.idleUntil) {
        const FLOOR = { left: 30, right: 480 - 30, top: 104, bottom: 320 - 28 };
        // pick a new wander target
        const seed = w.time;
        const nx =
          FLOOR.left +
          Math.abs(Math.sin(seed * 12.9)) * (FLOOR.right - FLOOR.left);
        const ny =
          FLOOR.top +
          Math.abs(Math.cos(seed * 7.7)) * (FLOOR.bottom - FLOOR.top);
        w.tx = nx;
        w.ty = ny;
        w.ai = "walk";
        w.aiT = 0;
      }
    };

    const render = (ctx: CanvasRenderingContext2D) => {
      const w = worldRef.current;
      const p = propsRef.current;
      
      ctx.imageSmoothingEnabled = false;
      
      const W = 480;
      const H = 320;
      const FLOOR = { left: 30, right: W - 30, top: 104, bottom: H - 28 };

      // ---- room ----
      const wallH = FLOOR.top - 10;
      // back wall (subtle vertical gradient via two bands)
      ctx.fillStyle = "#4a3a66";
      ctx.fillRect(0, 0, W, wallH);
      ctx.fillStyle = "#574378";
      ctx.fillRect(0, 0, W, 28);
      // floor
      ctx.fillStyle = "#8a6b45";
      ctx.fillRect(0, wallH, W, H - wallH);
      // floor tiles (diamond-ish checker)
      ctx.fillStyle = "#7d6040";
      for (let ty = wallH; ty < H; ty += 22) {
        for (let tx = 0; tx < W; tx += 44) {
          ctx.fillRect(tx + ((((ty - wallH) / 22) % 2) ? 22 : 0), ty, 22, 11);
        }
      }
      // skirting board
      ctx.fillStyle = "#3a2c54";
      ctx.fillRect(0, wallH - 6, W, 6);
      ctx.fillStyle = "#2a2040";
      ctx.fillRect(0, wallH, W, 3);

      // rug (center floor)
      const rugX = W / 2 - 130;
      const rugY = FLOOR.top + 26;
      ctx.fillStyle = "#c25b7a";
      ctx.fillRect(rugX, rugY, 260, 110);
      ctx.fillStyle = "#e07fa0";
      ctx.fillRect(rugX + 12, rugY + 10, 236, 90);
      ctx.fillStyle = "#f2a8c0";
      ctx.fillRect(rugX + 26, rugY + 22, 208, 66);

      // window on wall (left)
      ctx.fillStyle = "#2a2240";
      ctx.fillRect(46, 18, 96, 62);
      ctx.fillStyle = "#7fd0ff";
      ctx.fillRect(51, 23, 86, 52);
      ctx.fillStyle = "#bdeaff";
      ctx.fillRect(51, 23, 40, 52);
      // clouds in window
      ctx.fillStyle = "#eaf7ff";
      ctx.fillRect(100, 34, 22, 7);
      ctx.fillRect(60, 56, 26, 7);
      // window frame cross
      ctx.fillStyle = "#2a2240";
      ctx.fillRect(92, 23, 4, 52);
      ctx.fillRect(51, 47, 86, 4);

      // framed picture (center wall)
      ctx.fillStyle = "#caa15a";
      ctx.fillRect(W / 2 - 26, 22, 52, 40);
      ctx.fillStyle = "#33506b";
      ctx.fillRect(W / 2 - 21, 27, 42, 30);
      ctx.fillStyle = "#7bd88f"; // tiny hill
      ctx.fillRect(W / 2 - 21, 44, 42, 13);
      ctx.fillStyle = "#ffe08a"; // sun
      ctx.fillRect(W / 2 + 8, 31, 7, 7);

      // wall shelf (right) with books
      ctx.fillStyle = "#6b4a2a";
      ctx.fillRect(W - 130, 60, 80, 6);
      const bookCols = ["#e07f5a", "#5a8fe0", "#7bd88f", "#e0d05a", "#c25b9a"];
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = bookCols[i];
        ctx.fillRect(W - 124 + i * 12, 44, 9, 16);
      }

      // potted plant (right corner)
      ctx.fillStyle = "#6b4a2a";
      ctx.fillRect(W - 46, 70, 26, 22);
      ctx.fillStyle = "#5ec27a";
      ctx.fillRect(W - 44, 46, 8, 26);
      ctx.fillRect(W - 34, 38, 8, 34);
      ctx.fillRect(W - 24, 48, 8, 24);

      // pet bed (bottom-left floor)
      ctx.fillStyle = "#4a3870";
      ctx.fillRect(24, H - 56, 78, 42);
      ctx.fillStyle = "#6a54a0";
      ctx.fillRect(31, H - 49, 64, 28);
      ctx.fillStyle = "#8470c0";
      ctx.fillRect(38, H - 44, 50, 18);

      // toy box (bottom-right floor)
      ctx.fillStyle = "#7a4a2a";
      ctx.fillRect(W - 92, H - 50, 64, 36);
      ctx.fillStyle = "#9a6238";
      ctx.fillRect(W - 88, H - 46, 56, 12);
      ctx.fillStyle = "#e0d05a";
      ctx.fillRect(W - 84, H - 30, 12, 12);
      ctx.fillStyle = "#5a8fe0";
      ctx.fillRect(W - 68, H - 28, 10, 10);
      ctx.fillStyle = "#e07f5a";
      ctx.fillRect(W - 52, H - 30, 12, 12);

      // ---- call marker ----
      if (w.callMark) {
        const a = 1 - w.callMark.t / 0.8;
        ctx.strokeStyle = `rgba(255,210,122,${a})`;
        ctx.lineWidth = 2;
        const rr = 4 + w.callMark.t * 14;
        ctx.beginPath();
        ctx.arc(w.callMark.x, w.callMark.y, rr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ---- food bowl ----
      if (w.food) {
        const { x, y } = w.food;
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.ellipse(x, y + 3, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#cfd6dd";
        ctx.fillRect(x - 11, y - 4, 22, 8);
        ctx.fillStyle = "#9aa4ad";
        ctx.fillRect(x - 11, y + 2, 22, 3);
        ctx.fillStyle = "#c2702f";
        ctx.fillRect(x - 8, y - 6, 16, 4);
      }

      // ---- ball ----
      if (w.ball) {
        const { x, y } = w.ball;
        const hop = Math.abs(Math.sin((w.time - w.ball.spawn) * 8)) * 6;
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.ellipse(x, y + 4, 7, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff5a5a";
        ctx.beginPath();
        ctx.arc(x, y - hop, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillRect(x - 3, y - hop - 3, 2, 2);
      }

      // ---- pet ----
      const px = STAGE_PX[p.stage];
      const spriteH = 16 * px;
      const moving = w.ai === "walk" || w.ai === "chase" || w.ai === "goEat";
      let hop = 0;
      if (p.asleep) hop = 0;
      else if (moving) hop = Math.abs(Math.sin(w.animT * Math.PI)) * 6;
      else hop = Math.sin(w.time * 2) * 1.2; // breathing

      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(w.x, w.y, 8 * px * 0.5, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      drawPetSprite(
        ctx,
        w.x - (16 * px) / 2,
        w.y - spriteH - hop,
        px,
        { species: p.species, stage: p.stage, variant: p.variant },
        { flip: w.face < 0 },
      );

      // sleep Zzz
      if (p.asleep) {
        ctx.fillStyle = "#dcd0ff";
        ctx.font = "10px 'Press Start 2P', monospace";
        const zb = Math.sin(w.time * 3) * 2;
        ctx.fillText("z", w.x + 14, w.y - spriteH + 4 + zb);
        ctx.fillText("Z", w.x + 22, w.y - spriteH - 8 - zb);
      }

      // ---- emotes ----
      for (const e of w.emotes) {
        const a = 1 - e.t;
        ctx.globalAlpha = Math.max(0, a);
        ctx.font = "14px 'Press Start 2P', monospace";
        ctx.fillText(e.txt, e.x - 6, e.y - e.t * 22);
      }
      ctx.globalAlpha = 1;
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="room" />;
}
