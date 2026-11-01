// Simple cn utility (like clsx) without extra dep
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
