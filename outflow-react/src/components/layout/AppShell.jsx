import { motion } from 'framer-motion';
import Sidebar from './Sidebar.jsx';
import ErrorBoundary from '../ui/ErrorBoundary.jsx';
import DashboardView  from '../dashboard/DashboardView.jsx';
import EntriesView    from '../entries/EntriesView.jsx';
import BillsView      from '../bills/BillsView.jsx';
import GroceriesView  from '../groceries/GroceriesView.jsx';
import SettingsView   from '../settings/SettingsView.jsx';
import { VIEWS } from '../../constants/views.js';

// No AnimatePresence — its "wait" / "sync" modes require coordinating the
// unmounting old child with the mounting new child, which creates a window
// where a store dispatch (e.g. tracker-updated from an async Gist push) can
// stall the lifecycle and leave the new page frozen at opacity:0.
//
// Without AnimatePresence, React unmounts the old page and mounts the new one
// immediately. The new motion.div's key change naturally runs its own
// initial → animate transition — a clean, race-free fade+slide-in.

function PageContent({ activeView }) {
  switch (activeView) {
    case VIEWS.DASHBOARD:  return <DashboardView />;
    case VIEWS.ENTRIES:    return <EntriesView />;
    case VIEWS.BILLS:      return <BillsView />;
    case VIEWS.GROCERIES:  return <GroceriesView />;
    case VIEWS.SETTINGS:   return <SettingsView />;
    default:               return <DashboardView />;
  }
}

export default function AppShell({ activeView, onNavigate }) {
  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-bg-outer">
      <Sidebar activeView={activeView} onNavigate={onNavigate} />

      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="min-h-full"
        >
          <ErrorBoundary key={activeView}>
            <PageContent activeView={activeView} />
          </ErrorBoundary>
        </motion.div>
      </main>
    </div>
  );
}

