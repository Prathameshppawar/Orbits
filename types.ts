export interface Coordinate {
  lat: number;
  lng: number;
}

export enum PlaceCategory {
  Generic = 'Generic',
  Work = 'Work',
  Home = 'Home',
  Shop = 'Shop',
  Food = 'Food',
  Health = 'Health',
  Travel = 'Travel',
}

export interface Place {
  id: string;
  name: string;
  location: Coordinate;
  category: PlaceCategory;
  radius: number; // in meters
  notes?: string;
  isCompleted: boolean;
  createdAt: number;
  listId?: string; // If it belongs to a permanent list
}

export interface PlaceList {
  id: string;
  name: string;
  description?: string;
  places: string[]; // Array of Place IDs
}

export interface Itinerary {
  id: string;
  name: string;
  placeOrder: string[]; // Array of Place IDs in order
  isActive: boolean;
}

export interface SearchResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type: string;
}

export interface Alert {
  placeId: string;
  message: string;
  timestamp: number;
}
