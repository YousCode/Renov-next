"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// Utilitaires -----------------------------------------------------------
const normalizeString = (str) =>
  str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : "";

const fmtDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d) ? String(value) : d.toLocaleDateString("fr-FR");
};

const fmtMoney = (value) => {
  if (value === null || value === undefined) return "—";
  const cleaned = String(value).replace(/\s/g, "").replace(",", ".");
  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num)) return String(value);
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(num);
  } catch {
    return num.toFixed(2) + " €";
  }
};

const decodeSalesParam = (raw) => {
  const attempts = [
    () => JSON.parse(raw),
    () => JSON.parse(decodeURIComponent(raw)),
    () => JSON.parse(decodeURIComponent(decodeURIComponent(raw))),
    () => JSON.parse(atob(raw)), // base64 fallback
  ];
  for (const attempt of attempts) {
    try {
      const data = attempt();
      if (Array.isArray(data)) return data;
      if (data && typeof data === "object") return [data];
    } catch {
      // ignore
    }
  }
  throw new Error("decode-failed");
};

const get = (obj, key, fallback = "—") =>
  obj && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] ?? fallback : fallback;

// Composant -------------------------------------------------------------
const SearchClient = () => {
  const router = useRouter();
  const [ventes, setVentes] = useState([]);
  const [message, setMessage] = useState("");

  // Nouveaux états pour la recherche
  const [q, setQ] = useState(""); // recherche globale
  const [field, setField] = useState("NOM DU CLIENT"); // champ sélectionné pour recherche

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const sales = searchParams.get("sales");
      if (!sales) {
        setMessage("Aucune vente correspondante trouvée");
        return;
      }
      const data = decodeSalesParam(sales);
      setVentes(data);
      setMessage("");
    } catch (e) {
      setMessage("Erreur lors du décodage des données de vente");
    }
  }, []);

  // Filtrage mémoïsé
  const filteredVentes = useMemo(() => {
    const nq = normalizeString(q);
    if (!nq) return ventes;

    return ventes.filter((vente) => {
      const val = normalizeString(get(vente, field, ""));
      return val.includes(nq);
    });
  }, [q, field, ventes]);

  return (
    <div style={{ backgroundColor: "#071013" }} className="p-6 min-h-screen text-white">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
        >
          Retour
        </button>

        {/* Barre de recherche */}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Rechercher par ${field.toLowerCase()}`}
          className="flex-1 px-3 py-2 rounded-lg bg-gray-800 placeholder-gray-400 outline-none border border-gray-700 focus:border-teal-400"
        />

        {/* Sélecteur de champ */}
        <select
          value={field}
          onChange={(e) => setField(e.target.value)}
          className="px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-teal-400"
        >
          <option value="NOM DU CLIENT">Nom</option>
          <option value="TELEPHONE">Téléphone</option>
          <option value="ADRESSE DU CLIENT">Adresse</option>
          <option value="DESIGNATION">Désignation</option>
          <option value="VILLE">Ville</option>
        </select>
      </div>

      <div className="mt-3 text-sm text-gray-300">
        {message ? (
          <span className="text-red-400">{message}</span>
        ) : (
          <span>
            Résultats : <strong>{filteredVentes.length}</strong> / {ventes.length}
          </span>
        )}
      </div>

      <div className="flex-1 mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredVentes.map((vente) => {
          const isAnnule = normalizeString(get(vente, "ETAT", "")) === "annule";
          return (
            <div
              key={get(vente, "_id", Math.random().toString(36).slice(2))}
              style={{
                backgroundColor: isAnnule ? "#ff334e" : "#61D1B7",
                animation: isAnnule ? "blink 1s infinite" : "none",
              }}
              className="p-6 rounded-lg shadow-lg text-gray-900"
            >
              <p><strong>Date de Vente:</strong> {fmtDate(get(vente, "DATE DE VENTE"))}</p>
              <p><strong>Civilité:</strong> {get(vente, "CIVILITE")}</p>
              <p><strong>Nom du Client:</strong> {get(vente, "NOM DU CLIENT")}</p>
              <p><strong>Prénom:</strong> {get(vente, "prenom")}</p>
              <p><strong>Numéro BC:</strong> {get(vente, "NUMERO BC")}</p>
              <p><strong>Adresse du Client:</strong> {get(vente, "ADRESSE DU CLIENT")}</p>
              <p><strong>Ville:</strong> {get(vente, "VILLE")}</p>
              <p><strong>Code Postal:</strong> {get(vente, "CP")}</p>
              <p><strong>Téléphone:</strong> {get(vente, "TELEPHONE")}</p>
              <p><strong>Vendeur:</strong> {get(vente, "VENDEUR")}</p>
              <p><strong>Désignation:</strong> {get(vente, "DESIGNATION")}</p>
              <p><strong>Taux TVA:</strong> {get(vente, "TAUX TVA")}</p>
              <p><strong>Montant TTC:</strong> {fmtMoney(get(vente, "MONTANT TTC "))}</p>
              <p><strong>Montant HT:</strong> {fmtMoney(get(vente, "MONTANT HT"))}</p>
              <p><strong>Montant Annulé:</strong> {fmtMoney(get(vente, "MONTANT ANNULE"))}</p>
              <p><strong>CA Mensuel:</strong> {fmtMoney(get(vente, "CA MENSUEL"))}</p>
              <p><strong>État:</strong> {get(vente, "ETAT")}</p>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default SearchClient;