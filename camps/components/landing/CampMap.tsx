'use client';

import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface CampMapProps {
  citySlug: string;
  cityName: string;
}

/**
 * Lightweight camp location map for the landing page.
 * Renders dots on an OpenStreetMap static tile background.
 */
export function CampMap({ citySlug, cityName }: CampMapProps) {
  const locations = useQuery(api.locations.queries.getLocationCoordinates, { citySlug });

  if (!locations || locations.length === 0) return null;

  // Compute bounding box with padding
  const lats = locations.map((l) => l.lat);
  const lngs = locations.map((l) => l.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const padLat = Math.max((maxLat - minLat) * 0.15, 0.01);
  const padLng = Math.max((maxLng - minLng) * 0.15, 0.01);

  const boundsMinLat = minLat - padLat;
  const boundsMaxLat = maxLat + padLat;
  const boundsMinLng = minLng - padLng;
  const boundsMaxLng = maxLng + padLng;

  const latRange = boundsMaxLat - boundsMinLat;
  const lngRange = boundsMaxLng - boundsMinLng;

  // Convert lat/lng to percentage position in the bounding box
  function toPosition(lat: number, lng: number) {
    return {
      x: ((lng - boundsMinLng) / lngRange) * 100,
      // Invert Y since latitude increases upward but CSS y increases downward
      y: ((boundsMaxLat - lat) / latRange) * 100,
    };
  }

  // Center of the map for the static tile
  const centerLat = (boundsMinLat + boundsMaxLat) / 2;
  const centerLng = (boundsMinLng + boundsMaxLng) / 2;

  // OpenStreetMap static tile URL (zoom level based on spread)
  const spread = Math.max(latRange, lngRange);
  let zoom = 11;
  if (spread > 0.5) zoom = 10;
  if (spread > 1) zoom = 9;
  if (spread < 0.15) zoom = 12;

  // Use OpenStreetMap tile as background via an embedded iframe for simplicity
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${boundsMinLng},${boundsMinLat},${boundsMaxLng},${boundsMaxLat}&layer=mapnik`;

  return (
    <div className="relative w-full aspect-[16/9] md:aspect-[2/1] rounded-2xl overflow-hidden border border-slate-200 shadow-lg bg-slate-100">
      {/* Map background */}
      <iframe
        src={osmUrl}
        className="absolute inset-0 w-full h-full border-0 pointer-events-none"
        title={`Camp locations in ${cityName}`}
        loading="lazy"
      />

      {/* Dot overlay */}
      <div className="absolute inset-0">
        {locations.map((loc, i) => {
          const pos = toPosition(loc.lat, loc.lng);
          return (
            <div
              key={i}
              className="absolute group"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* Pulse ring */}
              <span className="absolute inset-0 w-3 h-3 -m-0.5 rounded-full bg-primary/30 animate-ping" />
              {/* Dot */}
              <span className="relative block w-2.5 h-2.5 rounded-full bg-primary border border-white shadow-sm" />
              {/* Tooltip */}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-slate-800 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                {loc.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Label */}
      <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm text-sm font-medium text-slate-700">
        {locations.length} camp locations across {cityName}
      </div>
    </div>
  );
}
