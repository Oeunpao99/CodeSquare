import React, { useEffect, useRef, useState } from 'react';
import { FiPause, FiPlay, FiRotateCw } from 'react-icons/fi';
import { messageService } from '../services/api';

const BAR_COUNT = 36;
const QUIET = Array(BAR_COUNT).fill(0);
const AudioContextClass = () => window.AudioContext || window.webkitAudioContext;

function formatDuration(seconds) {
  const whole = Math.floor(seconds);
  return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
}

function Waveform({ levels, progress = 0 }) {
  return <div aria-hidden="true" className="flex h-8 min-w-0 flex-1 items-center gap-[2px] overflow-hidden">
    {levels.map((level, index) => <span key={index}
      style={{ height: (3 + level * 27) + 'px' }}
      className={'min-w-0 flex-1 rounded-full ' +
        ((index + 0.5) / levels.length <= progress ? 'bg-cs-primary' : 'bg-cs-text-muted/45')} />)}
  </div>;
}

async function decodeWaveform(blob) {
  const Context = AudioContextClass();
  if (!Context) return null;
  const context = new Context();
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    const channels = Array.from({ length: audio.numberOfChannels }, (_, index) => audio.getChannelData(index));
    const peaks = QUIET.map((_, index) => {
      const start = Math.floor(index * audio.length / BAR_COUNT);
      const end = Math.floor((index + 1) * audio.length / BAR_COUNT);
      const step = Math.max(1, Math.floor((end - start) / 256));
      let peak = 0;
      for (const samples of channels) {
        for (let offset = start; offset < end; offset += step) {
          peak = Math.max(peak, Math.abs(samples[offset]));
        }
      }
      return peak;
    });
    const scale = Math.max(0.15, ...peaks);
    return { duration: audio.duration, levels: peaks.map((peak) => Math.sqrt(peak / scale)) };
  } finally {
    await context.close();
  }
}

export function VoicePlayer({ messageId, file }) {
  const player = useRef(null);
  const playOnLoad = useRef(false);
  const [requested, setRequested] = useState(false);
  const [status, setStatus] = useState(file ? 'loading' : 'idle');
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [levels, setLevels] = useState(QUIET);

  useEffect(() => {
    if (!file && !requested) return;
    const controller = new AbortController();
    const audio = player.current;
    let url;
    async function prepare() {
      try {
        const blob = file || (await messageService.media(messageId, controller.signal)).data;
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        audio.src = url;
        setStatus('ready');
        if (playOnLoad.current) {
          playOnLoad.current = false;
          audio.play().catch(() => {});
        }
        const waveform = await decodeWaveform(blob).catch(() => null);
        if (waveform && !controller.signal.aborted) {
          setLevels(waveform.levels);
          setDuration(waveform.duration);
        }
      } catch {
        if (!controller.signal.aborted) {
          setStatus('error');
          setRequested(false);
        }
      }
    }
    prepare();
    return () => {
      controller.abort();
      if (url) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        URL.revokeObjectURL(url);
      }
    };
  }, [file, messageId, requested]);

  function togglePlay() {
    if (status === 'ready') {
      const audio = player.current;
      if (audio.paused) {
        if (audio.ended) audio.currentTime = 0;
        audio.play().catch((error) => {
          if (error.name === 'NotSupportedError') setStatus('unsupported');
        });
      } else {
        audio.pause();
      }
      return;
    }
    playOnLoad.current = true;
    setStatus('loading');
    setRequested(true);
  }

  const buttonLabel = status === 'error' ? 'Retry loading voice clip' : playing ? 'Pause voice clip' : 'Play voice clip';
  const progress = duration ? Math.min(1, position / duration) : 0;
  return <div className="flex w-[17rem] max-w-full min-w-0 items-center gap-2.5 py-0.5">
    <audio ref={player} preload="metadata" onDurationChange={(event) => {
      const next = event.currentTarget.duration;
      if (Number.isFinite(next) && next > 0) setDuration(next);
    }} onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
      onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
      onError={() => { if (player.current?.getAttribute('src')) setStatus('unsupported'); }} />
    <button type="button" onClick={togglePlay} disabled={status === 'loading' || status === 'unsupported'}
      aria-label={buttonLabel} title={buttonLabel}
      className="grid size-10 shrink-0 place-items-center rounded-full bg-cs-primary text-cs-btn-text transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cs-primary disabled:opacity-50">
      {status === 'loading' ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />
        : status === 'error' ? <FiRotateCw /> : playing ? <FiPause /> : <FiPlay className="ml-0.5" />}
    </button>
    <div className="min-w-0 flex-1">
      <div className="relative flex rounded focus-within:ring-1 focus-within:ring-cs-primary">
        <Waveform levels={levels} progress={progress} />
        {duration > 0 && status === 'ready' && <input type="range" min={0} max={duration} step="any"
          value={Math.min(position, duration)} aria-label="Voice clip position" aria-valuetext={formatDuration(position)}
          onChange={(event) => {
            const next = Number(event.target.value);
            player.current.currentTime = next;
            setPosition(next);
          }}
          className="absolute inset-0 size-full cursor-pointer opacity-0" />}
      </div>
      <p className="text-xs tabular-nums text-cs-text-dim">
        {status === 'loading' ? 'Loading voice…' : status === 'error' ? 'Could not load voice clip.'
          : status === 'unsupported' ? 'This browser cannot play this clip.'
            : duration > 0 ? formatDuration(playing || position > 0 ? position : duration) : 'Voice clip'}
      </p>
    </div>
  </div>;
}

export function RecordingStatus({ holding, cancelArmed }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    const clock = setInterval(() => setElapsed((performance.now() - startedAt) / 1000), 100);
    return () => clearInterval(clock);
  }, []);

  return <div role="group" aria-label="Recording voice clip" className="flex min-w-0 flex-1 items-center gap-3 px-2">
    <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-cs-red motion-safe:animate-pulse" />
    <span className="w-12 shrink-0 text-sm font-medium tabular-nums">
      {formatDuration(elapsed)}.{Math.floor(elapsed * 10) % 10}
    </span>
    <span className={'flex-1 text-center text-xs sm:text-sm ' + (cancelArmed ? 'font-medium text-cs-red' : 'text-cs-text-dim')}>
      {cancelArmed ? 'Release to cancel' : holding ? 'Release outside the composer to cancel' : 'Press Enter to finish or Esc to cancel'}
    </span>
  </div>;
}
