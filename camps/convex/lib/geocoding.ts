'use node';

import { action } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Geocode any query string (address, place name, etc.) to coordinates
 * More flexible than geocodeAddress - works with partial addresses or place names
 */
export const geocodeQuery = action({
  args: {
    query: v.string(),
    // Optionally bias results toward a city
    nearCity: v.optional(v.string()),
  },
  handler: async (
    _,
    args,
  ): Promise<{
    latitude: number;
    longitude: number;
    formattedAddress?: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  } | null> => {
    const apiKey = process.env.OPENCAGE_API_KEY;
    if (!apiKey) {
      console.warn('OPENCAGE_API_KEY not set, skipping geocoding');
      return null;
    }

    // Add city context if provided
    let searchQuery = args.query;
    if (args.nearCity && !args.query.toLowerCase().includes(args.nearCity.toLowerCase())) {
      searchQuery = `${args.query}, ${args.nearCity}`;
    }

    const encodedQuery = encodeURIComponent(searchQuery);
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodedQuery}&key=${apiKey}&countrycode=us&limit=1`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Geocoding failed: ${response.statusText}`);
        return null;
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        const components = result.components;

        // Build street address from components
        const houseNumber = components.house_number || '';
        const road = components.road || components.street || '';
        const street = houseNumber && road ? `${houseNumber} ${road}` : road || '';

        return {
          latitude: result.geometry.lat,
          longitude: result.geometry.lng,
          formattedAddress: result.formatted,
          street: street || undefined,
          city: components.city || components.town || components.village || components.suburb || undefined,
          state: components.state_code || components.state || undefined,
          zip: components.postcode || undefined,
        };
      }

      return null;
    } catch (error) {
      console.warn('Geocoding error:', error);
      return null;
    }
  },
});

/**
 * Geocode an address to coordinates using OpenCage API
 */
export const geocodeAddress = action({
  args: {
    street: v.string(),
    city: v.string(),
    state: v.string(),
    zip: v.string(),
  },
  handler: async (_, args): Promise<{ latitude: number; longitude: number } | null> => {
    const apiKey = process.env.OPENCAGE_API_KEY;
    if (!apiKey) {
      throw new Error('OPENCAGE_API_KEY environment variable is not set');
    }

    const address = `${args.street}, ${args.city}, ${args.state} ${args.zip}, USA`;
    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodedAddress}&key=${apiKey}&countrycode=us&limit=1`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        latitude: result.geometry.lat,
        longitude: result.geometry.lng,
      };
    }

    return null;
  },
});

/**
 * Reverse geocode coordinates to an address using OpenCage API
 */
export const reverseGeocode = action({
  args: {
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (
    _,
    args,
  ): Promise<{
    street: string;
    city: string;
    state: string;
    zip: string;
  } | null> => {
    const apiKey = process.env.OPENCAGE_API_KEY;
    if (!apiKey) {
      throw new Error('OPENCAGE_API_KEY environment variable is not set');
    }

    const url = `https://api.opencagedata.com/geocode/v1/json?q=${args.latitude}+${args.longitude}&key=${apiKey}&countrycode=us&limit=1`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      const components = result.components;

      // Build street address from components
      const houseNumber = components.house_number || '';
      const road = components.road || components.street || '';
      const street = houseNumber && road ? `${houseNumber} ${road}` : road || '';

      return {
        street,
        city: components.city || components.town || components.village || components.suburb || '',
        state: components.state_code || components.state || '',
        zip: components.postcode || '',
      };
    }

    return null;
  },
});
