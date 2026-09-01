import React from 'react';
import { FiCheck } from 'react-icons/fi';
import { useTheme } from '../context/ThemeContext';

// Little editor-window swatch that previews a theme's core colors.
function Swatch({ colors }) {
  const rgb = (tok) => `rgb(${colors[tok]})`;
  return (
    <div
      className="rounded-lg overflow-hidden border w-full"
      style={{ borderColor: 'rgb(255 255 255 / 0.08)', background: rgb('cs-dark') }}
    >
      <div
        className="flex items-center gap-1 px-2 py-1.5"
        style={{ background: rgb('cs-darker') }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: rgb('cs-red') }} />
        <span className="w-2 h-2 rounded-full" style={{ background: rgb('cs-orange') }} />
        <span className="w-2 h-2 rounded-full" style={{ background: rgb('cs-green') }} />
      </div>
      <div className="px-3 py-2.5 font-mono text-[11px] leading-5" style={{ background: rgb('cs-darkest') }}>
        <div>
          <span style={{ color: rgb('cs-violet') }}>def </span>
          <span style={{ color: rgb('cs-blue') }}>run</span>
          <span style={{ color: rgb('cs-text-dim') }}>():</span>
        </div>
        <div>
          <span style={{ color: rgb('cs-text-dim') }}>{'  '}x </span>
          <span style={{ color: rgb('cs-cyan') }}>= </span>
          <span style={{ color: rgb('cs-orange') }}>42</span>
        </div>
        <div>
          <span style={{ color: rgb('cs-text-dim') }}>{'  '}return </span>
          <span style={{ color: rgb('cs-green') }}>"ok"</span>
        </div>
      </div>
      <div className="flex" style={{ background: rgb('cs-darkest') }}>
        {['cs-primary', 'cs-mint', 'cs-cyan', 'cs-blue', 'cs-violet', 'cs-green', 'cs-orange', 'cs-red'].map((tok) => (
          <span key={tok} className="h-1.5 flex-1" style={{ background: rgb(tok) }} />
        ))}
      </div>
    </div>
  );
}

function ThemePicker() {
  const { theme, setTheme, themes, themeKeys } = useTheme();

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-bold">Editor Theme</h2>
        <span className="font-mono text-xs text-cs-text-muted">
          {themes[theme]?.label} · saved to this browser
        </span>
      </div>

      {['dark', 'light'].map((mode) => (
        <div key={mode} className="mb-6 last:mb-0">
          <p className="mono-label text-cs-text-muted mb-3"> {mode} themes</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {themeKeys
              .filter((key) => themes[key].mode === mode)
              .map((key) => {
                const active = key === theme;
                return (
                  <button
                    key={key}
                    onClick={() => setTheme(key)}
                    className={`text-left rounded-xl border p-3 transition-all ${
                      active
                        ? 'border-cs-primary bg-cs-primary bg-opacity-10'
                        : 'border-cs-line border-opacity-10 hover:border-cs-primary hover:border-opacity-50'
                    }`}
                  >
                    <Swatch colors={themes[key].colors} />
                    <div className="flex items-center justify-between mt-3">
                      <div>
                        <p className="font-semibold text-sm">{themes[key].label}</p>
                        <p className="text-xs text-cs-text-muted">{themes[key].hint}</p>
                      </div>
                      {active && (
                        <span className="w-6 h-6 rounded-full bg-cs-primary text-cs-dark flex items-center justify-center shrink-0">
                          <FiCheck className="text-sm" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ThemePicker;
