import { PlaceCategory } from "./types";
import { MapPin, Briefcase, Home, ShoppingBag, Utensils, HeartPulse, Plane } from "lucide-react";

export const DEFAULT_CENTER = {
  lat: 40.7128,
  lng: -74.0060, // NYC
};

export const DEFAULT_ZOOM = 13;
export const PROXIMITY_THRESHOLD_METERS = 200;

export const CATEGORY_ICONS: Record<PlaceCategory, any> = {
  [PlaceCategory.Generic]: MapPin,
  [PlaceCategory.Work]: Briefcase,
  [PlaceCategory.Home]: Home,
  [PlaceCategory.Shop]: ShoppingBag,
  [PlaceCategory.Food]: Utensils,
  [PlaceCategory.Health]: HeartPulse,
  [PlaceCategory.Travel]: Plane,
};

export const CATEGORY_COLORS: Record<PlaceCategory, string> = {
  [PlaceCategory.Generic]: "bg-gray-500",
  [PlaceCategory.Work]: "bg-blue-600",
  [PlaceCategory.Home]: "bg-green-600",
  [PlaceCategory.Shop]: "bg-purple-600",
  [PlaceCategory.Food]: "bg-orange-500",
  [PlaceCategory.Health]: "bg-red-500",
  [PlaceCategory.Travel]: "bg-cyan-500",
};
