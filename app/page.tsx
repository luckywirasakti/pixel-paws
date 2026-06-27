"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PetState,
  Stats,
  SPECIES_INFO,
  newPet,
  tick,
  elus,
  fetchBall,
  eatMeal,
  payForFood,
  clean,
  toggleSleep,
  stageOf,
  variantOf,
  ageLabel,
  load,
  save,
  wipe,
} from "@/lib/game";
import { Species, Stage, Variant } from "@/lib/sprites";
import PetRoom, { Tool } from "@/components/PetRoom";

const STAT_META: {
  key: keyof Stats;
  label: string;
  color: string;
  icon: string;
}[] = [
  { key: "hunger", label: "Kenyang", color: "#ff9f4a", icon: "🍖" },
  { key: "energy", label: "Energi", color: "#6ac3ff", icon: "⚡" },
  { key: "happiness", label: "Senang", color: "#ff8fb3", icon: "😊" },
  { key: "cleanliness", label: "Bersih", color: "#7bd88f", icon: "🛁" },
  { key: "health", label: "Sehat", color: "#ff6b6b", icon: "❤️" },
];

const STAGE_LABEL: Record<Stage, string> = {
  baby: "Bayi",
  teen: "Remaja",
  adult: "Dewasa",
};

const VARIANT_LABEL: Record<Variant, string> = {
  sunny: "Ceria ☀️",
  normal: "Biasa",
  grumpy: "Murung 🌧️",
};

const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: "hand", icon: "👋", label: "Panggil" },
  { id: "ball", icon: "🎾", label: "Bola" },
  { id: "food", icon: "🍖", label: "Makan" },
  { id: "soap", icon: "🧼", label: "Mandi" },
];

function Onboarding({ onStart }: { onStart: (pet: PetState) => void }) {
  const [species, setSpecies] = useState<Species | null>(null);
  const [name, setName] = useState("");

  return (
    <div className="app">
      <h1 className="title">PIXELPAWS</h1>
      <p className="subtitle">
        Pilih sahabat pixel-mu.<br />Rawat baik-baik, mereka tumbuh sesuai cara
        kamu merawat ✨
      </p>

      <div className="panel">
        <div className="picker">
          {(Object.keys(SPECIES_INFO) as Species[]).map((sp) => (
            <div
              key={sp}
              className={`pick${species === sp ? " selected" : ""}`}
              onClick={() => setSpecies(sp)}
            >
              <span className="face">{SPECIES_INFO[sp].emoji}</span>
              {SPECIES_INFO[sp].label}
              <div className="blurb">{SPECIES_INFO[sp].blurb}</div>
            </div>
          ))}
        </div>

        <input
          className="namefield"
          placeholder="Kasih nama..."
          maxLength={12}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <button
          className="btn wide"
          disabled={!species}
          onClick={() => {
            if (!species) return;
            onStart(newPet(name, species, Date.now()));
          }}
        >
          {species ? `Adopsi ${SPECIES_INFO[species].label}! 🐾` : "Pilih dulu yuk"}
        </button>
      </div>

      <p className="foot">
        Berjalan real-time — hewanmu tetap hidup walau tab ditutup.
        <br />Disimpan otomatis di browser ini.
      </p>
    </div>
  );
}

