import React, { useState } from "react";
import { Search, Plus, MapPin, Trash2, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Place, SearchResult } from "../types";
import { CATEGORY_ICONS, CATEGORY_COLORS } from "../constants";

interface SidebarProps {
  searchResults: SearchResult[];
  isSearching: boolean;
  onSearch: (query: string) => void;
  onSelectSearchResult: (result: SearchResult) => void;
  
  tasks: Place[];
  
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onLocateTask: (place: Place) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  searchResults,
  isSearching,
  onSearch,
  onSelectSearchResult,
  tasks,
  onToggleTask,
  onDeleteTask,
  onLocateTask,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) onSearch(searchQuery);
  };

  const activeTasks = tasks.filter(t => !t.isCompleted);
  const completedTasks = tasks.filter(t => t.isCompleted);

  return (
    <div className="absolute top-4 left-4 w-96 max-h-[90vh] flex flex-col gap-3 z-[2000] pointer-events-none">
      
      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-xl overflow-hidden pointer-events-auto border border-gray-200">
        <form onSubmit={handleSearchSubmit} className="flex items-center p-3 bg-white">
          <Search className="w-5 h-5 text-gray-500 mr-3" />
          <input
            type="text"
            className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-500 text-base appearance-none"
            placeholder="Search place or category (e.g. Bakery)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {isSearching && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
        </form>
        
        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="max-h-60 overflow-y-auto bg-white border-t border-gray-100">
            {searchResults.map((result) => {
              const parts = result.display_name.split(',');
              const mainName = parts[0];
              const address = parts.slice(1).join(',').trim();

              return (
                <button
                  key={result.place_id}
                  onClick={() => {
                    onSelectSearchResult(result);
                    setSearchQuery("");
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3 border-b border-gray-100 last:border-0"
                >
                  <div className="mt-1 bg-gray-100 p-1.5 rounded-full shrink-0">
                    <MapPin className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{mainName}</p>
                    <p className="text-xs text-gray-500 line-clamp-2">{address || result.type}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Panel */}
      <div className="bg-white rounded-xl shadow-xl flex flex-col overflow-hidden pointer-events-auto flex-1 min-h-0 border border-gray-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Your Checkpoints</h2>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{activeTasks.length} Active</span>
        </div>

        {/* Content Area */}
        <div className="overflow-y-auto p-0 flex-1 bg-white">
          <div className="pb-4">
            
            <div className="divide-y divide-gray-50">
              {activeTasks.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-sm">
                  No active checkpoints.<br/>Search above or click map to add.
                </div>
              )}
              
              {activeTasks.map(task => {
                  const Icon = CATEGORY_ICONS[task.category] || MapPin;
                  const colorClass = CATEGORY_COLORS[task.category].replace('bg-', 'text-');
                  
                  return (
                  <div key={task.id} className="group flex items-start p-4 hover:bg-gray-50 transition-colors bg-white">
                    <button onClick={() => onToggleTask(task.id)} className="mt-0.5 text-gray-300 hover:text-green-500 transition-colors">
                      <Circle className="w-5 h-5" />
                    </button>
                    <div className="ml-3 flex-1 cursor-pointer" onClick={() => onLocateTask(task)}>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-800">{task.name}</p>
                        <Icon className={`w-3 h-3 ${colorClass}`} />
                      </div>
                      {task.notes && <p className="text-xs text-gray-500 mb-1">{task.notes}</p>}
                      <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{task.category}</span>
                          <span className="text-[10px] text-gray-400">{task.radius}m radius</span>
                      </div>
                    </div>
                    <button onClick={() => onDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 transition-opacity">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  );
              })}
            </div>

            {completedTasks.length > 0 && (
              <>
                <div className="p-4 bg-gray-50 border-t border-gray-100 mt-2">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Completed ({completedTasks.length})</h2>
                </div>
                <div className="divide-y divide-gray-50 opacity-60 bg-white">
                  {completedTasks.map(task => (
                    <div key={task.id} className="flex items-center p-4">
                      <button onClick={() => onToggleTask(task.id)} className="text-green-500">
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-gray-500 line-through decoration-gray-400">{task.name}</p>
                      </div>
                      <button onClick={() => onDeleteTask(task.id)} className="text-gray-300 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;