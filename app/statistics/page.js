"use client";

import React, { useState, useEffect } from "react";
import { Doughnut } from "react-chartjs-2";
import { ClipLoader } from "react-spinners";
import DatePicker from "react-datepicker";
import confetti from "canvas-confetti";
import Navbar from "@/components/Navbar";

import "react-datepicker/dist/react-datepicker.css";

// ─────────────────────────────────────────────────────────────
// 1. Configuration Chart.js
// ─────────────────────────────────────────────────────────────
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Colors,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Colors,
  ChartDataLabels
);

// ─────────────────────────────────────────────────────────────
// 2. Constantes globales
// ─────────────────────────────────────────────────────────────
const VENDORS_TO_DISPLAY = [
  "payet",
  "rivet",
  "masson",
  "deberre",
  "fontaine",
  "villa",
  "lopez",
  "belmond",
  "antunes",
  "lanvin",
  "regonesi",
  "costa",
];

// Palette de couleurs pour les vendeurs (suffisamment grande)
const CHART_COLORS = [
  "#FF6384",
  "#36A2EB",
  "#FFCE56",
  "#4BC0C0",
  "#F77825",
  "#9966FF",
  "#FF9F40",
  "#B21FDE",
  "#2FDE00",
  "#00A6B4",
  "#6800B4",
];

// Options communes pour le Doughnut principal
const DOUGHNUT_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "70%", // ou "50%" selon vos préférences
  plugins: {
    legend: {
      display: false,
    },
    title: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label: function (tooltipItem) {
          const label = tooltipItem.label;
          // L'accès direct à bestSellers[label] se fera depuis la config plus bas
          return `Montant HT: ??? €`;
        },
      },
    },
    datalabels: {
      display: false,
    },
  },
  animation: {
    animateScale: true,
    animateRotate: true,
    duration: 1500,
    easing: "easeInOutBounce",
  },
};

