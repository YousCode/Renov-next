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
} from "@fortawesome/free-solid-svg-icons";
import Confetti from "react-confetti";
import useWindowSize from "react-use/lib/useWindowSize";

// Fonction pour normaliser les chaînes de caractères
const normalizeString = (str) => {
  return str
    ? str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    : "";
};

// Nombre d'éléments par page
const ITEMS_PER_PAGE = 500;

// Fonction pour formater les dates
const formatDate = (dateStr) => {
  if (!dateStr) return "Date invalide";

  const date = new Date(dateStr);
  return isNaN(date.getTime())
    ? "Date invalide"
    : date.toLocaleDateString("fr-FR");
};

// Fonction pour formater les nombres
const formatNumber = (value) => {
  const number = parseFloat(value);
  return isNaN(number) ? value : number.toFixed(2) + " €";
};

// Liste des états à exclure (sans "annule")
const EXCLUDED_STATES = [
  // ... votre liste d'états ...
];

// Fonction pour déterminer si un état doit être exclu
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

// Fonction pour traiter les montants HT et TTC et supprimer les doublons
const processSalesData = (salesData) => {
  const uniqueSales = [];
  const seen = new Set();

  salesData.forEach((sale) => {
    // Définir un identifiant unique pour chaque vente basée sur certains champs
    const identifier = `${normalizeString(sale["NOM DU CLIENT"])}|${formatDate(
      sale["DATE DE VENTE"]
    )}|${sale["MONTANT TTC"]}|${sale["VENDEUR"]}`;

    if (!seen.has(identifier)) {
      seen.add(identifier);

      let montantHT = parseFloat(sale["MONTANT HT"]);
      let montantTTC = parseFloat(sale["MONTANT TTC"]);
      let tauxTVA = parseFloat(sale["TAUX TVA"]) || 5.5; // Valeur par défaut

      // Si le taux de TVA est supérieur à 1, le considérer comme un pourcentage
      if (tauxTVA > 1) {
        tauxTVA = tauxTVA / 100;
      }

      // Calculer Montant TTC si manquant
      if (isNaN(montantTTC) && !isNaN(montantHT)) {
        montantTTC = montantHT * (1 + tauxTVA);
        sale["MONTANT TTC"] = montantTTC.toFixed(2);
      }

      // Calculer Montant HT si manquant
      if (isNaN(montantHT) && !isNaN(montantTTC)) {
        montantHT = montantTTC / (1 + tauxTVA);
        sale["MONTANT HT"] = montantHT.toFixed(2);
      }

      // Si les deux sont manquants, les initialiser à 0
      if (isNaN(montantHT) && isNaN(montantTTC)) {
        sale["MONTANT HT"] = "0.00";
        sale["MONTANT TTC"] = "0.00";
      }

      // Assurer que le taux de TVA est toujours présent
      if (!sale["TAUX TVA"]) {
        sale["TAUX TVA"] = "5.5";
      }

      // Assurer que "PREVISION CHANTIER" est présent
      if (!sale["PREVISION CHANTIER"]) {
        sale["PREVISION CHANTIER"] = null; // Ou une date par défaut
      }

      uniqueSales.push(sale);
    }
  });

  return uniqueSales;
};

