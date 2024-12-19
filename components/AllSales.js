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
  faTrash,
  faCopy,
  faDownload,
} from "@fortawesome/free-solid-svg-icons";
import Confetti from "react-confetti";
import useWindowSize from "react-use/lib/useWindowSize";

const normalizeString = (str) => {
  return str
    ? str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    : "";
};

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? "" : date.toLocaleDateString("fr-FR");
};

const formatNumber = (value) => {
  const number = parseFloat(value);
  if (isNaN(number)) return value || "";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
};

const EXCLUDED_STATES = ["annule"];

const isExcludedState = (etat) => {
  if (!etat) return false;
  const normalizedEtat = normalizeString(etat);
  if (EXCLUDED_STATES.some((state) => normalizedEtat.startsWith(state))) {
    return true;
  }
  const dvRegex = /^dv\s*\d+$/i;
  const numberRegex = /^\d+$/;
  return dvRegex.test(etat) || numberRegex.test(etat);
};

function calculateCommission(sale) {
  const caHT = parseFloat(sale["MONTANT HT"]) || 0;
  let percent = 0.1;
  switch (sale["BAREME COM"]) {
    case "T1":
      percent = 0.2;
      break;
    case "T2":
      percent = 0.17;
      break;
    case "T3":
      percent = 0.15;
      break;
    case "T4":
      percent = 0.12;
      break;
    case "T5":
      percent = 0.1;
      break;
    case "T6":
      percent = 0.06;
      break;
    default:
      percent = 0.1;
  }
  return (caHT * percent).toFixed(2);
}

function getBaremeBgColor(bareme) {
  switch (bareme) {
    case "T1":
      return "bg-green-300";
    case "T2":
      return "bg-blue-300";
    case "T3":
      return "bg-purple-300";
    case "T4":
      return "bg-yellow-300";
    case "T5":
      return "";
    case "T6":
      return "bg-red-300";
    default:
      return "";
  }
}

const processSalesData = (salesData) => {
  const uniqueSales = [];
  const seen = new Set();

  salesData.forEach((sale) => {
    const identifier = `${normalizeString(sale["NOM DU CLIENT"])}|${formatDate(
      sale["DATE DE VENTE"]
    )}|${sale["MONTANT TTC"]}|${sale["VENDEUR"]}`;

    if (!seen.has(identifier)) {
      seen.add(identifier);

      let montantHT = parseFloat(sale["MONTANT HT"]);
      let montantTTC = parseFloat(sale["MONTANT TTC"]);
      let tauxTVA = parseFloat(sale["TAUX TVA"]) || 5.5;

      if (tauxTVA !== 5.5 && tauxTVA !== 10) {
        tauxTVA = 5.5;
      }

      const tvaRate = tauxTVA === 10 ? 0.1 : 0.055;
      if (isNaN(montantTTC) && !isNaN(montantHT)) {
        montantTTC = montantHT * (1 + tvaRate);
        sale["MONTANT TTC"] = montantTTC.toFixed(2);
      }
      if (isNaN(montantHT) && !isNaN(montantTTC)) {
        montantHT = montantTTC / (1 + tvaRate);
        sale["MONTANT HT"] = montantHT.toFixed(2);
      }
      if (isNaN(montantHT) && isNaN(montantTTC)) {
        sale["MONTANT HT"] = "0.00";
        sale["MONTANT TTC"] = "0.00";
      }

      sale["TAUX TVA"] = tauxTVA === 10 ? "10,0%" : "5,5%";

      if (!sale["PREVISION CHANTIER"]) {
        sale["PREVISION CHANTIER"] = null;
      }

      if (!sale["BAREME COM"]) {
        sale["BAREME COM"] = "T5";
      }

      sale["MONTANT COMMISSIONS"] = calculateCommission(sale);

      uniqueSales.push(sale);
    }
  });

  return uniqueSales;
};

const ITEMS_PER_PAGE = 500;

