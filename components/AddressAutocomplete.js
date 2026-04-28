"use client";

import React, { useEffect, useRef, useState } from "react";

const BAN_URL = "https://api-adresse.data.gouv.fr/search/";

const AddressAutocomplete = ({
  value,
  onChange,
  onSelect,
  className = "border p-2 rounded w-full",
  placeholder = "Adresse",
  inputProps = {},
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = (q) => {
    if (abortRef.current) abortRef.current.abort();
    if (!q || q.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    fetch(`${BAN_URL}?q=${encodeURIComponent(q)}&limit=6&autocomplete=1`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { features: [] }))
      .then((data) => {
        setSuggestions(data.features || []);
        setOpen(true);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setSuggestions([]);
      })
      .finally(() => setLoading(false));
  };

  const handleChange = (e) => {
    const v = e.target.value;
    onChange?.(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 200);
  };

  const handlePick = (feat) => {
    const p = feat.properties || {};
    const street = [p.housenumber, p.street].filter(Boolean).join(" ") || p.name || "";
    onSelect?.({
      address: street,
      city: p.city || "",
      postcode: p.postcode || "",
      label: p.label || "",
      raw: p,
    });
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value || ""}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        autoComplete="off"
        placeholder={placeholder}
        className={className}
        {...inputProps}
      />
      {loading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">…</div>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-auto bg-white border border-gray-300 rounded shadow-lg text-sm text-gray-900">
          {suggestions.map((feat) => (
            <li
              key={feat.properties?.id || feat.properties?.label}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
              onMouseDown={(e) => {
                e.preventDefault();
                handlePick(feat);
              }}
            >
              {feat.properties?.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AddressAutocomplete;
