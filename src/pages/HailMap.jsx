import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import { Calendar, Ruler, Search, Filter, AlertCircle, X, Users, MapPin as MapPinIcon, Loader } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const { BaseLayer } = LayersControl;

// Create hail marker
const createHailIcon = (size) => {
  let color;
  if (size >= 2) color = '#dc2626';
  else if (size >= 1.75) color = '#f97316';
  else if (size >= 1) color = '#eab308';
  else color = '#22c55e';

  return L.divIcon({
    className: 'custom-hail-marker',
    html: `
      <div style="position: relative; width: 40px; height: 50px;">
        <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
            </filter>
          </defs>
          <path d="M20 0C8.954 0 0 8.954 0 20c0 15 20 30 20 30s20-15 20-30C40 8.954 31.046 0 20 0z" 
                fill="${color}" 
                stroke="white" 
                stroke-width="2.5"
                filter="url(#shadow)"/>
        </svg>
        <div style="
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          border-radius: 12px;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: bold;
          color: ${color};
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        ">
          ${size.toFixed(1)}"
        </div>
      </div>
    `,
    iconSize: [40, 50],
    iconAnchor: [20, 50],
    popupAnchor: [0, -50],
  });
};

// Map updater
function MapUpdater({ events }) {
  const map = useMap();
  
  useEffect(() => {
    if (events.length > 0) {
      const bounds = events.map(e => [e.lat, e.lon]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [events, map]);
  
  return null;
}

export default function HailMap() {
  const [hailEvents, setHailEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchZip, setSearchZip] = useState('');
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [dateRange, setDateRange] = useState('sample');
  const [customDate, setCustomDate] = useState('');
  const [error, setError] = useState(null);
  const [mapCenter, setMapCenter] = useState([32.7555, -97.3308]);
  const [zipFilter, setZipFilter] = useState(null);

  useEffect(() => {
    fetchHailData();
  }, [dateRange]);

  const fetchHailData = async () => {
    setLoading(true);
    setError(null);
    
    if (dateRange === 'sample') {
      loadSampleData();
      return;
    }

    try {
      let date = '';
      const today = new Date();
      
      if (dateRange === 'today') {
        date = formatDate(today);
      } else if (dateRange === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        date = formatDate(yesterday);
      } else if (dateRange === 'custom' && customDate) {
        const [year, month, day] = customDate.split('-');
        const selectedDate = new Date(year, month - 1, day);
        date = formatDate(selectedDate);
      } else if (dateRange === 'custom' && !customDate) {
        setError('Please select a date');
        setLoading(false);
        loadSampleData();
        return;
      }

      const response = await fetch(
        `https://www.spc.noaa.gov/climo/reports/${date}_rpts_filtered_hail.csv`
      );

      if (!response.ok) {
        throw new Error(`No hail reports found for ${customDate || 'this date'}`);
      }

      const csvText = await response.text();
      const events = parseSPCCSV(csvText);
      
      if (events.length === 0) {
        throw new Error('No hail reports for this date');
      }

      setHailEvents(events);
      
      if (zipFilter) {
        const nearby = events.filter(event => {
          const distance = getDistance(zipFilter.lat, zipFilter.lon, event.lat, event.lon);
          return distance <= 50;
        });
        setFilteredEvents(nearby);
      } else {
        setFilteredEvents(events);
      }
      
      setLoading(false);
      setError(null);
    } catch (error) {
      console.error('Error fetching hail data:', error);
      setError(error.message + ' - Showing sample data instead');
      loadSampleData();
    }
  };

  const formatDate = (date) => {
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  };

  const parseSPCCSV = (csv) => {
    const lines = csv.trim().split('\n');
    const events = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length >= 6) {
        const sizeInHundredths = parseFloat(parts[1]) || 75;
        const actualSize = sizeInHundredths / 100;
        const lat = parseFloat(parts[5]) || 32.7555;
        const lon = parseFloat(parts[6]) || -97.3308;
        
        events.push({
          id: i,
          time: parts[0] || 'Unknown',
          size: actualSize,
          location: parts[2] || 'Unknown',
          county: parts[3] || 'Unknown',
          state: parts[4] || 'TX',
          lat: lat,
          lon: lon,
          comments: parts[7] || '',
          zipCode: null,
          estimatedPopulation: null,
        });
      }
    }

    return events;
  };

  const getZipAndPopulation = async (lat, lon) => {
    try {
      const response = await fetch('https://hail-spectrum-worker.alysonwalters22.workers.dev/census-lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lat, lon }),
      });

      const data = await response.json();
      return {
        zip: data.zip || 'Unknown',
        population: data.population || 7383,
      };
    } catch (error) {
      console.error('Census lookup error:', error);
      return {
        zip: 'Unknown',
        population: 7383,
      };
    }
  };

  const loadSampleData = () => {
    const samples = [
      {
        id: 1,
        time: '14:30 CST',
        size: 1.75,
        location: 'Fort Worth',
        county: 'Tarrant',
        state: 'TX',
        lat: 32.7555,
        lon: -97.3308,
        comments: 'Golf ball sized hail reported by trained spotter.',
        zipCode: '76102',
        estimatedPopulation: 12450,
      },
      {
        id: 2,
        time: '15:45 CST',
        size: 1.0,
        location: 'Arlington',
        county: 'Tarrant',
        state: 'TX',
        lat: 32.7357,
        lon: -97.1081,
        comments: 'Quarter sized hail observed.',
        zipCode: '76011',
        estimatedPopulation: 8200,
      },
      {
        id: 3,
        time: '16:20 CST',
        size: 2.5,
        location: 'Dallas',
        county: 'Dallas',
        state: 'TX',
        lat: 32.7767,
        lon: -96.7970,
        comments: 'Baseball to softball sized hail. Vehicle damage reported.',
        zipCode: '75201',
        estimatedPopulation: 18500,
      },
    ];

    setHailEvents(samples);
    setFilteredEvents(samples);
    setZipFilter(null);
    setError(dateRange !== 'sample' ? 'Showing sample data for demonstration' : null);
    setLoading(false);
  };

  const handleSearch = async () => {
    if (searchZip.length !== 5) {
      alert('Please enter a valid 5-digit ZIP code');
      return;
    }

    try {
      const response = await fetch(`https://api.zippopotam.us/us/${searchZip}`);
      const data = await response.json();
      const zipLat = parseFloat(data.places[0].latitude);
      const zipLon = parseFloat(data.places[0].longitude);

      setZipFilter({ lat: zipLat, lon: zipLon });
      setMapCenter([zipLat, zipLon]);

      const nearby = hailEvents.filter(event => {
        const distance = getDistance(zipLat, zipLon, event.lat, event.lon);
        return distance <= 50;
      });

      setFilteredEvents(nearby);
      
      if (nearby.length === 0) {
        alert(`No hail events found within 50 miles of ZIP ${searchZip} for this date.`);
      }
    } catch (error) {
      console.error('Zip search error:', error);
      alert('Could not find ZIP code. Please try again.');
    }
  };

  const clearZipFilter = () => {
    setZipFilter(null);
    setSearchZip('');
    setFilteredEvents(hailEvents);
    setMapCenter([32.7555, -97.3308]);
  };

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getSizeColor = (size) => {
    if (size >= 2) return 'bg-red-500';
    if (size >= 1.75) return 'bg-orange-500';
    if (size >= 1) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getSizeLabel = (size) => {
    if (size >= 2.75) return 'Softball';
    if (size >= 2) return 'Baseball';
    if (size >= 1.75) return 'Golf Ball';
    if (size >= 1.5) return 'Ping Pong Ball';
    if (size >= 1.25) return 'Half Dollar';
    if (size >= 1) return 'Quarter';
    if (size >= 0.88) return 'Nickel';
    if (size >= 0.75) return 'Penny';
    return 'Pea';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-block bg-gradient-to-r from-blue-600 to-blue-700 p-4 rounded-3xl shadow-lg mb-4">
            <span className="text-5xl">🧊</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Interactive Hail Damage Map
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Track hail events with satellite imagery and accurate residential impact data
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-xl p-4 mb-8 flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-blue-900 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Search & Filter */}
        <div className="bg-white rounded-3xl shadow-xl p-6 mb-8 border border-gray-100">
          <div className="grid md:grid-cols-3 gap-6">
            {/* ZIP Search */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600" />
                Search by ZIP Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchZip}
                  onChange={(e) => setSearchZip(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter 5-digit ZIP"
                  maxLength="5"
                  className="flex-1 px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">50 mile search radius</p>
              {zipFilter && (
                <button
                  onClick={clearZipFilter}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear filter
                </button>
              )}
            </div>

            {/* Date Selector */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Select Date
              </label>
              <select
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value);
                  if (e.target.value !== 'custom') {
                    setCustomDate('');
                  }
                }}
                className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all mb-2"
              >
                <option value="sample">📊 Sample Data (Demo)</option>
                <option value="today">📅 Today</option>
                <option value="yesterday">⏮️ Yesterday</option>
                <option value="custom">🗓️ Custom Date</option>
              </select>
              
              {dateRange === 'custom' && (
                <div>
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    min="2012-01-01"
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                  <button
                    onClick={() => fetchHailData()}
                    className="w-full mt-3 px-4 py-3 text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-bold shadow-md hover:shadow-lg"
                  >
                    Load Events
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">Historical data from 2012-present</p>
            </div>

            {/* Stats Box */}
            <div className="flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 shadow-lg">
              <div className="text-center text-white">
                <p className="text-5xl font-bold mb-2">{filteredEvents.length}</p>
                <p className="text-sm font-semibold opacity-90">Hail Events Found</p>
              </div>
            </div>
          </div>
        </div>

        {/* Map + List */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden h-[700px] border border-gray-100">
              {loading ? (
                <div className="flex items-center justify-center h-full bg-gradient-to-br from-blue-50 to-gray-50">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-lg font-semibold text-gray-700">Loading map...</p>
                    <p className="text-sm text-gray-500 mt-2">Fetching hail event data</p>
                  </div>
                </div>
              ) : (
                <MapContainer
                  center={mapCenter}
                  zoom={zipFilter ? 10 : 6}
                  style={{ height: '100%', width: '100%' }}
                  className="rounded-3xl"
                >
                  <LayersControl position="topright">
                    <BaseLayer checked name="🗺️ Street Map">
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                    </BaseLayer>
                    <BaseLayer name="🛰️ Satellite View">
                      <TileLayer
                        attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      />
                    </BaseLayer>
                  </LayersControl>
                  <MapUpdater events={filteredEvents} />
                  {filteredEvents.map((event) => (
                    <React.Fragment key={event.id}>
                      <Marker
                        position={[event.lat, event.lon]}
                        icon={createHailIcon(event.size)}
                        eventHandlers={{
                          click: async () => {
                            setSelectedEvent({ ...event, loading: true });
                            if (!event.zipCode) {
                              const locationData = await getZipAndPopulation(event.lat, event.lon);
                              event.zipCode = locationData.zip;
                              event.estimatedPopulation = locationData.population;
                              setSelectedEvent({ ...event, loading: false });
                            } else {
                              setSelectedEvent(event);
                            }
                          },
                        }}
                      >
                        <Popup>
                          <div className="p-3">
                            <p className="font-bold text-gray-900 text-base mb-1">{event.location}, {event.state}</p>
                            <p className="text-xs text-gray-500 mb-2">{event.time}</p>
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${getSizeColor(event.size)}`}></div>
                              <p className="text-sm font-bold text-gray-800">
                                {event.size.toFixed(2)}" ({getSizeLabel(event.size)})
                              </p>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                      <Circle
                        center={[event.lat, event.lon]}
                        radius={8046.72}
                        pathOptions={{
                          color: '#3b82f6',
                          fillColor: '#3b82f6',
                          fillOpacity: 0.08,
                          weight: 2,
                          opacity: 0.4,
                        }}
                      />
                    </React.Fragment>
                  ))}
                </MapContainer>
              )}
            </div>
          </div>

          {/* Events List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-xl p-6 max-h-[700px] overflow-y-auto border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 sticky top-0 bg-white pb-3 border-b border-gray-100">
                <Filter className="w-5 h-5 text-blue-600" />
                Event List
              </h3>

              {loading ? (
                <div className="text-center py-16">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-sm text-gray-500">Loading events...</p>
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-2xl">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-sm font-semibold text-gray-700">No hail events found</p>
                  <p className="text-xs text-gray-500 mt-2">Try a different date or location</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredEvents.map((event) => (
                    <div
                      key={event.id}
                      onClick={async () => {
                        setSelectedEvent({ ...event, loading: true });
                        if (!event.zipCode) {
                          const locationData = await getZipAndPopulation(event.lat, event.lon);
                          event.zipCode = locationData.zip;
                          event.estimatedPopulation = locationData.population;
                          setSelectedEvent({ ...event, loading: false });
                        } else {
                          setSelectedEvent(event);
                        }
                      }}
                      className="p-4 border-2 border-gray-100 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer bg-gradient-to-br from-white to-gray-50"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-3 h-3 rounded-full ${getSizeColor(event.size)} mt-1.5 flex-shrink-0 shadow-sm`}></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate mb-1">
                            {event.location}, {event.state}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                            <Calendar className="w-3 h-3" />
                            <span>{event.time}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                            <Ruler className="w-3 h-3" />
                            <span>{event.size.toFixed(2)}" ({getSizeLabel(event.size)})</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-xl">📏</span>
            Hail Size Reference Guide
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
              <div className="w-4 h-4 rounded-full bg-green-500 shadow-sm"></div>
              <div>
                <p className="text-xs font-bold text-green-900">Pea/Penny</p>
                <p className="text-xs text-green-700">&lt;1 inch</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-xl border border-yellow-200">
              <div className="w-4 h-4 rounded-full bg-yellow-500 shadow-sm"></div>
              <div>
                <p className="text-xs font-bold text-yellow-900">Quarter</p>
                <p className="text-xs text-yellow-700">1-1.75"</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl border border-orange-200">
              <div className="w-4 h-4 rounded-full bg-orange-500 shadow-sm"></div>
              <div>
                <p className="text-xs font-bold text-orange-900">Golf Ball</p>
                <p className="text-xs text-orange-700">1.75-2"</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-200">
              <div className="w-4 h-4 rounded-full bg-red-500 shadow-sm"></div>
              <div>
                <p className="text-xs font-bold text-red-900">Baseball+</p>
                <p className="text-xs text-red-700">2+ inches</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Data from <span className="font-semibold">NOAA Storm Prediction Center</span> • Historical records 2012-Present
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Population estimates from <span className="font-semibold">US Census Bureau</span>
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full border border-blue-200">
            <span className="text-sm font-bold text-blue-700">100% Free Forever</span>
            <span className="text-blue-600">•</span>
            <span className="text-sm text-blue-600">No subscriptions required</span>
          </div>
        </div>
      </div>

      {/* Selected Event Modal */}
{selectedEvent && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]" onClick={() => setSelectedEvent(null)}>
    <div className="bg-white rounded-3xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Event Details</h3>
          <p className="text-sm text-gray-500 mt-1">Comprehensive impact report</p>
        </div>
        <button 
          onClick={() => setSelectedEvent(null)} 
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <X className="w-6 h-6 text-gray-400" />
        </button>
      </div>
      
      {selectedEvent.loading ? (
        <div className="text-center py-16">
          <Loader className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-gray-700">Loading data...</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="p-4 bg-gradient-to-br from-blue-50 to-gray-50 rounded-2xl border border-blue-100">
            <label className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2 block">Location</label>
            <p className="text-base font-semibold text-gray-900">{selectedEvent.location}, {selectedEvent.county} County, {selectedEvent.state}</p>
          </div>
          
          {selectedEvent.zipCode && selectedEvent.zipCode !== 'Unknown' && (
            <div className="p-4 bg-gradient-to-br from-green-50 to-gray-50 rounded-2xl border border-green-100">
              <label className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2 block flex items-center gap-2">
                <MapPinIcon className="w-3 h-3" />
                ZIP Code
              </label>
              <p className="text-lg font-bold text-gray-900">{selectedEvent.zipCode}</p>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gradient-to-br from-purple-50 to-gray-50 rounded-2xl border border-purple-100">
              <label className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2 block">Time</label>
              <p className="text-sm font-semibold text-gray-900">{selectedEvent.time}</p>
            </div>
            
            <div className="p-4 bg-gradient-to-br from-orange-50 to-gray-50 rounded-2xl border border-orange-100">
              <label className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-2 block">Hail Size</label>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getSizeColor(selectedEvent.size)} shadow-sm`}></div>
                <p className="text-sm font-bold text-gray-900">
                  {selectedEvent.size.toFixed(2)}" 
                </p>
              </div>
              <p className="text-xs text-gray-600 mt-1">({getSizeLabel(selectedEvent.size)})</p>
            </div>
          </div>
          
          {selectedEvent.estimatedPopulation > 0 && (
            <div className="p-5 bg-gradient-to-br from-yellow-50 to-gray-50 rounded-2xl border-2 border-yellow-200">
              <label className="text-xs font-bold text-yellow-800 uppercase tracking-wide mb-3 block flex items-center gap-2">
                <Users className="w-4 h-4" />
                Impact Assessment
              </label>
              <p className="text-2xl font-bold text-gray-900 mb-1">
                ~{selectedEvent.estimatedPopulation.toLocaleString()}
              </p>
              <p className="text-xs text-gray-600">people within 5-mile impact radius</p>
              <p className="text-xs text-gray-500 mt-2 italic">Based on 2020 US Census data</p>
            </div>
          )}

          {/* Property Data Section */}
          {!selectedEvent.propertyData ? (
            <button
              onClick={async () => {
                setSelectedEvent({ ...selectedEvent, loadingProperty: true });
                try {
                  const response = await fetch('https://hail-spectrum-worker.alysonwalters22.workers.dev/property-lookup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lat: selectedEvent.lat, lon: selectedEvent.lon }),
                  });
                  const propertyData = await response.json();
                  setSelectedEvent({ ...selectedEvent, propertyData, loadingProperty: false });
                } catch (error) {
                  console.error('Property lookup error:', error);
                  setSelectedEvent({ ...selectedEvent, loadingProperty: false });
                }
              }}
              disabled={selectedEvent.loadingProperty}
              className="w-full p-5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl hover:from-indigo-700 hover:to-indigo-800 transition-all font-bold shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              {selectedEvent.loadingProperty ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Loading Property Data...
                </>
              ) : (
                <>
                  🏠 View Property Details
                </>
              )}
            </button>
          ) : selectedEvent.propertyData.error ? (
            <div className="p-4 bg-red-50 rounded-2xl border border-red-200">
              <p className="text-sm text-red-800">Property data not available for this location</p>
            </div>
          ) : (
            <div className="p-5 bg-gradient-to-br from-indigo-50 to-gray-50 rounded-2xl border-2 border-indigo-200">
              <label className="text-xs font-bold text-indigo-800 uppercase tracking-wide mb-3 block flex items-center gap-2">
                🏠 Property Information
              </label>
              <div className="space-y-2 text-sm">
                {selectedEvent.propertyData.address && (
                  <div>
                    <span className="font-semibold text-gray-700">Address:</span>
                    <p className="text-gray-900">{selectedEvent.propertyData.address}</p>
                  </div>
                )}
                {selectedEvent.propertyData.propertyType && selectedEvent.propertyData.propertyType !== 'Unknown' && (
                  <div>
                    <span className="font-semibold text-gray-700">Type:</span>
                    <span className="text-gray-900 ml-2">{selectedEvent.propertyData.propertyType}</span>
                  </div>
                )}
                {selectedEvent.propertyData.yearBuilt && (
                  <div>
                    <span className="font-semibold text-gray-700">Year Built:</span>
                    <span className="text-gray-900 ml-2">{selectedEvent.propertyData.yearBuilt}</span>
                  </div>
                )}
                {selectedEvent.propertyData.sqft && (
                  <div>
                    <span className="font-semibold text-gray-700">Square Feet:</span>
                    <span className="text-gray-900 ml-2">{selectedEvent.propertyData.sqft.toLocaleString()} sq ft</span>
                  </div>
                )}
                {selectedEvent.propertyData.bedrooms && (
                  <div>
                    <span className="font-semibold text-gray-700">Bedrooms:</span>
                    <span className="text-gray-900 ml-2">{selectedEvent.propertyData.bedrooms}</span>
                  </div>
                )}
                {selectedEvent.propertyData.bathrooms && (
                  <div>
                    <span className="font-semibold text-gray-700">Bathrooms:</span>
                    <span className="text-gray-900 ml-2">{selectedEvent.propertyData.bathrooms}</span>
                  </div>
                )}
                {selectedEvent.propertyData.assessedValue && (
                  <div className="pt-2 mt-2 border-t border-indigo-200">
                    <span className="font-semibold text-gray-700">Assessed Value:</span>
                    <span className="text-gray-900 ml-2 text-lg font-bold">${selectedEvent.propertyData.assessedValue.toLocaleString()}</span>
                  </div>
                )}
                {selectedEvent.propertyData.marketValue && (
                  <div>
                    <span className="font-semibold text-gray-700">Market Value:</span>
                    <span className="text-gray-900 ml-2 text-lg font-bold">${selectedEvent.propertyData.marketValue.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {selectedEvent.comments && (
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2 block">Spotter Report</label>
              <p className="text-sm text-gray-800 leading-relaxed">{selectedEvent.comments}</p>
            </div>
          )}
          
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2 block">Coordinates</label>
            <p className="text-sm font-mono text-gray-900">
              {selectedEvent.lat.toFixed(6)}°N, {selectedEvent.lon.toFixed(6)}°W
            </p>
          </div>
        </div>
      )}
      
      <button
        onClick={() => setSelectedEvent(null)}
        className="mt-6 w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 text-sm rounded-2xl hover:from-blue-700 hover:to-blue-800 transition-all font-bold shadow-lg hover:shadow-xl"
      >
        Close Details
      </button>
    </div>
  </div>
)}
    </div>
  );
}