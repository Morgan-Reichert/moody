"use client";

import { useEffect, useRef, useState } from "react";
import { getDashOrder, saveDashOrder } from "@/lib/storage";
import { vibrate } from "@/lib/reminders";
import { Check, GripVertical } from "lucide-react";

export interface SortItem { key: string; node: React.ReactNode; }
const GAP = 12;

export function SortableList({ items }: { items: SortItem[] }) {
  const keys = items.map((i) => i.key);
  const [order, setOrder] = useState<string[]>(keys);
  const [editing, setEditing] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dy, setDy] = useState(0);

  const orderRef = useRef<string[]>(order); orderRef.current = order;
  const wrapRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const heights = useRef<Record<string, number>>({});
  const startY = useRef(0);
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);

  // merge saved order with current keys (keep known order, append new, drop gone)
  useEffect(() => {
    const saved = getDashOrder();
    const merged = [...saved.filter((k) => keys.includes(k)), ...keys.filter((k) => !saved.includes(k))];
    setOrder(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join(",")]);

  const measure = () => { for (const k of orderRef.current) { const el = wrapRefs.current[k]; if (el) heights.current[k] = el.offsetHeight + GAP; } };

  const down = (key: string) => (e: React.PointerEvent) => {
    if (editing) {
      measure(); setDragKey(key); startY.current = e.clientY; setDy(0);
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* */ }
    } else {
      pressStart.current = { x: e.clientX, y: e.clientY };
      pressTimer.current = window.setTimeout(() => { setEditing(true); vibrate(30); pressTimer.current = null; }, 450);
    }
  };
  const move = (e: React.PointerEvent) => {
    if (editing && dragKey) {
      e.stopPropagation();
      let d = e.clientY - startY.current;
      const o = [...orderRef.current];
      const idx = o.indexOf(dragKey);
      if (idx < o.length - 1) {
        const nH = heights.current[o[idx + 1]] ?? 90;
        if (d > nH / 2) { [o[idx], o[idx + 1]] = [o[idx + 1], o[idx]]; setOrder(o); startY.current += nH; d -= nH; }
      }
      if (idx > 0) {
        const pH = heights.current[o[idx - 1]] ?? 90;
        if (d < -pH / 2) { [o[idx], o[idx - 1]] = [o[idx - 1], o[idx]]; setOrder(o); startY.current -= pH; d += pH; }
      }
      setDy(d);
    } else if (pressTimer.current && pressStart.current) {
      if (Math.abs(e.clientY - pressStart.current.y) > 8 || Math.abs(e.clientX - pressStart.current.x) > 8) {
        clearTimeout(pressTimer.current); pressTimer.current = null;
      }
    }
  };
  const up = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
    if (dragKey) { saveDashOrder(orderRef.current); setDragKey(null); setDy(0); vibrate(15); }
  };

  const ordered = order.map((k) => items.find((i) => i.key === k)).filter(Boolean) as SortItem[];

  return (
    <>
      {editing && (
        <div className="flex items-center justify-between mb-3 mt-1 animate-pop">
          <p className="text-[13px] font-bold text-brand-700">Glisse pour réorganiser</p>
          <button onClick={() => setEditing(false)} className="rounded-full bg-brand-500 text-white text-sm font-bold px-4 py-1.5 shadow-glow flex items-center gap-1.5"><Check className="h-4 w-4" /> Terminé</button>
        </div>
      )}
      <div>
        {ordered.map((it) => {
          const isDrag = dragKey === it.key;
          return (
            <div
              key={it.key}
              ref={(el) => { wrapRefs.current[it.key] = el; }}
              onPointerDown={down(it.key)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              className={`relative ${editing ? "touch-none" : ""} ${editing && !isDrag ? "wiggle" : ""}`}
              style={{
                marginBottom: GAP,
                zIndex: isDrag ? 50 : undefined,
                transform: isDrag ? `translateY(${dy}px) scale(1.03)` : undefined,
                transition: isDrag ? "none" : "transform .18s ease",
              }}
            >
              <div className={editing ? "pointer-events-none select-none" : ""}>{it.node}</div>
              {editing && (
                <span className="absolute -top-2 -right-2 grid place-items-center h-7 w-7 rounded-full bg-white shadow-card text-ink-mute pointer-events-none">
                  <GripVertical className="h-4 w-4" />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
