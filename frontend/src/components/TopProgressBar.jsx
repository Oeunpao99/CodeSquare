import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

// Tiny top "loading" progress bar that runs whenever the route changes. Fills
// quickly then completes, giving feedback without blocking the fade transition.
function TopProgressBar() {
  const location = useLocation();
  const [state, setState] = useState({ visible: false, width: 0 });

  useEffect(() => {
    let timers = [];
    setState({ visible: true, width: 8 });
    timers.push(setTimeout(() => setState((s) => ({ ...s, width: 45 })), 60));
    timers.push(setTimeout(() => setState((s) => ({ ...s, width: 70 })), 180));
    timers.push(setTimeout(() => setState((s) => ({ ...s, width: 88 })), 350));
    timers.push(setTimeout(() => setState((s) => ({ ...s, width: 100 })), 600));
    timers.push(setTimeout(() => setState({ visible: false, width: 0 }), 950));
    return () => timers.forEach(clearTimeout);
  }, [location.pathname, location.search]);

  if (!state.visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[1.5px] bg-transparent pointer-events-none">
      <motion.div
        className="h-full bg-gradient-main rounded-r-full opacity-25 saturate-50"
        initial={false}
        animate={{ width: `${state.width}%` }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      />
    </div>
  );
}

export default TopProgressBar;