const AllSales = () => {
  const [sales, setSales] = useState([]);
  const [displayedSales, setDisplayedSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllSales, setShowAllSales] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("DATE DE VENTE");
  const [sortOrder, setSortOrder] = useState("asc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [payments, setPayments] = useState([]);
  const [newPaymentAmount, setNewPaymentAmount] = useState("");
  const [newPaymentDate, setNewPaymentDate] = useState("");
  const [newPaymentComment, setNewPaymentComment] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hiddenSales, setHiddenSales] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("hiddenSales");
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });

  const router = useRouter();
  const { width, height } = useWindowSize();
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
      const processedSales = processSalesData(data.data);
      setSales(processedSales);
      filterSales(processedSales);
    } catch (error) {
      console.error("Erreur lors de la récupération des ventes :", error);
      setError(`Erreur : ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filterSales = (salesData) => {
    let filtered = salesData.filter((sale) => {
      const saleDate = new Date(sale["DATE DE VENTE"]);
      const etat = normalizeString(sale.ETAT || "");
      const dateCondition = showAllSales
        ? true
        : saleDate.getMonth() === selectedMonth &&
          saleDate.getFullYear() === selectedYear;

      return (
        dateCondition &&
        !isExcludedState(etat) &&
        !hiddenSales.includes(sale._id)
      );
    });

    if (searchTerm) {
      filtered = filtered.filter(
        (sale) =>
          normalizeString(sale["NOM DU CLIENT"] || "").includes(searchTerm) ||
          normalizeString(sale["TELEPHONE"] || "").includes(searchTerm) ||
          normalizeString(sale["ADRESSE DU CLIENT"] || "").includes(
            searchTerm
          ) ||
          normalizeString(sale["VENDEUR"] || "").includes(searchTerm) ||
          normalizeString(sale["DESIGNATION"] || "").includes(searchTerm)
      );
    }

    filtered.sort((a, b) => {
      let valueA = a[sortField];
      let valueB = b[sortField];
      if (sortField === "DATE DE VENTE" || sortField === "PREVISION CHANTIER") {
        valueA = valueA ? new Date(valueA) : new Date(0);
        valueB = valueB ? new Date(valueB) : new Date(0);
      } else if (sortField === "MONTANT HT" || sortField === "MONTANT TTC") {
        valueA = parseFloat(valueA);
        valueB = parseFloat(valueB);
      } else {
        valueA = normalizeString(valueA);
        valueB = normalizeString(valueB);
      }
      if (valueA < valueB) return sortOrder === "asc" ? -1 : 1;
      if (valueA > valueB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    setTotalPages(Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedSales = filtered.slice(startIndex, endIndex);
    setDisplayedSales(paginatedSales);
  };

  useEffect(() => {
    filterSales(sales);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showAllSales,
    selectedMonth,
    selectedYear,
    sortField,
    sortOrder,
    sales,
    currentPage,
    searchTerm,
    hiddenSales,
  ]);

  const handleSearchChange = (e) => {
    const term = normalizeString(e.target.value);
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const handleRowDoubleClick = (sale) => {
    setSelectedSale(sale);
    setPayments(sale.payments || []);
    setIsModalOpen(true);
  };

  const handleAddPayment = () => {
    if (!newPaymentAmount || !newPaymentDate) {
      alert("Veuillez remplir tous les champs de paiement.");
      return;
    }

    const montant = parseFloat(newPaymentAmount);
    if (isNaN(montant) || montant <= 0) {
      alert("Veuillez entrer un montant valide.");
      return;
    }

    const newPayment = {
      montant: montant,
      date: newPaymentDate,
      comment: newPaymentComment,
      id: Date.now(),
    };

    setPayments((prevPayments) => [...prevPayments, newPayment]);
    setSales((prevSales) =>
      prevSales.map((s) =>
        s._id === selectedSale._id
          ? { ...s, payments: [...(s.payments || []), newPayment] }
          : s
      )
    );

    setNewPaymentAmount("");
    setNewPaymentDate("");
    setNewPaymentComment("");
  };

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
      console.error("Erreur OCR:", error);
      alert("Erreur lors de la reconnaissance OCR.");
    } finally {
      setOcrLoading(false);
    }
  };

  const extractAmountFromText = (text) => {
    const regex = /(\d+[\.,\s]\d{2})/g;
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      return matches[0].replace(",", ".").replace(" ", "");
    }
    return null;
  };

  const calculateTotalPaid = () =>
    payments.reduce((sum, payment) => sum + payment.montant, 0);

  const calculateProgress = () => {
    const totalPaid = calculateTotalPaid();
    const totalAmount =
      parseFloat(selectedSale?.["MONTANT TTC"]) ||
      parseFloat(selectedSale?.["MONTANT HT"]) ||
      0;
    return totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;
  };

  const handleCopySale = (sale) => {
    const saleData = `
Date de Vente: ${formatDate(sale["DATE DE VENTE"])}
Nom du Client: ${sale["NOM DU CLIENT"] || ""}
Prénom: ${sale["prenom"] || ""}
Numéro: ${sale["NUMERO BC"] || ""}
Adresse du Client: ${sale["ADRESSE DU CLIENT"] || ""}
Code: ${sale["CODE"] || ""}
Ville: ${sale["VILLE"] || ""}
CP: ${sale["CP"] || ""}
Téléphone: ${sale["TELEPHONE"] || ""}
Vendeur: ${sale["VENDEUR"] || ""}
Désignation: ${sale["DESIGNATION"] || ""}
Taux TVA: ${sale["TAUX TVA"] || ""}
Montant TTC: ${formatNumber(sale["MONTANT TTC"])}
Montant HT: ${formatNumber(sale["MONTANT HT"])}
Prévision Chantier: ${
      sale["PREVISION CHANTIER"] ? formatDate(sale["PREVISION CHANTIER"]) : ""
    }
Observation: ${sale["OBSERVATION"] || ""}
    `;
    navigator.clipboard
      .writeText(saleData)
      .then(() => alert("Vente copiée dans le presse-papiers !"))
      .catch((err) => {
        console.error("Erreur lors de la copie :", err);
        alert("Erreur lors de la copie.");
      });
  };

  const handleHideSale = (sale) => {
    const confirmation = confirm(
      "Êtes-vous sûr de vouloir cacher cette vente ?"
    );
    if (!confirmation) return;
    const updatedHiddenSales = [...hiddenSales, sale._id];
    setHiddenSales(updatedHiddenSales);
    localStorage.setItem("hiddenSales", JSON.stringify(updatedHiddenSales));
    setSales((prevSales) => prevSales.filter((s) => s._id !== sale._id));
    setDisplayedSales((prevDisplayedSales) =>
      prevDisplayedSales.filter((s) => s._id !== sale._id)
    );
    alert("Vente cachée avec succès.");
  };

  const handleSaveSale = async () => {
    try {
      const updatedSale = selectedSale;
      const response = await fetch(`/api/ventes/${updatedSale._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSale),
      });

      if (response.ok) {
        const data = await response.json();
        setSales((prevSales) =>
          prevSales.map((sale) =>
            sale._id === data.data._id ? data.data : sale
          )
        );
        alert("Vente mise à jour avec succès !");
        setIsModalOpen(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erreur : ${response.status}`);
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde :", error.message);
      alert(`Erreur lors de la sauvegarde : ${error.message}`);
    }
  };

  const calculateTotalHT = () => {
    return displayedSales.reduce((sum, sale) => {
      const etat = normalizeString(sale.ETAT || "");
      if (etat === "annule") return sum;
      const montantHT = parseFloat(sale["MONTANT HT"]);
      return sum + (isNaN(montantHT) ? 0 : montantHT);
    }, 0);
  };

  const calculateTotalTTC = () => {
    return displayedSales.reduce((sum, sale) => {
      const etat = normalizeString(sale.ETAT || "");
      if (etat === "annule") return sum;
      const montantTTC = parseFloat(sale["MONTANT TTC"]);
      return sum + (isNaN(montantTTC) ? 0 : montantTTC);
    }, 0);
  };

  const handleCopyCSV = () => {
    if (displayedSales.length === 0) {
      alert("Aucune vente à copier.");
      return;
    }
    const fields = [
      "DATE DE VENTE",
      "NOM DU CLIENT",
      "prenom",
      "NUMERO BC",
      "ADRESSE DU CLIENT",
      "CODE",
      "VILLE",
      "CP",
      "TELEPHONE",
      "VENDEUR",
      "DESIGNATION",
      "TAUX TVA",
      "MONTANT TTC",
      "MONTANT HT",
      "PREVISION CHANTIER",
      "OBSERVATION",
    ];
    const lines = [];
    lines.push(fields.join(";"));
    for (const sale of displayedSales) {
      const values = fields.map((f) => sale[f] || "");
      lines.push(values.join(";"));
    }

    const csv = lines.join("\n");
    navigator.clipboard
      .writeText(csv)
      .then(() => alert("CSV des ventes copiées !"))
      .catch(() => alert("Erreur lors de la copie du CSV."));
  };

  const handleDownloadCSV = () => {
    if (displayedSales.length === 0) {
      alert("Aucune vente à télécharger.");
      return;
    }
    const fields = [
      "DATE DE VENTE",
      "NOM DU CLIENT",
      "prenom",
      "NUMERO BC",
      "ADRESSE DU CLIENT",
      "CODE",
      "VILLE",
      "CP",
      "TELEPHONE",
      "VENDEUR",
      "DESIGNATION",
      "TAUX TVA",
      "MONTANT TTC",
      "MONTANT HT",
      "PREVISION CHANTIER",
      "OBSERVATION",
    ];
    const lines = [];
    lines.push(fields.join(";"));
    for (const sale of displayedSales) {
      const values = fields.map((f) => sale[f] || "");
      lines.push(values.join(";"));
    }
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ventes.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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

  if (loading)
    return <p className="text-center text-gray-700">Chargement...</p>;
  if (error) return <p className="text-center text-red-500">{error}</p>;

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-800 p-2 font-arial text-[10px]">
      <div className="flex flex-col items-center w-full mb-2">
        <button
          onClick={() => router.back()}
          className="px-2 py-1 bg-gray-700 text-white rounded mb-1 text-[10px]"
        >
          Retour
        </button>
        <button
          onClick={() => setShowAllSales(!showAllSales)}
          className="px-2 py-1 bg-blue-500 text-white rounded mb-1 text-[10px]"
        >
          {showAllSales ? "Afficher mensuelles" : "Afficher toutes"}
        </button>
        <div className="flex flex-col md:flex-row items-center justify-center w-full mb-1 space-y-1 md:space-y-0">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Rechercher"
            className="w-full md:w-1/2 p-1 border border-gray-300 rounded text-[10px]"
          />
        </div>
        <div className="flex flex-wrap items-center justify-center w-full mb-1 space-x-1">
          <label className="text-white text-[10px]">Trier par:</label>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            className="p-1 border border-gray-300 rounded text-[10px]"
          >
            <option value="DATE DE VENTE">DATE DE VENTE</option>
            <option value="NOM DU CLIENT">NOM DU CLIENT</option>
            <option value="MONTANT HT">MONTANT HT</option>
            <option value="MONTANT TTC">MONTANT TTC</option>
            <option value="VENDEUR">VENDEUR</option>
            <option value="DESIGNATION">DESIGNATION</option>
            <option value="PREVISION CHANTIER">PREVISION CHANTIER</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="p-1 border border-gray-300 rounded text-[10px]"
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
          <button
            onClick={handleCopyCSV}
            className="px-2 py-1 bg-purple-500 text-white rounded text-[10px]"
            title="Copier CSV"
          >
            <FontAwesomeIcon icon={faCopy} />
          </button>
          <button
            onClick={handleDownloadCSV}
            className="px-2 py-1 bg-green-500 text-white rounded text-[10px]"
            title="Télécharger CSV"
          >
            <FontAwesomeIcon icon={faDownload} />
          </button>
        </div>
      </div>

      <div className="w-full overflow-x-auto mb-8">
        <table
          ref={tableRef}
          className="min-w-full bg-white text-gray-800 text-[10px]"
        >
          <thead className="bg-gray-700 text-white">
            {showAllSales ? (
              <tr>
                <th>DATE DE VENTE</th>
                <th>NOM DU CLIENT</th>
                <th>prenom</th>
                <th>BC</th>
                <th>ADRESSE DU CLIENT</th>
                <th>CODE</th>
                <th>VILLE</th>
                <th>CP</th>
                <th>TELEPHONE</th>
                <th>VENDEUR</th>
                <th>DESIGNATION</th>
                <th>TAUX TVA</th>
                <th>MONTANT TTC</th>
                <th>MONTANT HT</th>
                <th>PREVISION CHANTIER</th>
                <th>OBSERVATION</th>
                <th>Actions</th>
              </tr>
            ) : (
              <tr>
                <th>Date vente</th>
                <th>Client</th>
                <th>VENDEUR</th>
                <th>BC</th>
                <th>désignation produit</th>
                <th>Montant vente TTC (€)</th>
                <th>TVA</th>
                <th>CA HT (€)</th>
                <th>Barème COM</th>
                <th>Montant commissions en €</th>
                <th>Actions</th>
              </tr>
            )}
          </thead>
          <tbody>
            {displayedSales.map((sale) => {
              const etatNormalized = normalizeString(sale.ETAT);
              let rowClass = "";
              if (etatNormalized === "annule") {
                rowClass = "bg-red-200 animate-blink";
              } else if (!sale["ADRESSE DU CLIENT"] || !sale.VILLE) {
                rowClass = "animate-blink-yellow";
              }

              const totalPaid = (sale.payments || []).reduce(
                (sum, p) => sum + parseFloat(p.montant),
                0
              );
              const totalAmount =
                parseFloat(sale["MONTANT TTC"]) ||
                parseFloat(sale["MONTANT HT"]) ||
                0;
              const rowProgress =
                totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;

              return (
                <tr
                  key={sale._id}
                  className={`${rowClass} hover:bg-gray-100`}
                  onDoubleClick={() => handleRowDoubleClick(sale)}
                >
                  {showAllSales ? (
                    <>
                      <td className="border px-1 py-1">
                        {formatDate(sale["DATE DE VENTE"])}
                      </td>
                      <td className="border px-1 py-1">
                        {sale["NOM DU CLIENT"] || ""}
                      </td>
                      <td className="border px-1 py-1">
                        {sale["prenom"] || ""}
                      </td>
                      <td className="border px-1 py-1">
                        {sale["NUMERO BC"] || ""}
                      </td>
                      <td className="border px-1 py-1">
                        {sale["ADRESSE DU CLIENT"] || ""}
                      </td>
                      <td className="border px-1 py-1">{sale["CODE"] || ""}</td>
                      <td className="border px-1 py-1">
                        {sale["VILLE"] || ""}
                      </td>
                      <td className="border px-1 py-1">{sale["CP"] || ""}</td>
                      <td className="border px-1 py-1">
                        {sale["TELEPHONE"] || ""}
                      </td>
                      <td className="border px-1 py-1">
                        {sale["VENDEUR"] || ""}
                      </td>
                      <td className="border px-1 py-1">
                        {sale["DESIGNATION"] || ""}
                      </td>
                      <td className="border px-1 py-1">
                        {sale["TAUX TVA"] || ""}
                      </td>
                      <td className="border px-1 py-1 text-right">
                        {formatNumber(sale["MONTANT TTC"])}
                      </td>
                      <td className="border px-1 py-1 text-right">
                        {formatNumber(sale["MONTANT HT"])}
                      </td>
                      <td className="border px-1 py-1">
                        {sale["PREVISION CHANTIER"]
                          ? formatDate(sale["PREVISION CHANTIER"])
                          : ""}
                      </td>
                      <td className="border px-1 py-1">
                        {sale["OBSERVATION"] || ""}
                      </td>
                      <td className="border px-1 py-1 flex justify-center space-x-1">
                        <button
                          onClick={() => router.push(`/sales/edit/${sale._id}`)}
                          className="px-1 py-1 bg-blue-500 text-white rounded text-[10px]"
                          title="Modifier"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button
                          onClick={() =>
                            router.push(`/file/details/${sale._id}`)
                          }
                          className="px-1 py-1 bg-green-500 text-white rounded text-[10px]"
                          title="Détails"
                        >
                          <FontAwesomeIcon icon={faFile} />
                        </button>
                        <button
                          onClick={() => handleRowDoubleClick(sale)}
                          className="px-1 py-1 bg-yellow-500 text-white rounded text-[10px]"
                          title="Paiements"
                        >
                          <FontAwesomeIcon icon={faMoneyBillWave} />
                        </button>
                        <button
                          onClick={() => handleCopySale(sale)}
                          className="px-1 py-1 bg-purple-500 text-white rounded text-[10px]"
                          title="Copier"
                        >
                          <FontAwesomeIcon icon={faCopy} />
                        </button>
                        <button
                          onClick={() => handleHideSale(sale)}
                          className="px-1 py-1 bg-red-500 text-white rounded text-[10px]"
                          title="Cacher"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="border px-1 py-1 relative">
                        {formatDate(sale["DATE DE VENTE"])}
                        <div className="absolute bottom-0 left-0 w-full">
                          <div className="w-full bg-gray-300 h-1">
                            <div
                              className="bg-green-500 h-1"
                              style={{ width: `${rowProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="border px-1 py-1">
                        {sale["NOM DU CLIENT"] || ""}
                      </td>
                      <td className="border px-1 py-1">
                        {sale["VENDEUR"] || "Inconnu"}
                      </td>
                      <td className="border px-1 py-1">{sale["BC"] || ""}</td>
                      <td className="border px-1 py-1">
                        {sale["DESIGNATION"] || "N/A"}
                      </td>
                      <td className="border px-1 py-1 text-right">
                        {formatNumber(sale["MONTANT TTC"])}
                      </td>
                      <td className="border px-1 py-1">
                        {sale["TAUX TVA"] || "N/A"}
                      </td>
                      <td className="border px-1 py-1 text-right">
                        {formatNumber(sale["MONTANT HT"])}
                      </td>
                      <td
                        className={`border px-1 py-1 ${getBaremeBgColor(
                          sale["BAREME COM"]
                        )}`}
                      >
                        <select
                          value={sale["BAREME COM"]}
                          onChange={(e) => {
                            const newBareme = e.target.value;
                            const updatedSale = {
                              ...sale,
                              "BAREME COM": newBareme,
                            };
                            updatedSale["MONTANT COMMISSIONS"] =
                              calculateCommission(updatedSale);
                            setSales((prev) =>
                              prev.map((s) =>
                                s._id === sale._id ? updatedSale : s
                              )
                            );
                          }}
                          className="p-1 border border-gray-300 rounded text-[10px]"
                        >
                          <option value="T1">T1 (20%)</option>
                          <option value="T2">T2 (17%)</option>
                          <option value="T3">T3 (15%)</option>
                          <option value="T4">T4 (12%)</option>
                          <option value="T5">T5 (10%)</option>
                          <option value="T6">T6 (6%)</option>
                        </select>
                      </td>
                      <td className="border px-1 py-1 text-right">
                        {sale["MONTANT COMMISSIONS"]
                          ? formatNumber(sale["MONTANT COMMISSIONS"])
                          : "-"}
                      </td>
                      <td className="border px-1 py-1 flex justify-center space-x-1">
                        <button
                          onClick={() => router.push(`/sales/edit/${sale._id}`)}
                          className="px-1 py-1 bg-blue-500 text-white rounded text-[10px]"
                          title="Modifier"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button
                          onClick={() =>
                            router.push(`/file/details/${sale._id}`)
                          }
                          className="px-1 py-1 bg-green-500 text-white rounded text-[10px]"
                          title="Détails"
                        >
                          <FontAwesomeIcon icon={faFile} />
                        </button>
                        <button
                          onClick={() => handleRowDoubleClick(sale)}
                          className="px-1 py-1 bg-yellow-500 text-white rounded text-[10px]"
                          title="Paiements"
                        >
                          <FontAwesomeIcon icon={faMoneyBillWave} />
                        </button>
                        <button
                          onClick={() => handleCopySale(sale)}
                          className="px-1 py-1 bg-purple-500 text-white rounded text-[10px]"
                          title="Copier"
                        >
                          <FontAwesomeIcon icon={faCopy} />
                        </button>
                        <button
                          onClick={() => handleHideSale(sale)}
                          className="px-1 py-1 bg-red-500 text-white rounded text-[10px]"
                          title="Cacher"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}

            {showAllSales ? (
              <tr
                className="bg-gray-200 font-bold cursor-pointer"
                onMouseEnter={() => setShowConfetti(true)}
                onMouseLeave={() => setShowConfetti(false)}
              >
                <td colSpan="12" className="border px-1 py-1 text-right">
                  Totaux :
                </td>
                <td className="border px-1 py-1 text-right">
                  {formatNumber(calculateTotalTTC())}
                </td>
                <td className="border px-1 py-1 text-right">
                  {formatNumber(calculateTotalHT())}
                </td>
                <td colSpan="3" className="border px-1 py-1"></td>
              </tr>
            ) : (
              <tr
                className="bg-gray-200 font-bold cursor-pointer"
                onMouseEnter={() => setShowConfetti(true)}
                onMouseLeave={() => setShowConfetti(false)}
              >
                <td colSpan="5" className="border px-1 py-1 text-right">
                  Totaux :
                </td>
                <td className="border px-1 py-1 text-right">
                  {formatNumber(calculateTotalTTC())}
                </td>
                <td className="border px-1 py-1"></td>
                <td className="border px-1 py-1 text-right">
                  {formatNumber(calculateTotalHT())}
                </td>
                <td colSpan="3" className="border px-1 py-1"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center items-center space-x-1 mt-2 text-[10px]">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="px-1 py-1 bg-gray-500 text-white rounded disabled:opacity-50 text-[10px]"
        >
          Précédent
        </button>
        <span className="text-white text-[10px]">
          Page {currentPage} sur {totalPages}
        </span>
        <button
          onClick={() =>
            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
          }
          disabled={currentPage === totalPages}
          className="px-1 py-1 bg-gray-500 text-white rounded disabled:opacity-50 text-[10px]"
        >
          Suivant
        </button>
      </div>

      {showConfetti && <Confetti width={width} height={height} />}

      {isModalOpen && selectedSale && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white w-11/12 md:w-2/3 lg:w-1/2 p-2 rounded-lg overflow-y-auto max-h-screen text-[10px]">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xs font-bold">
                Paiements pour {selectedSale["NOM DU CLIENT"]}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-600 hover:text-gray-800 text-xs"
              >
                <FontAwesomeIcon icon={faTimes} size="lg" />
              </button>
            </div>
            <div className="mb-2 border-b pb-1">
              <h3 className="text-xs font-semibold mb-1">Aperçu de la Vente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-[10px]">
                <div>
                  <p>
                    <span className="font-bold">Date de Vente:</span>{" "}
                    {formatDate(selectedSale["DATE DE VENTE"])}
                  </p>
                  <p>
                    <span className="font-bold">Nom:</span>{" "}
                    {selectedSale["NOM DU CLIENT"] || ""}
                  </p>
                  <p>
                    <span className="font-bold">Téléphone:</span>{" "}
                    {selectedSale.TELEPHONE || ""}
                  </p>
                  <p>
                    <span className="font-bold">Adresse:</span>{" "}
                    {selectedSale["ADRESSE DU CLIENT"] || "N/A"}
                  </p>
                </div>
                <div>
                  <p>
                    <span className="font-bold">Ville:</span>{" "}
                    {selectedSale.VILLE || "N/A"}
                  </p>
                  <p>
                    <span className="font-bold">Vendeur:</span>{" "}
                    {selectedSale["VENDEUR"] || ""}
                  </p>
                  <p>
                    <span className="font-bold">Désignation:</span>{" "}
                    {selectedSale["DESIGNATION"] || ""}
                  </p>
                  <p>
                    <span className="font-bold">État:</span>{" "}
                    {selectedSale.ETAT || ""}
                  </p>
                </div>
              </div>
              <div className="mt-1 text-[10px]">
                <p>
                  <span className="font-bold">Montant TTC:</span>{" "}
                  {formatNumber(selectedSale["MONTANT TTC"])}
                </p>
                <p>
                  <span className="font-bold">Montant HT:</span>{" "}
                  {formatNumber(selectedSale["MONTANT HT"])}
                </p>
              </div>
            </div>

            <div className="mb-2 text-[10px]">
              <h3 className="font-bold mb-1 text-xs">Prévision Chantier:</h3>
              <input
                type="date"
                value={selectedSale["PREVISION CHANTIER"] || ""}
                onChange={(e) => {
                  const updatedSale = {
                    ...selectedSale,
                    "PREVISION CHANTIER": e.target.value,
                  };
                  setSelectedSale(updatedSale);
                  setSales((prevSales) =>
                    prevSales.map((s) =>
                      s._id === updatedSale._id ? updatedSale : s
                    )
                  );
                }}
                className="w-full p-1 border border-gray-300 rounded text-[10px]"
              />
            </div>

            <div className="mb-2 text-[10px]">
              <button
                onClick={handleSaveSale}
                className="px-2 py-1 bg-blue-500 text-white rounded text-[10px]"
              >
                Sauvegarder
              </button>
            </div>

            <div className="mb-2 text-[10px]">
              <h3 className="font-bold mb-1 text-xs">
                Progression des Paiements :
              </h3>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${calculateProgress()}%` }}
                ></div>
              </div>
              <p>
                <span className="font-bold">Total:</span>{" "}
                {formatNumber(
                  parseFloat(selectedSale["MONTANT TTC"]) ||
                    parseFloat(selectedSale["MONTANT HT"]) ||
                    0
                )}
              </p>
              <p>
                <span className="font-bold">Payé:</span>{" "}
                {formatNumber(calculateTotalPaid())}
              </p>
              <p>
                <span className="font-bold">Restant:</span>{" "}
                {formatNumber(
                  (parseFloat(selectedSale["MONTANT TTC"]) ||
                    parseFloat(selectedSale["MONTANT HT"]) ||
                    0) - calculateTotalPaid()
                )}
              </p>
            </div>

            <div className="mb-2 text-[10px]">
              <h3 className="font-bold mb-1 text-xs">
                Historique des paiements:
              </h3>
              {payments.length > 0 ? (
                <ul className="list-disc list-inside text-[10px]">
                  {payments.map((payment) => (
                    <li key={payment.id} className="mb-1">
                      <span className="font-medium">
                        {formatDate(payment.date)}
                      </span>{" "}
                      - {formatNumber(payment.montant)}
                      {payment.comment && (
                        <p className="text-[9px] text-gray-600">
                          Commentaire : {payment.comment}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Aucun paiement.</p>
              )}
            </div>

            <div className="mb-2 text-[10px]">
              <h3 className="font-bold mb-1 text-xs">Ajouter un paiement:</h3>
              <div className="flex flex-col space-y-1">
                <input
                  type="number"
                  step="0.01"
                  value={newPaymentAmount}
                  onChange={(e) => setNewPaymentAmount(e.target.value)}
                  placeholder="Montant"
                  className="p-1 border border-gray-300 rounded text-[10px]"
                />
                <input
                  type="date"
                  value={newPaymentDate}
                  onChange={(e) => setNewPaymentDate(e.target.value)}
                  className="p-1 border border-gray-300 rounded text-[10px]"
                />
                <textarea
                  value={newPaymentComment}
                  onChange={(e) => setNewPaymentComment(e.target.value)}
                  placeholder="Commentaire"
                  className="p-1 border border-gray-300 rounded text-[10px]"
                ></textarea>
                <div className="flex items-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="p-1 text-[10px]"
                  />
                  {ocrLoading && (
                    <span className="ml-1 text-gray-600 text-[9px]">
                      Analyse...
                    </span>
                  )}
                </div>
                <button
                  onClick={handleAddPayment}
                  className="px-2 py-1 bg-green-500 text-white rounded text-[10px]"
                >
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!showAllSales && (
        <footer className="fixed bottom-0 left-0 w-full bg-gray-700 text-white py-1 flex flex-col md:flex-row justify-between items-center px-1 text-[10px]">
          <div className="flex space-x-1 overflow-x-auto mb-1 md:mb-0">
            {months.map((month, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedMonth(index);
                  setCurrentPage(1);
                }}
                className={`px-1 py-1 rounded whitespace-nowrap text-[10px] ${
                  selectedMonth === index ? "bg-blue-500" : "bg-gray-600"
                }`}
              >
                {month}
              </button>
            ))}
          </div>
          <div className="flex items-center space-x-1">
            <label htmlFor="year" className="mr-1 text-[10px]">
              Année :
            </label>
            <select
              id="year"
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="p-1 bg-gray-600 rounded text-white text-[10px]"
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
      )}

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
          font-family: Arial, sans-serif;
          padding: 2px;
          border: 1px solid #d1d5db;
          white-space: nowrap;
          text-align: center;
        }
        th {
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default AllSales;
