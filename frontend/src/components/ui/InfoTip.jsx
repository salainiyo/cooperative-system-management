import { useState, useRef, useEffect, useId } from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * Accessible "?" tooltip for KPI cards.
 * - Hover or keyboard-focus opens it
 * - Click/tap toggles it (mobile)
 * - Escape closes it
 */
export default function InfoTip({ title, children, className = '' }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const openedByFocusRef = useRef(false);
  const id = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        openedByFocusRef.current = false;
        setOpen(false);
      }
    };
    const onClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`What is ${title}?`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => {
          // Focus (mouse/tap) already opened it — don't immediately toggle it shut.
          if (openedByFocusRef.current) {
            openedByFocusRef.current = false;
            return;
          }
          setOpen((v) => !v);
        }}
        onFocus={() => {
          openedByFocusRef.current = true;
          setOpen(true);
        }}
        onBlur={() => {
          openedByFocusRef.current = false;
          setOpen(false);
        }}
        className="p-0.5 rounded-full text-slate-500 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute z-50 top-6 right-0 w-72 max-w-[80vw] p-3 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl text-left animate-fade-in"
        >
          <span className="block text-xs font-bold text-indigo-300 uppercase tracking-wide mb-1">
            {title}
          </span>
          <span className="block text-xs text-slate-300 leading-relaxed whitespace-normal">
            {children}
          </span>
        </span>
      )}
    </span>
  );
}
