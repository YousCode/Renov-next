"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSave, faFile, faCopy, faDownload } from "@fortawesome/free-solid-svg-icons";

// 1) Import de react-datepicker et son CSS
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// Taux de TVA par défaut
const TVA_RATE_DEFAULT = 20;

/**
 * Convertit un objet Date JavaScript en string "dd/MM/yyyy"
 * @param {Date} dateObj
 * @returns {string} ex: "05/09/2023"
 */
function formatDateDDMMYYYY(dateObj) {
  if (!(dateObj instanceof Date)) return "";
  const d = String(dateObj.getDate()).padStart(2, "0");
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const y = dateObj.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * parseDateString("05/09/2023") => Date(2023, 8, 5)
 * parseDateString("2023-09-05T12:00:00Z") => Date(2023,8,5,12,0,0)
 * Gère différents formats
 */
function parseDateString(str) {
  if (!str) return null;
  // Cas format ISO ou string commençant par yyyy-mm-dd
  if (str.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(str)) {
    return new Date(str);
  }
  // Cas "dd/mm/yyyy"
  if (str.includes("/")) {
    const [jour, mois, annee] = str.split("/");
    return new Date(Number(annee), Number(mois) - 1, Number(jour));
  }
  // Sinon, fallback => new Date() (now)
  return new Date();
}

const EditSale = () => {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const saleDateParam = searchParams.get("date"); // ?date=...

  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [notification, setNotification] = useState(null);

  // 2) On gère deux états date (type Date) côté client :
  //    - date de vente
  //    - prévision chantier
  const [saleDate, setSaleDate] = useState(null);
  const [prevChantierDate, setPrevChantierDate] = useState(null);

  // --------------------------------------------------
  //  fetchSale : récupération de la vente
  // --------------------------------------------------
  useEffect(() => {
    const fetchSale = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/ventes/${id}`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`Échec de la récupération : ${response.status}`);
        }
        const data = await response.json();

        const vente = data.data;

        // 1) Si ?date=... (format "dd/MM/yyyy" ou autre) => on l'applique à la "Date de Vente"
        if (saleDateParam) {
          setSaleDate(parseDateString(saleDateParam));
          vente["DATE DE VENTE"] = saleDateParam;
        } else {
          // Sinon, si la DB n'a pas "DATE DE VENTE", on met la date du jour
          if (!vente["DATE DE VENTE"]) {
            const now = new Date();
            setSaleDate(now);
          } else {
            setSaleDate(parseDateString(vente["DATE DE VENTE"]));
          }
        }

        // 2) Prévision Chantier : parse le champ si présent
        if (vente["PREVISION CHANTIER"]) {
          setPrevChantierDate(parseDateString(vente["PREVISION CHANTIER"]));
        }

        setSale(vente);
      } catch (err) {
        console.error("Erreur :", err);
        setError(`Erreur : ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSale();
  }, [id, saleDateParam]);

  // --------------------------------------------------
  // handleInputChange : pour les autres champs (texte / number)
  // --------------------------------------------------
  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSale((prev) => {
      const updated = { ...prev, [name]: value };

      // Recalcul MONTANT HT si Taux TVA / MONTANT TTC changent
      if (name === "MONTANT TTC" || name === "TAUX TVA") {
        const montantTTC = parseFloat(updated["MONTANT TTC"]) || 0;
        let tauxTVA = parseFloat(updated["TAUX TVA"]) || TVA_RATE_DEFAULT;
        if (tauxTVA > 1) {
          tauxTVA = tauxTVA / 100;
        }
        const ht = montantTTC / (1 + tauxTVA);
        updated["MONTANT HT"] = ht > 0 ? ht.toFixed(2) : "0.00";
      }

      return updated;
    });
  };

  // --------------------------------------------------
  // handleSave : sauvegarde
  // --------------------------------------------------
  const handleSave = async (e) => {
    e.preventDefault();
    if (!sale) return;

    // Vérifier des champs obligatoires
    const required = ["NOM DU CLIENT", "prenom", "ADRESSE DU CLIENT"];
    const missing = required.filter((f) => !sale[f]);
    if (missing.length > 0) {
      setNotification({
        type: "error",
        message: `Champs obligatoires manquants : ${missing.join(", ")}`,
      });
      return;
    }

    // 1) On convertit nos DatePicker en "dd/MM/yyyy" (ou ISO si vous voulez)
    const dateVenteStr = saleDate ? formatDateDDMMYYYY(saleDate) : "";
    const prevChantierStr = prevChantierDate
      ? formatDateDDMMYYYY(prevChantierDate)
      : "";

    // On stocke ces formats dans l’objet sale
    sale["DATE DE VENTE"] = dateVenteStr;
    sale["PREVISION CHANTIER"] = prevChantierStr;

    try {
      const response = await fetch(`/api/ventes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(sale),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || `Erreur : ${response.status}`);
      }

      setNotification({
        type: "success",
        message: "Vente mise à jour avec succès !",
      });
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (err) {
      console.error("Erreur lors de la sauvegarde :", err.message);
      setNotification({
        type: "error",
        message: `Erreur : ${err.message}`,
      });
    }
  };

  // --------------------------------------------------
  // CSV
  // --------------------------------------------------
  const excludedFields = ["_id", "createdAt", "updatedAt", "__v"];

  const handleCopyCSV = () => {
    if (!sale) return;
    const entries = Object.entries(sale).filter(([k]) => !excludedFields.includes(k));
    const line = entries.map(([k, v]) => v || "").join(";");
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
    const entries = Object.entries(sale).filter(([k]) => !excludedFields.includes(k));
    const headers = entries.map(([k]) => k).join(";");
    const values = entries.map(([k, v]) => v || "").join(";");
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

  // --------------------------------------------------
  // Page "Fichier"
  // --------------------------------------------------
  const handleFileAction = (saleId) => {
    router.push(`/file/details/${saleId}`);
  };

  // --------------------------------------------------
  // ÉTATS DE CHARGEMENT
  // --------------------------------------------------
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

  // Valeurs par défaut
  const defaultSale = {
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
    "TAUX TVA": "5.5",
    "MONTANT HT": "",
    "MONTANT TTC": "",
    "MONTANT ANNULE": "",
    ETAT: "",
    "PREVISION CHANTIER": "",
    OBSERVATION: "",
  };
  const currentSale = { ...defaultSale, ...sale };

  // --------------------------------------------------
  // RENDU
  // --------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-200 to-grey-600">
      <Navbar />

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
            {/* ---- Date de Vente ---- */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                Date de Vente
              </label>
              <DatePicker
                selected={saleDate}               // état local (type Date)
                onChange={(date) => setSaleDate(date)} 
                dateFormat="dd/MM/yyyy"            // affichage
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
                value={currentSale.CIVILITE || ""}
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
                value={currentSale["NOM DU CLIENT"] || ""}
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
                value={currentSale.prenom || ""}
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
                value={currentSale["ADRESSE DU CLIENT"] || ""}
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
                value={currentSale["CODE INTERP etage"] || ""}
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
                value={currentSale.VILLE || ""}
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
                value={currentSale.CP || ""}
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
                value={currentSale.TELEPHONE || ""}
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
                value={currentSale.VENDEUR || ""}
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
                value={currentSale.DESIGNATION || ""}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
              />
            </div>

            {/* TAUX TVA */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                TAUX TVA
              </label>
              <select
                name="TAUX TVA"
                value={currentSale["TAUX TVA"] || ""}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
              >
                <option value="5.5">5.5%</option>
                <option value="10">10%</option>
                <option value="20">20%</option>
                <option value="Autre">Autre</option>
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
                value={currentSale["MONTANT HT"] || ""}
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
                value={currentSale["MONTANT TTC"] || ""}
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
                value={currentSale["MONTANT ANNULE"] || ""}
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
                value={currentSale.ETAT || ""}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
              >
                <option value="">Sélectionner un état</option>
                <option value="En attente">En attente</option>
                <option value="Confirmé">Confirmé</option>
                <option value="Annulé">Annulé</option>
              </select>
            </div>

            {/* ---- Prévision Chantier ---- */}
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
                value={currentSale.OBSERVATION || ""}
                onChange={handleInputChange}
                className="border border-gray-300 p-2 rounded-md w-full"
              />
            </div>
          </div>

          {/* Boutons */}
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <button
              type="submit"
              className="bg-blue-500 text-white py-2 px-6 rounded-md hover:bg-blue-600"
            >
              <FontAwesomeIcon icon={faSave} /> Valider
            </button>

            <button
              type="button"
              onClick={() => handleFileAction(id)}
              className="bg-gray-500 text-white py-2 px-6 rounded-md hover:bg-gray-600"
            >
              <FontAwesomeIcon icon={faFile} /> Fichier
            </button>

            <button
              type="button"
              onClick={handleCopyCSV}
              className="bg-purple-500 text-white py-2 px-6 rounded-md hover:bg-purple-600"
              title="Copier la vente en CSV"
            >
              <FontAwesomeIcon icon={faCopy} /> Copier CSV
            </button>

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
};

export default EditSale;