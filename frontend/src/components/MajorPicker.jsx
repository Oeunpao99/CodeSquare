import React from 'react';
import { FiCheck, FiArrowRight } from 'react-icons/fi';
import { useMajor } from '../context/MajorContext';
import MajorIcon from './MajorIcon';

// Used both as first-run onboarding (onboarding) and as a "change major"
// panel on the Profile page.
function MajorPicker({ onboarding = false, onPicked }) {
  const { major, setMajor, majors, majorKeys } = useMajor();

  const choose = (key) => {
    setMajor(key);
    onPicked?.(key);
  };

  return (
    <div>
      {onboarding ? (
        <div className="mb-8">
          <span className="mono-label"> choose your path</span>
          <h1 className="text-3xl md:text-4xl font-extrabold mt-3 mb-3">
            What do you want to become?
          </h1>
          <p className="text-cs-text-dim max-w-2xl">
            Pick the field you're aiming for. Your lessons get ordered around it and every
            project the AI generates is scoped to that career path. You can change this
            anytime from your profile.
          </p>
        </div>
      ) : (
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg font-bold">Your Major</h2>
          <span className="font-mono text-xs text-cs-text-muted">
            {major ? majors[major].label : 'not set'}
          </span>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {majorKeys.map((key) => {
          const m = majors[key];
          const active = key === major;
          return (
            <button
              key={key}
              onClick={() => choose(key)}
              className={`text-left rounded-2xl border p-5 transition-all ${
                active
                  ? 'border-cs-primary bg-cs-primary bg-opacity-10'
                  : 'border-cs-line border-opacity-10 hover:border-cs-primary hover:border-opacity-50 hover:-translate-y-0.5'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl"
                  style={{ background: `${m.color}1f`, color: m.color }}
                >
                  <MajorIcon major={key} />
                </span>
                {active && (
                  <span className="w-6 h-6 rounded-full bg-cs-primary text-cs-dark flex items-center justify-center">
                    <FiCheck className="text-sm" />
                  </span>
                )}
              </div>
              <h3 className="font-bold text-base">{m.label}</h3>
              <p className="text-xs font-mono text-cs-text-muted mb-2">{m.tagline}</p>
              <p className="text-sm text-cs-text-dim leading-relaxed mb-4">{m.blurb}</p>
              <div className="flex flex-wrap gap-1.5">
                {m.focus.slice(0, 4).map((f) => (
                  <span
                    key={f}
                    className="text-[11px] font-mono px-2 py-0.5 rounded border border-cs-line/10 text-cs-text-muted"
                  >
                    {f}
                  </span>
                ))}
              </div>
              {onboarding && (
                <span className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-cs-primary">
                  Start this path <FiArrowRight />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MajorPicker;
