"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faFile } from "@fortawesome/free-solid-svg-icons";

const normalizeString = (str) => {
  return str
    ? str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    : "";
};

const ITEMS_PER_PAGE = 200;

const formatDate = (dateStr) => {
  if (!dateStr) return "Date invalide";

  const date = new Date(dateStr);
  return isNaN(date.getTime())
    ? "Date invalide"
    : date.toLocaleDateString("fr-FR");
};

const formatNumber = (value) => {
  const number = parseFloat(value);
  return isNaN(number) ? value : number.toFixed(2) + " €";
};

// Liste des états à exclure
const EXCLUDED_STATES = [
  "dnv",
  "pdc",
  "en attente",
  "nd enfant s'occupe",
  "nd abs partielle",
  "porte",
  "nd tutelle",
  "nd impossibilite technique",
  "nd veut rien",
  "reporté",
  "nd viage",
  "nd curatelle",
  "nd intercepte",
  "nd niece",
  "dlm",
  "nd indivision",
  "nd perché",
  "nd confusion",
  "nd reporte",
  "nd comite",
  "reporte",
  "nd s'occupe pas",
  "nd gardien",
  "rdv reporté",
  "nd alzheimer",
  "nd fils veut pas",
  "nd perchee",
  "nd copine intervenue",
  "nd enfants s'occupent",
  "rdv reporté",
  "ND PERCHÉ",
  "nd mr veut pas",
];

const isExcludedState = (etat) => {
  if (!etat) return true;

  const normalizedEtat = normalizeString(etat);

  // Exclure les états spécifiés
  if (EXCLUDED_STATES.some((state) => normalizedEtat.startsWith(state))) {
    return true;
  }

  // Exclure "DV + un chiffre" ou des états qui sont seulement un chiffre
  const dvRegex = /^dv\s*\d+$/i;
  const numberRegex = /^\d+$/;
  return dvRegex.test(etat) || numberRegex.test(etat);
};

