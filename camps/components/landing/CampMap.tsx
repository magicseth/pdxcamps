'use client';

import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface CampMapProps {
  citySlug: string;
  cityName: string;
}

function latToMercY(lat: number) {
  const latRad = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
}

/**
 * Compute tight bounds from locations, filtering outliers.
 * Uses IQR-based filtering: locations beyond 1.5x the interquartile range
 * from the median are dropped, then adds 15% padding.
 */
function computeBounds(locations: { lat: number; lng: number }[]) {
  if (locations.length === 0) return null;

  const lats = locations.map((l) => l.lat).sort((a, b) => a - b);
  const lngs = locations.map((l) => l.lng).sort((a, b) => a - b);

  function filterIQR(sorted: number[]): { min: number; max: number } {
    if (sorted.length < 4) {
      return { min: sorted[0], max: sorted[sorted.length - 1] };
    }
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    const filtered = sorted.filter((v) => v >= lower && v <= upper);
    return { min: filtered[0], max: filtered[filtered.length - 1] };
  }

  const latRange = filterIQR(lats);
  const lngRange = filterIQR(lngs);

  // Clamp to max metro-area size (~0.4 degrees lat, ~0.5 degrees lng ≈ 25-30 miles)
  const MAX_LAT_SPAN = 0.4;
  const MAX_LNG_SPAN = 0.5;
  const latCenter = (latRange.min + latRange.max) / 2;
  const lngCenter = (lngRange.min + lngRange.max) / 2;
  const clampedLatMin = Math.max(latRange.min, latCenter - MAX_LAT_SPAN / 2);
  const clampedLatMax = Math.min(latRange.max, latCenter + MAX_LAT_SPAN / 2);
  const clampedLngMin = Math.max(lngRange.min, lngCenter - MAX_LNG_SPAN / 2);
  const clampedLngMax = Math.min(lngRange.max, lngCenter + MAX_LNG_SPAN / 2);

  // Add 15% padding
  const latPad = (clampedLatMax - clampedLatMin) * 0.15 || 0.02;
  const lngPad = (clampedLngMax - clampedLngMin) * 0.15 || 0.02;

  return {
    minLat: clampedLatMin - latPad,
    maxLat: clampedLatMax + latPad,
    minLng: clampedLngMin - lngPad,
    maxLng: clampedLngMax + lngPad,
  };
}

export function CampMap({ citySlug, cityName }: CampMapProps) {
  const locations = useQuery(api.locations.queries.getLocationCoordinates, { citySlug });

  const { bounds, validLocations } = useMemo(() => {
    if (!locations || locations.length === 0) return { bounds: null, validLocations: null };

    // Filter out locations with obviously bad coordinates (0,0 or null-ish)
    const nonZero = locations.filter(
      (l) => Math.abs(l.lat) > 1 && Math.abs(l.lng) > 1
    );
    if (nonZero.length === 0) return { bounds: null, validLocations: null };

    const b = computeBounds(nonZero);
    if (!b) return { bounds: null, validLocations: null };

    // Keep only locations within the computed bounds
    const valid = nonZero.filter(
      (l) => l.lat >= b.minLat && l.lat <= b.maxLat && l.lng >= b.minLng && l.lng <= b.maxLng
    );

    return { bounds: b, validLocations: valid };
  }, [locations]);

  if (!bounds || !validLocations || validLocations.length === 0) return null;

  const bboxUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bounds.minLng},${bounds.minLat},${bounds.maxLng},${bounds.maxLat}&layer=mapnik`;

  const mercMinY = latToMercY(bounds.minLat);
  const mercMaxY = latToMercY(bounds.maxLat);
  const mercRangeY = mercMaxY - mercMinY;
  const lngRange = bounds.maxLng - bounds.minLng;

  const dots = validLocations.map((loc) => ({
    name: loc.name,
    xPct: ((loc.lng - bounds.minLng) / lngRange) * 100,
    yPct: ((mercMaxY - latToMercY(loc.lat)) / mercRangeY) * 100,
  }));

  // Iframe is scaled 130% and shifted to crop OSM zoom controls in top-left
  const iframeStyle = {
    pointerEvents: 'none' as const,
    top: '-20%',
    left: '-15%',
    width: '130%',
    height: '130%',
  };

  return (
    <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden border border-slate-200 shadow-lg bg-slate-100">
      <iframe
        src={bboxUrl}
        className="absolute border-0"
        title={`Camp locations in ${cityName}`}
        loading="lazy"
        style={iframeStyle}
      />

      {/* Dot overlay — must match the iframe's offset and scale */}
      <div className="absolute" style={{ ...iframeStyle, pointerEvents: 'none' }}>
        {dots.map((dot, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${dot.xPct}%`,
              top: `${dot.yPct}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span className="absolute w-4 h-4 -m-1 rounded-full bg-primary/15 animate-pulse" />
            <span className="relative block w-2.5 h-2.5 rounded-full bg-primary/80 border border-white shadow-sm" />
          </div>
        ))}
      </div>

      {/* Label */}
      <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm text-sm font-medium text-slate-700 z-10">
        {dots.length} camp locations across {cityName}
      </div>
    </div>
  );
}
