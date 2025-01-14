"use client"; // Directive pour indiquer que c'est un Client Component

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
  const [filter, setFilter] = useState("mois");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [bestSeller, setBestSeller] = useState(null);

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
        setSales(data.data);

        const sortedSellers = data.data.reduce((acc, sale) => {
          if (
            normalizeString(sale["ETAT"]) !== "annule" &&
            parseFloat(sale["MONTANT ANNULE"]) === 0
          ) {
            const sellerField = sale["VENDEUR"];
            if (sellerField) {
              const sellers = sellerField.split("/").map(normalizeString);
              const montantTTC = parseFloat(sale["MONTANT TTC "]);
              sellers.forEach((seller) => {
                if (!acc[seller]) acc[seller] = 0;
                acc[seller] += montantTTC;
              });
            }
          }
          return acc;
        }, {});

        const topSeller = Object.entries(sortedSellers)
          .filter(([seller]) => VENDORS_TO_DISPLAY.includes(seller))
          .sort((a, b) => b[1] - a[1])[0];

        setBestSeller(topSeller ? topSeller[0] : null);
        setSelectedSeller(topSeller ? topSeller[0] : null);
      } catch (error) {
        setError(`Erreur: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, []);

  useEffect(() => {
    if (selectedSeller === bestSeller) {
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

  const normalizeString = (str) => {
    return str
      ? str
          .trim()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
      : "";
  };

  const groupByKey = (acc, key, montantTTC, montantHT, count) => {
    if (!acc[key]) {
      acc[key] = { montantTTC: 0, montantHT: 0, count: 0 };
    }
    acc[key].montantTTC += isNaN(montantTTC) ? 0 : montantTTC;
    acc[key].montantHT += isNaN(montantHT) ? 0 : montantHT;
    acc[key].count += isNaN(count) ? 0 : count;
  };

  const filterSalesByDate = (
    sales,
    filter,
    selectedDate,
    startDate,
    endDate
  ) => {
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
  };

  const filteredSales = filterSalesByDate(
    sales,
    filter,
    selectedDate,
    startDate,
    endDate
  );

  const bestSellers = filteredSales.reduce((acc, sale) => {
    if (
      normalizeString(sale["ETAT"]) === "annule" ||
      parseFloat(sale["MONTANT ANNULE"]) === 0
    ) {
      return acc;
    }
    const sellerField = sale["VENDEUR"];
    if (sellerField) {
      const sellers = sellerField.split("/").map(normalizeString);
      const montantTTC = parseFloat(sale["MONTANT TTC "]);
      const montantHT = parseFloat(sale["MONTANT HT"]);
      const shareTTC = montantTTC / sellers.length;
      const shareHT = montantHT / sellers.length;
      const shareCount = 1 / sellers.length;

      sellers.forEach((seller) => {
        if (seller) {
          groupByKey(acc, seller, shareTTC, shareHT, shareCount);
        }
      });
    }

    return acc;
  }, {});

  const agencyStats = filteredSales.reduce(
    (acc, sale) => {
      acc.totalSales += parseFloat(sale["MONTANT TTC "]) || 0;
      acc.totalCount += 1;
      return acc;
    },
    { totalSales: 0, totalCount: 0 }
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <ClipLoader color={"#36D7B7"} loading={loading} size={150} />
      </div>
    );
  }

  if (error) return <p className="text-center text-red-500">{error}</p>;

  const totalSales = Object.values(bestSellers).reduce(
    (acc, { montantTTC }) => acc + montantTTC,
    0
  );

  const sortedSellers = Object.entries(bestSellers)
    .filter(([seller]) => VENDORS_TO_DISPLAY.includes(seller))
    .sort((a, b) => b[1].montantTTC - a[1].montantTTC);

  const bestSellersData = {
    labels: sortedSellers.map(([seller]) => seller),
    datasets: [
      {
        label: "Meilleurs Vendeurs",
        data: sortedSellers.map(([, { montantTTC }]) => montantTTC),
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
          "#4BC0C0",
          "#F77825",
          "#9966FF",
          "#FF9F40",
          "#B21FDE",
        ],
        borderColor: [
          "#FF6384",
          "#36A2EB",
          "#FFCE56",
          "#4BC0C0",
          "#F77825",
          "#9966FF",
          "#FF9F40",
        ],
        borderWidth: 1,
        hoverOffset: 10,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
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
            const seller = tooltipItem.label;
            const montantHT = bestSellers[seller].montantHT;
            return `Montant HT: ${new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
            }).format(montantHT)}`;
          },
        },
      },
      datalabels: {
        display: false,
      },
    },
    cutout: "70%",
    animation: {
      animateScale: true,
      animateRotate: true,
      duration: 2000,
      easing: "easeInOutBounce",
    },
  };

  const backgroundImageUrl = "/public/dahboard.png"; // Remplacez par l'URL de votre image

  // Prepare seller specific data
  const sellerData =
    selectedSeller && bestSellers[selectedSeller]
      ? {
          labels: ["Ventes"],
          datasets: [
            {
              label: selectedSeller,
              data: [bestSellers[selectedSeller].montantTTC],
              backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56"],
              borderColor: ["#FF6384", "#36A2EB", "#FFCE56"],
              borderWidth: 1,
            },
          ],
        }
      : null;

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
          {/* Stats Vendeurs */}
          <div className="md:w-1/2 flex flex-col space-y-4">
            <h2 className="text-white text-3xl">Stats Vendeurs</h2>
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

            {/* Display Sales Data */}
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
                    <span>{`Ventes: ${Math.round(
                      count
                    )}, CA: ${montantTTC.toFixed(0)} €`}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Stats Agence */}
          <div className="md:w-1/2 flex flex-col space-y-4">
            <h2 className="text-white text-3xl">Stats Agence</h2>
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
              <h3 className="text-white text-xl mb-4">
                Données de l&apos;Agence
              </h3>
              <ul className="space-y-2 text-white">
                <li>Nombre de ventes: {agencyStats.totalCount}</li>
                <li>
                  Chiffre d&apos;affaires total: {agencyStats.totalSales.toFixed(0)} €
                </li>
                <li>
                  Moyenne des ventes:{" "}
                  {(agencyStats.totalSales / agencyStats.totalCount).toFixed(2)} €
                </li>
              </ul>
            </div>
            <div className="flex justify-center items-center mt-4">
              <div className="relative">
                <Doughnut data={bestSellersData} options={options} />
                <div className="absolute inset-0 flex justify-center items-center">
                  <span className="text-white text-xl font-bold">
                    Total {totalSales.toFixed(0)} €
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Seller Stats Modal */}
        {selectedSeller && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full">
              <h3 className="text-black text-xl mb-4">
                {selectedSeller === bestSeller ? "Félicitations! " : ""}
                Statistiques de {selectedSeller}
              </h3>
              <p>CA: {bestSellers[selectedSeller].montantTTC.toFixed(0)} €</p>
              <p>
                Nombre de ventes:{" "}
                {Math.round(bestSellers[selectedSeller].count)}
              </p>
              <div className="mb-4 h-40 w-full">
                {sellerData && (
                  <Doughnut
                    data={sellerData}
                    options={{ ...options, cutout: "50%" }}
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