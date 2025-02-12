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

// Taux TVA par défaut
const TVA_RATE_DEFAULT = 0.2;

/**
 * Formatage pour affichage en "dd/MM/yyyy".
 * Utile si vous souhaitez afficher la date au format français,
 * mais ce n'est pas le format envoyé au serveur.
 */
function formatDateDDMMYYYY(dateObj) {
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return "";
  const d = String(dateObj.getDate()).padStart(2, "0");
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const y = dateObj.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Petite fonction utilitaire pour vérifier si une chaîne est au format ISO.
 * On renvoie un objet Date si c'est interprétable, sinon null.
 */
function parseIsoString(str) {
  if (!str) return null;
  const dateObj = new Date(str);
  return isNaN(dateObj.getTime()) ? null : dateObj;
}

const EditSale = () => {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const saleDateParam = searchParams.get("date");

  // État principal de la vente
  const [sale, setSale] = useState(null);

  // Dates locales (objets Date pour react-datepicker)
  const [saleDate, setSaleDate] = useState(null);
  const [prevChantierDate, setPrevChantierDate] = useState(null);

  // Gestion du chargement, des erreurs et des notifications
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Champs à exclure du CSV
  const excludedFields = ["_id", "createdAt", "updatedAt", "__v"];

  // --------------------------------------------------------------------
  // 1. Récupération de la vente (GET)
  // --------------------------------------------------------------------
  useEffect(() => {
    const fetchSale = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/ventes/${id}`, { credentials: "include" });
        if (!res.ok) {
          throw new Error(`Échec de la récupération : ${res.status}`);
        }
        const data = await res.json();
        const vente = data.data;

        // On part du principe que le backend stocke la date
        // au format ISO. Ex. "2025-02-10T10:00:00.000Z"
        // => On retransforme en objet Date
        const dateDeVente = parseIsoString(vente["DATE DE VENTE"]);
        const prevDateChantier = parseIsoString(vente["PREVISION CHANTIER"]);

        // Sinon, si ce n'est pas ISO, essayez d'adapter ce parseur.
        // Par exemple, si vous avez "dd/MM/yyyy", il faudra créer un parseur spécifique.

        // Si pas de date dans la vente, on regarde s'il y a un param "date" dans l'URL
        // Sinon on met la date du jour
        if (dateDeVente) {
          setSaleDate(dateDeVente);
        } else if (saleDateParam) {
          // essayez de parser saleDateParam en ISO, si possible
          const paramDate = parseIsoString(saleDateParam);
          setSaleDate(paramDate || new Date());
        } else {
          setSaleDate(new Date());
        }

        // Pour la date de prévision chantier
        if (prevDateChantier) {
          setPrevChantierDate(prevDateChantier);
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

  // --------------------------------------------------------------------
  // 2. handleInputChange
  // --------------------------------------------------------------------
  const handleInputChange = (e) => {
    if (!sale) return;
    const { name, value } = e.target;

    setSale((prev) => {
      const updated = { ...prev, [name]: value };

      // 2A. Gérer la TVA
      if (name === "TAUX TVA") {
        let tvaPourcent = parseFloat(value);
        if (isNaN(tvaPourcent)) {
          tvaPourcent = 10; // Défaut si champ vide
        }
        // Si l'utilisateur tape 550 => on interprète comme 5.5 etc.
        if (tvaPourcent > 100) {
          tvaPourcent = tvaPourcent / 100;
        }
        // On borne la TVA à [5.5, 20]
        if (tvaPourcent < 5.5) tvaPourcent = 5.5;
        if (tvaPourcent > 20) tvaPourcent = 20;

        updated["TAUX TVA"] = String(tvaPourcent);
      }

      // 2B. Recalcul du MONTANT HT si "MONTANT TTC" ou "TAUX TVA" changent
      if (name === "MONTANT TTC" || name === "TAUX TVA") {
        const montantTTC = parseFloat(updated["MONTANT TTC"]) || 0;

        let tvaPourcent = parseFloat(updated["TAUX TVA"]) || TVA_RATE_DEFAULT * 100;
        const tvaDecimal = tvaPourcent / 100;

        const ht = montantTTC / (1 + tvaDecimal);
        updated["MONTANT HT"] = ht > 0 ? ht.toFixed(2) : "0.00";
      }

      return updated;
    });
  };

  // --------------------------------------------------------------------
  // 3. Sauvegarde (PUT)
  // --------------------------------------------------------------------
  const handleSave = async (e) => {
    e.preventDefault();
    if (!sale) return;

    // Champs obligatoires
    const required = ["NOM DU CLIENT", "prenom", "ADRESSE DU CLIENT"];
    const missing = required.filter((f) => !sale[f]);
    if (missing.length > 0) {
      setNotification({
        type: "error",
        message: `Champs obligatoires manquants : ${missing.join(", ")}`,
      });
      return;
    }

    // IMPORTANT :
    // Avant d'envoyer au serveur, on stocke les dates au format ISO
    // car la BDD (ex: MongoDB) reconnaît le champ de type Date s'il reçoit une ISO string.
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
      // Redirection après un petit délai (optionnel)
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (err) {
      setNotification({ type: "error", message: `Erreur : ${err.message}` });
    }
  };

  // --------------------------------------------------------------------
  // 4. CSV
  // --------------------------------------------------------------------
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

  // 5. Accès au fichier (redirect)
  const handleFileAction = (saleId) => {
    router.push(`/file/details/${saleId}`);
  };

  // --------------------------------------------------------------------
  // 6. ÉTATS DE CHARGEMENT / ERREURS
  // --------------------------------------------------------------------
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

  // Valeurs par défaut (si certaines clés n'existent pas dans la vente)
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
    "TAUX TVA": "10", // => 10% => 0.1
    "MONTANT HT": "",
    "MONTANT TTC": "",
    "MONTANT ANNULE": "",
    ETAT: "",
    "PREVISION CHANTIER": "",
    OBSERVATION: "",
  };

  // Fusion des valeurs par défaut et de la vente récupérée
  const currentSale = { ...defaultSale, ...sale };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-200 to-gray-600">
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
            {/* Date de Vente (Objet Date) */}
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
              {/* Affichage formaté (optionnel) : {formatDateDDMMYYYY(saleDate)} */}
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

            {/* Prévision Chantier (Objet Date) */}
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