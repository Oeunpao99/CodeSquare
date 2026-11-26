import React from 'react';
import { NavLink } from 'react-router-dom';
import { FiShield, FiUsers, FiLogOut, FiBookOpen, FiZap, FiHelpCircle, FiAward } from 'react-icons/fi';

// Console shell for /admin-portal. New sections (content authoring, etc.) slot
// into NAV — add a route in AdminPortal and flip `soon` off here.
const NAV = [
  { to: '/admin-portal/users', label: 'Users', icon: FiUsers },
  { to: '/admin-portal/teachers', label: 'Instructors', icon: FiAward },
  { label: 'Lessons', icon: FiBookOpen, soon: true },
  { label: 'Library', icon: FiBookOpen, soon: true },
  { label: 'Challenges', icon: FiZap, soon: true },
  { label: 'Quizzes', icon: FiHelpCircle, soon: true },
];

export default function AdminLayout({ admin, onSignOut, children }) {
  return (
    <div className="min-h-screen bg-cs-dark text-cs-text flex">
      {/* sidebar — pinned; content scrolls past it */}
      <aside className="w-64 flex-none sticky top-0 h-screen self-start border-r border-cs-line/[0.07] bg-cs-dark/80 flex flex-col">
        <div className="px-5 py-5">
          <div className="text-xl font-bold tracking-tight text-cs-green">
            Code<span className="text-cs-mint">Square</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[0.6875rem] uppercase tracking-wider text-cs-primary">
            <FiShield className="text-xs" /> admin
          </div>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-3 space-y-1">
          {NAV.map((item) =>
            item.soon ? (
              <div
                key={item.label}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-[0.625rem] text-[0.9375rem] text-cs-text-muted cursor-default select-none"
                title="Coming soon"
              >
                <item.icon className="text-[1.1875rem]" />
                {item.label}
                <span className="ml-auto text-[0.5625rem] uppercase tracking-wider border border-cs-line/10 rounded px-1.5 py-0.5">
                  soon
                </span>
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 px-3.5 py-2.5 rounded-[0.625rem] text-[0.9375rem] transition-colors ${
                    isActive
                      ? 'text-cs-primary font-semibold bg-cs-primary/10'
                      : 'text-cs-text-dim font-medium hover:bg-cs-overlay/[0.06] hover:text-cs-text'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[0.1875rem] rounded-full bg-cs-primary" />
                    )}
                    <item.icon className="text-[1.1875rem]" />
                    {item.label}
                  </>
                )}
              </NavLink>
            )
          )}
        </nav>

        <div className="p-3 border-t border-cs-line/[0.07]">
          <div className="px-2 pb-2 text-[0.6875rem] text-cs-text-muted truncate">
            {admin?.email}
          </div>
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[0.8125rem] text-cs-text-dim border border-cs-line/[0.12] hover:text-cs-primary hover:border-cs-primary/35 transition-colors"
          >
            <FiLogOut /> Sign out
          </button>
        </div>
      </aside>

      {/* content */}
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
