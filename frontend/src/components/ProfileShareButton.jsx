import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiCopy, FiDownload, FiShare2 } from 'react-icons/fi';
import Dialog from './class/Dialog';

function ShareProfileDialog({ username, onClose }) {
  const url = new URL('/u/' + encodeURIComponent(username), window.location.origin).href;
  const [qr, setQr] = useState(null);
  const [qrError, setQrError] = useState(false);
  const [feedback, setFeedback] = useState('');
  const linkInput = useRef(null);

  useEffect(() => {
    let active = true;
    async function generate() {
      try {
        const { default: QRCode } = await import('qrcode');
        const image = await QRCode.toDataURL(url, { width: 512, margin: 4, errorCorrectionLevel: 'M' });
        const bytes = Uint8Array.from(atob(image.split(',')[1]), (character) => character.charCodeAt(0));
        const file = new File([bytes], `codesquare-${username}.png`, { type: 'image/png' });
        if (active) setQr({ image, file });
      } catch {
        if (active) setQrError(true);
      }
    }
    generate();
    return () => { active = false; };
  }, [url, username]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback('Link copied');
    } catch {
      linkInput.current?.select();
      setFeedback('Copy the selected link.');
    }
  }

  async function share(data) {
    try {
      await navigator.share(data);
    } catch (error) {
      if (error.name !== 'AbortError') setFeedback('Sharing is unavailable. You can copy the link or download the QR code.');
    }
  }

  return <Dialog title="Share profile" onClose={onClose}>
    <div className="space-y-5">
      <div className="mx-auto w-fit rounded-2xl border border-cs-line/10 bg-cs-overlay/[0.04] p-3 text-center">
        <div className="grid size-48 place-items-center overflow-hidden rounded-xl bg-white sm:size-52">
          {qr ? <img src={qr.image} alt={`QR code for @${username}'s CodeSquare profile`} className="size-full" />
            : <p className="px-4 text-sm text-slate-700">{qrError ? 'Could not generate the QR code.' : 'Generating QR code…'}</p>}
        </div>
        <p className="mt-2 truncate text-sm font-semibold">@{username}</p>
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="share-profile-url">Profile link</label>
        <div className="mt-1.5 flex items-center gap-2">
          <input id="share-profile-url" ref={linkInput} value={url} readOnly
            onFocus={(event) => event.currentTarget.select()}
            className="input min-w-0 flex-1" />
          <button type="button" onClick={copyLink} className="btn btn-primary shrink-0"><FiCopy /> Copy link</button>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {navigator.share && <button type="button" className="btn btn-secondary btn-sm"
          onClick={() => share({ title: `@${username} on CodeSquare`, url })}><FiShare2 /> Share link</button>}
        {qr && <a href={qr.image} download={qr.file.name} className="btn btn-secondary btn-sm"><FiDownload /> Download QR</a>}
        {qr && navigator.share && navigator.canShare?.({ files: [qr.file] }) &&
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => share({ files: [qr.file] })}>
            <FiShare2 /> Share QR
          </button>}
      </div>
      {feedback && <p role="status" className="text-center text-sm text-cs-text-dim">{feedback}</p>}
    </div>
  </Dialog>;
}

export default function ProfileShareButton({ username }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return <>
    <button type="button" onClick={() => setOpen(true)} className="btn btn-sm btn-secondary shrink-0">
      <FiShare2 /> Share profile
    </button>
    {open && <ShareProfileDialog key={username} username={username} onClose={close} />}
  </>;
}
