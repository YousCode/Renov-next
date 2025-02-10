// components/AddressAutocomplete.jsx
"use client";

import React, { useState } from "react";
import PlacesAutocomplete, {
  geocodeByAddress,
  getLatLng,
} from "react-places-autocomplete";

/**
 * Ce composant gère un champ d'adresse avec auto-complétion Google.
 * Il nécessite un script Google Maps avec "libraries=places" et votre API key.
 */
function AddressAutocomplete({ value, onChange }) {
  const [address, setAddress] = useState(value || "");

  // Sélection d'une suggestion
  const handleSelect = async (selected) => {
    setAddress(selected);
    onChange(selected); // Remonte la nouvelle adresse au parent

    try {
      // Si vous voulez récupérer lat/lng :
      const results = await geocodeByAddress(selected);
      const latLng = await getLatLng(results[0]);
      console.log("Coordonnées lat/lng:", latLng);
    } catch (error) {
      console.error("Erreur de géocodage:", error);
    }
  };

  return (
    <PlacesAutocomplete
      value={address}
      onChange={(val) => {
        setAddress(val);
        onChange(val);
      }}
      onSelect={handleSelect}
      searchOptions={{
        // Restreindre à la France par exemple :
        componentRestrictions: { country: ["fr"] },
      }}
    >
      {({ getInputProps, suggestions, getSuggestionItemProps, loading }) => (
        <div>
          <input
            {...getInputProps({
              placeholder: "Saisissez une adresse...",
              className: "border border-gray-300 p-2 rounded-md w-full",
            })}
          />
          <div className="border border-gray-300 bg-white">
            {loading && <div className="p-2">Chargement...</div>}
            {suggestions.map((suggestion, index) => {
              const className = suggestion.active
                ? "p-2 bg-gray-200 cursor-pointer"
                : "p-2 bg-white cursor-pointer";
              return (
                <div
                  key={index}
                  {...getSuggestionItemProps(suggestion, {
                    className,
                  })}
                >
                  {suggestion.description}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </PlacesAutocomplete>
  );
}

export default AddressAutocomplete;