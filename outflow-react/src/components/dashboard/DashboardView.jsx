import { motion } from 'framer-motion';
import { useOutflowStore } from '../../store/useOutflowStore.jsx';
import HeroCard from './HeroCard.jsx';
import RecentTransactions from './RecentTransactions.jsx';
import PacingCard from './PacingCard.jsx';
import GroceryMonitor from './GroceryMonitor.jsx';
import UpcomingBillsCard from './UpcomingBillsCard.jsx';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
};

export default function DashboardView() {
  const { db } = useOutflowStore();
  const userName = db?.settings?.user_name?.trim();
  const now = new Date();
  const monthLabel = MONTH_NAMES[now.getMonth()] + ' ' + now.getFullYear();

  return (
    <div className="p-6 xl:p-8 min-h-full">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-center justify-between mb-7"
      >
        <div>
          <h1 className="text-2xl font-bold text-text-main tracking-tight">
            {getGreeting()}{userName ? `, ${userName}` : ''}
          </h1>
          <p className="text-text-muted text-sm mt-0.5">Here's your financial snapshot.</p>
        </div>
        <span className="text-xs font-semibold text-accent-blue/80 bg-accent-blue/10 border border-accent-blue/20 px-3 py-1.5 rounded-full">
          {monthLabel}
        </span>
      </motion.div>

      {/* ── 3-Column Layout ─────────────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5"
      >
        {/* Left + Center column */}
        <div className="flex flex-col gap-5">
          <motion.div variants={itemVariants}>
            <HeroCard />
          </motion.div>
          <motion.div variants={itemVariants}>
            <RecentTransactions />
          </motion.div>
        </div>

        {/* Right column — telemetry */}
        <div className="flex flex-col gap-5">
          <motion.div variants={itemVariants}>
            <PacingCard />
          </motion.div>
          <motion.div variants={itemVariants}>
            <GroceryMonitor />
          </motion.div>
          <motion.div variants={itemVariants}>
            <UpcomingBillsCard />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
