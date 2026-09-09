import { useEffect, useState } from 'react';

/**
 * Desktop is a different layout, not a wider phone — so this is a real
 * breakpoint rather than a CSS-only stretch. 1024 is where the reading column
 * and the working column both fit without either being cramped.
 */
export function useIsDesktop(min = 1024): boolean {
  const [is, setIs] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(min-width:${min}px)`).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width:${min}px)`);
    const on = (e: MediaQueryListEvent) => setIs(e.matches);
    mq.addEventListener('change', on);
    setIs(mq.matches);
    return () => mq.removeEventListener('change', on);
  }, [min]);
  return is;
}
