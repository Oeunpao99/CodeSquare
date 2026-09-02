// IDE-style themes. Each value is an "R G B" channel triple so Tailwind's
// rgb(var(--token) / <alpha>) tokens keep working with opacity utilities.
// Token roles:
//   dark/darker/darkest ... page bg / raised surface / card+terminal body
//   primary/mint ............ brand accent + lighter variant
//   cyan/blue/violet ........ secondary accents (also drive code syntax)
//   green/orange/red ........ status + syntax (string / number / error)
//   teal/deep-teal .......... gradient end + faint borders
//   text/text-dim/text-muted  heading / body / captions
//   line ................... hair-line borders + grid  (white-ish on dark, ink on light)
//   overlay ............... subtle hover fills          (same idea)

export const THEMES = {
  /* ----------------------------- dark ----------------------------- */
  'terminal-neutral': {
    label: 'Terminal Neutral', mode: 'dark',
    hint: 'Neutral near-black, teal accent',
    colors: {
      'cs-dark': '11 11 14', 'cs-darker': '17 17 20', 'cs-darkest': '23 23 27',
      'cs-primary': '45 212 191', 'cs-mint': '94 234 212',
      'cs-cyan': '34 211 238', 'cs-blue': '59 130 246', 'cs-violet': '139 92 246',
      'cs-green': '74 222 128', 'cs-orange': '251 146 60', 'cs-red': '248 113 113',
      'cs-teal': '13 148 136', 'cs-deep-teal': '17 94 89',
      'cs-text': '228 228 231', 'cs-text-dim': '161 161 170', 'cs-text-muted': '113 113 122',
      'cs-line': '255 255 255', 'cs-overlay': '255 255 255',
      'cs-btn-text': '11 12 14',
    },
  },

  monokai: {
    label: 'Monokai', mode: 'dark',
    hint: 'Sublime classic — green & magenta',
    colors: {
      'cs-dark': '39 40 34', 'cs-darker': '33 34 28', 'cs-darkest': '30 31 26',
      'cs-primary': '166 226 46', 'cs-mint': '200 244 112',
      'cs-cyan': '102 217 239', 'cs-blue': '120 220 232', 'cs-violet': '174 129 255',
      'cs-green': '166 226 46', 'cs-orange': '253 151 31', 'cs-red': '249 38 114',
      'cs-teal': '39 174 158', 'cs-deep-teal': '61 66 46',
      'cs-text': '248 248 242', 'cs-text-dim': '201 201 192', 'cs-text-muted': '117 113 94',
      'cs-line': '255 255 255', 'cs-overlay': '255 255 255',
      'cs-btn-text': '26 27 19',
    },
  },

  dracula: {
    label: 'Dracula', mode: 'dark',
    hint: 'Purple night — pink primary',
    colors: {
      'cs-dark': '40 42 54', 'cs-darker': '33 34 44', 'cs-darkest': '30 31 41',
      'cs-primary': '255 121 198', 'cs-mint': '255 146 208',
      'cs-cyan': '139 233 253', 'cs-blue': '139 233 253', 'cs-violet': '189 147 249',
      'cs-green': '80 250 123', 'cs-orange': '255 184 108', 'cs-red': '255 85 85',
      'cs-teal': '189 147 249', 'cs-deep-teal': '68 71 90',
      'cs-text': '248 248 242', 'cs-text-dim': '201 204 224', 'cs-text-muted': '98 114 164',
      'cs-line': '255 255 255', 'cs-overlay': '255 255 255',
      'cs-btn-text': '26 24 29',
    },
  },

  'one-dark': {
    label: 'One Dark', mode: 'dark',
    hint: 'Atom — calm blue on slate',
    colors: {
      'cs-dark': '40 44 52', 'cs-darker': '33 37 43', 'cs-darkest': '30 34 39',
      'cs-primary': '97 175 239', 'cs-mint': '127 198 245',
      'cs-cyan': '86 182 194', 'cs-blue': '97 175 239', 'cs-violet': '198 120 221',
      'cs-green': '152 195 121', 'cs-orange': '229 192 123', 'cs-red': '224 108 117',
      'cs-teal': '86 182 194', 'cs-deep-teal': '62 68 81',
      'cs-text': '218 223 230', 'cs-text-dim': '171 178 191', 'cs-text-muted': '92 99 112',
      'cs-line': '255 255 255', 'cs-overlay': '255 255 255',
      'cs-btn-text': '11 15 22',
    },
  },

  'tokyo-night': {
    label: 'Tokyo Night', mode: 'dark',
    hint: 'Deep indigo, soft neon',
    colors: {
      'cs-dark': '26 27 38', 'cs-darker': '22 22 30', 'cs-darkest': '19 19 26',
      'cs-primary': '122 162 247', 'cs-mint': '154 184 248',
      'cs-cyan': '125 207 255', 'cs-blue': '122 162 247', 'cs-violet': '187 154 247',
      'cs-green': '158 206 106', 'cs-orange': '255 158 100', 'cs-red': '247 118 142',
      'cs-teal': '42 195 222', 'cs-deep-teal': '59 66 97',
      'cs-text': '192 202 245', 'cs-text-dim': '169 177 214', 'cs-text-muted': '86 95 137',
      'cs-line': '255 255 255', 'cs-overlay': '255 255 255',
      'cs-btn-text': '15 17 26',
    },
  },

  nord: {
    label: 'Nord', mode: 'dark',
    hint: 'Arctic — frost & polar night',
    colors: {
      'cs-dark': '46 52 64', 'cs-darker': '41 46 57', 'cs-darkest': '36 41 51',
      'cs-primary': '136 192 208', 'cs-mint': '143 188 187',
      'cs-cyan': '143 188 187', 'cs-blue': '129 161 193', 'cs-violet': '180 142 173',
      'cs-green': '163 190 140', 'cs-orange': '208 135 112', 'cs-red': '191 97 106',
      'cs-teal': '94 129 172', 'cs-deep-teal': '67 76 94',
      'cs-text': '236 239 244', 'cs-text-dim': '216 222 233', 'cs-text-muted': '97 110 136',
      'cs-line': '255 255 255', 'cs-overlay': '255 255 255',
      'cs-btn-text': '15 20 25',
    },
  },

  'github-dark': {
    label: 'GitHub Dark', mode: 'dark',
    hint: 'The one you already know',
    colors: {
      'cs-dark': '13 17 23', 'cs-darker': '22 27 34', 'cs-darkest': '27 33 40',
      'cs-primary': '47 129 247', 'cs-mint': '88 166 255',
      'cs-cyan': '86 212 221', 'cs-blue': '47 129 247', 'cs-violet': '188 140 255',
      'cs-green': '63 185 80', 'cs-orange': '219 109 40', 'cs-red': '248 81 73',
      'cs-teal': '57 197 207', 'cs-deep-teal': '33 38 45',
      'cs-text': '230 237 243', 'cs-text-dim': '173 186 199', 'cs-text-muted': '118 131 144',
      'cs-line': '255 255 255', 'cs-overlay': '255 255 255',
      'cs-btn-text': '255 255 255',
    },
  },

  /* ----------------------------- light ---------------------------- */
  'github-light': {
    label: 'GitHub Light', mode: 'light',
    hint: 'Clean white, GitHub blue',
    colors: {
      'cs-dark': '255 255 255', 'cs-darker': '246 248 250', 'cs-darkest': '239 242 245',
      'cs-primary': '9 105 218', 'cs-mint': '33 139 255',
      'cs-cyan': '27 124 131', 'cs-blue': '9 105 218', 'cs-violet': '130 80 223',
      'cs-green': '26 127 55', 'cs-orange': '188 76 0', 'cs-red': '207 34 46',
      'cs-teal': '9 105 218', 'cs-deep-teal': '208 215 222',
      'cs-text': '31 35 40', 'cs-text-dim': '87 96 106', 'cs-text-muted': '140 149 159',
      'cs-line': '13 17 23', 'cs-overlay': '13 17 23',
      'cs-btn-text': '255 255 255',
    },
  },

  'one-light': {
    label: 'One Light', mode: 'light',
    hint: 'Atom — soft grey paper',
    colors: {
      'cs-dark': '250 250 250', 'cs-darker': '240 240 240', 'cs-darkest': '233 233 233',
      'cs-primary': '64 120 242', 'cs-mint': '1 132 188',
      'cs-cyan': '1 132 188', 'cs-blue': '64 120 242', 'cs-violet': '166 38 164',
      'cs-green': '80 161 79', 'cs-orange': '193 132 1', 'cs-red': '228 86 73',
      'cs-teal': '64 120 242', 'cs-deep-teal': '208 208 208',
      'cs-text': '56 58 66', 'cs-text-dim': '105 108 119', 'cs-text-muted': '160 161 167',
      'cs-line': '56 58 66', 'cs-overlay': '56 58 66',
      'cs-btn-text': '255 255 255',
    },
  },

  'solarized-light': {
    label: 'Solarized Light', mode: 'light',
    hint: 'Warm parchment, low glare',
    colors: {
      'cs-dark': '253 246 227', 'cs-darker': '245 238 216', 'cs-darkest': '238 232 213',
      'cs-primary': '38 139 210', 'cs-mint': '42 161 152',
      'cs-cyan': '42 161 152', 'cs-blue': '38 139 210', 'cs-violet': '108 113 196',
      'cs-green': '133 153 0', 'cs-orange': '203 75 22', 'cs-red': '220 50 47',
      'cs-teal': '38 139 210', 'cs-deep-teal': '147 161 161',
      'cs-text': '88 110 117', 'cs-text-dim': '101 123 131', 'cs-text-muted': '147 161 161',
      'cs-line': '88 110 117', 'cs-overlay': '88 110 117',
      'cs-btn-text': '255 255 255',
    },
  },
};

export const THEME_KEYS = Object.keys(THEMES);
export const DEFAULT_THEME = 'terminal-neutral';
export const STORAGE_KEY = 'cs-theme';

/** rgb(...) string for a token in a theme — handy outside Tailwind (canvas, CM). */
export function tokenRgb(themeKey, token) {
  const t = THEMES[themeKey] || THEMES[DEFAULT_THEME];
  return `rgb(${t.colors[token]})`;
}

/** Write a theme's tokens onto :root as --cs-* custom properties. */
export function applyTheme(themeKey) {
  const key = THEMES[themeKey] ? themeKey : DEFAULT_THEME;
  const theme = THEMES[key];
  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([token, rgb]) => {
    root.style.setProperty(`--${token}`, rgb);
  });
  root.setAttribute('data-theme', key);
  root.setAttribute('data-mode', theme.mode);
  root.style.colorScheme = theme.mode;
}
