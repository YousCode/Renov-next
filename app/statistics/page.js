"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import DatePicker from "react-datepicker";
import confetti from "canvas-confetti";
import Navbar from "@/components/Navbar";
import "react-datepicker/dist/react-datepicker.css";

import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend, ArcElement, Colors,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, Colors, ChartDataLabels);

// ─────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────
const norm = (s) =>
  s ? s.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

const fmtCur = (n, compact = false) => {
  if (compact && Math.abs(n) >= 1000)
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 }).format(n);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "";

const COLORS = [
  "#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6",
  "#EC4899","#14B8A6","#F97316","#6366F1","#84CC16",
  "#06B6D4","#F43F5E","#A78BFA","#34D399","#FCD34D",
];

// ─────────────────────────────────────────────────────────────
// Helpers : filtrage & stats
// ─────────────────────────────────────────────────────────────
function filterByPeriod(sales, filter, selectedDate, startDate, endDate, offset = 0) {
  return sales.filter((sale) => {
    const d = new Date(sale["DATE DE VENTE"]);
    if (filter === "mois") {
      const ref = new Date(selectedDate);
      ref.setMonth(ref.getMonth() - offset);
      return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
    }
    if (filter === "annee") {
      return d.getFullYear() === selectedDate.getFullYear() - offset;
    }
    if (filter === "personnalise") {
      if (offset === 0) return d >= startDate && d <= endDate;
      const dur = endDate - startDate;
      const pEnd = new Date(startDate.getTime() - 1);
      const pStart = new Date(pEnd.getTime() - dur);
      return d >= pStart && d <= pEnd;
    }
    return true;
  });
}