export default function Home() {
  const [pet, setPet] = useState<PetState | null>(null);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("Klik hewanmu buat ngelus 🐾");
  const [now, setNow] = useState(0);
  const [tool, setTool] = useState<Tool>("hand");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = load();
    if (saved) {
      const n = Date.now();
      setPet(tick(saved, n));
      setNow(n);
    } else {
      setNow(Date.now());
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!pet) return;
    const id = setInterval(() => {
      const n = Date.now();
      setPet((prev) => (prev ? tick(prev, n) : prev));
      setNow(n);
    }, 1000);
    return () => clearInterval(id);
  }, [pet?.bornAt]);

  useEffect(() => {
    if (pet) save(pet);
  }, [pet]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }, []);

  const act = useCallback(
    (fn: (p: PetState) => { pet: PetState; msg: string }) => {
      setPet((prev) => {
        if (!prev) return prev;
        const { pet: next, msg } = fn(prev);
        setTimeout(() => flash(msg), 0);
        return next;
      });
    },
    [flash],
  );

  // Charge for food synchronously and report whether allowed.
  const tryFood = useCallback((): boolean => {
    if (!pet) return false;
    const testPaid = payForFood(pet);
    if (!testPaid) {
      flash("Koin kurang buat beli makan! 🪙");
      return false;
    }
    
    setPet((prev) => {
      if (!prev) return prev;
      const paid = payForFood(prev);
      if (!paid) {
        setTimeout(() => flash("Koin kurang buat beli makan! 🪙"), 0);
        return prev;
      }
      setTimeout(() => flash("Mangkok makan ditaruh 🍖 (-3🪙)"), 0);
      return paid;
    });
    return true;
  }, [pet, flash]);

  if (!ready) return null;

  if (!pet) {
    return (
      <Onboarding
        onStart={(p) => {
          setPet(p);
          setNow(Date.now());
          flash(`${p.name} sekarang jadi sahabatmu! 🎉`);
        }}
      />
    );
  }

  const stage = stageOf(pet, now);
  const variant = variantOf(pet);
  const info = SPECIES_INFO[pet.species];

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="app">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <h1 className="title">PIXELPAWS</h1>
        <button 
          onClick={toggleFullscreen} 
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "24px", color: "var(--accent)" }}
          title="Fullscreen"
        >
          🔲
        </button>
      </div>

      <div className="layout">
        <div className="col col-left">
          <div className="panel roomwrap">
            <PetRoom
              species={pet.species}
              stage={stage}
              variant={variant}
              asleep={pet.asleep}
              tool={tool}
              onPet={() => act(elus)}
              onCatch={() => act(fetchBall)}
              onEat={() => act(eatMeal)}
              onTryFood={tryFood}
              onClean={() => act(clean)}
            />
            <div className="badges">
              <span className="badge">{info.emoji} {info.label}</span>
              <span className="badge">🎂 {ageLabel(pet, now)}</span>
              <span className={`badge ${variant}`}>{VARIANT_LABEL[variant]}</span>
            </div>
          </div>
        </div>

        <div className="col col-right">
          <div className="panel">
            <div className="topbar">
              <span>{pet.name} · {STAGE_LABEL[stage]}</span>
              <span className="coins">🪙 {pet.coins}</span>
            </div>
          </div>

          <div className="toast">{toast}</div>

          {/* tool selector — what a click on the floor does */}
          <div className="tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`tool${tool === t.id ? " active" : ""}`}
            onClick={() => setTool(t.id)}
          >
            <span className="ico">{t.icon}</span>
            {t.label}
          </button>
        ))}
        <button className="tool" onClick={() => act(toggleSleep)}>
          <span className="ico">{pet.asleep ? "🌞" : "😴"}</span>
          {pet.asleep ? "Bangun" : "Tidur"}
        </button>
      </div>

      <div className="panel">
        {STAT_META.map((m) => {
          const v = Math.round(pet.stats[m.key]);
          return (
            <div className="stat" key={m.key}>
              <div className="stat-row">
                <span>{m.icon} {m.label}</span>
                <span>{v}%</span>
              </div>
              <div className="bar">
                <span
                  style={{
                    width: `${v}%`,
                    background: v < 25 ? "#ff6b6b" : m.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="foot">
        Klik hewan = elus ❤️ · Pilih alat lalu klik lantai buat panggil / lempar
        bola / taruh makan.
        <br />Tumbuh: Bayi → Remaja (1 hari) → Dewasa (3 hari).
        <br />
        <button
          className="link"
          onClick={() => {
            if (confirm("Yakin mau lepas hewan ini & mulai dari awal?")) {
              wipe();
              setPet(null);
              flash("Mulai petualangan baru 🐾");
            }
          }}
        >
          Reset / ganti hewan
        </button>
      </p>
        </div>
      </div>
    </div>
  );
}
