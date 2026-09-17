import React, { useState, useEffect } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';

interface LocationResult {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    hospital?: string;
  };
}

interface LocationPickerProps {
  label: string;
  placeholder: string;
  onSelect: (data: { areaLabel: string; fullAddress: string; lat: number; lng: number }) => void;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({ label, placeholder, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedText, setSelectedText] = useState('');

  useEffect(() => {
    if (!query || query.trim().length < 3 || query === selectedText) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
            query.trim()
          )}&addressdetails=1&limit=8&accept-language=ar`,
          {
            headers: {
              'Accept-Language': 'ar',
            },
            signal: controller.signal,
          }
        );
        if (!response.ok) throw new Error('Geocoding error');
        const data = await response.json();
        setResults(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedText]);

  const handlePick = (item: LocationResult) => {
    const area =
      item.address.suburb ||
      item.address.neighbourhood ||
      item.address.hospital ||
      item.address.city ||
      item.display_name.split(',')[0];

    setSelectedText(item.display_name);
    setQuery(item.display_name);
    setResults([]);

    onSelect({
      areaLabel: area.trim(),
      fullAddress: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    });
  };

  return (
    <div className="relative w-full space-y-1 text-right">
      <label className="block text-sm font-semibold text-[#1F2430]">{label}</label>
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full h-[52px] pr-10 pl-4 bg-white border border-[#8A949E] rounded-xl text-base text-[#1F2430] placeholder:text-[#6B7280] focus:border-[#2F6FED] focus:outline-none transition-colors"
        />
        <div className="absolute right-3 text-[#6B7280]">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
        </div>
      </div>

      {results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-[#8A949E] rounded-xl shadow-lg overflow-hidden divide-y divide-[#EEF0EF]">
          {results.map((r, i) => (
            <li
              key={i}
              onClick={() => handlePick(r)}
              className="p-3 text-sm text-[#1F2430] hover:bg-[#F7F8F9] cursor-pointer flex items-start gap-2"
            >
              <MapPin className="w-4 h-4 text-[#1E8E5A] shrink-0 mt-0.5" />
              <span className="line-clamp-2">{r.display_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
