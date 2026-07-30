"use client";

import { useRef } from "react";

export function DragSlider({
  value, min, max, step, onChange, showDots = false,
  thumbAbove, thumbBelow, trackClass = "bg-brand-50", fillClass = "bg-brand-500",
}: {
  value: number | null;
  min: number; max: number; step: number;
  onChange: (v: number) => void;
  showDots?: boolean;
  thumbAbove?: (v: number) => React.ReactNode;
  thumbBelow?: (v: number) => React.ReactNode;
  trackClass?: string;
  fillClass?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const steps = Math.round((max - min) / step);
  const shown = value == null ? min : value;
  const ratio = (shown - min) / (max - min);

  const posToValue = (clientX: number) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    let t = (clientX - r.left) / r.width;
    t = Math.max(0, Math.min(1, t));
    const v = min + Math.round((t * (max - min)) / step) * step;
    onChange(Math.round(v * 100) / 100);
  };

  // mouse
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true; posToValue(e.clientX);
    const move = (ev: MouseEvent) => dragging.current && posToValue(ev.clientX);
    const up = () => { dragging.current = false; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };
  // touch (shielded from the page swipe handler)
  const onTouchStart = (e: React.TouchEvent) => { e.stopPropagation(); posToValue(e.touches[0].clientX); };
  const onTouchMove = (e: React.TouchEvent) => { e.stopPropagation(); posToValue(e.touches[0].clientX); };
  const onTouchEnd = (e: React.TouchEvent) => { e.stopPropagation(); };

  const dots = showDots ? Array.from({ length: steps + 1 }, (_, i) => i) : [];

  return (
    <div className="select-none">
      {thumbAbove && (
        <div className="relative h-12 mb-1">
          <div className="absolute -translate-x-1/2 bottom-0 transition-all duration-150" style={{ left: `calc(${ratio * 100}% )` }}>
            {value != null && thumbAbove(shown)}
          </div>
        </div>
      )}
      <div
        ref={ref}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative h-9 flex items-center cursor-pointer"
        style={{ touchAction: "none" }}
        role="slider"
        aria-valuemin={min} aria-valuemax={max} aria-valuenow={value ?? undefined}
      >
        {/* track */}
        <div className={`absolute left-0 right-0 h-2.5 rounded-full ${trackClass}`} />
        {/* fill */}
        {value != null && <div className={`absolute left-0 h-2.5 rounded-full ${fillClass} transition-all duration-150`} style={{ width: `calc(${ratio * 100}% )` }} />}
        {/* dots */}
        {dots.map((i) => {
          const dr = i / steps;
          const active = value != null && dr <= ratio + 0.001;
          return <div key={i} className={`absolute h-3 w-3 rounded-full -translate-x-1/2 transition-colors ${active ? "bg-white ring-2 ring-brand-500" : "bg-white ring-1 ring-black/10"}`} style={{ left: `${dr * 100}%` }} />;
        })}
        {/* thumb */}
        <div
          className={`absolute h-7 w-7 rounded-full -translate-x-1/2 border-[3px] border-white shadow-glow transition-all duration-150 ${value != null ? "bg-brand-500 scale-100" : "bg-brand-200 scale-90"}`}
          style={{ left: `calc(${ratio * 100}% )` }}
        />
      </div>
      {thumbBelow && (
        <div className="relative h-6 mt-1">
          <div className="absolute -translate-x-1/2 top-0 transition-all duration-150" style={{ left: `calc(${ratio * 100}% )` }}>
            {value != null && thumbBelow(shown)}
          </div>
        </div>
      )}
    </div>
  );
}
