import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

/**
 * Animates a numeric value from 0 → target on mount (or when value changes).
 * Renders the formatted string produced by `format(value)`.
 */
export default function AnimatedNumber({ value, format = (v) => v.toFixed(2), duration = 0.8 }) {
  const targetValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  const motionVal = useMotionValue(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const controls = animate(motionVal, targetValue, {
      duration,
      ease: [0.25, 0.1, 0.25, 1],
    });
    prevRef.current = targetValue;
    return controls.stop;
  }, [targetValue, motionVal, duration]);

  // We render via a plain span that subscribes to motionVal
  return <RawNumber motionVal={motionVal} format={format} />;
}

function RawNumber({ motionVal, format }) {
  const spanRef = useRef(null);

  useEffect(() => {
    return motionVal.on('change', (v) => {
      if (spanRef.current) {
        spanRef.current.textContent = format(v);
      }
    });
  }, [motionVal, format]);

  return <span ref={spanRef}>{format(motionVal.get())}</span>;
}
