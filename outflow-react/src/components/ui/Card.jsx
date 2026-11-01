import { motion } from 'framer-motion';
import { cn } from '../../utils/cn.js';

export default function Card({ className, children, onClick, ...props }) {
  const isClickable = !!onClick;
  return (
    <motion.div
      whileTap={isClickable ? { scale: 0.98 } : undefined}
      whileHover={isClickable ? { borderColor: 'rgba(56,189,248,0.3)' } : undefined}
      onClick={onClick}
      className={cn(
        'bg-panel rounded-card border border-white/[0.08] shadow-card',
        isClickable && 'cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
