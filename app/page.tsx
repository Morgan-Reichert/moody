"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { migrate } from "@/lib/storage";
import { Dashboard } from "@/components/Dashboard";
import { MoodScreen } from "@/components/MoodScreen";
import { BottomNav } from "@/components/BottomNav";
import { ReminderEngine } from "@/components/ReminderEngine";

export default function Home() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [tab, setTab] = useState(0);          // 0 = accueil, 1 = humeur
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [mounted, setMounted] = useState(false);

  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"h" | "v" | null>(null);

  const goTo = useCallback((i: number) => setTab(Math.max(0, Math.min(1, i))), []);

  useEffect(() => {
    migrate();
    setMounted(true);
    const el = wrapRef.current;
    if (el) {
      const measure = () => setW(el.clientWidth);
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      if (new URLSearchParams(window.location.search).get("tab") === "humeur") setTab(1);
      return () => ro.disconnect();
    }
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    axis.current = null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return;
    const dx = e.touches[0].clientX - start.current.x;
    const dy = e.touches[0].clientY - start.current.y;
    if (axis.current === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (axis.current === "h") setDragging(true);
    }
    if (axis.current === "h") {
      let d = dx;
      if ((tab === 0 && d > 0) || (tab === 1 && d < 0)) d *= 0.35; // edge resistance
      setDrag(d);
    }
  };
  const onTouchEnd = () => {
    if (axis.current === "h") {
      const th = w * 0.18;
      if (drag < -th && tab < 1) setTab(1);
      else if (drag > th && tab > 0) setTab(0);
    }
    start.current = null; axis.current = null;
    setDrag(0); setDragging(false);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-cream">
      <div ref={wrapRef} className="flex-1 overflow-hidden relative">
        <div
          className="flex h-full"
          style={{
            transform: `translate3d(${-tab * w + drag}px,0,0)`,
            transition: dragging ? "none" : "transform .38s cubic-bezier(.22,.61,.36,1)",
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex-none w-full h-full overflow-y-auto overflow-x-hidden overscroll-none">
            <Dashboard mounted={mounted} onLogMood={() => goTo(1)} />
          </div>
          <div className="flex-none w-full h-full overflow-y-auto overflow-x-hidden overscroll-none">
            <MoodScreen />
          </div>
        </div>
      </div>

      <BottomNav tab={tab} onTab={goTo} />
      <ReminderEngine onOpenMood={() => goTo(1)} />
    </div>
  );
}
