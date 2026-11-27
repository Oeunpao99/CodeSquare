// Short UI sounds (public/sounds/*.mp3): send, receive, notify.
// Off switch is remembered in localStorage ('cs-sounds' = 'off').
// Browsers only allow audio after the person has interacted with the page,
// so a blocked play() is ignored quietly.

const FILES = { send: '/sounds/send.mp3', receive: '/sounds/receive.mp3', notify: '/sounds/notify.mp3' };
const KEY = 'cs-sounds';
const cache = {};
const lastPlayed = {};

export const soundsEnabled = () => {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
};

export const setSoundsEnabled = (on) => {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
};

export function playSound(name, volume = 0.6) {
  if (!FILES[name] || !soundsEnabled()) return;
  const now = Date.now();
  if (now - (lastPlayed[name] || 0) < 700) return; // no machine-gun repeats
  lastPlayed[name] = now;
  try {
    cache[name] ||= new Audio(FILES[name]);
    const a = cache[name];
    a.volume = volume;
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch { /* no audio support */ }
}