// ─────────────────────────────────────────────────────────────
// 3. Composant principal
// ─────────────────────────────────────────────────────────────
const StatisticsDashboard = () => {
  // ───────────────────────────────────────────────────────────
  // 3.1. States
  // ───────────────────────────────────────────────────────────
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtrage par période
  const [filter, setFilter] = useState("mois");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  // Sélection d'un vendeur (pour le modal) & meilleur vendeur
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [bestSeller, setBestSeller] = useState(null);

  // ───────────────────────────────────────────────────────────
  // 3.2. useEffect : Récupération initiale des ventes
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchSales = async () => {
      try {
        const response = await fetch("/api/ventes");
        if (!response.ok) {
          throw new Error(
            `Échec de la récupération des ventes: ${response.statusText}`
          );
        }
        const data = await response.json();
        setSales(data.data || []);

        // Calcule le meilleur vendeur global
        const sortedSellers = data.data.reduce((acc, sale) => {
          // On ignore si ETAT = "annule" ou MONTANT ANNULE != 0
          if (
            normalizeString(sale["ETAT"]) !== "annule" &&
            parseFloat(sale["MONTANT ANNULE"]) === 0
          ) {
            const sellerField = sale["VENDEUR"];
            if (sellerField) {
              const sellerNames = sellerField.split("/").map(normalizeString);
              const montantTTC = parseFloat(sale["MONTANT TTC "]) || 0;
              sellerNames.forEach((seller) => {
                if (!acc[seller]) acc[seller] = 0;
                acc[seller] += montantTTC;
              });
            }
          }
          return acc;
        }, {});

        // Tri et meilleur vendeur
        const topSellerEntry = Object.entries(sortedSellers)
          .filter(([seller]) => VENDORS_TO_DISPLAY.includes(seller))
          .sort((a, b) => b[1] - a[1])[0];

        if (topSellerEntry) {
          setBestSeller(topSellerEntry[0]);
          setSelectedSeller(topSellerEntry[0]);
        }
      } catch (err) {
        setError(`Erreur: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, []);

  // ───────────────────────────────────────────────────────────
  // 3.3. useEffect : Confettis si on sélectionne le bestSeller
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedSeller && selectedSeller === bestSeller) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [selectedSeller, bestSeller]);

  // ───────────────────────────────────────────────────────────
  // 3.4. Fonctions utilitaires
  // ───────────────────────────────────────────────────────────
  const normalizeString = (str) =>
    str
      ? str
          .trim()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
      : "";

  /**
   * Filtre les ventes selon le "filter" (mois, annee, personnalisée).
   */
  function getFilteredSales() {
    return sales.filter((sale) => {
      const saleDate = new Date(sale["DATE DE VENTE"]);
      switch (filter) {
        case "mois":
          return (
            saleDate.getFullYear() === selectedDate.getFullYear() &&
            saleDate.getMonth() === selectedDate.getMonth()
          );
        case "annee":
          return saleDate.getFullYear() === selectedDate.getFullYear();
        case "personnalise":
          return saleDate >= startDate && saleDate <= endDate;
        default:
          return true;
      }
    });
  }

  /**
   * Regroupe les ventes par vendeur (à partir du champ "VENDEUR"),
   * tout en tenant compte du partage (s'il y a plusieurs vendeurs).
   */
  function computeSellersStats(filteredSales) {
    return filteredSales.reduce((acc, sale) => {
      // On ignore si ETAT = "annule" ou MONTANT ANNULE = 0
      if (
        normalizeString(sale["ETAT"]) === "annule" ||
        parseFloat(sale["MONTANT ANNULE"]) === 0
      ) {
        return acc;
      }
      const sellerField = sale["VENDEUR"];
      if (!sellerField) return acc;

      const sellers = sellerField.split("/").map(normalizeString);
      const montantTTC = parseFloat(sale["MONTANT TTC "]) || 0;
      const montantHT = parseFloat(sale["MONTANT HT"]) || 0;

      // On partage la somme entre chaque vendeur
      const shareTTC = montantTTC / sellers.length;
      const shareHT = montantHT / sellers.length;
      const shareCount = 1 / sellers.length;

      sellers.forEach((seller) => {
        if (!seller) return;
        if (!acc[seller]) {
          acc[seller] = { montantTTC: 0, montantHT: 0, count: 0 };
        }
        acc[seller].montantTTC += shareTTC;
        acc[seller].montantHT += shareHT;
        acc[seller].count += shareCount;
      });

      return acc;
    }, {});
  }

  /**
   * Calcule les stats "agence" (nombre total de ventes, total CA, etc.).
   */
  function computeAgencyStats(filteredSales) {
    return filteredSales.reduce(
      (acc, sale) => {
        acc.totalSales += parseFloat(sale["MONTANT TTC "]) || 0;
        acc.totalCount += 1;
        return acc;
      },
      { totalSales: 0, totalCount: 0 }
    );
  }

  // ───────────────────────────────────────────────────────────
  // 3.5. Calculs (filtrage, stats vendeurs, stats agence, etc.)
  // ───────────────────────────────────────────────────────────
  const filteredSales = getFilteredSales();
  const sellersStats = computeSellersStats(filteredSales);
  const agencyStats = computeAgencyStats(filteredSales);

  // On calcule la somme TTC de tous les vendeurs
  const totalSales = Object.values(sellersStats).reduce(
    (sum, { montantTTC }) => sum + montantTTC,
    0
  );

  // On trie les vendeurs (ceux autorisés dans VENDORS_TO_DISPLAY)
  const sortedSellers = Object.entries(sellersStats)
    .filter(([seller]) => VENDORS_TO_DISPLAY.includes(seller))
    .sort((a, b) => b[1].montantTTC - a[1].montantTTC);

  // ───────────────────────────────────────────────────────────
  // 3.6. Configuration du Doughnut principal
  // ───────────────────────────────────────────────────────────
  const sellersChartData = {
    labels: sortedSellers.map(([seller]) => seller),
    datasets: [
      {
        label: "Ventes par vendeur",
        data: sortedSellers.map(([, { montantTTC }]) => montantTTC),
        backgroundColor: CHART_COLORS,
        borderColor: CHART_COLORS,
        borderWidth: 1,
        hoverOffset: 10,
      },
    ],
  };

  // On surcharge options pour pouvoir afficher le Montant HT dans le tooltip
  const doughnutOptions = {
    ...DOUGHNUT_OPTIONS,
    plugins: {
      ...DOUGHNUT_OPTIONS.plugins,
      tooltip: {
        ...DOUGHNUT_OPTIONS.plugins.tooltip,
        callbacks: {
          label: (tooltipItem) => {
            const seller = tooltipItem.label;
            const dataObj = sellersStats[seller];
            if (!dataObj) return "";
            const montantHT = dataObj.montantHT;
            return `Montant HT: ${new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
            }).format(montantHT)}`;
          },
        },
      },
    },
  };

  // ───────────────────────────────────────────────────────────
  // 3.7. Configuration du Doughnut pour un vendeur (modal)
  // ───────────────────────────────────────────────────────────
  // Si un vendeur est sélectionné, on affiche un mini-graph
  const sellerData =
    selectedSeller && sellersStats[selectedSeller]
      ? {
          labels: ["Ventes"],
          datasets: [
            {
              label: selectedSeller,
              data: [sellersStats[selectedSeller].montantTTC],
              backgroundColor: CHART_COLORS,
              borderColor: CHART_COLORS,
              borderWidth: 1,
            },
          ],
        }
      : null;

  const sellerDoughnutOptions = {
    ...DOUGHNUT_OPTIONS,
    cutout: "50%", // un peu moins pour le mini-graph
  };

  // ───────────────────────────────────────────────────────────
  // 3.8. Affichage conditionnel (loading, error)
  // ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <ClipLoader color="#36D7B7" loading={loading} size={150} />
      </div>
    );
  }
  if (error) {
    return <p className="text-center text-red-500">{error}</p>;
  }

  // ───────────────────────────────────────────────────────────
  // 3.9. Rendu JSX
  // ───────────────────────────────────────────────────────────

  // Image de fond (public/dahboard.png)
  const backgroundImageUrl = "/public/dahboard.png";

  return (
    <div
      style={{
        backgroundImage: `url(${backgroundImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
        color: "#ffffff",
      }}
    >
      <Navbar />

      <div
        className="min-h-screen flex flex-col p-4"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
      >
        {/* SECTION 1 : Paramètres de filtre et listing vendeurs */}
        <div className="flex flex-col md:flex-row w-full space-y-4 md:space-y-0 md:space-x-4">
          {/* Stats Vendeurs */}
          <div className="md:w-1/2 flex flex-col space-y-4">
            <h2 className="text-white text-3xl">Stats Vendeurs</h2>

            {/* Sélecteur de période */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-2 rounded-lg bg-gray-700 text-white mb-4"
            >
              {["mois", "annee", "personnalise"].map((period) => (
                <option key={period} value={period}>
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </option>
              ))}
            </select>

            {/* Choix de la date/mois/année */}
            {filter === "mois" && (
              <DatePicker
                selected={selectedDate}
                onChange={(date) => setSelectedDate(date)}
                dateFormat="MM/yyyy"
                showMonthYearPicker
                className="px-4 py-2 rounded-lg bg-gray-700 text-white"
                placeholderText="Sélectionnez le mois"
              />
            )}
            {filter === "annee" && (
              <DatePicker
                selected={selectedDate}
                onChange={(date) => setSelectedDate(date)}
                dateFormat="yyyy"
                showYearPicker
                className="px-4 py-2 rounded-lg bg-gray-700 text-white"
                placeholderText="Sélectionnez l'année"
              />
            )}
            {filter === "personnalise" && (
              <>
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date)}
                  selectsStart
                  startDate={startDate}
                  endDate={endDate}
                  dateFormat="dd/MM/yyyy"
                  className="px-4 py-2 rounded-lg bg-gray-700 text-white mb-4"
                  placeholderText="Date de début"
                />
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date)}
                  selectsEnd
                  startDate={startDate}
                  endDate={endDate}
                  dateFormat="dd/MM/yyyy"
                  className="px-4 py-2 rounded-lg bg-gray-700 text-white"
                  placeholderText="Date de fin"
                />
              </>
            )}

            {/* Liste des vendeurs filtrés */}
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
              <h3 className="text-white text-xl mb-4">Données des Vendeurs</h3>
              <ul className="space-y-2 text-white">
                {sortedSellers.map(([seller, { montantTTC, count }]) => (
                  <li
                    key={seller}
                    className="flex justify-between cursor-pointer"
                    onClick={() => setSelectedSeller(seller)}
                  >
                    <span>{seller}</span>
                    <span>
                      {`Ventes: ${Math.round(count)}, CA: ${montantTTC.toFixed(
                        0
                      )} €`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* SECTION 2 : Stats agence + Graph principal */}
          <div className="md:w-1/2 flex flex-col space-y-4">
            <h2 className="text-white text-3xl">Stats Agence</h2>

            {/* Données Agence */}
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
              <h3 className="text-white text-xl mb-4">
                Données de l&apos;Agence
              </h3>
              <ul className="space-y-2 text-white">
                <li>Nombre de ventes: {agencyStats.totalCount}</li>
                <li>
                  Chiffre d&apos;affaires total:{" "}
                  {agencyStats.totalSales.toFixed(0)} €
                </li>
                <li>
                  Moyenne des ventes:{" "}
                  {agencyStats.totalCount > 0
                    ? (agencyStats.totalSales / agencyStats.totalCount).toFixed(
                        2
                      )
                    : 0}{" "}
                  €
                </li>
              </ul>
            </div>

            {/* Doughnut principal */}
            <div className="flex justify-center items-center mt-4 relative">
              <div className="w-[300px] h-[300px] relative">
                <Doughnut data={sellersChartData} options={doughnutOptions} />
                {/* Affichage du total au centre du donut */}
                <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
                  <span className="text-white text-xl font-bold">
                    Total {totalSales.toFixed(0)} €
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3 : Modal stats vendeur */}
        {selectedSeller && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full">
              <h3 className="text-black text-xl mb-4">
                {selectedSeller === bestSeller ? "Félicitations! " : ""}
                Statistiques de {selectedSeller}
              </h3>
              <p>
                CA: {sellersStats[selectedSeller].montantTTC.toFixed(0)} €<br />
                Nombre de ventes:{" "}
                {Math.round(sellersStats[selectedSeller].count)}
              </p>

              <div className="mb-4 h-40 w-full">
                {sellerData && (
                  <Doughnut
                    data={sellerData}
                    options={sellerDoughnutOptions}
                  />
                )}
              </div>

              <button
                className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg"
                onClick={() => setSelectedSeller(null)}
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatisticsDashboard;