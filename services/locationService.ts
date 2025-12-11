import { Coordinate, SearchResult } from "../types";

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

export const searchPlaces = async (
  query: string, 
  userLocation?: Coordinate, 
  signal?: AbortSignal
): Promise<SearchResult[]> => {
  try {
    // Clean query
    const cleanedQuery = query.replace(/(\s+|^)(near me|nearby|closest|near)(\s+|$)/gi, ' ').trim();
    if (!cleanedQuery) return [];

    // Use Photon API (by Komoot) - Excellent for POI and Autocomplete
    // Documentation: https://github.com/komoot/photon
    let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanedQuery)}&limit=10&lang=en`;

    // Prioritize results near the user
    if (userLocation) {
      url += `&lat=${userLocation.lat}&lon=${userLocation.lng}`;
    }

    const response = await fetch(url, { signal });
    
    if (!response.ok) throw new Error("Search failed");
    
    const data = await response.json();

    // Map GeoJSON to our App's SearchResult format
    return data.features.map((feature: any) => {
      const { properties, geometry } = feature;
      
      // Construct a readable title/subtitle
      // Photon returns: name, street, city, state, country, osm_key, osm_value
      const name = properties.name || properties.street || "Unknown Place";
      
      const details = [
        properties.street,
        properties.city,
        properties.state,
        properties.country
      ].filter(Boolean).filter(d => d !== name).join(', ');

      // Determine type (e.g., "Shop", "Restaurant")
      const type = properties.osm_value || properties.osm_key || "place";

      return {
        place_id: properties.osm_id || Math.random(),
        lat: geometry.coordinates[1].toString(), // GeoJSON is [lon, lat]
        lon: geometry.coordinates[0].toString(),
        display_name: details ? `${name}, ${details}` : name,
        type: type.charAt(0).toUpperCase() + type.slice(1)
      };
    });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('Search aborted');
    } else {
      console.error("Error searching places:", error);
    }
    return [];
  }
};