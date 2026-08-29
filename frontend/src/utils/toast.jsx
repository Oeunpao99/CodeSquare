import { toast as rht } from 'react-hot-toast';
import { FiCheckCircle, FiXCircle } from 'react-icons/fi';

// Dev-vibe toast helpers — a slim icon + message so every notification stays
// clean and matches the app's code/tech aesthetic.

const render = (Icon, color, title, message) => (
  <div className="flex items-center gap-2.5">
    <Icon className={`text-lg shrink-0 ${color}`} />
    <div className="min-w-0">
      <div className="text-sm font-semibold text-cs-text leading-snug">{title}</div>
      {message && <div className="text-xs text-cs-text-dim mt-0.5">{message}</div>}
    </div>
  </div>
);

export const toast = {
  ...rht,
  // Plain rht() so react-hot-toast doesn't ALSO prepend its own status icon —
  // the icon in `render` is the only one.
  success: (title, message) =>
    rht(render(FiCheckCircle, 'text-cs-green', title, message)),
  error: (title, message) =>
    rht(render(FiXCircle, 'text-cs-red', title, message)),
};
