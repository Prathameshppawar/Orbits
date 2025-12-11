import React, { useState, useEffect, useCallback, useRef } from "react";
import MapCanvas from "./components/MapCanvas";
import Sidebar from "./components/Sidebar";
import { Place, Coordinate, SearchResult, PlaceCategory, Alert, PlaceList, Itinerary } from "./types";
import { calculateDistance, getCurrentLocation, searchPlaces } from "./services/locationService";
import { suggestCategoryAndNotes } from "./services/geminiService";
import { PROXIMITY_THRESHOLD_METERS, CATEGORY_COLORS } from "./constants";
import { X, BellRing, MapPin, Save, Edit3, Loader2, Check, Clock, Trash2 } from "lucide-react";

// Initial Mock Data
const INITIAL_TASKS: Place[] = [];

// Audio Helper with throttling
let isSpeaking = false;
const playAlertSound = (message: string) => {
  // 1. Play Beep (Web Audio API) - Immediate
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      // High pitched 'ping'
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      
      gain.gain.setValueAtTime(0.2, ctx.currentTime); // Volume
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    // Audio context might be blocked if no user interaction yet, ignore
  }

  // 2. Text to Speech - Delayed
  if ('speechSynthesis' in window) {
    // Prevent overlapping speech
    if (isSpeaking) return;

    setTimeout(() => {
        window.speechSynthesis.cancel(); // Clear queue
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 0.9; // Slightly slower
        utterance.pitch = 1;
        
        utterance.onstart = () => { isSpeaking = true; };
        utterance.onend = () => { isSpeaking = false; };
        
        window.speechSynthesis.speak(utterance);
    }, 1200); // 1.2 second delay to let the beep finish and user attention grab
  }

  // 3. System Notification (if backgrounded)
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Places Alarm", { body: message, icon: "/favicon.ico" });
  }
};

