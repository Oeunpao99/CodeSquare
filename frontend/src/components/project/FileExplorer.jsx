import React, { useMemo, useState } from 'react';
import {
  FiChevronRight, FiChevronDown, FiPlus, FiTrash2, FiEdit2, FiStar, FiCheck, FiX,
} from 'react-icons/fi';
import { FileIcon, FolderIcon } from './fileIcons';

// Editor language + icon for a file path.
const EXT_LANG = {
  py: 'python', js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'react', tsx: 'react', ts: 'javascript',
  html: 'html', htm: 'html', css: 'css', scss: 'css', json: 'javascript', sql: 'sql', sh: 'bash',
  dax: 'dax', pq: 'powerquery', m: 'powerquery',
};
export const extOf = (path) => (path.includes('.') ? path.split('.').pop().toLowerCase() : '');
export const languageFor = (path) => EXT_LANG[extOf(path)] || 'text';

// paths -> nested tree { name, path, children: Map } (folders first, then files)
function buildTree(paths) {
  const root = { name: '', path: '', dirs: new Map(), files: [] };
  for (const p of paths) {
    const parts = p.split('/');
    let node = root;
    parts.slice(0, -1).forEach((part, i) => {
      if (!node.dirs.has(part)) node.dirs.set(part, { name: part, path: parts.slice(0, i + 1).join('/'), dirs: new Map(), files: [] });
      node = node.dirs.get(part);
    });
    node.files.push(p);
  }
  return root;
}

export default function FileExplorer({ files, active, entry, onOpen, onCreate, onRename, onDelete, onSetEntry }) {
  const paths = useMemo(() => files.map((f) => f.path), [files]);
  const tree = useMemo(() => buildTree(paths), [paths]);
  // open the folders that lead to the active file, plus the top level
  const [open, setOpen] = useState(() => {
    const o = new Set();
    if (active) active.split('/').slice(0, -1).forEach((_, i, arr) => o.add(arr.slice(0, i + 1).join('/')));
    return o;
  });
  const [adding, setAdding] = useState(null);   // folder path a new file goes into
  const [draft, setDraft] = useState('');
  const [renaming, setRenaming] = useState(null);

  const toggle = (p) => setOpen((o) => { const n = new Set(o); if (n.has(p)) n.delete(p); else n.add(p); return n; });

  const submitNew = () => {
    const name = draft.trim().replace(/^\/+/, '');
    if (name) onCreate((adding ? `${adding}/` : '') + name);
    setAdding(null); setDraft('');
  };
  const submitRename = () => {
    const name = draft.trim();
    if (name && renaming) {
      const dir = renaming.includes('/') ? renaming.slice(0, renaming.lastIndexOf('/') + 1) : '';
      const next = name.includes('/') ? name : dir + name;
      if (next !== renaming) onRename(renaming, next);
    }
    setRenaming(null); setDraft('');
  };

  const inputRow = ({ onSubmit, onCancel, depth, key }) => (
    <div key={key} className="flex items-center gap-1 pr-2 py-0.5" style={{ paddingLeft: 10 + depth * 12 }}>
      <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); if (e.key === 'Escape') onCancel(); }}
        placeholder="name.py or folder/name.py"
        className="flex-1 min-w-0 h-6 px-1.5 rounded border border-cs-primary/60 bg-cs-darkest text-[12px] outline-none" />
      <button type="button" onClick={onSubmit} className="text-cs-green" aria-label="Save"><FiCheck /></button>
      <button type="button" onClick={onCancel} className="text-cs-text-muted" aria-label="Cancel"><FiX /></button>
    </div>
  );

  const renderNode = (node, depth) => (
    <>
      {[...node.dirs.values()].sort((a, b) => a.name.localeCompare(b.name)).map((d) => (
        <div key={`d:${d.path}`}>
          <div className="group flex items-center">
            <button type="button" onClick={() => toggle(d.path)}
              className="flex-1 min-w-0 flex items-center gap-1.5 py-[3px] pr-2 text-left text-[12.5px] text-cs-text-dim hover:bg-cs-overlay/[0.05] rounded"
              style={{ paddingLeft: 6 + depth * 12 }}>
              {open.has(d.path) ? <FiChevronDown className="shrink-0 text-[11px]" /> : <FiChevronRight className="shrink-0 text-[11px]" />}
              <FolderIcon name={d.name} open={open.has(d.path)} />
              <span className="truncate">{d.name}</span>
            </button>
            <button type="button" title={`New file in ${d.path}`} onClick={() => { setAdding(d.path); setDraft(''); setOpen((o) => new Set(o).add(d.path)); }}
              className="opacity-0 group-hover:opacity-100 px-1 text-cs-text-muted hover:text-cs-text"><FiPlus className="text-[12px]" /></button>
          </div>
          {open.has(d.path) && (
            <>
              {adding === d.path && inputRow({ depth: depth + 1, onSubmit: submitNew, onCancel: () => setAdding(null) })}
              {renderNode(d, depth + 1)}
            </>
          )}
        </div>
      ))}
      {[...node.files].sort((a, b) => a.localeCompare(b)).map((p) => {
        const name = p.split('/').pop();
        if (renaming === p) return inputRow({ key: `r:${p}`, depth, onSubmit: submitRename, onCancel: () => setRenaming(null) });
        return (
          <div key={`f:${p}`} className={`group flex items-center rounded ${active === p ? 'bg-cs-primary/[0.12]' : 'hover:bg-cs-overlay/[0.05]'}`}>
            <button type="button" onClick={() => onOpen(p)} title={p}
              className={`flex-1 min-w-0 flex items-center gap-1.5 py-[3px] pr-1 text-left text-[12.5px] ${active === p ? 'text-cs-text font-medium' : 'text-cs-text-dim'}`}
              style={{ paddingLeft: 20 + depth * 12 }}>
              <FileIcon path={p} />
              <span className="truncate">{name}</span>
              {entry === p && <FiStar className="shrink-0 text-[10px] text-cs-orange fill-current" title="Main file" />}
            </button>
            <span className="hidden group-hover:flex items-center gap-1 pr-1.5 text-cs-text-muted">
              {entry !== p && <button type="button" title="Make main file" onClick={() => onSetEntry(p)} className="hover:text-cs-orange"><FiStar className="text-[11px]" /></button>}
              <button type="button" title="Rename" onClick={() => { setRenaming(p); setDraft(p.split('/').pop()); }} className="hover:text-cs-text"><FiEdit2 className="text-[11px]" /></button>
              {files.length > 1 && <button type="button" title="Delete" onClick={() => onDelete(p)} className="hover:text-cs-red"><FiTrash2 className="text-[11px]" /></button>}
            </span>
          </div>
        );
      })}
    </>
  );

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center justify-between px-3 h-11 border-b border-cs-line/10">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-cs-text-muted">Explorer · {files.length}</span>
        <button type="button" title="New file" onClick={() => { setAdding(''); setDraft(''); }}
          className="w-6 h-6 grid place-items-center rounded text-cs-text-muted hover:text-cs-text hover:bg-cs-overlay/[0.06]">
          <FiPlus />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto py-1.5 px-1">
        {adding === '' && inputRow({ depth: 0, onSubmit: submitNew, onCancel: () => setAdding(null) })}
        {renderNode(tree, 0)}
      </div>
    </div>
  );
}
