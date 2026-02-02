'use client';

import { useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import useSupercluster from 'use-supercluster';
import { Id } from '../../convex/_generated/dataModel';
import { SessionMarker, HomeMarker } from './SessionMarker';
import { ClusterMarker } from './ClusterMarker';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with webpack
import L from 'leaflet';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export interface MapSession {
  _id: Id<'sessions'>;
  startDate: string;
  endDate: string;
  price: number;
  currency: string;
  spotsLeft?: number;
  distanceFromHome?: number;
  camp: {
    name: string;
  };
  organization: {
    name: string;
  };
  location: {
    name: string;
    latitude?: number;
    longitude?: number;
  };
}

interface CampMapProps {
  sessions: MapSession[];
  centerLatitude: number;
  centerLongitude: number;
  homeLatitude?: number;
  homeLongitude?: number;
  zoom?: number;
  height?: string;
  getMarkerColor?: (session: MapSession) => string;
}

// Component to handle map bounds and zoom
function MapBounds({
  sessions,
  centerLatitude,
  centerLongitude,
  homeLatitude,
  homeLongitude,
}: {
  sessions: MapSession[];
  centerLatitude: number;
  centerLongitude: number;
  homeLatitude?: number;
  homeLongitude?: number;
}) {
  const map = useMap();

  // Fit bounds to show all markers on initial load
  useMemo(() => {
    const points: [number, number][] = [];

    // Add session locations
    sessions.forEach((session) => {
      if (session.location.latitude && session.location.longitude) {
        points.push([session.location.latitude, session.location.longitude]);
      }
    });

    // Add home location
    if (homeLatitude && homeLongitude) {
      points.push([homeLatitude, homeLongitude]);
    }

    // If we have points, fit bounds; otherwise use center
    if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    } else if (points.length === 1) {
      map.setView(points[0], 13);
    } else {
      map.setView([centerLatitude, centerLongitude], 11);
    }
  }, [map, sessions, centerLatitude, centerLongitude, homeLatitude, homeLongitude]);

  return null;
}

// Cluster layer component
function ClusterLayer({
  sessions,
  getMarkerColor,
}: {
  sessions: MapSession[];
  getMarkerColor?: (session: MapSession) => string;
}) {
  const map = useMap();

  // Convert sessions to GeoJSON points for supercluster
  const points = useMemo(() => {
    return sessions
      .filter((s) => s.location.latitude && s.location.longitude)
      .map((session) => ({
        type: 'Feature' as const,
        properties: {
          cluster: false,
          sessionId: session._id,
          session,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [session.location.longitude!, session.location.latitude!],
        },
      }));
  }, [sessions]);

  // Get current map bounds
  const bounds = map.getBounds();
  const bbox: [number, number, number, number] = [
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth(),
  ];
  const zoom = map.getZoom();

  // Use supercluster
  const { clusters, supercluster } = useSupercluster({
    points,
    bounds: bbox,
    zoom,
    options: {
      radius: 75,
      maxZoom: 17,
    },
  });

  const handleClusterClick = useCallback(
    (clusterId: number, latitude: number, longitude: number) => {
      if (!supercluster) return;

      const expansionZoom = Math.min(
        supercluster.getClusterExpansionZoom(clusterId),
        17
      );
      map.setView([latitude, longitude], expansionZoom);
    },
    [supercluster, map]
  );

  return (
    <>
      {clusters.map((cluster) => {
        const [longitude, latitude] = cluster.geometry.coordinates;
        const { cluster: isCluster, point_count: pointCount } = cluster.properties;

        if (isCluster) {
          return (
            <ClusterMarker
              key={`cluster-${cluster.id}`}
              latitude={latitude}
              longitude={longitude}
              pointCount={pointCount}
              onClick={() => handleClusterClick(cluster.id as number, latitude, longitude)}
            />
          );
        }

        const session = cluster.properties.session as MapSession;
        const color = getMarkerColor ? getMarkerColor(session) : '#3b82f6';

        return (
          <SessionMarker
            key={`session-${session._id}`}
            session={session}
            color={color}
          />
        );
      })}
    </>
  );
}

export function CampMap({
  sessions,
  centerLatitude,
  centerLongitude,
  homeLatitude,
  homeLongitude,
  zoom = 11,
  height = '400px',
  getMarkerColor,
}: CampMapProps) {
  return (
    <MapContainer
      center={[centerLatitude, centerLongitude]}
      zoom={zoom}
      style={{ height, width: '100%' }}
      className="rounded-lg z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapBounds
        sessions={sessions}
        centerLatitude={centerLatitude}
        centerLongitude={centerLongitude}
        homeLatitude={homeLatitude}
        homeLongitude={homeLongitude}
      />

      <ClusterLayer sessions={sessions} getMarkerColor={getMarkerColor} />

      {homeLatitude !== undefined && homeLongitude !== undefined && (
        <HomeMarker latitude={homeLatitude} longitude={homeLongitude} />
      )}
    </MapContainer>
  );
}
