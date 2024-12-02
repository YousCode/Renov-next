"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Tesseract from "tesseract.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEdit,
  faFile,
  faMoneyBillWave,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";

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
  "nd mr veut pas",
];

const isExcludedState = (etat) => {
  // Ne pas exclure les ventes avec un état vide
  if (!etat) return false;

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [payments, setPayments] = useState([]);
  const [newPaymentAmount, setNewPaymentAmount] = useState("");
  const [newPaymentDate, setNewPaymentDate] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const router = useRouter();

  const tableRef = useRef(null);

  useEffect(() => {
    fetchSales();
  }, [selectedMonth, selectedYear]);

  const fetchSales = async () => {
    try {
      setLoading(true);
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

  const filterSalesByDate = (salesData) => {
    const filtered = salesData.filter((sale) => {
      const saleDate = new Date(sale["DATE DE VENTE"]);
      const etat = normalizeString(sale.ETAT || "");

      // Inclure les ventes même si l'état est vide
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
        normalizeString(sale["NOM DU CLIENT"]).includes(term) ||
        normalizeString(sale["TELEPHONE"]).includes(term) ||
        normalizeString(sale["ADRESSE DU CLIENT"]).includes(term)
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

  // Fonction pour gérer le double-clic sur une ligne de vente
  const handleRowDoubleClick = (sale) => {
    setSelectedSale(sale);
    // Initialiser les paiements à partir de la vente ou vide
    setPayments(sale.payments || []);
    setIsModalOpen(true);
  };

  // Fonction pour ajouter un nouveau paiement
  const handleAddPayment = () => {
    if (!newPaymentAmount || !newPaymentDate) {
      alert("Veuillez remplir tous les champs de paiement.");
      return;
    }

    const newPayment = {
      montant: parseFloat(newPaymentAmount),
      date: newPaymentDate,
      id: Date.now(), // ID temporaire pour le mapping
    };

    setPayments((prevPayments) => [...prevPayments, newPayment]);

    // Mettre à jour les paiements dans l'état des ventes
    setSales((prevSales) =>
      prevSales.map((s) =>
        s._id === selectedSale._id
          ? { ...s, payments: [...(s.payments || []), newPayment] }
          : s
      )
    );

    setNewPaymentAmount("");
    setNewPaymentDate("");
  };

  // Fonction pour gérer le téléchargement d'une image et l'extraction du montant via OCR
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setOcrLoading(true);

    try {
      const {
        data: { text },
      } = await Tesseract.recognize(file, "fra");
      const amount = extractAmountFromText(text);
      if (amount) {
        setNewPaymentAmount(amount);
      } else {
        alert("Aucun montant détecté dans l'image.");
      }
    } catch (error) {
      console.error("Erreur lors de la reconnaissance OCR :", error);
      alert("Erreur lors de la reconnaissance OCR.");
    } finally {
      setOcrLoading(false);
    }
  };

  // Fonction pour extraire le montant du texte OCR
  const extractAmountFromText = (text) => {
    const regex = /(\d+[\.,\s]\d{2})/g;
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      // On prend le premier montant trouvé
      return matches[0].replace(",", ".").replace(" ", "");
    }
    return null;
  };

  // Calcul du montant total payé
  const calculateTotalPaid = () => {
    return payments.reduce((sum, payment) => sum + payment.montant, 0);
  };

  // Calcul de la progression du paiement
  const calculateProgress = () => {
    const totalPaid = calculateTotalPaid();
    const totalAmount =
      parseFloat(selectedSale["MONTANT TTC"]) ||
      parseFloat(selectedSale["MONTANT HT"]) ||
      0;
    return totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;
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
                onDoubleClick={() => handleRowDoubleClick(sale)}
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
                  {sale["MONTANT TTC"]
                    ? formatNumber(sale["MONTANT TTC"])
                    : "N/A"}
                </td>
                <td className="border px-4 py-2">
                  {sale["MONTANT HT"]
                    ? formatNumber(sale["MONTANT HT"])
                    : "N/A"}
                </td>
                <td className="border px-4 py-2">
                  {sale.ETAT || "" /* Ne pas afficher "État inconnu" */}
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
                  <button
                    onClick={() => handleRowDoubleClick(sale)}
                    className="px-2 py-1 bg-yellow-500 text-white rounded-lg ml-2"
                  >
                    <FontAwesomeIcon icon={faMoneyBillWave} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal pour gérer les paiements */}
      {isModalOpen && selectedSale && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white w-11/12 md:w-2/3 lg:w-1/2 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                Paiements pour {selectedSale["NOM DU CLIENT"]}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-600 hover:text-gray-800"
              >
                <FontAwesomeIcon icon={faTimes} size="lg" />
              </button>
            </div>

            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
                <div
                  className="bg-green-500 h-4 rounded-full"
                  style={{ width: `${calculateProgress()}%` }}
                ></div>
              </div>
              <p>
                Montant total :{" "}
                {formatNumber(
                  parseFloat(selectedSale["MONTANT TTC"]) ||
                    parseFloat(selectedSale["MONTANT HT"]) ||
                    0
                )}
              </p>
              <p>Montant payé : {formatNumber(calculateTotalPaid())}</p>
              <p>
                Montant restant :{" "}
                {formatNumber(
                  (parseFloat(selectedSale["MONTANT TTC"]) ||
                    parseFloat(selectedSale["MONTANT HT"]) ||
                    0) - calculateTotalPaid()
                )}
              </p>
            </div>

            <div className="mb-4">
              <h3 className="font-bold mb-2">Historique des paiements :</h3>
              <ul>
                {payments.map((payment) => (
                  <li key={payment.id}>
                    {formatDate(payment.date)} - {formatNumber(payment.montant)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-4">
              <h3 className="font-bold mb-2">Ajouter un paiement :</h3>
              <div className="flex flex-col space-y-2">
                <input
                  type="number"
                  step="0.01"
                  value={newPaymentAmount}
                  onChange={(e) => setNewPaymentAmount(e.target.value)}
                  placeholder="Montant"
                  className="p-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="date"
                  value={newPaymentDate}
                  onChange={(e) => setNewPaymentDate(e.target.value)}
                  className="p-2 border border-gray-300 rounded-lg"
                />
                <div className="flex items-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="p-2"
                  />
                  {ocrLoading && (
                    <span className="ml-2 text-gray-600">
                      Analyse en cours...
                    </span>
                  )}
                </div>
                <button
                  onClick={handleAddPayment}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg"
                >
                  Ajouter le paiement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Sticky pour la sélection de Mois et Année */}
      <footer className="fixed bottom-0 left-0 w-full bg-gray-700 text-white py-4 flex justify-between items-center px-4">
        <div className="flex space-x-2 overflow-x-auto">
          {months.map((month, index) => (
            <button
              key={index}
              onClick={() => handleMonthChange(index)}
              className={`px-2 py-1 rounded-lg whitespace-nowrap ${
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