import React from 'react';
import { motion } from 'framer-motion';

// Soft fade between routes — no sliding/push. Works with AnimatePresence in
// App.jsx so the outgoing page fades out while the new one fades in.
export default function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
