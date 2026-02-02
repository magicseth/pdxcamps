'use client';

import { Marker } from 'react-leaflet';
import L from 'leaflet';

interface ClusterMarkerProps {
  latitude: number;
  longitude: number;
  pointCount: number;
  onClick: () => void;
}

export function ClusterMarker({ latitude, longitude, pointCount, onClick }: ClusterMarkerProps) {
  // Size based on point count
  const size = Math.min(60, 30 + Math.sqrt(pointCount) * 5);

  const icon = L.divIcon({
    className: 'cluster-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: #3b82f6;
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: ${size > 40 ? '14px' : '12px'};
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
      ">
        ${pointCount}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  return (
    <Marker
      position={[latitude, longitude]}
      icon={icon}
      eventHandlers={{
        click: onClick,
      }}
    />
  );
}
