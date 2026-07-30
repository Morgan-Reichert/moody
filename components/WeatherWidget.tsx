"use client";

import { useEffect, useState } from "react";
import { fetchWeather, getCachedWeather, Weather } from "@/lib/weather";
import { Sun, Moon, Cloud, CloudSun, CloudRain, CloudDrizzle, CloudSnow, CloudFog, CloudLightning, MapPin } from "lucide-react";

function iconFor(code: number, isDay: boolean) {
  if (code === 0) return isDay ? Sun : Moon;
  if (code <= 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CloudSnow;
  if (code >= 95) return CloudLightning;
  return Cloud;
}

export function WeatherWidget() {
  const [w, setW] = useState<Weather | null>(() => getCachedWeather());
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchWeather().then((res) => { if (alive) setW(res); }).catch(() => { if (alive && !getCachedWeather()) setDenied(true); });
    return () => { alive = false; };
  }, []);

  if (denied && !w) {
    return (
      <div className="chip px-3.5 py-2.5 flex items-center gap-2 text-ink-mute shrink-0">
        <MapPin className="h-4 w-4" /><span className="text-[12px] font-semibold">Localisation off</span>
      </div>
    );
  }
  if (!w) {
    return <div className="chip px-3.5 py-2.5 shrink-0"><div className="h-4 w-16 rounded bg-black/5 animate-pulse" /></div>;
  }

  const Icon = iconFor(w.code, w.isDay);
  return (
    <div className="chip px-3.5 py-2 flex items-center gap-2.5 shrink-0">
      <Icon className="h-6 w-6 text-brand-600" strokeWidth={2} />
      <div className="leading-tight">
        <p className="font-display font-semibold text-ink text-[17px] tabular-nums">{w.temp}°</p>
        {w.place && <p className="text-[10.5px] text-ink-mute font-semibold -mt-0.5 max-w-[86px] truncate">{w.place}</p>}
      </div>
    </div>
  );
}
