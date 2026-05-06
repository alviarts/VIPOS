// VIPOS — Tiny ResizeObserver hook used by the vanilla-SVG chart
// components (RevenueChart, TopProductChart) to track their parent
// container's pixel dimensions so they can compute scales without
// pulling in `recharts` ResponsiveContainer.
//
// Single source of truth for both charts so the polyfill story stays
// consistent: jsdom doesn't ship ResizeObserver, but
// `apps/web/src/__tests__/setup.js` provides a no-op stub. Without
// real dimensions in tests we just render at 0×0 and the chart short-
// circuits to its empty-state placeholder, which keeps existing test
// mocks honest (they mock the entire component anyway).

import { useEffect, useRef, useState } from 'react';

export default function useChartSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });
    ro.observe(node);

    // Seed with the current rect so the first paint isn't 0×0 on
    // browsers (jsdom never delivers entries to the callback in
    // tests).
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      setSize({ width: rect.width, height: rect.height });
    }

    return () => ro.disconnect();
  }, []);

  return [ref, size];
}
