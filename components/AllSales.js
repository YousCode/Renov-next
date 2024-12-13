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

// =============================
// Fonctions utilitaires
// =============================
const normalizeString = (str) => {
  return str
    ? str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    : "";
};

const formatDate = (dateStr) => {
  if (!dateStr) return "Date invalide";
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? "Date invalide" : date.toLocaleDateString("fr-FR");
};

const formatNumber = (value) => {
  const number = parseFloat(value);
  if (isNaN(number)) return value;
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

// Fonction pour calculer la commission selon le barème
function calculateCommission(sale) {
  // On suppose que le "CA HT (€)" = "MONTANT HT"
  const caHT = parseFloat(sale["MONTANT HT"]) || 0;
  let percent = 0.10; // T5 par défaut (10%)
  switch (sale["BAREME COM"]) {
    case "T1": percent = 0.20; break;
    case "T2": percent = 0.17; break;
    case "T3": percent = 0.15; break;
    case "T4": percent = 0.12; break;
    case "T5": percent = 0.10; break;
    case "T6": percent = 0.06; break;
    default: percent = 0.10;
  }
  return (caHT * percent).toFixed(2);
}

// Fonction pour obtenir la classe de background selon le barème
function getBaremeBgColor(bareme) {
  switch (bareme) {
    case "T1": return "bg-green-300";    // 20%
    case "T2": return "bg-blue-300";     // 17%
    case "T3": return "bg-purple-300";   // 15%
    case "T4": return "bg-yellow-300";   // 12%
    case "T5": return "";                // 10% pas de bg
    case "T6": return "bg-red-300";      // 6%
    default: return "";
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
      let tauxTVA = parseFloat(sale["TAUX TVA"]) || 5.5; // Valeur par défaut

      // Si le taux de TVA est supérieur à 1, on considère que c'est 5.5 ou 10.0
      if (tauxTVA !== 5.5 && tauxTVA !== 10) {
        // Par défaut 5.5 si non conforme
        tauxTVA = 5.5;
      }

      // Recalcul TTC/HT si nécessaire
      const tvaRate = (tauxTVA === 10) ? 0.10 : 0.055;
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

      // Assurer que "TAUX TVA" est en "5,5%" ou "10,0%"
      sale["TAUX TVA"] = (tauxTVA === 10) ? "10,0%" : "5,5%";

      if (!sale["PREVISION CHANTIER"]) {
        sale["PREVISION CHANTIER"] = null;
      }

      // En vue mensuelle, on a un BAREME COM (si pas présent, T5 par défaut)
      if (!sale["BAREME COM"]) {
        sale["BAREME COM"] = "T5";
      }

      // Calcul de la commission selon le barème
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
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('hiddenSales');
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });

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
        : (saleDate.getMonth() === selectedMonth && saleDate.getFullYear() === selectedYear);

      return (
        dateCondition &&
        !isExcludedState(etat) &&
        !hiddenSales.includes(sale._id)
      );
    });

    if (searchTerm) {
      filtered = filtered.filter(
        (sale) =>
          normalizeString(sale["NOM DU CLIENT"]).includes(searchTerm) ||
          normalizeString(sale["TELEPHONE"]).includes(searchTerm) ||
          normalizeString(sale["ADRESSE DU CLIENT"]).includes(searchTerm) ||
          normalizeString(sale["VENDEUR"]).includes(searchTerm) ||
          normalizeString(sale["DESIGNATION"]).includes(searchTerm)
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
  }, [showAllSales, selectedMonth, selectedYear, sortField, sortOrder, sales, currentPage, searchTerm, hiddenSales]);

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
      const { data: { text } } = await Tesseract.recognize(file, "fra");
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

  const calculateTotalPaid = () => {
    return payments.reduce((sum, payment) => sum + payment.montant, 0);
  };

  const calculateProgress = () => {
    const totalPaid = calculateTotalPaid();
    const totalAmount =
      parseFloat(selectedSale?.["MONTANT TTC"]) ||
      parseFloat(selectedSale?.["MONTANT HT"]) ||
      0;
    return totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;
  };

  const calculateSaleProgress = (sale) => {
    const totalPaid = (sale.payments || []).reduce(
      (sum, payment) => sum + parseFloat(p.montant),
      0
    );
    const totalAmount =
      parseFloat(sale["MONTANT TTC"]) || parseFloat(sale["MONTANT HT"]) || 0;
    return totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;
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

  const handleCopySale = (sale) => {
    const saleData = `
Date de Vente: ${formatDate(sale["DATE DE VENTE"])}
Nom du Client: ${sale["NOM DU CLIENT"]}
Téléphone: ${sale.TELEPHONE}
Adresse: ${sale["ADRESSE DU CLIENT"] || "Adresse manquante"}
Ville: ${sale.VILLE || "Ville manquante"}
Vendeur: ${sale["VENDEUR"] || "Vendeur inconnu"}
Désignation: ${sale["DESIGNATION"] || "Désignation manquante"}
Montant TTC: ${formatNumber(sale["MONTANT TTC"])}
Montant HT: ${formatNumber(sale["MONTANT HT"])}
Prévision Chantier: ${
      sale["PREVISION CHANTIER"] ? formatDate(sale["PREVISION CHANTIER"]) : "Non définie"
    }
État: ${sale.ETAT || "État inconnu"}
    `;
    navigator.clipboard.writeText(saleData)
      .then(() => alert("Vente copiée dans le presse-papiers !"))
      .catch((err) => {
        console.error("Erreur lors de la copie :", err);
        alert("Erreur lors de la copie.");
      });
  };

  const handleTotalMouseEnter = () => {
    setShowConfetti(true);
  };

  const handleTotalMouseLeave = () => {
    setShowConfetti(false);
  };

  const { width, height } = useWindowSize();

  const handleHideSale = (sale) => {
    const confirmation = confirm("Êtes-vous sûr de vouloir cacher cette vente ?");
    if (!confirmation) return;
    const updatedHiddenSales = [...hiddenSales, sale._id];
    setHiddenSales(updatedHiddenSales);
    localStorage.setItem('hiddenSales', JSON.stringify(updatedHiddenSales));

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
        headers: {
          "Content-Type": "application/json",
        },
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

  // Fonction pour copier les ventes affichées en CSV
  const handleCopyCSV = () => {
    if (displayedSales.length === 0) {
      alert("Aucune vente à copier.");
      return;
    }
    const keys = Object.keys(displayedSales[0]);
    const lines = [];
    lines.push(keys.join(";"));
    for (const sale of displayedSales) {
      const values = keys.map(k => sale[k] || "");
      lines.push(values.join(";"));
    }

    const csv = lines.join("\n");
    navigator.clipboard.writeText(csv)
      .then(() => alert("CSV des ventes copiées dans le presse-papiers !"))
      .catch(() => alert("Erreur lors de la copie du CSV."));
  };

  // Fonction pour télécharger les ventes affichées en CSV
  const handleDownloadCSV = () => {
    if (displayedSales.length === 0) {
      alert("Aucune vente à télécharger.");
      return;
    }
    const keys = Object.keys(displayedSales[0]);
    const lines = [];
    lines.push(keys.join(";"));
    for (const sale of displayedSales) {
      const values = keys.map(k => sale[k] || "");
      lines.push(values.join(";"));
    }
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
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

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-800 p-4 font-arial text-xs">
      <div className="flex flex-col items-center w-full mb-4">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg mb-2"
        >
          Retour
        </button>
        <button
          onClick={() => setShowAllSales(!showAllSales)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg mb-4"
        >
          {showAllSales ? "Afficher les ventes mensuelles" : "Afficher toutes les ventes"}
        </button>

        <div className="flex flex-col md:flex-row items-center justify-center w-full mb-2 space-y-2 md:space-y-0">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Rechercher par nom, téléphone, adresse, vendeur, désignation"
            className="w-full md:w-1/2 p-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="flex flex-wrap items-center justify-center w-full mb-2 space-x-2">
          <label className="text-white">Trier par :</label>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            className="p-1 border border-gray-300 rounded-lg text-xs"
          >
            <option value="DATE DE VENTE">Date de Vente</option>
            <option value="NOM DU CLIENT">Nom du Client</option>
            <option value="MONTANT HT">Montant HT</option>
            <option value="MONTANT TTC">Montant TTC</option>
            <option value="VENDEUR">Vendeur</option>
            <option value="DESIGNATION">Désignation</option>
            <option value="PREVISION CHANTIER">Prévision Chantier</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="p-1 border border-gray-300 rounded-lg text-xs"
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>

          {/* Boutons Copier CSV et Télécharger CSV */}
          <button
            onClick={handleCopyCSV}
            className="px-2 py-1 bg-purple-500 text-white rounded-lg text-xs"
            title="Copier les ventes affichées en CSV"
          >
            <FontAwesomeIcon icon={faCopy} /> Copier CSV
          </button>
          <button
            onClick={handleDownloadCSV}
            className="px-2 py-1 bg-green-500 text-white rounded-lg text-xs"
            title="Télécharger les ventes affichées en CSV"
          >
            <FontAwesomeIcon icon={faDownload} /> Télécharger CSV
          </button>
        </div>
      </div>

      <div className="w-full overflow-x-auto mb-16">
        <table ref={tableRef} className="min-w-full bg-white text-gray-800 text-xs">
          <thead className="bg-gray-700 text-white">
            {showAllSales ? (
              <tr>
                <th>Date</th>
                <th>Nom</th>
                <th>Téléphone</th>
                <th>Adresse</th>
                <th>Ville</th>
                <th>Vendeur</th>
                <th>Désignation</th>
                <th>Montant TTC</th>
                <th>Montant HT</th>
                <th>Prévision Chantier</th>
                <th>État</th>
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
              let rowClass = "bg-white";
              if (etatNormalized === "annule") {
                rowClass = "bg-red-200 animate-blink";
              } else if (!sale["ADRESSE DU CLIENT"] || !sale.VILLE) {
                rowClass = "animate-blink-yellow";
              }

              const rowProgress = calculateSaleProgress(sale);

              return (
                <tr
                  key={sale._id}
                  className={`${rowClass} hover:bg-gray-100`}
                  onDoubleClick={() => handleRowDoubleClick(sale)}
                >
                  {showAllSales ? (
                    <>
                      <td className="border px-2 py-1 relative">
                        {formatDate(sale["DATE DE VENTE"])}
                        <div className="absolute bottom-0 left-0 w-full mt-1">
                          <div className="w-full bg-gray-300 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${rowProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="border px-2 py-1">{sale["NOM DU CLIENT"]}</td>
                      <td className="border px-2 py-1">{sale.TELEPHONE}</td>
                      <td className="border px-2 py-1">{sale["ADRESSE DU CLIENT"] || "Adresse manquante"}</td>
                      <td className="border px-2 py-1">{sale.VILLE || "Ville manquante"}</td>
                      <td className="border px-2 py-1">{sale["VENDEUR"] || "Vendeur inconnu"}</td>
                      <td className="border px-2 py-1">{sale["DESIGNATION"] || "Désignation manquante"}</td>
                      <td className="border px-2 py-1 text-right">{formatNumber(sale["MONTANT TTC"])}</td>
                      <td className="border px-2 py-1 text-right">{formatNumber(sale["MONTANT HT"])}</td>
                      <td className="border px-2 py-1">
                        {sale["PREVISION CHANTIER"] ? formatDate(sale["PREVISION CHANTIER"]) : ""}
                      </td>
                      <td className="border px-2 py-1">{sale.ETAT || ""}</td>
                      <td className="border px-2 py-1 flex justify-center space-x-1">
                        <button
                          onClick={() => router.push(`/sales/edit/${sale._id}`)}
                          className="px-2 py-1 bg-blue-500 text-white rounded-lg text-xs"
                          title="Modifier la vente"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button
                          onClick={() => router.push(`/file/details/${sale._id}`)}
                          className="px-2 py-1 bg-green-500 text-white rounded-lg text-xs"
                          title="Voir les détails du fichier"
                        >
                          <FontAwesomeIcon icon={faFile} />
                        </button>
                        <button
                          onClick={() => handleRowDoubleClick(sale)}
                          className="px-2 py-1 bg-yellow-500 text-white rounded-lg text-xs"
                          title="Gérer les paiements"
                        >
                          <FontAwesomeIcon icon={faMoneyBillWave} />
                        </button>
                        <button
                          onClick={() => handleCopySale(sale)}
                          className="px-2 py-1 bg-purple-500 text-white rounded-lg text-xs"
                          title="Copier la vente"
                        >
                          <FontAwesomeIcon icon={faCopy} />
                        </button>
                        <button
                          onClick={() => handleHideSale(sale)}
                          className="px-2 py-1 bg-red-500 text-white rounded-lg text-xs"
                          title="Cacher la vente"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      {/* Mode mensuel inchangé */}
                      <td className="border px-2 py-1 relative">
                        {formatDate(sale["DATE DE VENTE"])}
                        <div className="absolute bottom-0 left-0 w-full mt-1">
                          <div className="w-full bg-gray-300 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${rowProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="border px-2 py-1">{sale["NOM DU CLIENT"]}</td>
                      <td className="border px-2 py-1">{sale["VENDEUR"] || "Inconnu"}</td>
                      <td className="border px-2 py-1">{sale["BC"] || ""}</td>
                      <td className="border px-2 py-1">{sale["DESIGNATION"] || "N/A"}</td>
                      <td className="border px-2 py-1 text-right">{formatNumber(sale["MONTANT TTC"])}</td>
                      <td className="border px-2 py-1">{sale["TAUX TVA"] || "N/A"}</td>
                      <td className="border px-2 py-1 text-right">{formatNumber(sale["MONTANT HT"])}</td>
                      <td className={`border px-2 py-1 ${getBaremeBgColor(sale["BAREME COM"])}`}>
                        <select
                          value={sale["BAREME COM"]}
                          onChange={(e)=>{
                            const newBareme=e.target.value;
                            const updatedSale={...sale,"BAREME COM":newBareme};
                            updatedSale["MONTANT COMMISSIONS"]=calculateCommission(updatedSale);
                            setSales(prev=>prev.map(s=>s._id===sale._id?updatedSale:s));
                          }}
                          className="p-1 border border-gray-300 rounded text-xs"
                        >
                          <option value="T1">T1 (20%)</option>
                          <option value="T2">T2 (17%)</option>
                          <option value="T3">T3 (15%)</option>
                          <option value="T4">T4 (12%)</option>
                          <option value="T5">T5 (10%)</option>
                          <option value="T6">T6 (6%)</option>
                        </select>
                      </td>
                      <td className="border px-2 py-1 text-right">
                        {sale["MONTANT COMMISSIONS"] ? formatNumber(sale["MONTANT COMMISSIONS"]) : "-"}
                      </td>
                      <td className="border px-2 py-1 flex justify-center space-x-1">
                        <button
                          onClick={() => router.push(`/sales/edit/${sale._id}`)}
                          className="px-2 py-1 bg-blue-500 text-white rounded-lg text-xs"
                          title="Modifier la vente"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button
                          onClick={() => router.push(`/file/details/${sale._id}`)}
                          className="px-2 py-1 bg-green-500 text-white rounded-lg text-xs"
                          title="Voir les détails du fichier"
                        >
                          <FontAwesomeIcon icon={faFile} />
                        </button>
                        <button
                          onClick={() => handleRowDoubleClick(sale)}
                          className="px-2 py-1 bg-yellow-500 text-white rounded-lg text-xs"
                          title="Gérer les paiements"
                        >
                          <FontAwesomeIcon icon={faMoneyBillWave} />
                        </button>
                        <button
                          onClick={() => handleCopySale(sale)}
                          className="px-2 py-1 bg-purple-500 text-white rounded-lg text-xs"
                          title="Copier la vente"
                        >
                          <FontAwesomeIcon icon={faCopy} />
                        </button>
                        <button
                          onClick={() => handleHideSale(sale)}
                          className="px-2 py-1 bg-red-500 text-white rounded-lg text-xs"
                          title="Cacher la vente"
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
                onMouseEnter={handleTotalMouseEnter}
                onMouseLeave={handleTotalMouseLeave}
              >
                <td colSpan="7" className="border px-2 py-1 text-right">Totaux :</td>
                <td className="border px-2 py-1 text-right">{formatNumber(calculateTotalTTC())}</td>
                <td className="border px-2 py-1 text-right">{formatNumber(calculateTotalHT())}</td>
                <td className="border px-2 py-1"></td>
                <td className="border px-2 py-1"></td>
                <td className="border px-2 py-1"></td>
              </tr>
            ) : (
              <tr
                className="bg-gray-200 font-bold cursor-pointer"
                onMouseEnter={handleTotalMouseEnter}
                onMouseLeave={handleTotalMouseLeave}
              >
                <td colSpan="5" className="border px-2 py-1 text-right">Totaux :</td>
                <td className="border px-2 py-1 text-right">{formatNumber(calculateTotalTTC())}</td>
                <td className="border px-2 py-1"></td>
                <td className="border px-2 py-1 text-right">{formatNumber(calculateTotalHT())}</td>
                <td className="border px-2 py-1"></td>
                <td className="border px-2 py-1"></td>
                <td className="border px-2 py-1"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center items-center space-x-2 mt-4">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="px-2 py-1 bg-gray-500 text-white rounded-lg disabled:opacity-50 text-xs"
        >
          Précédent
        </button>
        <span className="text-white text-xs">
          Page {currentPage} sur {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-2 py-1 bg-gray-500 text-white rounded-lg disabled:opacity-50 text-xs"
        >
          Suivant
        </button>
      </div>

      {showConfetti && <Confetti width={width} height={height} />}

      {isModalOpen && selectedSale && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white w-11/12 md:w-2/3 lg:w-1/2 p-6 rounded-lg overflow-y-auto max-h-screen">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-xs md:text-xs">
                Paiements pour {selectedSale["NOM DU CLIENT"]}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-600 hover:text-gray-800 text-xs md:text-xs"
              >
                <FontAwesomeIcon icon={faTimes} size="lg" />
              </button>
            </div>
            <div className="mb-6 border-b pb-4">
              <h3 className="text-xl font-semibold mb-2 text-xs md:text-xs">Aperçu de la Vente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p><span className="font-bold">Date de Vente:</span> {formatDate(selectedSale["DATE DE VENTE"])}</p>
                  <p><span className="font-bold">Nom du Client:</span> {selectedSale["NOM DU CLIENT"]}</p>
                  <p><span className="font-bold">Téléphone:</span> {selectedSale.TELEPHONE}</p>
                  <p><span className="font-bold">Adresse:</span> {selectedSale["ADRESSE DU CLIENT"] || "Adresse manquante"}</p>
                </div>
                <div>
                  <p><span className="font-bold">Ville:</span> {selectedSale.VILLE || "Ville manquante"}</p>
                  <p><span className="font-bold">Vendeur:</span> {selectedSale["VENDEUR"] || "Vendeur inconnu"}</p>
                  <p><span className="font-bold">Désignation:</span> {selectedSale["DESIGNATION"] || "Désignation manquante"}</p>
                  <p><span className="font-bold">État:</span> {selectedSale.ETAT || "État inconnu"}</p>
                </div>
              </div>
              <div className="mt-4">
                <p><span className="font-bold">Montant TTC:</span> {formatNumber(selectedSale["MONTANT TTC"])}</p>
                <p><span className="font-bold">Montant HT:</span> {formatNumber(selectedSale["MONTANT HT"])}</p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-bold mb-2 text-xs md:text-xs">Prévision Chantier :</h3>
              <input
                type="date"
                value={selectedSale["PREVISION CHANTIER"] || ""}
                onChange={(e) => {
                  const updatedSale = { ...selectedSale, "PREVISION CHANTIER": e.target.value };
                  setSelectedSale(updatedSale);
                  setSales((prevSales) =>
                    prevSales.map((s) => (s._id === updatedSale._id ? updatedSale : s))
                  );
                }}
                className="w-full p-2 border border-gray-300 rounded-lg text-xs md:text-xs"
              />
            </div>

            <div className="mb-6">
              <button
                onClick={handleSaveSale}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-xs md:text-xs"
              >
                Sauvegarder
              </button>
            </div>

            <div className="mb-6">
              <h3 className="font-bold mb-2 text-xs md:text-xs">Progression des Paiements :</h3>
              <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                <div
                  className="bg-green-500 h-4 rounded-full"
                  style={{ width: `${calculateProgress()}%` }}
                ></div>
              </div>
              <p className="text-xs md:text-xs">
                <span className="font-bold">Montant total :</span>{" "}
                {formatNumber(
                  parseFloat(selectedSale["MONTANT TTC"]) ||
                    parseFloat(selectedSale["MONTANT HT"]) ||
                    0
                )}
              </p>
              <p className="text-xs md:text-xs">
                <span className="font-bold">Montant payé :</span>{" "}
                {formatNumber(calculateTotalPaid())}
              </p>
              <p className="text-xs md:text-xs">
                <span className="font-bold">Montant restant :</span>{" "}
                {formatNumber(
                  (parseFloat(selectedSale["MONTANT TTC"]) ||
                    parseFloat(selectedSale["MONTANT HT"]) ||
                    0) - calculateTotalPaid()
                )}
              </p>
            </div>

            <div className="mb-6">
              <h3 className="font-bold mb-2 text-xs md:text-xs">Historique des paiements :</h3>
              {payments.length > 0 ? (
                <ul className="list-disc list-inside text-xs md:text-xs">
                  {payments.map((payment) => (
                    <li key={payment.id} className="mb-2">
                      <span className="font-medium">{formatDate(payment.date)}</span> - {formatNumber(payment.montant)}
                      {payment.comment && (
                        <p className="text-sm text-gray-600">Commentaire : {payment.comment}</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs md:text-xs">Aucun paiement enregistré.</p>
              )}
            </div>

            <div className="mb-6">
              <h3 className="font-bold mb-2 text-xs md:text-xs">Ajouter un paiement :</h3>
              <div className="flex flex-col space-y-2">
                <input
                  type="number"
                  step="0.01"
                  value={newPaymentAmount}
                  onChange={(e) => setNewPaymentAmount(e.target.value)}
                  placeholder="Montant"
                  className="p-2 border border-gray-300 rounded-lg text-xs md:text-xs"
                />
                <input
                  type="date"
                  value={newPaymentDate}
                  onChange={(e) => setNewPaymentDate(e.target.value)}
                  className="p-2 border border-gray-300 rounded-lg text-xs md:text-xs"
                />
                <textarea
                  value={newPaymentComment}
                  onChange={(e) => setNewPaymentComment(e.target.value)}
                  placeholder="Commentaire"
                  className="p-2 border border-gray-300 rounded-lg text-xs md:text-xs"
                ></textarea>
                <div className="flex items-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="p-2 text-xs md:text-xs"
                  />
                  {ocrLoading && (
                    <span className="ml-2 text-gray-600 text-xs md:text-xs">
                      Analyse en cours...
                    </span>
                  )}
                </div>
                <button
                  onClick={handleAddPayment}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg text-xs md:text-xs"
                >
                  Ajouter le paiement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!showAllSales && (
        <footer className="fixed bottom-0 left-0 w-full bg-gray-700 text-white py-4 flex flex-col md:flex-row justify-between items-center px-4">
          <div className="flex space-x-2 overflow-x-auto mb-2 md:mb-0">
            {months.map((month, index) => (
              <button
                key={index}
                onClick={() => {setSelectedMonth(index); setCurrentPage(1);}}
                className={`px-2 py-1 rounded-lg whitespace-nowrap text-xs md:text-xs ${
                  selectedMonth === index ? "bg-blue-500" : "bg-gray-600"
                }`}
              >
                {month}
              </button>
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <label htmlFor="year" className="mr-2 text-xs md:text-xs">
              Année :
            </label>
            <select
              id="year"
              value={selectedYear}
              onChange={(e) => {setSelectedYear(Number(e.target.value)); setCurrentPage(1);}}
              className="p-1 bg-gray-600 rounded-lg text-white text-xs md:text-xs"
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
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        .animate-blink {
          animation: blink 1s infinite;
        }
        .animate-blink-yellow {
          animation: blink-yellow 1s infinite;
          background-color: #fff3cd;
        }
        @keyframes blink-yellow {
          0% { background-color: #fff3cd; }
          50% { background-color: #ffecb5; }
          100% { background-color: #fff3cd; }
        }
        th, td {
          padding: 4px;
          border: 1px solid #d1d5db;
          white-space: nowrap;
          text-align: center;
          font-family: Arial, sans-serif;
          font-size: 12px;
        }
        th {
          font-weight: bold;
        }
        .font-arial {
          font-family: Arial, sans-serif;
        }
        footer button:hover {
          background-color: #ffffff44;
        }
        .bg-blue-500:hover,
        .bg-green-500:hover,
        .bg-yellow-500:hover,
        .bg-red-500:hover,
        .bg-purple-500:hover {
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
};

export default AllSales;