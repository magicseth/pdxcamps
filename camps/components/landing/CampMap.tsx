'use client';

import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface CampMapProps {
  citySlug: string;
  cityName: string;
}

// Fixed map centers and zoom per market
const MARKET_CONFIG: Record<string, { lat: number; lng: number; zoom: number; bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } }> = {
  portland: {
    lat: 45.475, lng: -122.675, zoom: 11,
    bounds: { minLat: 45.35, maxLat: 45.60, minLng: -122.85, maxLng: -122.50 },
  },
  boston: {
    lat: 42.36, lng: -71.06, zoom: 12,
    bounds: { minLat: 42.28, maxLat: 42.45, minLng: -71.20, maxLng: -70.95 },
  },
  denver: {
    lat: 39.74, lng: -104.95, zoom: 11,
    bounds: { minLat: 39.60, maxLat: 39.85, minLng: -105.10, maxLng: -104.80 },
  },
};
const DEFAULT_CONFIG = MARKET_CONFIG.portland;

export function CampMap({ citySlug, cityName }: CampMapProps) {
  const locations = useQuery(api.locations.queries.getLocationCoordinates, { citySlug });

  const config = MARKET_CONFIG[citySlug] || DEFAULT_CONFIG;

  const validLocations = useMemo(() => {
    if (!locations) return null;
    const { bounds } = config;
    return locations.filter(
      (l) => l.lat >= bounds.minLat && l.lat <= bounds.maxLat && l.lng >= bounds.minLng && l.lng <= bounds.maxLng
    );
  }, [locations, config]);

  if (!validLocations || validLocations.length === 0) return null;

  // Build OSM embed URL with the bounding box
  const { bounds } = config;
  const bboxUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bounds.minLng},${bounds.minLat},${bounds.maxLng},${bounds.maxLat}&layer=mapnik`;

  // For dot positioning: convert lat/lng to percentage within the bounds
  // OSM embed uses Mercator projection, so we need Mercator Y for latitude
  function latToMercY(lat: number) {
    const latRad = (lat * Math.PI) / 180;
    return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  }

  const mercMinY = latToMercY(bounds.minLat);
  const mercMaxY = latToMercY(bounds.maxLat);
  const mercRangeY = mercMaxY - mercMinY;
  const lngRange = bounds.maxLng - bounds.minLng;

  const dots = validLocations.map((loc) => ({
    name: loc.name,
    xPct: ((loc.lng - bounds.minLng) / lngRange) * 100,
    // Mercator Y is inverted (higher lat = higher mercY, but CSS top = 0 at top)
    yPct: ((mercMaxY - latToMercY(loc.lat)) / mercRangeY) * 100,
  }));

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-lg bg-slate-100" style={{ aspectRatio: '4/3' }}>
      {/* OSM iframe — handles its own tile rendering and projection */}
      <iframe
        src={bboxUrl}
        className="absolute inset-0 w-full h-full border-0"
        title={`Camp locations in ${cityName}`}
        loading="lazy"
        style={{ pointerEvents: 'none' }}
      />

      {/* Dot overlay — uses Mercator-corrected percentages matching the iframe's projection */}
      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
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
            <span className="absolute w-4 h-4 -m-1 rounded-full bg-primary/25 animate-ping" />
            <span className="relative block w-3 h-3 rounded-full bg-primary border-2 border-white shadow-md" />
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
