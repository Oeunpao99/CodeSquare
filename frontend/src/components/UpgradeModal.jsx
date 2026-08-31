import React, { useEffect, useRef, useState } from 'react';
import { FiX, FiCheckCircle, FiLoader, FiZap } from 'react-icons/fi';
import { billingService } from '../services/api';

// Mock KHQR checkout. Real gateway (ABA PayWay / Bakong) later plugs into the
// same `billingService.confirm` -> the backend already extends the plan there.
const VERIFY_MS = 3000;

const PRO_POINTS = [
  '~1M AI tokens / 5h · 8M / week (≈ 8× Free)',
  'Priority model access',
  'Longer chat history kept in context',
];

export default function UpgradeModal({ open, onClose, onUpgraded }) {
  const [phase, setPhase] = useState('idle'); // idle | loading | qr | verifying | done | error
  const [checkout, setCheckout] = useState(null);
  const [result, setResult] = useState(null);
  const [qrOk, setQrOk] = useState(true);
  const [errMsg, setErrMsg] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setPhase('loading');
    setResult(null);
    setErrMsg('');
    billingService
      .checkout('pro')
      .then((r) => { setCheckout(r.data); setPhase('qr'); })
      .catch(() => { setErrMsg('Could not start checkout.'); setPhase('error'); });
    return () => clearTimeout(timer.current);
  }, [open]);

  if (!open) return null;

  const startVerify = () => {
    if (!checkout) return;
    setPhase('verifying');
    timer.current = setTimeout(async () => {
      try {
        const r = await billingService.confirm(checkout.payment_id);
        setResult(r.data);
        setPhase('done');
      } catch (e) {
        setErrMsg(e?.response?.data?.detail || 'Payment could not be verified.');
        setPhase('error');
      }
    }, VERIFY_MS);
  };

  const finish = () => {
    onUpgraded?.(result);
    onClose();
  };

  const until = result?.plan_expires_at
    ? new Date(result.plan_expires_at).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-cs-dark/70 backdrop-blur-sm"
      onClick={phase === 'verifying' ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-cs-line/12 bg-cs-darker overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-cs-line/10">
          <span className="mono-label text-cs-primary flex items-center gap-2">
            <FiZap /> // upgrade to pro
          </span>
          {phase !== 'verifying' && (
            <button onClick={onClose} className="p-1.5 text-cs-text-muted hover:text-cs-text rounded-lg">
              <FiX />
            </button>
          )}
        </div>

        <div className="p-5">
          {/* what you get */}
          {(phase === 'qr' || phase === 'loading') && (
            <>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-lg font-bold">CodeSquare Pro</h2>
                <span className="font-mono text-cs-primary font-bold">
                  {checkout ? `${checkout.amount_display} · ${checkout.period_days} days` : '…'}
                </span>
              </div>
              <ul className="space-y-1.5 mb-5">
                {PRO_POINTS.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-[13px] text-cs-text-dim">
                    <FiCheckCircle className="text-cs-green mt-0.5 shrink-0" /> {p}
                  </li>
                ))}
              </ul>

              {/* QR */}
              <div className="flex flex-col items-center gap-3">
                {qrOk ? (
                  <img
                    src="/pro-khqr.png"
                    alt="KHQR — scan to pay"
                    className="w-56 h-56 object-contain"
                    onError={() => setQrOk(false)}
                  />
                ) : (
                  <div className="w-48 h-48 rounded-lg border border-dashed border-cs-line/20 flex flex-col items-center justify-center text-center px-3">
                    <div className="grid grid-cols-4 gap-1 w-24 mb-2">
                      {Array.from({ length: 16 }).map((_, i) => (
                        <span key={i} className={`aspect-square ${i % 3 ? 'bg-cs-text-muted/60' : 'bg-cs-text-muted/20'}`} />
                      ))}
                    </div>
                    <p className="font-mono text-[10px] text-cs-text-muted leading-tight">
                      add your KHQR at<br />frontend/public/pro-khqr.png
                    </p>
                  </div>
                )}
                <p className="font-mono text-[11px] text-cs-text-muted text-center">
                  Scan with any Cambodian bank app (KHQR / Bakong)
                </p>
              </div>

              <p className="mt-3 font-mono text-[10px] text-cs-text-muted text-center">
                demo checkout — no real charge is made
              </p>

              <button
                onClick={startVerify}
                disabled={phase !== 'qr'}
                className="btn btn-primary w-full mt-4 font-mono disabled:opacity-50"
              >
                I&apos;ve completed the payment
              </button>
            </>
          )}

          {phase === 'verifying' && (
            <div className="py-10 flex flex-col items-center gap-3 text-center">
              <FiLoader className="text-3xl text-cs-primary animate-spin" />
              <p className="font-mono text-sm text-cs-text">Verifying payment…</p>
              <p className="font-mono text-[11px] text-cs-text-muted">checking the transaction with the bank</p>
            </div>
          )}

          {phase === 'done' && (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <FiCheckCircle className="text-4xl text-cs-green" />
              <h2 className="text-lg font-bold">You&apos;re on Pro 🎉</h2>
              <p className="font-mono text-[12px] text-cs-text-dim">
                {until ? <>Active until <span className="text-cs-text">{until}</span></> : 'Pro is now active'}
              </p>
              <button onClick={finish} className="btn btn-primary w-full mt-3 font-mono">Done</button>
            </div>
          )}

          {phase === 'error' && (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <p className="font-mono text-[13px] text-cs-red">{errMsg}</p>
              <button onClick={onClose} className="btn btn-ghost w-full mt-2 font-mono">Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
