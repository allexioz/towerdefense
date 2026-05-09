import { Howl, Howler } from "howler";

type SoundKey = "click" | "place" | "slide" | "attack" | "dialogue" | "alert" | "impact";

const sounds: Record<SoundKey, Howl> = {
  click: new Howl({ src: ["/audio/ui-soft-click.mp3"], volume: 0.28, preload: true }),
  place: new Howl({ src: ["/audio/ui-clean-click.wav"], volume: 0.34, preload: true }),
  slide: new Howl({ src: ["/audio/ui-slide.mp3"], volume: 0.2, preload: true }),
  attack: new Howl({ src: ["/audio/attack-ping.mp3"], volume: 0.18, preload: true }),
  dialogue: new Howl({ src: ["/audio/dialogue-pop.mp3"], volume: 0.22, preload: true }),
  alert: new Howl({ src: ["/audio/soft-alert.mp3"], volume: 0.36, preload: true }),
  impact: new Howl({ src: ["/audio/impact-thud.mp3"], volume: 0.26, preload: true })
};

const lastPlayedAt = new Map<SoundKey, number>();
const throttleMs: Partial<Record<SoundKey, number>> = {
  attack: 90,
  dialogue: 180,
  slide: 140,
  impact: 180
};

let enabled = window.localStorage.getItem("sky-defense-audio") !== "muted";
Howler.mute(!enabled);

function play(key: SoundKey, rate = 1) {
  if (!enabled) {
    return;
  }

  const now = performance.now();
  const minDelay = throttleMs[key] ?? 0;
  const last = lastPlayedAt.get(key) ?? 0;
  if (now - last < minDelay) {
    return;
  }

  lastPlayedAt.set(key, now);
  const sound = sounds[key];
  sound.rate(rate);
  sound.play();
}

export const gameAudio = {
  isEnabled() {
    return enabled;
  },
  setEnabled(nextEnabled: boolean) {
    enabled = nextEnabled;
    window.localStorage.setItem("sky-defense-audio", nextEnabled ? "enabled" : "muted");
    Howler.mute(!nextEnabled);
  },
  toggle() {
    this.setEnabled(!enabled);
    play("click");
    return enabled;
  },
  click() {
    play("click", 0.96 + Math.random() * 0.08);
  },
  place() {
    play("place", 0.96 + Math.random() * 0.1);
  },
  slide() {
    play("slide");
  },
  attack() {
    play("attack", 0.92 + Math.random() * 0.22);
  },
  dialogue() {
    play("dialogue", 0.96 + Math.random() * 0.08);
  },
  alert() {
    play("alert");
  },
  impact() {
    play("impact", 0.92 + Math.random() * 0.12);
  }
};
