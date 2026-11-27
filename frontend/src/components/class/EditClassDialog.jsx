import React, { useCallback, useId, useState } from 'react';
import { FiCheck } from 'react-icons/fi';
import Dialog from './Dialog';
import { CLASS_COLORS, classBannerInk, colorPickerValue } from './classColors';
import { classService } from '../../services/api';

export default function EditClassDialog({ classroom, onClose, onSaved }) {
  const formId = useId();
  const initialColor = colorPickerValue(classroom.color);
  const [title, setTitle] = useState(classroom.title);
  const [color, setColor] = useState(initialColor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const close = useCallback(() => { if (!saving) onClose(); }, [onClose, saving]);
  const name = title.trim();
  const hasChanges = name !== classroom.title || color !== initialColor;

  async function save(event) {
    event.preventDefault();
    if (saving || !hasChanges || [...name].length < 2) return;
    setSaving(true);
    setError('');
    const updates = {};
    if (name !== classroom.title) updates.title = name;
    if (color !== initialColor) updates.color = color;
    try {
      const { data } = await classService.update(classroom.id, updates);
      onSaved(data);
    } catch (error) {
      const detail = error.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Could not save the class. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title="Edit class" onClose={close} footer={<>
      <button type="button" className="btn btn-secondary" onClick={close} disabled={saving}>Cancel</button>
      <button type="submit" form={formId} className="btn btn-primary"
        disabled={saving || !hasChanges || [...name].length < 2}>{saving ? 'Saving…' : 'Save changes'}</button>
    </>}>
      <form id={formId} onSubmit={save} className="space-y-4">
        <label className="block text-sm font-medium">
          Class name
          <input autoFocus required minLength={2} maxLength={120} value={title}
            onChange={(event) => setTitle(event.target.value)} disabled={saving}
            className="mt-1.5 block w-full rounded-lg border border-cs-line/20 bg-transparent px-3 py-2.5 outline-none focus:border-cs-primary" />
        </label>
        <fieldset disabled={saving}>
          <legend className="mb-2 text-sm font-medium">Banner color</legend>
          <div className="flex flex-wrap items-center gap-2.5">
            {CLASS_COLORS.map((swatch) => (
              <button key={swatch} type="button" onClick={() => setColor(swatch)} aria-label={swatch}
                aria-pressed={color === swatch} title={swatch}
                className="grid size-8 shrink-0 place-items-center rounded-full border border-black/10 aria-pressed:ring-2 aria-pressed:ring-cs-primary aria-pressed:ring-offset-2 aria-pressed:ring-offset-cs-dark"
                style={{ background: swatch, color: classBannerInk(swatch) }}>
                {color === swatch && <FiCheck aria-hidden="true" />}
              </button>
            ))}
          </div>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-cs-text-dim">
            <input type="color" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())}
              className="h-7 w-9 cursor-pointer rounded border border-cs-line/20 bg-transparent p-0.5" />
            Custom color
          </label>
        </fieldset>
        <div aria-label="Banner preview" className="rounded-xl px-4 py-4"
          style={{ background: color, color: classBannerInk(color) }}>
          {classroom.subject && <p className="truncate text-xs font-medium opacity-85">{classroom.subject}</p>}
          <p className="truncate text-lg font-semibold">{name || classroom.title}</p>
        </div>
        {error && <p role="alert" className="text-sm text-cs-red">{error}</p>}
      </form>
    </Dialog>
  );
}
