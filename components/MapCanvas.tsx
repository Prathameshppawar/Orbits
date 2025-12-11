import React, { useEffect, useRef, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle } from "react-leaflet";
import L from "leaflet";
import { Place, Coordinate } from "../types";
import { CATEGORY_ICONS, CATEGORY_COLORS, DEFAULT_CENTER, DEFAULT_ZOOM } from "../constants";
import { LucideIcon, Navigation2, MapPin } from "lucide-react";
import ReactDOMServer from "react-dom/server";

interface MapCanvasProps {
  places: Place[];
  userLocation: Coordinate | null;
  draftLocation: Coordinate | null; // New draft prop
  onMapClick: (coord: Coordinate) => void;
  onPlaceClick: (place: Place) => void;
  onPlaceMove: (id: string, coord: Coordinate) => void;
  onDraftMove: (coord: Coordinate) => void; // New draft move prop
  selectedPlaceId: string | null;
}

// Component to handle map center updates and selection
const MapController = ({ 
  userLocation, 
  selectedPlace, 
  onMapClick 
}: { 
  userLocation: Coordinate | null, 
  selectedPlace: Place | undefined,
  onMapClick: (coord: Coordinate) => void 
}) => {
  const map = useMap();
  const hasCenteredRef = useRef(false);

  // Handle map clicks
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  // Fly to selected place
  useEffect(() => {
    if (selectedPlace) {
      map.flyTo([selectedPlace.location.lat, selectedPlace.location.lng], 16, {
        animate: true,
        duration: 1.5
      });
    }
  }, [selectedPlace, map]);

  // Initial center on user - ONLY ONCE
  useEffect(() => {
    if (userLocation && !hasCenteredRef.current && !selectedPlace) {
      map.setView([userLocation.lat, userLocation.lng], 15);
      hasCenteredRef.current = true;
    }
  }, [userLocation, map, selectedPlace]);

  return null;
};

// Custom Control for Recentering
const RecenterControl = ({ userLocation }: { userLocation: Coordinate | null }) => {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      // CRITICAL: Disable click propagation so clicking the button doesn't trigger a map click (drop pin)
      L.DomEvent.disableClickPropagation(containerRef.current);
      L.DomEvent.disableScrollPropagation(containerRef.current);
    }
  }, []);

  if (!userLocation) return null;

  return (
    <div 
      ref={containerRef}
      className="leaflet-bottom leaflet-right" 
      style={{ marginBottom: '80px', marginRight: '10px', pointerEvents: 'auto', zIndex: 1000 }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          map.flyTo([userLocation.lat, userLocation.lng], 16);
        }}
        className="bg-white p-3 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center justify-center text-blue-600"
        title="Center on my location"
      >
        <Navigation2 className="w-6 h-6 fill-current" />
      </button>
    </div>
  );
};

// Helper to create custom div icons from Lucide React components
const createCustomIcon = (CategoryIcon: LucideIcon, colorClass: string, isSelected: boolean) => {
  const iconHtml = ReactDOMServer.renderToString(
    <div className={`relative flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-lg transition-transform ${colorClass} ${isSelected ? 'scale-125 ring-2 ring-offset-2 ring-black z-50' : 'z-10'}`}>
      <CategoryIcon className="w-4 h-4 text-white" />
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: "custom-leaflet-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 32], // Bottom center
    popupAnchor: [0, -34],
  });
};

