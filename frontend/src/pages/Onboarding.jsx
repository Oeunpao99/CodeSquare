import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useMajor } from '../context/MajorContext';
import { authService } from '../services/api';
import { toast } from '../utils/toast';
import MajorPicker from '../components/MajorPicker';
import ProfileForm from '../components/ProfileForm';
import { FiArrowRight, FiArrowLeft } from 'react-icons/fi';

// First-run flow shown once, right after signup. Step 1 = career track,
// step 2 = profile (avatar / name / headline / bio / links). Skippable at
// any point; everything is editable later from /profile.
function Onboarding() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const { hasMajor } = useMajor();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [skipping, setSkipping] = useState(false);

  if (user?.onboarded) return <Navigate to="/dashboard" replace />;

  const skip = async () => {
    if (skipping) return;
    setSkipping(true);
    try {
      const res = await authService.skipOnboarding();
      updateUser(res.data);
    } catch {
      toast.error('Could not skip right now — try again.');
      setSkipping(false);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-cs-dark relative overflow-hidden">
      <div className="dev-grid absolute inset-0 opacity-40 pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-6 py-10">
        {/* header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 font-mono font-bold">
            <span className="text-cs-primary">⟨/⟩</span>
            <span className="text-cs-text-muted">~/</span>codesphere
          </div>
          <button onClick={skip} disabled={skipping} className="btn btn-ghost btn-sm font-mono">
            {skipping ? t('onboarding.skipping') : t('onboarding.skip')}
          </button>
        </div>

        {/* progress */}
        <div className="flex items-center gap-3 mb-10 font-mono text-xs">
          {[1, 2].map((n) => (
            <React.Fragment key={n}>
              <span className={`flex items-center gap-2 ${step >= n ? 'text-cs-primary' : 'text-cs-text-muted'}`}>
                <span className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                  step >= n ? 'border-cs-primary bg-cs-primary/10' : 'border-cs-line/20'
                }`}>{n}</span>
                {n === 1 ? t('onboarding.your_path') : t('onboarding.your_profile')}
              </span>
              {n === 1 && <span className="flex-1 h-px bg-cs-line/15" />}
            </React.Fragment>
          ))}
        </div>

        {step === 1 ? (
          <div>
            <MajorPicker onboarding />
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!hasMajor}
                className="btn btn-primary btn-lg disabled:opacity-40"
              >
                {t('onboarding.continue')} <FiArrowRight />
              </button>
            </div>
          </div>
        ) : (
          <div>
            <span className="mono-label"> {t('onboarding.almost_there')}</span>
            <h1 className="text-3xl md:text-4xl font-extrabold mt-3 mb-3">{t('onboarding.setup_profile')}</h1>
            <p className="text-cs-text-dim max-w-2xl mb-8">
              {t('onboarding.setup_profile_desc')}
            </p>

            <div className="card p-6">
              <ProfileForm
                submitLabel={t('onboarding.finish')}
                extraPayload={{ complete_onboarding: true }}
                onSaved={() => navigate('/dashboard', { replace: true })}
              />
            </div>

            <div className="mt-6">
              <button onClick={() => setStep(1)} className="btn btn-ghost btn-sm">
                <FiArrowLeft /> {t('onboarding.back')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Onboarding;
