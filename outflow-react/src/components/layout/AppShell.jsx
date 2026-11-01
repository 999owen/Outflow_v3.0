import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar.jsx';
import ErrorBoundary from '../ui/ErrorBoundary.jsx';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.15, ease: 'easeIn' } },
};

export default function AppShell({ activeView, onNavigate, children }) {
  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-bg-outer">
      <Sidebar activeView={activeView} onNavigate={onNavigate} />

      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="min-h-full"
          >
            <ErrorBoundary key={activeView}>
              {children}
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
