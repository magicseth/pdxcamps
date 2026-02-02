'use client';

import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Id } from '../../convex/_generated/dataModel';
import { SessionPopup } from './SessionPopup';

// Create custom marker icon
const createMarkerIcon = (color: string = '#3b82f6') => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 2.4.7 4.7 1.9 6.6L12.5 41l10.6-21.9c1.2-1.9 1.9-4.2 1.9-6.6C25 5.6 19.4 0 12.5 0z" fill="${color}" stroke="white" stroke-width="1"/>
        <circle cx="12.5" cy="12.5" r="5" fill="white"/>
      </svg>
    `,
    iconSize: [25, 41],
    iconAnchor: [12.5, 41],
    popupAnchor: [0, -35],
  });
};

// Marker for home location
const homeIcon = L.divIcon({
  className: 'home-marker',
  html: `
    <svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="#10b981" stroke="white" stroke-width="2"/>
      <path d="M12 5L5 10v8h4v-5h6v5h4v-8L12 5z" fill="white"/>
    </svg>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

interface SessionMarkerProps {
  session: {
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
  };
  color?: string;
}

export function SessionMarker({ session, color = '#3b82f6' }: SessionMarkerProps) {
  const { location } = session;

  if (!location.latitude || !location.longitude) {
    return null;
  }

  const icon = createMarkerIcon(color);

  return (
    <Marker position={[location.latitude, location.longitude]} icon={icon}>
      <Popup>
        <SessionPopup session={session} />
      </Popup>
    </Marker>
  );
}

interface HomeMarkerProps {
  latitude: number;
  longitude: number;
}

export function HomeMarker({ latitude, longitude }: HomeMarkerProps) {
  return (
    <Marker position={[latitude, longitude]} icon={homeIcon}>
      <Popup>
        <div className="text-sm font-medium text-slate-900">Your Home</div>
      </Popup>
    </Marker>
  );
}
