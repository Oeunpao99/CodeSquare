import React, { useMemo, useState } from 'react';
import { FiGithub, FiGlobe, FiLinkedin, FiSave } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';
import { toast } from '../utils/toast';
import AvatarUpload from './AvatarUpload';

const LINKS = [
  { key: 'github_url', label: 'GitHub', icon: <FiGithub />, ph: 'https://github.com/you' },
  { key: 'website_url', label: 'Website', icon: <FiGlobe />, ph: 'https://you.dev' },
  { key: 'linkedin_url', label: 'LinkedIn', icon: <FiLinkedin />, ph: 'https://linkedin.com/in/you' },
];

// Shared by the onboarding flow and the Profile → settings tab.
// `extraPayload` lets onboarding pass { complete_onboarding: true }.
function ProfileForm({ onSaved, submitLabel = 'Save changes', extraPayload = {} }) {
  const { user, updateUser } = useAuth();

  const initial = useMemo(() => ({
    display_name: user?.display_name || '',
    headline: user?.headline || '',
    bio: user?.bio || '',
    github_url: user?.github_url || '',
    website_url: user?.website_url || '',
    linkedin_url: user?.linkedin_url || '',
  }), [user]);

  const [form, setForm] = useState(initial);
  // Only an uploaded / OAuth photo counts here; without one we show the illustrated avatar.
  const [avatar, setAvatar] = useState(user?.has_photo ? user.avatar : '');
  const [style, setStyle] = useState(user?.avatar_style || 'neutral');
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onAvatar = (next) => { setAvatar(next); setAvatarDirty(true); };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const payload = { ...extraPayload };
    Object.keys(initial).forEach((k) => {
      if (form[k].trim() !== initial[k]) payload[k] = form[k].trim();
    });
    // Only send the image when it actually changed, and never send a plain URL
    // (e.g. a Google picture) as uploaded data.
    if (avatarDirty) {
      payload.avatar_data = avatar.startsWith('data:') ? avatar : '';
    }
    if (style !== (user?.avatar_style || 'neutral') || !user?.avatar_style) payload.avatar_style = style;

    setSaving(true);
    try {
      const res = await authService.updateProfile(payload);
      updateUser(res.data);
      toast.success('Profile saved');
      onSaved?.(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save your profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <AvatarUpload value={avatar} name={user?.display_name || user?.username} onChange={onAvatar}
        fallback={user ? `/api/avatars/${style}/${user.id}.svg` : ''} />

      {/* Illustrated avatar, used whenever there's no photo */}
      <div>
        <span className="mono-label text-cs-text-muted"> pick your avatar</span>
        <p className="text-[0.75rem] text-cs-text-muted mt-0.5">Shown when you haven’t uploaded a photo.</p>
        <div className="mt-2.5 flex gap-3" role="radiogroup" aria-label="Avatar">
          {[['woman', 'Woman'], ['man', 'Man'], ['neutral', 'Neutral']].map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={style === k} onClick={() => setStyle(k)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-colors ${
                style === k ? 'border-cs-primary bg-cs-primary/[0.06]' : 'border-cs-line/15 hover:border-cs-line/30'
              }`}>
              <img src={`/api/avatars/${k}/${user?.id || 0}.svg`} alt="" className="w-14 h-14 rounded-full" />
              <span className={`text-xs ${style === k ? 'text-cs-primary font-semibold' : 'text-cs-text-dim'}`}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="mono-label text-cs-text-muted"> display name</span>
          <input
            type="text" value={form.display_name} onChange={set('display_name')} maxLength={60}
            placeholder={user?.username}
            className="mt-1.5 w-full rounded-lg bg-cs-darkest/70 border border-cs-line/15 px-3 py-2.5 text-sm outline-none focus:border-cs-primary/60"
          />
        </label>
        <label className="block">
          <span className="mono-label text-cs-text-muted"> headline</span>
          <input
            type="text" value={form.headline} onChange={set('headline')} maxLength={120}
            placeholder="Aspiring AI engineer · learning in public"
            className="mt-1.5 w-full rounded-lg bg-cs-darkest/70 border border-cs-line/15 px-3 py-2.5 text-sm outline-none focus:border-cs-primary/60"
          />
        </label>
      </div>

      <label className="block">
        <span className="mono-label text-cs-text-muted"> bio</span>
        <textarea
          value={form.bio} onChange={set('bio')} maxLength={600} rows={3}
          placeholder="A couple of sentences about what you're working toward."
          className="mt-1.5 w-full rounded-lg bg-cs-darkest/70 border border-cs-line/15 px-3 py-2.5 text-sm outline-none focus:border-cs-primary/60 resize-y"
        />
        <span className="text-[0.6875rem] text-cs-text-muted">{form.bio.length}/600</span>
      </label>

      <div className="space-y-3">
        <span className="mono-label text-cs-text-muted"> links — shown on your portfolio</span>
        {LINKS.map((l) => (
          <div key={l.key} className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-lg glass flex items-center justify-center text-cs-text-dim shrink-0">{l.icon}</span>
            <input
              type="url" value={form[l.key]} onChange={set(l.key)} placeholder={l.ph} maxLength={300}
              className="flex-1 rounded-lg bg-cs-darkest/70 border border-cs-line/15 px-3 py-2.5 text-sm outline-none focus:border-cs-primary/60"
            />
          </div>
        ))}
      </div>

      <button type="submit" disabled={saving} className="btn btn-primary btn-sm disabled:opacity-50">
        <FiSave /> {saving ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}

export default ProfileForm;
