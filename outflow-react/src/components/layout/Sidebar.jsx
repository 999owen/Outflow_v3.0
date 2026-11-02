import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  List,
  FileText,
  ShoppingCart,
  Settings,
  Wifi,
  WifiOff,
  Loader2,
} from 'lucide-react';
import { useOutflowStore } from '../../store/useOutflowStore.jsx';
import { VIEWS } from '../../constants/views.js';

const NAV_ITEMS = [
  { id: VIEWS.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
  { id: VIEWS.ENTRIES,   label: 'Entries',   icon: List },
  { id: VIEWS.BILLS,     label: 'Bills',     icon: FileText },
  { id: VIEWS.GROCERIES, label: 'Groceries', icon: ShoppingCart },
];

export default function Sidebar({ activeView, onNavigate }) {
  const { syncStatus, db } = useOutflowStore();
  const hasSync = !!(db.settings.github_token && db.settings.gist_id);

  return (
    <aside className="
      w-full md:w-[220px] shrink-0
      bg-bg-inner border-b md:border-b-0 md:border-r border-white/[0.06]
      flex flex-row md:flex-col items-center md:items-stretch justify-between md:justify-start
      gap-1 py-2.5 px-3 md:py-5 md:px-3
      overflow-x-auto md:overflow-y-auto
      z-20
    ">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 md:px-3 mb-0 md:mb-6 shrink-0">
        <img src="./logo.svg" alt="Outflow" className="w-7 h-7 rounded-lg object-contain shrink-0" />
        <span className="text-text-main font-bold text-[15px] tracking-wide uppercase hidden sm:inline">
          Outflow
        </span>
      </div>

      {/* Main nav */}
      <nav className="flex flex-row md:flex-col gap-0.5 md:flex-1 shrink-0">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="relative flex items-center gap-2 md:gap-3 px-2.5 md:px-3 py-1.5 md:py-2.5 rounded-lg text-xs md:text-sm font-medium text-left transition-colors duration-150 shrink-0"
              style={{
                color: isActive ? '#f9fafb' : '#9ca3af',
                background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute inset-0 rounded-lg bg-white/[0.06] border border-accent-blue/20"
                  style={{ boxShadow: '0 0 10px rgba(56,189,248,0.08)' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <Icon size={16} className="relative z-10 shrink-0" />
              <span className="relative z-10 hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Settings + sync status */}
      <div className="flex flex-row md:flex-col items-center md:items-stretch gap-1 md:gap-0.5 mt-0 md:mt-2 shrink-0">
        <button
          onClick={() => onNavigate(VIEWS.SETTINGS)}
          className="relative flex items-center gap-2 md:gap-3 px-2.5 md:px-3 py-1.5 md:py-2.5 rounded-lg text-xs md:text-sm font-medium text-left transition-colors duration-150 shrink-0"
          style={{
            color: activeView === VIEWS.SETTINGS ? '#f9fafb' : '#9ca3af',
            background: activeView === VIEWS.SETTINGS ? 'rgba(255,255,255,0.06)' : 'transparent',
          }}
        >
          {activeView === VIEWS.SETTINGS && (
            <motion.div
              layoutId="sidebar-indicator"
              className="absolute inset-0 rounded-lg bg-white/[0.06] border border-accent-blue/20"
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            />
          )}
          <Settings size={16} className="relative z-10 shrink-0" />
          <span className="relative z-10 hidden sm:inline">Settings</span>
        </button>

        {/* User profile / sync status indicator dot */}
        <div className="flex items-center justify-between px-2.5 md:px-3 py-1.5 md:py-2.5 mt-0 md:mt-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
            <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-accent-blue/20 text-accent-blue flex items-center justify-center font-bold text-[10px] md:text-xs shrink-0">
              OF
            </div>
            <div className="min-w-0 hidden md:block">
              <p className="text-xs font-semibold text-text-main truncate">Owen</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <SyncDot status={syncStatus} hasSync={hasSync} />
                <span className="text-[10px] text-text-muted">
                  {syncStatus === 'syncing' ? 'Syncing…' :
                   syncStatus === 'synced'  ? 'Synced' :
                   syncStatus === 'error'   ? 'Sync error' :
                   hasSync ? 'Gist Connected' : 'local only'}
                </span>
              </div>
            </div>
            <div className="md:hidden flex items-center">
              <SyncDot status={syncStatus} hasSync={hasSync} />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function SyncDot({ status, hasSync }) {
  if (status === 'syncing') {
    return <Loader2 size={12} className="text-accent-blue animate-spin" />;
  }
  if (status === 'error') {
    return <WifiOff size={12} className="text-accent-red" />;
  }
  if (hasSync) {
    return <Wifi size={12} className="text-accent-green" />;
  }
  return (
    <span className="w-2 h-2 rounded-full bg-text-muted/40 block" />
  );
}
