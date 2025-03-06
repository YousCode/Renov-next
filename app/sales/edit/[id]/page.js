"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSave,
  faFile,
  faCopy,
  faDownload,
} from "@fortawesome/free-solid-svg-icons";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// --- Constantes de configuration -----------------------------------

// Taux TVA par défaut (ex. 0.2 => 20%)
const TVA_RATE_DEFAULT = 0.2;

// Champs obligatoires
const REQUIRED_FIELDS = ["NOM DU CLIENT", "prenom", "ADRESSE DU CLIENT"];

// Champs à exclure pour le CSV
const EXCLUDED_FIELDS = ["_id", "createdAt", "updatedAt", "__v"];

// Valeurs par défaut
const DEFAULT_SALE = {
  "NUMERO BC": "",
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
  "TAUX TVA": "10",  // Par défaut 10%
  "MONTANT HT": "",
  "MONTANT TTC": "",
  "MONTANT ANNULE": "",
  ETAT: "",
  "PREVISION CHANTIER": "",
  OBSERVATION: "",
};

/**
 * Convertit une chaîne ISO en objet Date (ou null si invalide).
 */
function parseISODate(str) {
  if (!str) return null;
  const dateObj = new Date(str);
  return isNaN(dateObj.getTime()) ? null : dateObj;
}

export default function EditSale() {
  const { id } = useParams();           
  const router = useRouter();
  const searchParams = useSearchParams();
  const saleDateParam = searchParams.get("date");

  // État de la vente
  const [sale, setSale] = useState(null);

  // Dates pour react-datepicker
  const [saleDate, setSaleDate] = useState(null);
  const [prevChantierDate, setPrevChantierDate] = useState(null);

  // États de chargement, d'erreur et de notification
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // ─────────────────────────────────────────────────────────
  // 1. Récupération (GET /api/ventes/:id)
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchSale() {
      setLoading(true);
      try {
        const res = await fetch(`/api/ventes/${id}`, { credentials: "include" });
        if (!res.ok) {
          throw new Error(`Échec de la récupération : ${res.status}`);
        }
        const data = await res.json();
        const vente = data.data;

        // Convertit en Date
        const dateDeVente = parseISODate(vente["DATE DE VENTE"]);
        const prevDateChantier = parseISODate(vente["PREVISION CHANTIER"]);

        if (dateDeVente) {
          setSaleDate(dateDeVente);
        } else if (saleDateParam) {
          const paramDate = parseISODate(saleDateParam);
          setSaleDate(paramDate || new Date());
        } else {
          setSaleDate(new Date());
        }

        if (prevDateChantier) {
          setPrevChantierDate(prevDateChantier);
        }

        setSale(vente);
      } catch (err) {
        setError(`Erreur : ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    fetchSale();
  }, [id, saleDateParam]);

  // ─────────────────────────────────────────────────────────
  // 2. Gère les changements d'inputs
  // ─────────────────────────────────────────────────────────
  function handleInputChange(e) {
    if (!sale) return;
    const { name, value } = e.target;

    setSale((prev) => {
      const updated = { ...prev, [name]: value };

      // 2A) Gestion TVA
      if (name === "TAUX TVA") {
        let tvaPourcent = parseFloat(value);
        if (isNaN(tvaPourcent)) {
          tvaPourcent = 10;
        }
        if (tvaPourcent > 100) {
          tvaPourcent = tvaPourcent / 100;
        }
        if (tvaPourcent < 5.5) tvaPourcent = 5.5;
        if (tvaPourcent > 20) tvaPourcent = 20;

        updated["TAUX TVA"] = String(tvaPourcent);
      }

      // 2B) Recalcul Montant HT
      if (name === "MONTANT TTC" || name === "TAUX TVA") {
        const montantTTC = parseFloat(updated["MONTANT TTC"]) || 0;
        const tvaPourcent =
          parseFloat(updated["TAUX TVA"]) || TVA_RATE_DEFAULT * 100;
        const tvaDecimal = tvaPourcent / 100;

        const ht = montantTTC / (1 + tvaDecimal);
        updated["MONTANT HT"] = ht > 0 ? ht.toFixed(2) : "0.00";
      }

      // 2C) Si on veut "NUMERO BC" = "MONTANT TTC"
      // => On copie la valeur
      if (name === "MONTANT TTC") {
        updated["NUMERO BC"] = value;
      }

      return updated;
    });
  }

  // ─────────────────────────────────────────────────────────
  // 3. Sauvegarde (PUT /api/ventes/:id)
  // ─────────────────────────────────────────────────────────
  async function handleSave(e) {
    e.preventDefault();
    if (!sale) return;

    // Vérifie champs obligatoires
    const missing = REQUIRED_FIELDS.filter(
      (field) => !sale[field] || sale[field].trim() === ""
    );
    if (missing.length > 0) {
      setNotification({
        type: "error",
        message: `Champs obligatoires manquants : ${missing.join(", ")}`,
      });
      return;
    }

    // Convertit les dates => ISO
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
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (err) {
      setNotification({ type: "error", message: `Erreur : ${err.message}` });
    }
  }

  // ─────────────────────────────────────────────────────────
  // 4. CSV (copie / téléchargement)
  // ─────────────────────────────────────────────────────────
  function handleCopyCSV() {
    if (!sale) return;
    const entries = Object.entries(sale).filter(
      ([key]) => !EXCLUDED_FIELDS.includes(key)
    );
    const line = entries.map(([_, v]) => (v == null ? "" : v)).join(";");

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
  }

  function handleDownloadCSV() {
    if (!sale) return;
    const entries = Object.entries(sale).filter(
      ([key]) => !EXCLUDED_FIELDS.includes(key)
    );
    const headers = entries.map(([key]) => key).join(";");
    const values = entries.map(([_, v]) => (v == null ? "" : v)).join(";");
    const csv = `${headers}\n${values}`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `vente_${id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ─────────────────────────────────────────────────────────
  // 5. Accès Fichier
  // ─────────────────────────────────────────────────────────
  function handleFileAction(saleId) {
    router.push(`/file/details/${saleId}`);
  }

  // ─────────────────────────────────────────────────────────
  // 6. Chargement / Erreur
  // ─────────────────────────────────────────────────────────
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

  // Fusion objet récupéré + valeurs par défaut
  const currentSale = { ...DEFAULT_SALE, ...sale };

  // ─────────────────────────────────────────────────────────
  // 7. Rendu du formulaire
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-200 to-gray-600">
      <Navbar />

      <div className="max-w-5xl mx-auto py-8 px-4">
        <h2 className="text-3xl text-white font-bold mb-6 text-center">
          Compléter la vente
        </h2>

        {/* Notification */}
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
            {/* Date de Vente */}
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

            {/* NUMERO BC : mis à jour quand "MONTANT TTC" change */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                NUMERO BC (identique à Montant TTC)
              </label>
              <input
                type="text"
                name="NUMERO BC"
                value={currentSale["NUMERO BC"]}
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

            {/* ADRESSE DU CLIENT */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                ADRESSE DU CLIENT
              </label>
              <input
                type="text"
                name="ADRESSE DU CLIENT"
                value={currentSale["ADRESSE DU CLIENT"]}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
                required
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

            {/* MONTANT HT (lecture seule) */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                Montant HT (calculé)
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

            {/* Prévision Chantier */}
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

          {/* Boutons d'action */}
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            {/* Valider */}
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
              title="Copier la vente en CSV"
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