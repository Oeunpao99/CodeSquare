import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { adminAuth, adminToken } from '../../services/adminApi';
import AdminLogin from './AdminLogin';
import AdminLayout from './AdminLayout';
import AdminUsers from './AdminUsers';

// Mounted at /admin-portal/* — its own session, separate from the learner app.
export default function AdminPortal() {
  const [phase, setPhase] = useState('checking'); // checking | anon | authed
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    if (!adminToken.get()) { setPhase('anon'); return; }
    adminAuth
      .me()
      .then((r) => { setAdmin(r.data); setPhase('authed'); })
      .catch(() => { adminToken.clear(); setPhase('anon'); });
  }, []);

  if (phase === 'checking') {
    return (
      <div className="min-h-screen bg-cs-dark text-cs-text-muted flex items-center justify-center font-mono text-sm">
        checking session…
      </div>
    );
  }

  if (phase === 'anon') {
    return <AdminLogin onAuthed={(a) => { setAdmin(a); setPhase('authed'); }} />;
  }

  return (
    <AdminLayout
      admin={admin}
      onSignOut={() => { adminToken.clear(); setAdmin(null); setPhase('anon'); }}
    >
      <Routes>
        <Route index element={<Navigate to="users" replace />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="*" element={<Navigate to="users" replace />} />
      </Routes>
    </AdminLayout>
  );
}