// User Location Icon
const userIconHtml = ReactDOMServer.renderToString(
  <div className="relative flex items-center justify-center w-6 h-6">
    <div className="absolute w-full h-full bg-blue-500 rounded-full opacity-30 animate-ping"></div>
    <div className="relative w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md"></div>
  </div>
);
const userIcon = L.divIcon({
  html: userIconHtml,
  className: "user-location-dot",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Draft Location Icon (Pulsing)
const draftIconHtml = ReactDOMServer.renderToString(
  <div className="relative flex items-center justify-center w-8 h-8">
     <div className="absolute w-full h-full bg-indigo-500 rounded-full opacity-30 animate-ping"></div>
     <div className="relative flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-lg bg-indigo-600 z-20">
      <MapPin className="w-4 h-4 text-white" />
    </div>
  </div>
);
const draftIcon = L.divIcon({
  html: draftIconHtml,
  className: "draft-location-pin",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});


// Individual Draggable Marker Component
const PlaceMarker = ({ 
  place, 
  isSelected, 
  onPlaceClick, 
  onPlaceMove 
}: { 
  place: Place; 
  isSelected: boolean; 
  onPlaceClick: (p: Place) => void;
  onPlaceMove: (id: string, c: Coordinate) => void;
}) => {
  // Local state for smooth dragging (Circle moves with Marker)
  const [position, setPosition] = useState(place.location);
  
  // Sync local position if props change (e.g. from API or other edits)
  useEffect(() => {
    setPosition(place.location);
  }, [place.location]);

  const IconComponent = CATEGORY_ICONS[place.category];
  const colorClass = CATEGORY_COLORS[place.category];
  const isCompleted = place.isCompleted;
  const finalColorClass = isCompleted ? 'bg-gray-400' : colorClass;

  const eventHandlers = useMemo(
    () => ({
      click: () => onPlaceClick(place),
      drag: (e: L.LeafletEvent) => {
        // Update local state during drag so Circle follows
        const marker = e.target;
        const latlng = marker.getLatLng();
        setPosition({ lat: latlng.lat, lng: latlng.lng });
      },
      dragend: (e: L.LeafletEvent) => {
        const marker = e.target;
        const newPos = marker.getLatLng();
        onPlaceMove(place.id, { lat: newPos.lat, lng: newPos.lng });
      },
    }),
    [place, onPlaceClick, onPlaceMove],
  );

  return (
    <React.Fragment>
      <Marker
        position={position}
        draggable={true}
        icon={createCustomIcon(IconComponent, finalColorClass, isSelected)}
        eventHandlers={eventHandlers}
        opacity={isCompleted ? 0.6 : 1}
        zIndexOffset={isSelected ? 1000 : 0}
      >
        <Popup className="font-sans">
          <div className="p-1 min-w-[150px]">
            <h3 className="font-bold text-gray-800">{place.name}</h3>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{place.category}</p>
            {place.notes && <p className="text-sm text-gray-600 italic">"{place.notes}"</p>}
            <p className="text-[10px] text-gray-400 mt-2 italic">Drag to move</p>
          </div>
        </Popup>
      </Marker>
      {/* Draw radius for active tasks */}
      {!isCompleted && (
        <Circle 
          center={position}
          radius={place.radius}
          pathOptions={{ 
            color: isSelected ? '#ef4444' : '#64748b', 
            fillOpacity: isSelected ? 0.1 : 0.05, 
            weight: isSelected ? 2 : 1, 
            dashArray: '4' 
          }} 
        />
      )}
    </React.Fragment>
  );
};

// Draggable Draft Marker Component
const DraftMarker = ({ 
  location, 
  onDragEnd 
}: { 
  location: Coordinate; 
  onDragEnd: (c: Coordinate) => void;
}) => {
  const eventHandlers = useMemo(
    () => ({
      dragend: (e: L.LeafletEvent) => {
        const marker = e.target;
        const newPos = marker.getLatLng();
        onDragEnd({ lat: newPos.lat, lng: newPos.lng });
      },
    }),
    [onDragEnd]
  );

  return (
    <Marker
      position={location}
      draggable={true}
      icon={draftIcon}
      eventHandlers={eventHandlers}
      zIndexOffset={2000}
    />
  );
};

const MapCanvas: React.FC<MapCanvasProps> = ({
  places,
  userLocation,
  draftLocation,
  onMapClick,
  onPlaceClick,
  onPlaceMove,
  onDraftMove,
  selectedPlaceId
}) => {
  const selectedPlace = places.find(p => p.id === selectedPlaceId);

  // If we have user location, use it as center, otherwise default
  const center = userLocation || DEFAULT_CENTER;

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={DEFAULT_ZOOM}
      style={{ height: "100%", width: "100%", zIndex: 0 }}
      zoomControl={false}
    >
      {/* Google Maps Style Tiles with Retina Support */}
      <TileLayer
        attribution='&copy; Google Maps'
        url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        maxZoom={20}
        detectRetina={true}
      />
      
      <MapController 
        userLocation={userLocation} 
        selectedPlace={selectedPlace}
        onMapClick={onMapClick} 
      />

      <RecenterControl userLocation={userLocation} />

      {/* User Location Marker */}
      {userLocation && (
        <>
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} zIndexOffset={1000}>
            <Popup>You are here</Popup>
          </Marker>
          <Circle 
            center={[userLocation.lat, userLocation.lng]}
            radius={100} 
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 1 }} 
          />
        </>
      )}

      {/* Draft Marker (New Location) */}
      {draftLocation && (
        <DraftMarker location={draftLocation} onDragEnd={onDraftMove} />
      )}

      {/* Place Markers */}
      {places.map((place) => (
        <PlaceMarker
          key={place.id}
          place={place}
          isSelected={selectedPlaceId === place.id}
          onPlaceClick={onPlaceClick}
          onPlaceMove={onPlaceMove}
        />
      ))}
    </MapContainer>
  );
};

export default MapCanvas;