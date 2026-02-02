'use client';

import dynamic from 'next/dynamic';
import type { MapSession } from './CampMap';

// Dynamically import CampMap with SSR disabled
// Leaflet requires window object which isn't available during SSR
const CampMap = dynamic(() => import('./CampMap').then((mod) => mod.CampMap), {
  ssr: false,
  loading: () => (
    <div className="h-96 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg flex items-center justify-center">
      <div className="text-slate-500 dark:text-slate-400 text-sm">Loading map...</div>
    </div>
  ),
});

interface MapWrapperProps {
  sessions: MapSession[];
  centerLatitude: number;
  centerLongitude: number;
  homeLatitude?: number;
  homeLongitude?: number;
  zoom?: number;
  height?: string;
  getMarkerColor?: (session: MapSession) => string;
}

export function MapWrapper(props: MapWrapperProps) {
  return <CampMap {...props} />;
}

export type { MapSession };
