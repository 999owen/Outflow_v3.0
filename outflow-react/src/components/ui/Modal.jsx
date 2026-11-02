import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Render into document.body so this AnimatePresence is completely outside the
  // page-level AnimatePresence in AppShell. Without this, the modal's exit
  // animation races with the page exit animation and can leave the incoming
  // page frozen at opacity:0 (its initial value).
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className={`relative z-10 w-full ${maxWidth} bg-panel border border-white/[0.10] rounded-[14px] shadow-[0_24px_80px_rgba(0,0,0,0.6)] p-6`}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-text-main font-semibold text-base">{title}</h3>
              <button
                onClick={onClose}
                className="text-text-muted hover:text-text-main transition-colors p-1 rounded-md hover:bg-white/[0.06]"
              >
                <X size={16} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