const AllSales = () => {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const router = useRouter();

  const tableRef = useRef(null);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const response = await fetch("/api/ventes");
        if (!response.ok) {
          throw new Error(
            `Échec de la récupération des ventes : ${response.statusText}`
          );
        }
        const data = await response.json();
        setSales(data.data);
        filterSalesByDate(data.data);
      } catch (error) {
        console.error("Erreur lors de la récupération des ventes :", error);
        setError(`Erreur : ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchSales();
  }, [selectedMonth, selectedYear]);

  const filterSalesByDate = (salesData) => {
    const filtered = salesData.filter((sale) => {
      const saleDate = new Date(sale["DATE DE VENTE"]);
      const etat = normalizeString(sale.ETAT || "");

      // Exclure les états spécifiés et ceux commençant par "nd"
      return (
        saleDate.getMonth() === selectedMonth &&
        saleDate.getFullYear() === selectedYear &&
        !isExcludedState(etat)
      );
    });
    setFilteredSales(filtered);
  };

  const handleMonthChange = (month) => {
    setSelectedMonth(month);
  };

  const handleYearChange = (event) => {
    setSelectedYear(Number(event.target.value));
  };

  const handleSearchChange = (e) => {
    const term = normalizeString(e.target.value);
    setSearchTerm(term);
    
    const filtered = sales.filter(
      (sale) =>
        normalizeString(sale["NOM DU CLIENT"]).startsWith(term) ||
        normalizeString(sale["TELEPHONE"]).startsWith(term) ||
        normalizeString(sale["ADRESSE DU CLIENT"]).startsWith(term)
    );
    setFilteredSales(filtered);
  };

  const handleSortDate = () => {
    const newSortOrder = sortOrder === "asc" ? "desc" : "asc";
    setSortOrder(newSortOrder);
    setFilteredSales((prevSales) =>
      [...prevSales].sort((a, b) => {
        const dateA = new Date(a["DATE DE VENTE"]);
        const dateB = new Date(b["DATE DE VENTE"]);
        return newSortOrder === "asc" ? dateA - dateB : dateB - dateA;
      })
    );
  };

  if (loading)
    return <p className="text-center text-gray-700">Chargement...</p>;
  if (error) return <p className="text-center text-red-500">{error}</p>;

  const months = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ];

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-800 p-4">
      <div className="flex flex-col items-center w-full mb-4">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg mb-2"
        >
          Retour
        </button>
        <div className="flex items-center justify-center w-full">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Rechercher par nom, téléphone, adresse"
            className="w-1/2 p-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      <div className="w-full overflow-x-auto mb-16">
        <table ref={tableRef} className="min-w-full bg-white text-gray-800">
          <thead className="bg-gray-700 text-white">
            <tr>
              <th
                className="relative w-1/12 px-4 py-2 cursor-pointer"
                onClick={handleSortDate}
              >
                Date de Vente {sortOrder === "asc" ? "↑" : "↓"}
              </th>
              <th className="relative w-1/12 px-4 py-2">Nom du Client</th>
              <th className="relative w-1/12 px-4 py-2">Téléphone</th>
              <th className="relative w-1/12 px-4 py-2">Adresse</th>
              <th className="relative w-1/12 px-4 py-2">Ville</th>
              <th className="relative w-1/12 px-4 py-2">Montant TTC</th>
              <th className="relative w-1/12 px-4 py-2">Montant HT</th>
              <th className="relative w-1/12 px-4 py-2">État</th>
              <th className="relative w-1/12 px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map((sale) => (
              <tr
                key={sale._id}
                className={`${
                  normalizeString(sale.ETAT) === "annule"
                    ? "bg-red-200 animate-blink"
                    : !sale["ADRESSE DU CLIENT"] || !sale.VILLE
                    ? "animate-blink-yellow"
                    : "bg-white"
                }`}
              >
                <td className="border px-4 py-2">
                  {formatDate(sale["DATE DE VENTE"])}
                </td>
                <td className="border px-4 py-2">{sale["NOM DU CLIENT"]}</td>
                <td className="border px-4 py-2">{sale.TELEPHONE}</td>
                <td className="border px-4 py-2">
                  {sale["ADRESSE DU CLIENT"] || "Adresse manquante"}
                </td>
                <td className="border px-4 py-2">
                  {sale.VILLE || "Ville manquante"}
                </td>
                <td className="border px-4 py-2">
                  {sale["MONTANT TTC"] ? formatNumber(sale["MONTANT TTC"]) : "N/A"}
                </td>
                <td className="border px-4 py-2">
                  {sale["MONTANT HT"] ? formatNumber(sale["MONTANT HT"]) : "N/A"}
                </td>
                <td className="border px-4 py-2">
                  {sale.ETAT || "État inconnu"}
                </td>
                <td className="border px-4 py-2 flex justify-center space-x-2">
                  <button
                    onClick={() => router.push(`/sales/edit/${sale._id}`)}
                    className="px-2 py-1 bg-blue-500 text-white rounded-lg"
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  <button
                    onClick={() => router.push(`/file/details/${sale._id}`)}
                    className="px-2 py-1 bg-green-500 text-white rounded-lg ml-2"
                  >
                    <FontAwesomeIcon icon={faFile} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Sticky pour la sélection de Mois et Année */}
      <footer className="fixed bottom-0 left-0 w-full bg-gray-700 text-white py-4 flex justify-between items-center px-4">
        <div className="flex space-x-2">
          {months.map((month, index) => (
            <button
              key={index}
              onClick={() => handleMonthChange(index)}
              className={`px-2 py-1 rounded-lg ${
                selectedMonth === index ? "bg-blue-500" : "bg-gray-600"
              }`}
            >
              {month}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="year" className="mr-2">
            Année :
          </label>
          <select
            id="year"
            value={selectedYear}
            onChange={handleYearChange}
            className="p-1 bg-gray-600 rounded-lg text-white"
          >
            {Array.from({ length: 10 }, (_, i) => {
              const year = new Date().getFullYear() - i;
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              );
            })}
          </select>
        </div>
      </footer>

      <style jsx>{`
        @keyframes blink {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            opacity: 1;
          }
        }
        .animate-blink {
          animation: blink 1s infinite;
        }
        .animate-blink-yellow {
          animation: blink-yellow 1s infinite;
          background-color: #fff3cd;
        }
        @keyframes blink-yellow {
          0% {
            background-color: #fff3cd;
          }
          50% {
            background-color: #ffecb5;
          }
          100% {
            background-color: #fff3cd;
          }
        }
        th,
        td {
          padding: 8px;
          border: 1px solid #d1d5db;
          white-space: nowrap;
          text-align: center;
        }
        footer button:hover {
          background-color: #ffffff44;
        }
      `}</style>
    </div>
  );
};

export default AllSales;