const App: React.FC = () => {
  const [places, setPlaces] = useState<Place[]>(INITIAL_TASKS);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  
  // Alert Suppression Logic
  // alertedPlaceIds: Tracks places that have already triggered an alert during the *current* entry.
  // We won't alert them again until the user leaves the radius and re-enters.
  const [alertedPlaceIds, setAlertedPlaceIds] = useState<Set<string>>(new Set());
  
  // snoozedPlaceIds: Tracks places snoozed for a specific duration.
  // Key: placeId, Value: timestamp when snooze expires
  const [snoozedPlaceIds, setSnoozedPlaceIds] = useState<Record<string, number>>({});

  // Selection & Editing State
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState("");
  const [tempName, setTempName] = useState("");

  // Draft State (for "Ask before adding")
  const [draftLocation, setDraftLocation] = useState<Coordinate | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftNote, setDraftNote] = useState("");
  
  // --- Permissions & Init ---
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Try to get initial location once quickly
    getCurrentLocation()
      .then(loc => {
        setUserLocation(loc);
        setIsLoadingLocation(false);
      })
      .catch(err => {
        console.warn("Initial location fetch failed, relying on watcher", err);
      });

    let watchId: number | null = null;

    const startWatcher = (enableHighAccuracy: boolean) => {
      if (!navigator.geolocation) return;

      // Clear existing if any
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setIsLoadingLocation(false);
        },
        (err) => {
          console.warn(`Watch error (highAccuracy: ${enableHighAccuracy}):`, err.code, err.message);
          
          // Code 2: POSITION_UNAVAILABLE, Code 3: TIMEOUT
          // If high accuracy failed, try low accuracy
          if (enableHighAccuracy && (err.code === 2 || err.code === 3)) {
            console.log("Retrying location with low accuracy...");
            startWatcher(false);
          } else {
            // If it fails even on low accuracy (or permission denied), 
            // stop loading so the user can at least use the app manually
            setIsLoadingLocation(false);
          }
        },
        { 
          enableHighAccuracy: enableHighAccuracy, 
          maximumAge: 10000, 
          timeout: 10000 
        }
      );
    };

    // Start with high accuracy
    startWatcher(true);

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // --- Proximity Check ---
  useEffect(() => {
    if (!userLocation) return;

    const now = Date.now();

    places.forEach(place => {
      if (place.isCompleted) return;
      
      const distance = calculateDistance(userLocation, place.location);
      const isInside = distance <= place.radius;
      
      if (isInside) {
        // We are inside the radius. Check if we should trigger an alert.
        
        // 1. Is it snoozed?
        const snoozeExpiry = snoozedPlaceIds[place.id];
        if (snoozeExpiry && snoozeExpiry > now) return;

        // 2. Have we already alerted for this specific entry?
        const hasAlertedThisSession = alertedPlaceIds.has(place.id);
        
        // 3. Is there currently an active alert UI shown?
        const isAlertActive = activeAlerts.some(a => a.placeId === place.id);

        if (!hasAlertedThisSession && !isAlertActive) {
          const message = `You are near ${place.name}!`;
          
          // Trigger UI
          setActiveAlerts(prev => [...prev, {
            placeId: place.id,
            message: message,
            timestamp: now
          }]);
          
          // Mark as alerted so we don't spam
          setAlertedPlaceIds(prev => new Set(prev).add(place.id));
          
          // Play sound
          playAlertSound(message);
        }
      } else {
        // We are OUTSIDE the radius.
        // Reset the "alerted" state so it can trigger again when we come back.
        if (alertedPlaceIds.has(place.id)) {
           setAlertedPlaceIds(prev => {
             const next = new Set(prev);
             next.delete(place.id);
             return next;
           });
        }
      }
    });

  }, [userLocation, places, activeAlerts, alertedPlaceIds, snoozedPlaceIds]);

  // --- Handlers ---

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    const results = await searchPlaces(query, userLocation || undefined);
    setSearchResults(results);
    setIsSearching(false);
  };

  // Fixed: Made synchronous for UI to prevent double-submissions while AI runs in background
  const handleAddPlace = (location: Coordinate, name: string, userNotes?: string, givenId?: string) => {
    const id = givenId || Date.now().toString();
    const initialNote = userNotes || "";

    const newPlace: Place = {
      id: id,
      name: name,
      location,
      category: PlaceCategory.Generic,
      radius: PROXIMITY_THRESHOLD_METERS,
      isCompleted: false,
      createdAt: Date.now(),
      notes: initialNote
    };

    setPlaces(prev => [newPlace, ...prev]);

    // AI Enhancement (Background Side Effect)
    if (process.env.API_KEY) {
      suggestCategoryAndNotes(name).then(enhancement => {
        if (enhancement) {
          setPlaces(prev => prev.map(p => 
            p.id === id
              ? { 
                  ...p, 
                  category: enhancement.category, 
                  // Only overwrite notes if user didn't provide any originally
                  notes: initialNote ? initialNote : enhancement.suggestedNote 
                }
              : p
          ));
        }
      }).catch(err => console.error("AI enhancement failed", err));
    }
    return id;
  };

  const handleSearchResultClick = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const newId = Date.now().toString();
    handleAddPlace({ lat, lng }, result.display_name.split(',')[0], undefined, newId);
    setSearchResults([]);
    setSelectedPlaceId(newId);
  };

  const handleMapClick = (coord: Coordinate) => {
    setDraftLocation(coord);
    setDraftName(""); 
    setDraftNote("");
    setSelectedPlaceId(null);
  };

  const handleConfirmDraft = () => {
    if (!draftLocation) return;
    
    // Capture data immediately
    const location = draftLocation;
    const name = draftName.trim() || "New Place";
    const note = draftNote.trim();
    
    // CRITICAL: Clear draft state IMMEDIATELY to prevent double-clicks/duplication
    setDraftLocation(null);
    setDraftName("");
    setDraftNote("");

    // Add place (sync)
    const id = handleAddPlace(location, name, note);
    
    // Select the new place
    setSelectedPlaceId(id);
  };

  const handleCancelDraft = () => {
    setDraftLocation(null);
    setDraftName("");
    setDraftNote("");
  };

  const handlePlaceMove = (id: string, newLocation: Coordinate) => {
    setPlaces(prev => prev.map(p => 
      p.id === id ? { ...p, location: newLocation } : p
    ));
    
    // CRITICAL: If moving a place, clear its alerted/snoozed state 
    // so it acts like a "fresh" place at the new location
    setAlertedPlaceIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
    });
    setSnoozedPlaceIds(prev => {
        const next = {...prev};
        delete next[id];
        return next;
    });
    // Also remove active alerts if any
    setActiveAlerts(prev => prev.filter(a => a.placeId !== id));
  };

  const handleDraftMove = (newLocation: Coordinate) => {
    setDraftLocation(newLocation);
  };

  const handleToggleTask = (id: string) => {
    setPlaces(prev => prev.map(p => 
      p.id === id ? { ...p, isCompleted: !p.isCompleted } : p
    ));
  };

  const handleDeleteTask = (id: string) => {
    setPlaces(prev => prev.filter(p => p.id !== id));
    if (selectedPlaceId === id) setSelectedPlaceId(null);
  };

  const handleUpdatePlace = (id: string, updates: Partial<Place>) => {
    setPlaces(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleDismissAlert = (placeId: string) => {
    setActiveAlerts(prev => prev.filter(a => a.placeId !== placeId));
    // Note: We do NOT remove it from alertedPlaceIds.
    // This ensures it remains "acknowledged" for this session and won't trigger again until re-entry.
  };

  const handleSnoozeAlert = (placeId: string) => {
    const SNOOZE_DURATION = 5 * 60 * 1000; // 5 minutes
    setSnoozedPlaceIds(prev => ({
      ...prev,
      [placeId]: Date.now() + SNOOZE_DURATION
    }));
    setActiveAlerts(prev => prev.filter(a => a.placeId !== placeId));
    
    // Ensure we clear the immediate alerted flag so logic checks snooze first next time
     setAlertedPlaceIds(prev => {
         const next = new Set(prev);
         next.delete(placeId);
         return next;
     });
  };

  const selectedPlace = places.find(p => p.id === selectedPlaceId);

  // Focus helper for draft input
  const draftInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (draftLocation && draftInputRef.current) {
      draftInputRef.current.focus();
    }
  }, [draftLocation]);

  return (
    <div className="relative w-full h-screen bg-gray-100 overflow-hidden font-sans">
        {/* Loading Screen */}
        {isLoadingLocation && (
            <div className="absolute inset-0 z-[3000] bg-white flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                <h2 className="text-xl font-bold text-gray-800">Locating you...</h2>
                <p className="text-gray-500 mt-2">Please allow location access</p>
                <button 
                  onClick={() => setIsLoadingLocation(false)}
                  className="mt-8 px-4 py-2 text-sm text-gray-500 underline hover:text-gray-800"
                >
                  Skip and use default location
                </button>
            </div>
        )}

        {/* Map */}
        <div className="absolute inset-0 z-0">
            <MapCanvas
              places={places}
              userLocation={userLocation}
              draftLocation={draftLocation}
              onMapClick={handleMapClick}
              onPlaceClick={(p) => setSelectedPlaceId(p.id)}
              onPlaceMove={handlePlaceMove}
              onDraftMove={handleDraftMove}
              selectedPlaceId={selectedPlaceId}
            />
        </div>

        {/* Sidebar */}
        <Sidebar
          searchResults={searchResults}
          isSearching={isSearching}
          onSearch={handleSearch}
          onSelectSearchResult={handleSearchResultClick}
          tasks={places}
          onToggleTask={handleToggleTask}
          onDeleteTask={handleDeleteTask}
          onLocateTask={(p) => setSelectedPlaceId(p.id)}
        />

        {/* Alerts Overlay */}
        <div className="absolute top-4 right-4 z-[2500] flex flex-col gap-2 pointer-events-none">
            {activeAlerts.map(alert => (
                <div key={alert.placeId} className="pointer-events-auto bg-white rounded-lg shadow-2xl border-l-4 border-red-500 p-4 w-80 animate-in slide-in-from-right fade-in duration-300">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                             <BellRing className="w-5 h-5 text-red-500 animate-bounce" />
                             <h3 className="font-bold text-gray-800">Proximity Alert!</h3>
                        </div>
                        <button onClick={() => handleDismissAlert(alert.placeId)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-gray-600 mt-1 text-sm">{alert.message}</p>
                    <div className="mt-3 flex gap-2">
                        <button 
                            onClick={() => handleDismissAlert(alert.placeId)}
                            className="flex-1 bg-blue-600 text-white text-xs font-bold py-2 rounded hover:bg-blue-700 transition-colors"
                        >
                            OK, GOT IT
                        </button>
                         <button 
                            onClick={() => handleSnoozeAlert(alert.placeId)}
                            className="flex-1 bg-gray-100 text-gray-700 text-xs font-bold py-2 rounded hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
                        >
                            <Clock className="w-3 h-3" /> SNOOZE
                        </button>
                    </div>
                </div>
            ))}
        </div>

        {/* Draft Creation Panel (Bottom Center) */}
        {draftLocation && (
             <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[2000] w-full max-w-md px-4">
                 <div className="bg-white rounded-xl shadow-2xl p-4 border border-gray-200 animate-in slide-in-from-bottom fade-in duration-300">
                     <div className="flex justify-between items-center mb-3">
                         <h3 className="font-bold text-gray-800 flex items-center gap-2">
                             <MapPin className="w-4 h-4 text-indigo-600" />
                             New Location
                         </h3>
                         <button onClick={handleCancelDraft} className="text-gray-400 hover:text-gray-600">
                             <X className="w-4 h-4" />
                         </button>
                     </div>
                     
                     <div className="space-y-3">
                         <input
                            ref={draftInputRef}
                            type="text"
                            placeholder="Name (e.g. My Parking Spot)..."
                            className="w-full text-lg font-semibold border-b-2 border-gray-200 focus:border-indigo-500 outline-none pb-1 bg-transparent"
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmDraft();
                            }}
                         />
                         <textarea
                             placeholder="Add a note (optional)..."
                             className="w-full text-sm text-gray-600 bg-gray-50 rounded p-2 outline-none focus:ring-1 focus:ring-indigo-500 resize-none h-20"
                             value={draftNote}
                             onChange={(e) => setDraftNote(e.target.value)}
                         />
                         <div className="flex gap-2">
                             <button 
                                onClick={handleCancelDraft}
                                className="flex-1 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-lg"
                             >
                                 Cancel
                             </button>
                             <button 
                                onClick={handleConfirmDraft}
                                className="flex-1 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md"
                             >
                                 Add Pin
                             </button>
                         </div>
                     </div>
                     <p className="text-[10px] text-center text-gray-400 mt-2">Drag the pin to adjust location</p>
                 </div>
             </div>
        )}

        {/* Place Details Popup (Bottom Right) */}
        {selectedPlace && !draftLocation && (
             <div className="absolute bottom-8 right-8 z-[2000] w-80">
                 <div className="bg-white rounded-xl shadow-2xl p-0 border border-gray-200 overflow-hidden animate-in slide-in-from-bottom fade-in duration-300">
                     <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500" />
                     <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                            {editingNameId === selectedPlace.id ? (
                                <div className="flex-1 flex items-center gap-2 mr-2">
                                    <input 
                                        autoFocus
                                        className="flex-1 font-bold text-lg border-b border-blue-500 outline-none"
                                        value={tempName}
                                        onChange={(e) => setTempName(e.target.value)}
                                    />
                                    <button onClick={() => {
                                        handleUpdatePlace(selectedPlace.id, { name: tempName });
                                        setEditingNameId(null);
                                    }} className="text-green-600"><Check className="w-4 h-4"/></button>
                                </div>
                            ) : (
                                <h2 className="text-xl font-bold text-gray-800 flex-1 mr-2 leading-tight">
                                    {selectedPlace.name}
                                    <button 
                                        onClick={() => {
                                            setEditingNameId(selectedPlace.id);
                                            setTempName(selectedPlace.name);
                                        }}
                                        className="inline-block ml-2 text-gray-300 hover:text-gray-500"
                                    >
                                        <Edit3 className="w-3 h-3" />
                                    </button>
                                </h2>
                            )}
                            <button onClick={() => setSelectedPlaceId(null)} className="text-gray-400 hover:text-gray-600 p-1">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Category Badge - Colored */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            <span 
                                className={`text-[10px] font-bold px-2 py-1 rounded-full text-white ${CATEGORY_COLORS[selectedPlace.category]}`}
                            >
                                {selectedPlace.category.toUpperCase()}
                            </span>
                            {selectedPlace.isCompleted && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">COMPLETED</span>}
                        </div>

                        {/* Radius Slider */}
                        <div className="mb-4">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>Alert Radius</span>
                                <span>{selectedPlace.radius}m</span>
                            </div>
                            <input 
                                type="range" 
                                min="50" 
                                max="1000" 
                                step="50"
                                value={selectedPlace.radius}
                                onChange={(e) => handleUpdatePlace(selectedPlace.id, { radius: parseInt(e.target.value) })}
                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>

                        {/* Notes Section */}
                        <div className="bg-gray-50 rounded-lg p-3 mb-4">
                             <div className="flex justify-between items-center mb-1">
                                 <span className="text-xs font-bold text-gray-400 uppercase">Notes</span>
                                 {editingNoteId !== selectedPlace.id && (
                                     <button 
                                        onClick={() => {
                                            setEditingNoteId(selectedPlace.id);
                                            setTempNote(selectedPlace.notes || "");
                                        }}
                                        className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                                    >
                                        <Edit3 className="w-3 h-3" /> Edit
                                    </button>
                                 )}
                             </div>
                             
                             {editingNoteId === selectedPlace.id ? (
                                 <div className="space-y-2">
                                     <textarea 
                                        className="w-full text-sm bg-white border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none"
                                        rows={3}
                                        value={tempNote}
                                        onChange={(e) => setTempNote(e.target.value)}
                                     />
                                     <div className="flex justify-end gap-2">
                                         <button 
                                            onClick={() => setEditingNoteId(null)}
                                            className="text-xs text-gray-500 px-2 py-1 hover:bg-gray-200 rounded"
                                         >
                                             Cancel
                                         </button>
                                         <button 
                                            onClick={() => {
                                                handleUpdatePlace(selectedPlace.id, { notes: tempNote });
                                                setEditingNoteId(null);
                                            }}
                                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 flex items-center gap-1"
                                         >
                                             <Save className="w-3 h-3" /> Save
                                         </button>
                                     </div>
                                 </div>
                             ) : (
                                 <p className="text-sm text-gray-600 italic">
                                     {selectedPlace.notes || "No notes added."}
                                 </p>
                             )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button 
                                onClick={() => handleToggleTask(selectedPlace.id)}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${selectedPlace.isCompleted ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                            >
                                {selectedPlace.isCompleted ? 'Mark Active' : 'Mark Done'}
                            </button>
                            <button 
                                onClick={() => handleDeleteTask(selectedPlace.id)}
                                className="px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-[10px] text-center text-gray-400 mt-3 border-t border-gray-100 pt-2">
                            Hold & Drag marker to adjust location
                        </p>
                     </div>
                 </div>
             </div>
        )}
    </div>
  );
};

export default App;