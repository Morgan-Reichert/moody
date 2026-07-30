"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Renders children into document.body so `position: fixed` escapes any
 *  transformed ancestor (our swipe track uses translate3d). */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
