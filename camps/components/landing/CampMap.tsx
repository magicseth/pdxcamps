'use client';

import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface CampMapProps {
  citySlug: string;
  cityName: string;
}

// ─── Web Mercator projection helpers ───────────────────────────────

function lngToWorldX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * 256 * Math.pow(2, zoom);
}

function latToWorldY(lat: number, zoom: number) {
  const latRad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * 256 * Math.pow(2, zoom);
}

function fitZoom(minLat: number, maxLat: number, minLng: number, maxLng: number, targetW: number, targetH: number) {
  for (let z = 15; z >= 1; z--) {
    const x1 = lngToWorldX(minLng, z);
    const x2 = lngToWorldX(maxLng, z);
    const y1 = latToWorldY(maxLat, z);
    const y2 = latToWorldY(minLat, z);
    if (x2 - x1 <= targetW && y2 - y1 <= targetH) return z;
  }
  return 1;
}

// Fixed bounding boxes per market — prevents bad geocodes from breaking the map
const MARKET_BOUNDS: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  portland: { minLat: 45.35, maxLat: 45.60, minLng: -122.85, maxLng: -122.50 },
  boston:   { minLat: 42.28, maxLat: 42.45, minLng: -71.20, maxLng: -70.95 },
  denver:  { minLat: 39.60, maxLat: 39.85, minLng: -105.10, maxLng: -104.80 },
};
const DEFAULT_BOUNDS = { minLat: 45.35, maxLat: 45.60, minLng: -122.85, maxLng: -122.50 };

export function CampMap({ citySlug, cityName }: CampMapProps) {
  const locations = useQuery(api.locations.queries.getLocationCoordinates, { citySlug });

  const mapData = useMemo(() => {
    if (!locations || locations.length === 0) return null;

    const bounds = MARKET_BOUNDS[citySlug] || DEFAULT_BOUNDS;
    const { minLat: bMinLat, maxLat: bMaxLat, minLng: bMinLng, maxLng: bMaxLng } = bounds;

    // Filter to only locations within the fixed bounds
    const validLocations = locations.filter(
      (l) => l.lat >= bMinLat && l.lat <= bMaxLat && l.lng >= bMinLng && l.lng <= bMaxLng
    );
    if (validLocations.length === 0) return null;

    const targetW = 1200;
    const targetH = 800;
    const zoom = fitZoom(bMinLat, bMaxLat, bMinLng, bMaxLng, targetW, targetH);

    const vpX1 = lngToWorldX(bMinLng, zoom);
    const vpX2 = lngToWorldX(bMaxLng, zoom);
    const vpY1 = latToWorldY(bMaxLat, zoom);
    const vpY2 = latToWorldY(bMinLat, zoom);
    const vpW = vpX2 - vpX1;
    const vpH = vpY2 - vpY1;

    const tileMinX = Math.floor(vpX1 / 256);
    const tileMaxX = Math.floor(vpX2 / 256);
    const tileMinY = Math.floor(vpY1 / 256);
    const tileMaxY = Math.floor(vpY2 / 256);

    const tiles: { key: string; url: string; leftPct: number; topPct: number; widthPct: number; heightPct: number }[] = [];
    for (let ty = tileMinY; ty <= tileMaxY; ty++) {
      for (let tx = tileMinX; tx <= tileMaxX; tx++) {
        tiles.push({
          key: `${tx}-${ty}`,
          url: `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`,
          leftPct: ((tx * 256 - vpX1) / vpW) * 100,
          topPct: ((ty * 256 - vpY1) / vpH) * 100,
          widthPct: (256 / vpW) * 100,
          heightPct: (256 / vpH) * 100,
        });
      }
    }

    const dots = validLocations.map((loc) => ({
      name: loc.name,
      xPct: ((lngToWorldX(loc.lng, zoom) - vpX1) / vpW) * 100,
      yPct: ((latToWorldY(loc.lat, zoom) - vpY1) / vpH) * 100,
    }));

    return { vpW, vpH, tiles, dots };
  }, [locations]);

  if (!mapData) return null;

  return (
    <div
      className="relative w-full max-h-[300px] rounded-2xl overflow-hidden border border-slate-200 shadow-lg bg-slate-100"
      style={{ aspectRatio: `${mapData.vpW} / ${mapData.vpH}` }}
    >
      {/* Tile layer — positioned as percentages so they scale with the container */}
      <div className="absolute inset-0 overflow-hidden">
        {mapData.tiles.map((tile) => (
          <img
            key={tile.key}
            src={tile.url}
            alt=""
            loading="lazy"
            className="absolute block"
            style={{
              left: `${tile.leftPct}%`,
              top: `${tile.topPct}%`,
              width: `${tile.widthPct}%`,
              height: `${tile.heightPct}%`,
            }}
          />
        ))}
      </div>

      {/* Dot overlay */}
      <div className="absolute inset-0">
        {mapData.dots.map((dot, i) => (
          <div
            key={i}
            className="absolute group"
            style={{
              left: `${dot.xPct}%`,
              top: `${dot.yPct}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span className="absolute w-4 h-4 -m-1 rounded-full bg-primary/25 animate-ping" />
            <span className="relative block w-3 h-3 rounded-full bg-primary border-2 border-white shadow-md" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-xs font-medium text-white bg-slate-800 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
              {dot.name}
            </span>
          </div>
        ))}
      </div>

      {/* Label */}
      <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm text-sm font-medium text-slate-700 z-10">
        {mapData.dots.length} camp locations across {cityName}
      </div>

      {/* OSM attribution */}
      <div className="absolute bottom-1 right-1 text-[9px] text-slate-400 bg-white/70 px-1 rounded z-10">
        &copy;{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:underline">
          OpenStreetMap
        </a>
      </div>
    </div>
  );
}
