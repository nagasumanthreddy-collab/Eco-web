import { motion } from 'motion/react';
import { useEffect } from 'react';
import { AppLogo } from './AppLogo.tsx';

interface SplashScreenProps {
  onComplete: () => void;
  durationMs?: number;
}

export function SplashScreen({ onComplete, durationMs = 3000 }: SplashScreenProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onComplete();
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B1115] text-white px-6 select-none"
      aria-label="EcoPredict startup animation"
    >
      <div className="relative flex flex-col items-center max-w-sm w-full text-center">
        {/* Soft expanding halo around app logo */}
        <div className="relative flex items-center justify-center mb-7">
          <motion.div
            initial={{ scale: 0.75, opacity: 0 }}
            animate={{ scale: [0.85, 1.18, 1.05], opacity: [0, 0.45, 0.2] }}
            transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute w-32 h-32 rounded-3xl border border-emerald-500/40"
          />
          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="relative shadow-2xl shadow-emerald-950/80 rounded-2xl ring-1 ring-emerald-500/30 overflow-hidden"
          >
            <AppLogo size="xl" />
          </motion.div>
        </div>

        {/* Brand Wordmark */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white"
        >
          EcoPredict
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-sm text-slate-300 mt-2.5 [text-wrap:balance]"
        >
          AI-Powered Food Waste Prediction &amp; Prevention
        </motion.p>

        {/* 3-second progress bar */}
        <div className="w-52 h-1 bg-slate-800 rounded-full overflow-hidden mt-8">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: durationMs / 1000 - 0.15, ease: 'linear' }}
            style={{ transformOrigin: 'left center' }}
            className="h-full w-full bg-emerald-500"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onComplete}
        className="mt-10 text-xs font-medium text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        Skip intro
      </button>
    </motion.div>
  );
}
