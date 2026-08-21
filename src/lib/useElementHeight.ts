import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Measures the live rendered height of an element. Used to stack multiple
 * `position: sticky` blocks correctly — e.g. the table's sticky header needs
 * to know how tall the sticky page header above it is, so it can pin itself
 * right below it instead of underneath it.
 */
export function useElementHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, height] as const;
}
