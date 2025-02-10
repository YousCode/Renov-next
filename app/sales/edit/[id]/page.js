"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import PlacesAutocomplete, {
  geocodeByAddress,
  getLatLng,
} from "react-places-autocomplete";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSave,
  faFile,
  faCopy,
  faDownload,
} from "@fortawesome/free-solid-svg-icons";

////////////////////////////////////////////////////////////////////////
// Composant interne AddressAutocomplete pour le champ d’adresse
////////////////////////////////////////////////////////////////////////
function AddressAutocomplete({ value, onChange }) {
  const [address, setAddress] = useState(value || "");

  // Sélection dans la liste de suggestions
  const handleSelect = async (selected) => {
    setAddress(selected);
    onChange(selected); // On remonte la nouvelle valeur vers le parent

    // Optionnel : géocoder l’adresse pour obtenir lat/lng
    try {
      const results = await geocodeByAddress(selected);
      const latLng = await getLatLng(results[0]);
      console.log("Coordonnées lat/lng :", latLng);
    } catch (err) {
      console.error("Erreur géocodage :", err);
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
        // Facultatif : Restreindre à la France (ou autre) si souhaité :
        componentRestrictions: { country: ["fr"] },
      }}
    >
      {({ getInputProps, suggestions, getSuggestionItemProps, loading }) => (
        <div>
          <input
            {...getInputProps({
              placeholder: "Saisissez une adresse",
              className: "border border-gray-300 p-2 rounded-md w-full",
            })}
          />
          <div className="border border-gray-300 bg-white">
            {loading && <div className="p-2">Chargement...</div>}
            {suggestions.map((suggestion, idx) => {
              const className = suggestion.active
                ? "p-2 bg-gray-200 cursor-pointer"
                : "p-2 bg-white cursor-pointer";
              return (
                <div
                  key={idx}
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

////////////////////////////////////////////////////////////////////////
// Fonctions utilitaires pour les dates
////////////////////////////////////////////////////////////////////////
const TVA_RATE_DEFAULT = 0.2;

/**
 * parseIsoString("2025-02-10T10:00:00Z") => new Date(2025, 1, 10, 10, 0, 0)
 */
function parseIsoString(str) {
  if (!str) return null;
  const dateObj = new Date(str);
  return isNaN(dateObj.getTime()) ? null : dateObj;
}

////////////////////////////////////////////////////////////////////////
// Composant principal : EditSale
////////////////////////////////////////////////////////////////////////
export default function EditSale() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const saleDateParam = searchParams.get("date");

  // État local : infos de la vente
  const [sale, setSale] = useState(null);

  // État local : dates (objet Date)
  const [saleDate, setSaleDate] = useState(null);
  const [prevChantierDate, setPrevChantierDate] = useState(null);

  // Loading, erreurs, notifications
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Champs à exclure du CSV
  const excludedFields = ["_id", "createdAt", "updatedAt", "__v"];

  ////////////////////////////////////////////////////////////////////////
  // 1. Récupération de la vente (GET)
  ////////////////////////////////////////////////////////////////////////
  useEffect(() => {
    const fetchSale = async () => {
      setLoading(true);
      try {
        // On suppose que vous avez une route /api/ventes/[id]
        const res = await fetch(`/api/ventes/${id}`, { credentials: "include" });
        if (!res.ok) {
          throw new Error(`Échec de récupération : ${res.status}`);
        }
        const data = await res.json();
        const vente = data.data;

        // Conversion de la date en objet Date
        const dateDeVente = parseIsoString(vente["DATE DE VENTE"]);
        const dateChantier = parseIsoString(vente["PREVISION CHANTIER"]);

        // Si pas de date, on regarde s'il y a un param "date" dans l'URL, sinon date du jour
        if (dateDeVente) {
          setSaleDate(dateDeVente);
        } else if (saleDateParam) {
          const paramDateObj = parseIsoString(saleDateParam);
          setSaleDate(paramDateObj || new Date());
        } else {
          setSaleDate(new Date());
        }

        // Pour la prévision de chantier
        if (dateChantier) {
          setPrevChantierDate(dateChantier);
        }

        setSale(vente);
      } catch (err) {
        setError(`Erreur : ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSale();
  }, [id, saleDateParam]);

  ////////////////////////////////////////////////////////////////////////
  // 2. handleInputChange
  ////////////////////////////////////////////////////////////////////////
  const handleInputChange = (e) => {
    if (!sale) return;
    const { name, value } = e.target;

    setSale((prev) => {
      const updated = { ...prev, [name]: value };

      // Gérer la TVA
      if (name === "TAUX TVA") {
        let tvaPourcent = parseFloat(value);
        if (isNaN(tvaPourcent)) {
          tvaPourcent = 10;
        }
        // Ex : si 550 => 5.5, si 100 => 1, etc.
        if (tvaPourcent > 100) {
          tvaPourcent = tvaPourcent / 100;
        }
        // On borne [5.5, 20]
        if (tvaPourcent < 5.5) tvaPourcent = 5.5;
        if (tvaPourcent > 20) tvaPourcent = 20;
        updated["TAUX TVA"] = String(tvaPourcent);
      }

      // Recalcul MONTANT HT si MONTANT TTC ou TAUX TVA changent
      if (name === "MONTANT TTC" || name === "TAUX TVA") {
        const montantTTC = parseFloat(updated["MONTANT TTC"]) || 0;
        let tvaPourcent =
          parseFloat(updated["TAUX TVA"]) || TVA_RATE_DEFAULT * 100;
        const tvaDecimal = tvaPourcent / 100;
        const ht = montantTTC / (1 + tvaDecimal);
        updated["MONTANT HT"] = ht > 0 ? ht.toFixed(2) : "0.00";
      }

      return updated;
    });
  };

  ////////////////////////////////////////////////////////////////////////
  // 2B. handleAddressChange
  ////////////////////////////////////////////////////////////////////////
  // Pour l'auto-complétion
  const handleAddressChange = (newAddress) => {
    if (!sale) return;
    setSale((prev) => ({
      ...prev,
      ["ADRESSE DU CLIENT"]: newAddress,
    }));
  };

  ////////////////////////////////////////////////////////////////////////
  // 3. Sauvegarde (PUT)
  ////////////////////////////////////////////////////////////////////////
  const handleSave = async (e) => {
    e.preventDefault();
    if (!sale) return;

    // Vérification champs obligatoires
    const required = ["NOM DU CLIENT", "prenom", "ADRESSE DU CLIENT"];
    const missing = required.filter((f) => !sale[f]);
    if (missing.length > 0) {
      setNotification({
        type: "error",
        message: `Champs obligatoires manquants : ${missing.join(", ")}`,
      });
      return;
    }

    // Convertir les dates en ISO
    sale["DATE DE VENTE"] = saleDate ? saleDate.toISOString() : "";
    sale["PREVISION CHANTIER"] = prevChantierDate
      ? prevChantierDate.toISOString()
      : "";

    try {
      const res = await fetch(`/api/ventes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(sale),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || `Erreur : ${res.status}`);
      }

      setNotification({
        type: "success",
        message: "Vente mise à jour avec succès !",
      });
      // Redirection ou retour
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (err) {
      setNotification({
        type: "error",
        message: `Erreur : ${err.message}`,
      });
    }
  };

  ////////////////////////////////////////////////////////////////////////
  // 4. CSV
  ////////////////////////////////////////////////////////////////////////
  const handleCopyCSV = () => {
    if (!sale) return;
    const entries = Object.entries(sale).filter(
      ([k]) => !excludedFields.includes(k)
    );
    const line = entries.map(([_, v]) => v || "").join(";");
    navigator.clipboard
      .writeText(line)
      .then(() => {
        setNotification({
          type: "success",
          message: "CSV copié dans le presse-papiers !",
        });
      })
      .catch(() => {
        setNotification({
          type: "error",
          message: "Erreur lors de la copie CSV.",
        });
      });
  };

  const handleDownloadCSV = () => {
    if (!sale) return;
    const entries = Object.entries(sale).filter(
      ([k]) => !excludedFields.includes(k)
    );
    const headers = entries.map(([k]) => k).join(";");
    const values = entries.map(([_, v]) => v || "").join(";");
    const csv = headers + "\n" + values;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vente_${id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  ////////////////////////////////////////////////////////////////////////
  // 5. Accès au fichier (redirect)
  ////////////////////////////////////////////////////////////////////////
  const handleFileAction = (saleId) => {
    router.push(`/file/details/${saleId}`);
  };

  ////////////////////////////////////////////////////////////////////////
  // 6. ÉTATS DE CHARGEMENT / ERREURS
  ////////////////////////////////////////////////////////////////////////
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Chargement...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }
  if (!sale) return null;

  ////////////////////////////////////////////////////////////////////////
  // Valeurs par défaut (au cas où certaines clés n'existent pas)
  ////////////////////////////////////////////////////////////////////////
  const defaultSale = {
    NUMERO_BC: "",
    CIVILITE: "",
    "NOM DU CLIENT": "",
    prenom: "",
    "ADRESSE DU CLIENT": "",
    "CODE INTERP etage": "",
    VILLE: "",
    CP: "",
    TELEPHONE: "",
    VENDEUR: "",
    DESIGNATION: "",
    "TAUX TVA": "10",
    "MONTANT HT": "",
    "MONTANT TTC": "",
    "MONTANT ANNULE": "",
    ETAT: "",
    "PREVISION CHANTIER": "",
    OBSERVATION: "",
  };

  // Fusion
  const currentSale = { ...defaultSale, ...sale };

  ////////////////////////////////////////////////////////////////////////
  // RENDER
  ////////////////////////////////////////////////////////////////////////
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-200 to-gray-600">
      {/* Si vous avez un composant Navbar, décommentez */}
      {/* <Navbar /> */}

      <div className="max-w-5xl mx-auto py-8 px-4">
        <h2 className="text-3xl text-white font-bold mb-6 text-center">
          Compléter la vente
        </h2>

        {notification && (
          <div
            className={`p-4 rounded-md mb-6 ${
              notification.type === "success"
                ? "bg-green-500 text-white"
                : "bg-red-500 text-white"
            }`}
          >
            {notification.message}
          </div>
        )}

        <form
          onSubmit={handleSave}
          className="bg-white bg-opacity-90 rounded-lg shadow-2xl p-6"
        >
          <div className="grid grid-cols-2 gap-6">
            {/* DATE DE VENTE */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                Date de Vente
              </label>
              <DatePicker
                selected={saleDate}
                onChange={(date) => setSaleDate(date)}
                dateFormat="dd/MM/yyyy"
                className="border border-gray-300 p-2 rounded-md w-full"
              />
            </div>

            {/* NUMERO_BC */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                NUMERO BC
              </label>
              <input
                type="text"
                name="NUMERO_BC"
                value={currentSale.NUMERO_BC}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
              />
            </div>

            {/* CIVILITE */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                CIVILITE
              </label>
              <input
                type="text"
                name="CIVILITE"
                value={currentSale.CIVILITE}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
              />
            </div>

            {/* NOM DU CLIENT */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                NOM DU CLIENT
              </label>
              <input
                type="text"
                name="NOM DU CLIENT"
                value={currentSale["NOM DU CLIENT"]}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
                required
              />
            </div>

            {/* prenom */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                prenom
              </label>
              <input
                type="text"
                name="prenom"
                value={currentSale.prenom}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
                required
              />
            </div>

            {/* ADRESSE DU CLIENT (auto-complétion) */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                ADRESSE DU CLIENT
              </label>
              <AddressAutocomplete
                value={currentSale["ADRESSE DU CLIENT"]}
                onChange={handleAddressChange}
              />
            </div>

            {/* CODE INTERP etage */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                CODE INTERP etage
              </label>
              <input
                type="text"
                name="CODE INTERP etage"
                value={currentSale["CODE INTERP etage"]}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
              />
            </div>

            {/* VILLE */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                VILLE
              </label>
              <input
                type="text"
                name="VILLE"
                value={currentSale.VILLE}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
              />
            </div>

            {/* CP */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                CP
              </label>
              <input
                type="text"
                name="CP"
                value={currentSale.CP}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
              />
            </div>

            {/* TELEPHONE */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                TELEPHONE
              </label>
              <input
                type="text"
                name="TELEPHONE"
                value={currentSale.TELEPHONE}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
              />
            </div>

            {/* VENDEUR */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                VENDEUR
              </label>
              <input
                type="text"
                name="VENDEUR"
                value={currentSale.VENDEUR}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
              />
            </div>

            {/* DESIGNATION */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                DESIGNATION
              </label>
              <input
                type="text"
                name="DESIGNATION"
                value={currentSale.DESIGNATION}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
              />
            </div>

            {/* TAUX TVA */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                TAUX TVA (%)
              </label>
              <select
                name="TAUX TVA"
                value={currentSale["TAUX TVA"]}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
              >
                <option value="5.5">5.5%</option>
                <option value="10">10%</option>
                <option value="20">20%</option>
                <option value="0">0%</option>
              </select>
            </div>

            {/* MONTANT HT (Calculé) */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                Montant HT (Calculé)
              </label>
              <input
                type="text"
                name="MONTANT HT"
                value={currentSale["MONTANT HT"]}
                readOnly
                className="border border-gray-300 p-2 rounded-md w-full bg-gray-100 cursor-not-allowed"
              />
            </div>

            {/* MONTANT TTC */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                MONTANT TTC
              </label>
              <input
                type="number"
                name="MONTANT TTC"
                value={currentSale["MONTANT TTC"]}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
                step="0.01"
                min="0"
              />
            </div>

            {/* MONTANT ANNULE */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                MONTANT ANNULE
              </label>
              <input
                type="number"
                name="MONTANT ANNULE"
                value={currentSale["MONTANT ANNULE"]}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
                step="0.01"
                min="0"
              />
            </div>

            {/* ETAT */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                ETAT
              </label>
              <select
                name="ETAT"
                value={currentSale.ETAT}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
              >
                <option value="">Sélectionner un état</option>
                <option value="En attente">En attente</option>
                <option value="Confirmé">Confirmé</option>
                <option value="Annulé">Annulé</option>
              </select>
            </div>

            {/* PREVISION CHANTIER */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                Prévision Chantier
              </label>
              <DatePicker
                selected={prevChantierDate}
                onChange={(date) => setPrevChantierDate(date)}
                dateFormat="dd/MM/yyyy"
                className="border border-gray-300 p-2 rounded-md w-full"
              />
            </div>

            {/* OBSERVATION */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                OBSERVATION
              </label>
              <input
                type="text"
                name="OBSERVATION"
                value={currentSale.OBSERVATION}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
              />
            </div>
          </div>

          {/* Boutons */}
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            {/* Validation */}
            <button
              type="submit"
              className="bg-blue-500 text-white py-2 px-6 rounded-md hover:bg-blue-600"
            >
              <FontAwesomeIcon icon={faSave} /> Valider
            </button>
            {/* Fichier */}
            <button
              type="button"
              onClick={() => handleFileAction(id)}
              className="bg-gray-500 text-white py-2 px-6 rounded-md hover:bg-gray-600"
            >
              <FontAwesomeIcon icon={faFile} /> Fichier
            </button>
            {/* Copier CSV */}
            <button
              type="button"
              onClick={handleCopyCSV}
              className="bg-purple-500 text-white py-2 px-6 rounded-md hover:bg-purple-600"
            >
              <FontAwesomeIcon icon={faCopy} /> Copier CSV
            </button>
            {/* Télécharger CSV */}
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="bg-green-500 text-white py-2 px-6 rounded-md hover:bg-green-600"
            >
              <FontAwesomeIcon icon={faDownload} /> Télécharger CSV
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}