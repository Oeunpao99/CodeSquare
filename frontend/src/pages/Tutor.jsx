import React from 'react';
import { useMajor } from '../context/MajorContext';
import { FiCpu } from 'react-icons/fi';
import AITutor from '../components/AITutor';

function Tutor() {
  const { majorData } = useMajor();

  // Bounded to the viewport so the chat scrolls INSIDE its panel (like the
  // docked tutor in LessonView) instead of growing the whole page.
  return (
    <div className="h-[calc(100vh-3.75rem)] lg:h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden px-6 lg:px-10 py-6">
      <div className="shrink-0 mb-4">
        <span className="mono-label">AI tutor</span>
        <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
          <FiCpu className="text-cs-primary" /> CodeSquareAgent
        </h1>
        <p className="text-sm text-cs-text-dim mt-1 truncate">
          Interactive help{majorData ? ` · focused on ${majorData.label}` : ' · general'}
        </p>
      </div>

      <div className="flex-1 min-h-0 rounded-2xl border border-cs-line/10 bg-cs-darker/40 overflow-hidden">
        <AITutor
          context={majorData ? `Career focus: ${majorData.label}. ${majorData.projectFocus}` : undefined}
          embedded
          persist
        />
      </div>
    </div>
  );
}

export default Tutor;
