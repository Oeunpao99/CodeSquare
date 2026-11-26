import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiUser, FiSettings, FiBarChart2, FiGrid, FiLogOut, FiMoon, FiSun, FiActivity,
} from 'react-icons/fi';
import { useTheme } from '../context/ThemeContext';
import { teacherService } from '../services/api';

/**
 * Avatar button at the far right of the header. Opens an account menu:
 * who you are, light/dark switch, profile, settings, usage, instructor, log out.
 */
export default function AccountMenu({ user, onLogout, onOpenSettings, onOpenActivity, onInstructor }) {
  const [open, setOpen] = useState(false);
  const [instructor, setInstructor] = useState(undefined); // undefined = not loaded
  const ref = useRef(null);
  const { mode, toggleMode } = useTheme();

  useEffect(() => {
    if (!open) return undefined;
    if (instructor === undefined) {
      teacherService.me().then((r) => setInstructor(r.data?.status || null)).catch(() => setInstructor(null));
    }
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, instructor]);

  if (!user) return null;
  const name = user.display_name || user.username;
  const close = () => setOpen(false);
  const item = 'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-cs-text hover:bg-cs-overlay/[0.06] text-left';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={`w-9 h-9 rounded-full overflow-hidden grid place-items-center font-bold text-sm bg-cs-primary/10 text-cs-primary ring-2 transition-shadow ${
          open ? 'ring-cs-primary' : 'ring-transparent hover:ring-cs-line/30'
        }`}
      >
        {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-64 rounded-xl border border-cs-line/10 bg-cs-dark shadow-2xl animate-route-fade"
        >
          {/* who */}
          <div className="px-4 py-3 border-b border-cs-line/10">
            <p className="font-semibold truncate">{name}</p>
            <p className="text-xs text-cs-text-dim truncate">{user.email}</p>
          </div>

          {/* light / dark */}
          <div className="p-2 border-b border-cs-line/10">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-cs-overlay/[0.06] text-sm">
              {[['dark', 'Dark', FiMoon], ['light', 'Light', FiSun]].map(([m, label, Icon]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => m !== mode && toggleMode()}
                  className={`inline-flex items-center justify-center gap-1.5 h-8 rounded-md transition-colors ${
                    mode === m ? 'bg-cs-dark text-cs-text font-semibold shadow-sm' : 'text-cs-text-dim hover:text-cs-text'
                  }`}
                >
                  <Icon /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* links */}
          <div className="p-2">
            <Link to={`/u/${user.username}`} onClick={close} className={item}><FiUser className="text-cs-text-muted" /> My profile</Link>
            <button type="button" onClick={() => { close(); onOpenActivity(); }} className={item}>
              <FiActivity className="text-cs-text-muted" /> Activity
            </button>
            <Link to="/usage" onClick={close} className={item}><FiBarChart2 className="text-cs-text-muted" /> Usage</Link>
            <button type="button" onClick={() => { close(); onOpenSettings(); }} className={item}>
              <FiSettings className="text-cs-text-muted" /> Settings
            </button>
            {instructor === 'approved' ? (
              <Link to="/classes" onClick={close} className={item}><FiGrid className="text-cs-text-muted" /> Manage my classes</Link>
            ) : (
              <button type="button" onClick={() => { close(); onInstructor(); }} className={item}>
                <FiGrid className="text-cs-text-muted" />
                {instructor === 'pending' ? 'Instructor application pending' : 'Join as Instructor'}
              </button>
            )}
          </div>

          <div className="p-2 border-t border-cs-line/10">
            <button type="button" onClick={() => { close(); onLogout(); }} className={`${item} text-cs-red`}>
              <FiLogOut /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