const AllSales = () => {
  const [sales, setSales] = useState([]);
  const [displayedSales, setDisplayedSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("DATE DE VENTE"); // Champ de tri
  const [sortOrder, setSortOrder] = useState("asc"); // Ordre de tri
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [payments, setPayments] = useState([]);
  const [newPaymentAmount, setNewPaymentAmount] = useState("");
  const [newPaymentDate, setNewPaymentDate] = useState("");
  const [newPaymentComment, setNewPaymentComment] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showAllSales, setShowAllSales] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [currentPage, setCurrentPage] = useState(1); // Page actuelle
  const [totalPages, setTotalPages] = useState(1); // Nombre total de pages

  const router = useRouter();

  const tableRef = useRef(null);

  useEffect(() => {
    fetchSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      filterSalesByDate(processedSales);
    } catch (error) {
      console.error("Erreur lors de la récupération des ventes :", error);
      setError(`Erreur : ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filterSalesByDate = (salesData) => {
    let filtered = salesData.filter((sale) => {
      const saleDate = new Date(sale["DATE DE VENTE"]);
      const etat = normalizeString(sale.ETAT || "");

      // Inclure les ventes même si l'état est vide
      return (
        (!showAllSales
          ? saleDate.getMonth() === selectedMonth &&
            saleDate.getFullYear() === selectedYear
          : true) && !isExcludedState(etat)
      );
    });

    // Filtrer par recherche
    if (searchTerm) {
      filtered = filtered.filter(
        (sale) =>
          normalizeString(sale["NOM DU CLIENT"]).includes(searchTerm) ||
          normalizeString(sale["TELEPHONE"]).includes(searchTerm) ||
          normalizeString(sale["ADRESSE DU CLIENT"]).includes(searchTerm) ||
          normalizeString(sale["VENDEUR"]).includes(searchTerm) || // Inclure le vendeur dans la recherche
          normalizeString(sale["DESIGNATION"]).includes(searchTerm) // Inclure la désignation dans la recherche
      );
    }

    // Trier les ventes
    filtered.sort((a, b) => {
      let valueA = a[sortField];
      let valueB = b[sortField];

      // Gérer les dates
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

    // Pagination
    setTotalPages(Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedSales = filtered.slice(startIndex, endIndex);

    setDisplayedSales(paginatedSales);
  };

  useEffect(() => {
    filterSalesByDate(sales);
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
  ]);

  const handleMonthChange = (month) => {
    setSelectedMonth(month);
    setCurrentPage(1); // Réinitialiser à la première page lors du changement de mois
  };

  const handleYearChange = (event) => {
    setSelectedYear(Number(event.target.value));
    setCurrentPage(1); // Réinitialiser à la première page lors du changement d'année
  };

  const handleSearchChange = (e) => {
    const term = normalizeString(e.target.value);
    setSearchTerm(term);
    setCurrentPage(1); // Réinitialiser à la première page lors de la recherche
  };

  const handleToggleShowAllSales = () => {
    setShowAllSales((prev) => !prev);
    setCurrentPage(1); // Réinitialiser à la première page
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

    const montant = parseFloat(newPaymentAmount);
    if (isNaN(montant) || montant <= 0) {
      alert("Veuillez entrer un montant valide.");
      return;
    }

    const newPayment = {
      montant: montant,
      date: newPaymentDate,
      comment: newPaymentComment, // Ajouter le commentaire
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
    setNewPaymentComment("");
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

  // Fonction pour calculer la progression des paiements pour une vente
  const calculateSaleProgress = (sale) => {
    const totalPaid = (sale.payments || []).reduce(
      (sum, payment) => sum + parseFloat(payment.montant),
      0
    );
    const totalAmount =
      parseFloat(sale["MONTANT TTC"]) || parseFloat(sale["MONTANT HT"]) || 0;
    return totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;
  };

  // Calcul du total HT des ventes affichées (en excluant les ventes annulées)
  const calculateTotalHT = () => {
    return displayedSales.reduce((sum, sale) => {
      const etat = normalizeString(sale.ETAT || "");
      if (etat === "annule") {
        return sum;
      }
      const montantHT = parseFloat(sale["MONTANT HT"]);
      return sum + (isNaN(montantHT) ? 0 : montantHT);
    }, 0);
  };

  // Calcul du total TTC des ventes affichées (en excluant les ventes annulées)
  const calculateTotalTTC = () => {
    return displayedSales.reduce((sum, sale) => {
      const etat = normalizeString(sale.ETAT || "");
      if (etat === "annule") {
        return sum;
      }
      const montantTTC = parseFloat(sale["MONTANT TTC"]);
      return sum + (isNaN(montantTTC) ? 0 : montantTTC);
    }, 0);
  };

  // Fonction pour copier une ligne de vente
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
Prévision Chantier: ${sale["PREVISION CHANTIER"] ? formatDate(sale["PREVISION CHANTIER"]) : "Non définie"}
État: ${sale.ETAT || "État inconnu"}
    `;
    navigator.clipboard
      .writeText(saleData)
      .then(() => {
        alert("Vente copiée dans le presse-papiers !");
      })
      .catch((err) => {
        console.error("Erreur lors de la copie :", err);
        alert("Erreur lors de la copie.");
      });
  };

  // Gestion de l'animation des confettis
  const handleTotalMouseEnter = () => {
    setShowConfetti(true);
  };

  const handleTotalMouseLeave = () => {
    setShowConfetti(false);
  };

  // Obtenir la taille de la fenêtre pour Confetti
  const { width, height } = useWindowSize();

  // Fonction pour supprimer une vente de l'affichage avec confirmation
  const handleDeleteSale = (sale) => {
    if (
      confirm("Êtes-vous sûr de vouloir retirer cette vente de l'affichage ?")
    ) {
      // Retirer la vente de l'état `sales`
      setSales((prevSales) => prevSales.filter((s) => s._id !== sale._id));
      alert("Vente retirée de l'affichage.");
    }
  };

  // Fonction pour sauvegarder les modifications de la vente
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
        setIsModalOpen(false); // Fermer la modal après sauvegarde
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erreur : ${response.status}`);
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde :", error.message);
      alert(`Erreur lors de la sauvegarde : ${error.message}`);
    }
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
    <div className="min-h-screen flex flex-col items-center bg-gray-800 p-4 font-arial text-sm">
      <div className="flex flex-col items-center w-full mb-4">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg mb-2"
        >
          Retour
        </button>
        <div className="flex flex-col md:flex-row items-center justify-center w-full mb-2 space-y-2 md:space-y-0">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Rechercher par nom, téléphone, adresse, vendeur, désignation"
            className="w-full md:w-1/2 p-2 border border-gray-300 rounded-lg"
          />
          <button
            onClick={handleToggleShowAllSales}
            className="mt-2 md:mt-0 md:ml-4 px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            {showAllSales
              ? "Afficher les ventes du mois"
              : "Afficher toutes les ventes"}
          </button>
        </div>
        {/* Filtres de tri */}
        <div className="flex items-center space-x-2 mb-2">
          <label className="text-white">Trier par :</label>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            className="p-1 border border-gray-300 rounded-lg"
          >
            <option value="DATE DE VENTE">Date de Vente</option>
            <option value="NOM DU CLIENT">Nom du Client</option>
            <option value="MONTANT HT">Montant HT</option>
            <option value="MONTANT TTC">Montant TTC</option>
            <option value="VENDEUR">Vendeur</option>
            <option value="DESIGNATION">Désignation</option>
            <option value="PREVISION CHANTIER">Prévision Chantier</option> {/* Ajouté pour trier */}
            {/* Ajoutez d'autres options si nécessaire */}
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="p-1 border border-gray-300 rounded-lg"
          >
            <option value="asc">Ascendant</option>
            <option value="desc">Descendant</option>
          </select>
        </div>
      </div>

      <div className="w-full overflow-x-auto mb-16">
        <table ref={tableRef} className="min-w-full bg-white text-gray-800 text-sm">
          <thead className="bg-gray-700 text-white">
            <tr>
              <th className="px-2 py-1">Date</th>
              <th className="px-2 py-1">Nom</th>
              <th className="px-2 py-1">Téléphone</th>
              <th className="px-2 py-1">Adresse</th>
              <th className="px-2 py-1">Ville</th>
              <th className="px-2 py-1">Vendeur</th>
              <th className="px-2 py-1">Désignation</th>
              <th className="px-2 py-1">Montant TTC</th>
              <th className="px-2 py-1">Montant HT</th>
              <th className="px-2 py-1">Prévision Chantier</th> {/* Nouvelle colonne */}
              <th className="px-2 py-1">État</th>
              <th className="px-2 py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedSales.map((sale) => (
              <tr
                key={sale._id}
                className={`${
                  normalizeString(sale.ETAT) === "annule"
                    ? "bg-red-200 animate-blink"
                    : !sale["ADRESSE DU CLIENT"] || !sale.VILLE
                    ? "animate-blink-yellow"
                    : "bg-white"
                } hover:bg-gray-100`}
                onDoubleClick={() => handleRowDoubleClick(sale)}
              >
                <td className="border px-2 py-1 relative">
                  {formatDate(sale["DATE DE VENTE"])}
                  {/* Barre de progression */}
                  <div className="absolute bottom-0 left-0 w-full mt-1">
                    <div className="w-full bg-gray-300 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${calculateSaleProgress(sale)}%` }}
                      ></div>
                    </div>
                  </div>
                </td>
                <td className="border px-2 py-1">{sale["NOM DU CLIENT"]}</td>
                <td className="border px-2 py-1">{sale.TELEPHONE}</td>
                <td className="border px-2 py-1">
                  {sale["ADRESSE DU CLIENT"] || "Adresse manquante"}
                </td>
                <td className="border px-2 py-1">
                  {sale.VILLE || "Ville manquante"}
                </td>
                <td className="border px-2 py-1">
                  {sale["VENDEUR"] || "Vendeur inconnu"}
                </td>
                <td className="border px-2 py-1">
                  {sale["DESIGNATION"] || "Désignation manquante"}
                </td>
                <td className="border px-2 py-1">
                  {formatNumber(sale["MONTANT TTC"])}
                </td>
                <td className="border px-2 py-1">
                  {formatNumber(sale["MONTANT HT"])}
                </td>
                <td className="border px-2 py-1">
                  {sale["PREVISION CHANTIER"]
                    ? formatDate(sale["PREVISION CHANTIER"])
                    : "Non définie"}
                </td>
                <td className="border px-2 py-1">
                  {sale.ETAT || ""}
                </td>
                <td className="border px-2 py-1 flex justify-center space-x-1">
                  <button
                    onClick={() => router.push(`/sales/edit/${sale._id}`)}
                    className="px-2 py-1 bg-blue-500 text-white rounded-lg"
                    title="Modifier la vente" // Tooltip ajouté
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  <button
                    onClick={() => router.push(`/file/details/${sale._id}`)}
                    className="px-2 py-1 bg-green-500 text-white rounded-lg"
                    title="Voir les détails du fichier" // Tooltip ajouté
                  >
                    <FontAwesomeIcon icon={faFile} />
                  </button>
                  <button
                    onClick={() => handleRowDoubleClick(sale)}
                    className="px-2 py-1 bg-yellow-500 text-white rounded-lg"
                    title="Gérer les paiements" // Tooltip ajouté
                  >
                    <FontAwesomeIcon icon={faMoneyBillWave} />
                  </button>
                  <button
                    onClick={() => handleCopySale(sale)}
                    className="px-2 py-1 bg-purple-500 text-white rounded-lg"
                    title="Copier la vente" // Tooltip ajouté
                  >
                    <FontAwesomeIcon icon={faCopy} />
                  </button>
                  <button
                    onClick={() => handleDeleteSale(sale)}
                    className="px-2 py-1 bg-red-500 text-white rounded-lg"
                    title="Supprimer la vente" // Tooltip ajouté
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </td>
              </tr>
            ))}
            {/* Ligne pour les totaux HT et TTC */}
            <tr
              className="bg-gray-200 font-bold cursor-pointer"
              onMouseEnter={handleTotalMouseEnter}
              onMouseLeave={handleTotalMouseLeave}
            >
              <td colSpan="10" className="border px-2 py-1 text-right">
                Total TTC :
              </td>
              <td className="border px-2 py-1">
                {formatNumber(calculateTotalTTC())}
              </td>
              <td className="border px-2 py-1">
                {formatNumber(calculateTotalHT())}
              </td>
              <td className="border px-2 py-1"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Contrôles de pagination */}
      <div className="flex justify-center items-center space-x-2 mt-4">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="px-2 py-1 bg-gray-500 text-white rounded-lg disabled:opacity-50"
        >
          Précédent
        </button>
        <span className="text-white">
          Page {currentPage} sur {totalPages}
        </span>
        <button
          onClick={() =>
            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
          }
          disabled={currentPage === totalPages}
          className="px-2 py-1 bg-gray-500 text-white rounded-lg disabled:opacity-50"
        >
          Suivant
        </button>
      </div>

      {/* Animation de confettis */}
      {showConfetti && <Confetti width={width} height={height} />}

      {/* Modal pour gérer les paiements */}
      {isModalOpen && selectedSale && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white w-11/12 md:w-2/3 lg:w-1/2 p-6 rounded-lg overflow-y-auto max-h-screen">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">
                Paiements pour {selectedSale["NOM DU CLIENT"]}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-600 hover:text-gray-800"
              >
                <FontAwesomeIcon icon={faTimes} size="lg" />
              </button>
            </div>

            {/* Aperçu Global */}
            <div className="mb-6 border-b pb-4">
              <h3 className="text-xl font-semibold mb-2">Aperçu de la Vente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p>
                    <span className="font-bold">Date de Vente:</span>{" "}
                    {formatDate(selectedSale["DATE DE VENTE"])}
                  </p>
                  <p>
                    <span className="font-bold">Nom du Client:</span>{" "}
                    {selectedSale["NOM DU CLIENT"]}
                  </p>
                  <p>
                    <span className="font-bold">Téléphone:</span>{" "}
                    {selectedSale.TELEPHONE}
                  </p>
                  <p>
                    <span className="font-bold">Adresse:</span>{" "}
                    {selectedSale["ADRESSE DU CLIENT"] || "Adresse manquante"}
                  </p>
                </div>
                <div>
                  <p>
                    <span className="font-bold">Ville:</span>{" "}
                    {selectedSale.VILLE || "Ville manquante"}
                  </p>
                  <p>
                    <span className="font-bold">Vendeur:</span>{" "}
                    {selectedSale["VENDEUR"] || "Vendeur inconnu"}
                  </p>
                  <p>
                    <span className="font-bold">Désignation:</span>{" "}
                    {selectedSale["DESIGNATION"] || "Désignation manquante"}
                  </p>
                  <p>
                    <span className="font-bold">État:</span>{" "}
                    {selectedSale.ETAT || "État inconnu"}
                  </p>
                </div>
              </div>
              <div className="mt-4">
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

            {/* Champ "Prévision Chantier" */}
            <div className="mb-6">
              <h3 className="font-bold mb-2">Prévision Chantier :</h3>
              <input
                type="date"
                value={selectedSale["PREVISION CHANTIER"] || ""}
                onChange={(e) => {
                  const updatedSale = { ...selectedSale, "PREVISION CHANTIER": e.target.value };
                  setSelectedSale(updatedSale);
                  // Optionnel : Mettre à jour les ventes dans l'état
                  setSales((prevSales) =>
                    prevSales.map((s) =>
                      s._id === updatedSale._id ? updatedSale : s
                    )
                  );
                }}
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
            </div>

            {/* Bouton de Sauvegarde */}
            <div className="mb-6">
              <button
                onClick={handleSaveSale}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg"
              >
                Sauvegarder
              </button>
            </div>

            {/* Progression des Paiements */}
            <div className="mb-6">
              <h3 className="font-bold mb-2">Progression des Paiements :</h3>
              <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                <div
                  className="bg-green-500 h-4 rounded-full"
                  style={{ width: `${calculateProgress()}%` }}
                ></div>
              </div>
              <p>
                <span className="font-bold">Montant total :</span>{" "}
                {formatNumber(
                  parseFloat(selectedSale["MONTANT TTC"]) ||
                    parseFloat(selectedSale["MONTANT HT"]) ||
                    0
                )}
              </p>
              <p>
                <span className="font-bold">Montant payé :</span>{" "}
                {formatNumber(calculateTotalPaid())}
              </p>
              <p>
                <span className="font-bold">Montant restant :</span>{" "}
                {formatNumber(
                  (parseFloat(selectedSale["MONTANT TTC"]) ||
                    parseFloat(selectedSale["MONTANT HT"]) ||
                    0) - calculateTotalPaid()
                )}
              </p>
            </div>

            {/* Historique des Paiements */}
            <div className="mb-6">
              <h3 className="font-bold mb-2">Historique des paiements :</h3>
              {payments.length > 0 ? (
                <ul className="list-disc list-inside">
                  {payments.map((payment) => (
                    <li key={payment.id} className="mb-2">
                      <span className="font-medium">
                        {formatDate(payment.date)}
                      </span>{" "}
                      - {formatNumber(payment.montant)}
                      {payment.comment && (
                        <p className="text-sm text-gray-600">
                          Commentaire : {payment.comment}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Aucun paiement enregistré.</p>
              )}
            </div>

            {/* Ajouter un Paiement */}
            <div className="mb-6">
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
                <textarea
                  value={newPaymentComment}
                  onChange={(e) => setNewPaymentComment(e.target.value)}
                  placeholder="Commentaire"
                  className="p-2 border border-gray-300 rounded-lg"
                ></textarea>
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
      {!showAllSales && (
        <footer className="fixed bottom-0 left-0 w-full bg-gray-700 text-white py-4 flex flex-col md:flex-row justify-between items-center px-4">
          <div className="flex space-x-2 overflow-x-auto mb-2 md:mb-0">
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
          padding: 4px; /* Réduit de px-2 py-1 */
          border: 1px solid #d1d5db;
          white-space: nowrap;
          text-align: center;
          font-family: Arial, sans-serif; /* Assure Arial pour les cellules */
          font-size: 14px; /* Taille du texte à 14px */
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
        /* Ajustement des boutons dans le modal */
        .bg-blue-500:hover,
        .bg-green-500:hover,
        .bg-yellow-500:hover,
        .bg-red-500:hover,
        .bg-purple-500:hover { /* Ajout de la couleur pour le bouton de copie */
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
};

export default AllSales;