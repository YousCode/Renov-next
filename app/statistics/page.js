"use client"; // Indique qu'il s'agit d'un composant Client Next.js

import React, { useState, useEffect } from "react";
import { Doughnut } from "react-chartjs-2";
import { ClipLoader } from "react-spinners";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import confetti from "canvas-confetti";

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

import Navbar from "@/components/Navbar";

// Enregistrement de Chart.js + plugins
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

// Liste des vendeurs qu'on souhaite afficher
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

const StatisticsDashboard = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtre de période ("mois", "annee", "personnalise")
  const [filter, setFilter] = useState("mois");

  // Dates pour filtrage
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  // Pour gérer la sélection du vendeur (modale) et le best-seller
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [bestSeller, setBestSeller] = useState(null);

  // ------------------------------------------------------------------
  // 1. Récupération des ventes (Montant HT)
  // ------------------------------------------------------------------
  useEffect(() => {
    const fetchSales = async () => {
      try {
        const response = await fetch("/api/ventes"); // Endpoint à adapter si besoin
        if (!response.ok) {
          throw new Error(`Échec de la récupération des ventes: ${response.statusText}`);
        }
        const data = await response.json(); // data.data => liste de ventes
        setSales(data.data);

        // Calcul du meilleur vendeur global
        const sortedSellers = data.data.reduce((acc, sale) => {
          // Exclure si ETAT=annule ou MONTANT ANNULE>0
          if (
            normalizeString(sale["ETAT"]) !== "annule" &&
            parseFloat(sale["MONTANT ANNULE"]) === 0
          ) {
            const sellerField = sale["VENDEUR"];
            if (sellerField) {
              const sellers = sellerField.split("/").map(normalizeString);
              const montantHT = parseFloat(sale["MONTANT HT"]) || 0;
              // Répartition du HT s'il y a plusieurs vendeurs
              sellers.forEach((seller) => {
                if (!acc[seller]) acc[seller] = 0;
                acc[seller] += montantHT;
              });
            }
          }
          return acc;
        }, {});

        // Détermine le meilleur vendeur global
        const topSeller = Object.entries(sortedSellers)
          .filter(([seller]) => VENDORS_TO_DISPLAY.includes(seller))
          .sort((a, b) => b[1] - a[1])[0];

        setBestSeller(topSeller ? topSeller[0] : null);
        // On sélectionne aussi par défaut le best-seller
        setSelectedSeller(topSeller ? topSeller[0] : null);
      } catch (err) {
        setError(`Erreur: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, []);

  // ------------------------------------------------------------------
  // 2. Confettis si on sélectionne le best-seller
  // ------------------------------------------------------------------
  useEffect(() => {
    if (selectedSeller && selectedSeller === bestSeller) {
      triggerConfetti();
    }
  }, [selectedSeller, bestSeller]);

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  // Normaliser une string (casse, accents)
  const normalizeString = (str) => {
    return str
      ? str
          .trim()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
      : "";
  };

  // Regroupe Montant HT dans acc[seller].montantHT et .count
  const groupByKey = (acc, key, ht, count) => {
    if (!acc[key]) {
      acc[key] = { montantHT: 0, count: 0 };
    }
    acc[key].montantHT += isNaN(ht) ? 0 : ht;
    acc[key].count += isNaN(count) ? 0 : count;
  };

  // ------------------------------------------------------------------
  // 3. Filtrage par date (mois, année, personnalisé)
  // ------------------------------------------------------------------
  const filterSalesByDate = (allSales, filterType, selDate, start, end) => {
    return allSales.filter((sale) => {
      const saleDate = new Date(sale["DATE DE VENTE"]);
      if (isNaN(saleDate.getTime())) {
        return false; // date invalide => on exclut
      }
      switch (filterType) {
        case "mois":
          return (
            saleDate.getFullYear() === selDate.getFullYear() &&
            saleDate.getMonth() === selDate.getMonth()
          );
        case "annee":
          return saleDate.getFullYear() === selDate.getFullYear();
        case "personnalise":
          return saleDate >= start && saleDate <= end;
        default:
          return true;
      }
    });
  };

  // On applique le filtre aux ventes
  const filteredSales = filterSalesByDate(
    sales,
    filter,
    selectedDate,
    startDate,
    endDate
  );

  // ------------------------------------------------------------------
  // 4. Calcul bestSellers (HT) sur la période filtrée
  // ------------------------------------------------------------------
  const bestSellers = filteredSales.reduce((acc, sale) => {
    // Exclusion si ETAT=annule ou MONTANT ANNULE>0
    if (
      normalizeString(sale["ETAT"]) === "annule" ||
      parseFloat(sale["MONTANT ANNULE"]) > 0
    ) {
      return acc;
    }

    const sellerField = sale["VENDEUR"];
    if (sellerField) {
      const sellers = sellerField.split("/").map(normalizeString);
      const montantHT = parseFloat(sale["MONTANT HT"]) || 0;
      // Partage si plusieurs vendeurs
      const shareHT = montantHT / sellers.length;
      const shareCount = 1 / sellers.length;
      sellers.forEach((seller) => {
        groupByKey(acc, seller, shareHT, shareCount);
      });
    }
    return acc;
  }, {});

  // ------------------------------------------------------------------
  // 5. Stats globales Agence
  // ------------------------------------------------------------------
  const agencyStats = filteredSales.reduce(
    (acc, sale) => {
      const valHT = parseFloat(sale["MONTANT HT"]) || 0;
      acc.totalHT += valHT;
      acc.totalCount += 1;
      return acc;
    },
    { totalHT: 0, totalCount: 0 }
  );

  // ------------------------------------------------------------------
  // Gestions d'états (chargement, erreur)
  // ------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <ClipLoader color={"#36D7B7"} loading={loading} size={150} />
      </div>
    );
  }
  if (error) {
    return <p className="text-center text-red-500">{error}</p>;
  }

  // Calcul du total HT (période filtrée)
  const totalHT = Object.values(bestSellers).reduce(
    (acc, { montantHT }) => acc + montantHT,
    0
  );

  // On trie les vendeurs par ordre décroissant (HT) 
  // + on ne garde que ceux dans la liste VENDORS_TO_DISPLAY
  const sortedSellers = Object.entries(bestSellers)
    .filter(([seller]) => VENDORS_TO_DISPLAY.includes(seller))
    .sort((a, b) => b[1].montantHT - a[1].montantHT);

  // Données Doughnut "bestSellers" 
  const bestSellersData = {
    labels: sortedSellers.map(([seller]) => seller),
    datasets: [
      {
        label: "Meilleurs Vendeurs (HT)",
        data: sortedSellers.map(([, { montantHT }]) => montantHT),
        backgroundColor: [
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
          "#F77825",
        ],
        borderWidth: 1,
        hoverOffset: 10,
      },
    ],
  };

  // Options du Doughnut
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        callbacks: {
          label: function (tooltipItem) {
            const seller = tooltipItem.label;
            const dataSeller = bestSellers[seller];
            const valHT = dataSeller ? dataSeller.montantHT : 0;
            return `Montant HT: ${valHT.toFixed(2)} €`;
          },
        },
      },
      datalabels: { display: false },
    },
    cutout: "70%",
    animation: {
      animateScale: true,
      animateRotate: true,
      duration: 2000,
      easing: "easeInOutBounce",
    },
  };

  // Données Doughnut pour le vendeur sélectionné
  let sellerData = null;
  if (selectedSeller && bestSellers[selectedSeller]) {
    const valHT = bestSellers[selectedSeller].montantHT;
    sellerData = {
      labels: ["Montant HT"],
      datasets: [
        {
          label: selectedSeller,
          data: [valHT],
          backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56"],
          borderWidth: 1,
        },
      ],
    };
  }

  // Image de fond
  const backgroundImageUrl = "/public/dahboard.png"; // Mettez le chemin correct

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
        <div className="flex flex-col md:flex-row w-full space-y-4 md:space-y-0 md:space-x-4">
          {/* Stats Vendeurs (HT) */}
          <div className="md:w-1/2 flex flex-col space-y-4">
            <h2 className="text-white text-3xl">Stats Vendeurs (HT)</h2>

            {/* Sélecteur de filtre */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-2 rounded-lg bg-gray-700 text-white mb-4"
            >
              <option value="mois">Mois</option>
              <option value="annee">Année</option>
              <option value="personnalise">Personnalisé</option>
            </select>

            {/* DatePicker pour mois / année / personnalisé */}
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

            {/* Liste des vendeurs triés par HT */}
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
              <h3 className="text-white text-xl mb-4">Meilleurs Vendeurs (HT)</h3>
              <ul className="space-y-2 text-white">
                {sortedSellers.map(([seller, { montantHT, count }]) => (
                  <li
                    key={seller}
                    className="flex justify-between cursor-pointer"
                    onClick={() => setSelectedSeller(seller)}
                  >
                    <span>{seller}</span>
                    <span>
                      {`#Ventes: ${Math.round(count)} | HT: ${montantHT.toFixed(2)} €`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Stats globales Agence + Doughnut */}
          <div className="md:w-1/2 flex flex-col space-y-4">
            <h2 className="text-white text-3xl">Stats Agence (HT)</h2>

            <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
              <h3 className="text-white text-xl mb-4">Global Agence (HT)</h3>
              <ul className="space-y-2 text-white">
                <li>Nombre de ventes: {agencyStats.totalCount}</li>
                <li>CA total HT: {agencyStats.totalHT.toFixed(2)} €</li>
                <li>
                  Moyenne par vente:{" "}
                  {agencyStats.totalCount > 0
                    ? (agencyStats.totalHT / agencyStats.totalCount).toFixed(2)
                    : 0}{" "}
                  €
                </li>
              </ul>
            </div>

            {/* Doughnut "best sellers" */}
            <div className="flex justify-center items-center mt-4">
              <div className="relative" style={{ width: "300px", height: "300px" }}>
                <Doughnut data={bestSellersData} options={options} />
                {/* Centre du doughnut */}
                <div className="absolute inset-0 flex justify-center items-center">
                  <span className="text-white text-xl font-bold">
                    Total {totalHT.toFixed(2)} €
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modale pour le vendeur sélectionné */}
        {selectedSeller && bestSellers[selectedSeller] && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full">
              <h3 className="text-black text-xl mb-4">
                {selectedSeller === bestSeller ? "Félicitations ! " : ""}
                Statistiques (HT) de {selectedSeller}
              </h3>
              <p>
                CA HT: {bestSellers[selectedSeller].montantHT.toFixed(2)} €
              </p>
              <p>Nombre de ventes: {Math.round(bestSellers[selectedSeller].count)}</p>

              {/* Petit doughnut perso pour ce vendeur */}
              <div className="mb-4 h-40 w-full">
                <Doughnut
                  data={{
                    labels: ["Montant HT"],
                    datasets: [
                      {
                        label: selectedSeller,
                        data: [bestSellers[selectedSeller].montantHT],
                        backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56"],
                      },
                    ],
                  }}
                  options={{ ...options, cutout: "50%" }}
                />
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