function computeStats(sales) {
  return sales.reduce((acc, sale) => {
    if (norm(sale["ETAT"]) === "annule") return acc;
    const vendeur = sale["VENDEUR"];
    if (!vendeur) {
      acc.totalTTC  += parseFloat(sale["MONTANT TTC"]) || 0;
      acc.totalCount += 1;
      return acc;
    }
    const names = vendeur.split("/").map(norm).filter(Boolean);
    const ttc   = parseFloat(sale["MONTANT TTC"])  || 0;
    const ht    = parseFloat(sale["MONTANT HT"])   || 0;
    const com   = parseFloat(sale["Montant commissions en €"]) || 0;
    const share = names.length;

    names.forEach((n) => {
      if (!acc.sellers[n]) acc.sellers[n] = { ttc: 0, ht: 0, com: 0, count: 0 };
      acc.sellers[n].ttc   += ttc / share;
      acc.sellers[n].ht    += ht  / share;
      acc.sellers[n].com   += com / share;
      acc.sellers[n].count += 1   / share;
    });
    acc.totalTTC   += ttc;
    acc.totalCount += 1;
    return acc;
  }, { sellers: {}, totalTTC: 0, totalCount: 0 });
}

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────
const Skeleton = () => (
  <div className="min-h-screen bg-gray-900">
    <Navbar />
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 animate-pulse">
      <div className="flex gap-3">{[80,100,130].map((w,i) => <div key={i} className="h-9 rounded-full bg-gray-800" style={{width:w}}/>)}</div>
      <div className="grid grid-cols-3 gap-4">
        {[0,1,2].map(i => (
          <div key={i} className="bg-gray-800 rounded-xl p-5 border border-gray-700/50 space-y-3">
            <div className="h-3 w-24 bg-gray-700 rounded"/>
            <div className="h-8 w-32 bg-gray-700 rounded"/>
            <div className="h-3 w-16 bg-gray-700 rounded"/>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl border border-gray-700/50 h-80 flex items-center justify-center">
          <div className="w-48 h-48 rounded-full border-[14px] border-gray-700"/>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700/50 p-6 space-y-5">
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between"><div className="h-4 w-20 bg-gray-700 rounded"/><div className="h-4 w-24 bg-gray-700 rounded"/></div>
              <div className="h-1.5 bg-gray-700 rounded-full"/>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Trend badge
// ─────────────────────────────────────────────────────────────
const Trend = ({ current, previous }) => {
  if (!previous) return null;
  const delta = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const up = delta >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${up ? "text-emerald-400" : "text-red-400"}`}>
      {up ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
      <span className="text-gray-500 font-normal">vs période préc.</span>
    </span>
  );
};

// ─────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────
export default function StatisticsDashboard() {
  const [sales, setSales]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const [filter, setFilter]             = useState("mois");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startDate, setStartDate]       = useState(new Date());
  const [endDate, setEndDate]           = useState(new Date());

  const [selectedSeller, setSelectedSeller] = useState(null);
  const [bestSeller, setBestSeller]         = useState(null);
  const [search, setSearch]                 = useState("");

  // Fetch
  useEffect(() => {
    fetch("/api/ventes")
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(data => {
        const d = data.data || [];
        setSales(d);
        // Meilleur vendeur global
        const totals = d.reduce((acc, s) => {
          if (norm(s["ETAT"]) === "annule") return acc;
          (s["VENDEUR"] || "").split("/").map(norm).filter(Boolean).forEach(n => {
            acc[n] = (acc[n] || 0) + (parseFloat(s["MONTANT TTC"]) || 0);
          });
          return acc;
        }, {});
        const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
        if (top) setBestSeller(top[0]);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Périodes
  const currentSales  = useMemo(() => filterByPeriod(sales, filter, selectedDate, startDate, endDate, 0), [sales, filter, selectedDate, startDate, endDate]);
  const previousSales = useMemo(() => filterByPeriod(sales, filter, selectedDate, startDate, endDate, 1), [sales, filter, selectedDate, startDate, endDate]);

  const current  = useMemo(() => computeStats(currentSales),  [currentSales]);
  const previous = useMemo(() => computeStats(previousSales), [previousSales]);

  // Classement vendeurs (tous, dynamiques)
  const sortedSellers = useMemo(() =>
    Object.entries(current.sellers)
      .sort((a, b) => b[1].ttc - a[1].ttc)
      .filter(([s]) => !search || s.includes(norm(search))),
    [current.sellers, search]
  );

  const totalSellersTTC = useMemo(() =>
    sortedSellers.reduce((s, [, d]) => s + d.ttc, 0), [sortedSellers]);

  // Sélection vendeur
  const handleSelectSeller = useCallback((seller) => {
    setSelectedSeller(s => s === seller ? null : seller);
    if (seller === bestSeller) confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });
  }, [bestSeller]);

  // Chart
  const chartColors = useMemo(() =>
    sortedSellers.map(([s], i) =>
      selectedSeller && selectedSeller !== s
        ? `${COLORS[i % COLORS.length]}40`
        : COLORS[i % COLORS.length]
    ),
    [sortedSellers, selectedSeller]
  );

  const chartData = {
    labels: sortedSellers.map(([s]) => s),
    datasets: [{
      data: sortedSellers.map(([, d]) => d.ttc),
      backgroundColor: chartColors,
      borderColor: "transparent",
      hoverOffset: 10,
    }],
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false, cutout: "74%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (item) => {
            const d = current.sellers[item.label];
            return d ? [`${fmtCur(d.ttc)} TTC`, `${fmtCur(d.ht)} HT`, `${Math.round(d.count)} vente${Math.round(d.count) > 1 ? "s" : ""}`] : [];
          },
        },
      },
      datalabels: { display: false },
    },
    animation: { animateScale: true, animateRotate: true, duration: 800 },
    onClick: (_, elements) => {
      if (elements[0]) handleSelectSeller(sortedSellers[elements[0].index][0]);
    },
  };

  // Ventes du vendeur sélectionné (pour le modal)
  const sellerSales = useMemo(() => {
    if (!selectedSeller) return [];
    return currentSales
      .filter(s => norm(s["ETAT"]) !== "annule" && (s["VENDEUR"] || "").split("/").map(norm).includes(selectedSeller))
      .sort((a, b) => new Date(b["DATE DE VENTE"]) - new Date(a["DATE DE VENTE"]))
      .slice(0, 10);
  }, [selectedSeller, currentSales]);

  // ─── Render ────────────────────────────────────────────────
  if (loading) return <Skeleton />;
  if (error) return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    </div>
  );

  const avgCurrent  = current.totalCount  > 0 ? current.totalTTC  / current.totalCount  : 0;
  const avgPrevious = previous.totalCount > 0 ? previous.totalTTC / previous.totalCount : 0;
  const totalCom    = sortedSellers.reduce((s, [, d]) => s + d.com, 0);

  const PERIODS = { mois: "Mois", annee: "Année", personnalise: "Personnalisé" };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* ── Filtre période ── */}
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(PERIODS).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                filter === key
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700"
              }`}>
              {label}
            </button>
          ))}

          <div className="flex items-center gap-2 ml-1">
            {filter === "mois" && (
              <DatePicker selected={selectedDate} onChange={setSelectedDate}
                dateFormat="MM/yyyy" showMonthYearPicker
                className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm w-28 cursor-pointer" />
            )}
            {filter === "annee" && (
              <DatePicker selected={selectedDate} onChange={setSelectedDate}
                dateFormat="yyyy" showYearPicker
                className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm w-20 cursor-pointer" />
            )}
            {filter === "personnalise" && (
              <>
                <DatePicker selected={startDate} onChange={setStartDate}
                  selectsStart startDate={startDate} endDate={endDate} dateFormat="dd/MM/yyyy"
                  className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm w-32"
                  placeholderText="Début" />
                <span className="text-gray-600">→</span>
                <DatePicker selected={endDate} onChange={setEndDate}
                  selectsEnd startDate={startDate} endDate={endDate} dateFormat="dd/MM/yyyy"
                  className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm w-32"
                  placeholderText="Fin" />
              </>
            )}
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Chiffre d'affaires",
              value: fmtCur(current.totalTTC),
              sub: <Trend current={current.totalTTC} previous={previous.totalTTC} />,
              accent: "from-blue-600/20 to-transparent border-blue-700/40",
              text: "text-blue-300",
            },
            {
              label: "Ventes",
              value: current.totalCount,
              sub: <Trend current={current.totalCount} previous={previous.totalCount} />,
              accent: "from-emerald-600/20 to-transparent border-emerald-700/40",
              text: "text-emerald-300",
            },
            {
              label: "Panier moyen",
              value: fmtCur(avgCurrent),
              sub: <Trend current={avgCurrent} previous={avgPrevious} />,
              accent: "from-amber-600/20 to-transparent border-amber-700/40",
              text: "text-amber-300",
            },
            {
              label: "Commissions",
              value: fmtCur(totalCom, true),
              sub: <span className="text-[11px] text-gray-500">Total vendeurs</span>,
              accent: "from-violet-600/20 to-transparent border-violet-700/40",
              text: "text-violet-300",
            },
          ].map(({ label, value, sub, accent, text }) => (
            <div key={label} className={`bg-gradient-to-br ${accent} border rounded-xl p-4`}>
              <p className="text-gray-400 text-[11px] uppercase tracking-wider">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${text} tabular-nums`}>{value}</p>
              <div className="mt-1 min-h-[18px]">{sub}</div>
            </div>
          ))}
        </div>

        {/* ── Donut + Classement ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">

          {/* Donut */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700/50 flex flex-col items-center w-full lg:w-80">
            <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-4 self-start">
              Répartition CA
            </p>
            {sortedSellers.length > 0 ? (
              <>
                <div className="w-52 h-52 relative cursor-pointer">
                  <Doughnut data={chartData} options={chartOptions} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                    {selectedSeller && current.sellers[selectedSeller] ? (
                      <>
                        <span className="text-xs text-gray-400 capitalize">{selectedSeller}</span>
                        <span className="text-lg font-bold leading-tight">{fmtCur(current.sellers[selectedSeller].ttc)}</span>
                        <span className="text-[11px] text-gray-500">{Math.round(current.sellers[selectedSeller].count)} ventes</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl font-bold">{fmtCur(totalSellersTTC, true)}</span>
                        <span className="text-gray-400 text-xs mt-0.5">Total TTC</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-5">
                  {sortedSellers.slice(0, 10).map(([s], i) => (
                    <button key={s} onClick={() => handleSelectSeller(s)}
                      className={`flex items-center gap-1 text-[11px] transition-opacity ${selectedSeller && selectedSeller !== s ? "opacity-30" : "opacity-100"}`}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="capitalize">{s}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center py-16 text-gray-600 text-sm">
                Aucune donnée
              </div>
            )}
          </div>

          {/* Classement */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700/50 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] text-gray-400 uppercase tracking-wider">Classement vendeurs</p>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filtrer…"
                className="text-xs px-2.5 py-1 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 w-28 focus:outline-none focus:border-blue-500"
              />
            </div>

            {sortedSellers.length === 0 ? (
              <p className="text-gray-600 text-center py-10 text-sm">Aucune vente sur cette période</p>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-[420px] pr-1">
                {sortedSellers.map(([seller, { ttc, ht, com, count }], idx) => {
                  const share = totalSellersTTC > 0 ? (ttc / totalSellersTTC) * 100 : 0;
                  const prevData = previous.sellers[seller];
                  const isSelected = selectedSeller === seller;
                  const medals = ["🥇", "🥈", "🥉"];

                  return (
                    <button key={seller} onClick={() => handleSelectSeller(seller)}
                      className={`w-full text-left rounded-xl px-3 py-2.5 transition-all border ${
                        isSelected
                          ? "bg-gray-700 border-gray-500"
                          : "hover:bg-gray-700/60 border-transparent"
                      }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base w-5 shrink-0 text-center leading-none">
                            {idx < 3 ? medals[idx] : <span className="text-gray-600 text-xs font-bold">{idx + 1}</span>}
                          </span>
                          <span className="font-medium capitalize text-sm truncate">{seller}</span>
                          {seller === bestSeller && (
                            <span className="shrink-0 text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-semibold">TOP</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 shrink-0 ml-2">
                          <div className="text-right hidden sm:block">
                            <span className="text-[11px] text-gray-500 block">Commission</span>
                            <span className="text-xs text-violet-400 font-medium">{fmtCur(com)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] text-gray-500 block">{Math.round(count)} vte{Math.round(count) > 1 ? "s" : ""}</span>
                            <span className="text-sm font-semibold text-white">{fmtCur(ttc)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full"
                            style={{ width: `${share}%`, backgroundColor: COLORS[idx % COLORS.length] }} />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] text-gray-500 w-8 text-right">{share.toFixed(0)}%</span>
                          {prevData && (
                            <Trend current={ttc} previous={prevData.ttc} />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal vendeur ── */}
      {selectedSeller && current.sellers[selectedSeller] && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedSeller(null)}>
          <div className="bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md border border-gray-700 shadow-2xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}>

            {/* Header modal */}
            <div className="flex items-center justify-between p-5 border-b border-gray-700/60">
              <div>
                {selectedSeller === bestSeller && (
                  <p className="text-yellow-400 text-xs font-semibold mb-0.5 flex items-center gap-1">
                    🏆 Meilleur vendeur de la période
                  </p>
                )}
                <h3 className="text-lg font-bold capitalize">{selectedSeller}</h3>
              </div>
              <button onClick={() => setSelectedSeller(null)}
                className="text-gray-500 hover:text-white transition-colors text-xl leading-none">✕</button>
            </div>

            {/* KPI vendeur */}
            <div className="grid grid-cols-3 gap-px bg-gray-700/50 border-b border-gray-700/60">
              {[
                ["CA TTC", fmtCur(current.sellers[selectedSeller].ttc)],
                ["CA HT",  fmtCur(current.sellers[selectedSeller].ht)],
                ["Commissions", fmtCur(current.sellers[selectedSeller].com)],
              ].map(([label, val]) => (
                <div key={label} className="bg-gray-800 px-4 py-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-bold text-white mt-0.5">{val}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-px bg-gray-700/50 border-b border-gray-700/60">
              {[
                ["Ventes", Math.round(current.sellers[selectedSeller].count)],
                ["Part du CA", `${totalSellersTTC > 0 ? ((current.sellers[selectedSeller].ttc / totalSellersTTC) * 100).toFixed(1) : 0}%`],
              ].map(([label, val]) => (
                <div key={label} className="bg-gray-800 px-4 py-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-bold text-white mt-0.5">{val}</p>
                </div>
              ))}
            </div>

            {/* Trend vs période préc. */}
            {previous.sellers[selectedSeller] && (
              <div className="px-5 py-3 border-b border-gray-700/60 flex items-center gap-2 text-sm">
                <span className="text-gray-500 text-xs">Vs période précédente :</span>
                <Trend
                  current={current.sellers[selectedSeller].ttc}
                  previous={previous.sellers[selectedSeller].ttc}
                />
              </div>
            )}

            {/* Dernières ventes */}
            <div className="flex-1 overflow-y-auto">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider px-5 pt-4 pb-2">
                Dernières ventes ({sellerSales.length})
              </p>
              {sellerSales.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-6">Aucune vente</p>
              ) : (
                <div className="divide-y divide-gray-700/50">
                  {sellerSales.map((sale) => (
                    <div key={sale._id} className="flex items-center justify-between px-5 py-2.5 hover:bg-gray-700/30 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{sale["NOM DU CLIENT"]}</p>
                        <p className="text-[11px] text-gray-500">{fmtDate(sale["DATE DE VENTE"])} · {sale["DESIGNATION"] || "—"}</p>
                      </div>
                      <span className="text-sm font-semibold text-white ml-3 shrink-0">
                        {fmtCur(parseFloat(sale["MONTANT TTC"]) || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
