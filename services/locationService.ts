import { Coordinate } from "../types";

export const calculateDistance = (coord1: Coordinate, coord2: Coordinate): number => {
  const R = 6371e3; // Earth radius in meters
  const lat1 = (coord1.lat * Math.PI) / 180;
  const lat2 = (coord2.lat * Math.PI) / 180;
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

export const getCurrentLocation = (): Promise<Coordinate> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          reject(error);
        }
      );
    }
  });
};

export const searchPlaces = async (query: string, userLocation?: Coordinate) => {
  // Using OpenStreetMap Nominatim for free geocoding
  try {
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1`;

    // If user location is available, prioritize results near them
    if (userLocation) {
      // Create a viewbox roughly 1 degree (approx 111km) around the user to bias results
      // Format: <x1>,<y1>,<x2>,<y2> (left, top, right, bottom)
      const offset = 0.5; // Roughly 50km radius bias
      const viewbox = [
        userLocation.lng - offset,
        userLocation.lat + offset,
        userLocation.lng + offset,
        userLocation.lat - offset
      ].join(',');
      
      // bounded=0 means "prefer results in this box, but don't exclude others"
      // viewbox adds the spatial context
      url += `&viewbox=${viewbox}&bounded=0`;
    }

    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'en-US,en;q=0.9' // Prefer English results
      }
    });
    
    if (!response.ok) throw new Error("Search failed");
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error searching places:", error);
    return [];
  }
};