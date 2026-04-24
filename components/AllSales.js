"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faFile, faTrash, faCheck, faSearch, faChevronLeft, faDownload, faCopy } from "@fortawesome/free-solid-svg-icons";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const TVA_OPTIONS = ["0%","5.5%","10%","20%"];

const norm   = (s) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase() : "";
const fmtD   = (d) => { if (!d) return ""; const dt = new Date(d); return isNaN(dt) ? "" : dt.toLocaleDateString("fr-FR"); };
const fmtCur = (v) => { const n = parseFloat(v); return (!n || isNaN(n)) ? "—" : new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n); };
const toISO  = (d) => { if (!d) return ""; const dt = new Date(d); return isNaN(dt.getTime()) ? "" : dt.toISOString().split("T")[0]; };
const parseTVA = (r) => { const n = Number(String(r??"").replace("%","").replace(",",".").trim()); return Number.isFinite(n) ? Math.max(0,Math.min(20,n)) : 5.5; };
const hasMontant = (s) => parseFloat(s["MONTANT TTC"]) > 0;
const isAnnule   = (s) => norm(s["ETAT"]||"") === "annule";

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────
const TableSkeleton = () => (
  <div className="min-h-[calc(100vh-64px)] bg-gray-900 p-4 animate-pulse">
    <div className="max-w-full mx-auto space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[60,50,55,55,45,50,55,50,75,65,65,55].map((w,i) => (
          <div key={i} className="h-8 rounded-lg bg-gray-800" style={{inlineSize:w}}/>
        ))}
      </div>
      <div className="bg-gray-800 rounded-xl border border-gray-700/50 overflow-hidden">
        <div className="h-10 bg-gray-700/50"/>
        {[...Array(8)].map((_,i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-t border-gray-700/30">
            {[60,100,120,80,80,90,60,100,80,70].map((w,j) => (
              <div key={j} className="h-4 rounded bg-gray-700" style={{inlineSize:w, flexShrink:0}}/>
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Modal confirmation
// ─────────────────────────────────────────────────────────────
const ConfirmModal = ({ sale, onClose, onSave }) => {
  const [form, setForm] = useState({
    "MONTANT TTC":        parseFloat(sale["MONTANT TTC"]) || "",
    "TAUX TVA":           sale["TAUX TVA"] || "5.5%",
    "PREVISION CHANTIER": toISO(sale["PREVISION CHANTIER"]),
    "DATE PIT":           toISO(sale["DATE PIT"]),
    "DATE TRAVAUX":       toISO(sale["DATE TRAVAUX"]),
    "DESIGNATION":        sale["DESIGNATION"] || "",
    "qte":                sale["qte"] || "",
    "SURFACE":            sale["SURFACE"] || "",
    "EMPLACEMENT":        sale["EMPLACEMENT"] || "",
  });
  const [saving, setSaving] = useState(false);
  const tva = parseTVA(form["TAUX TVA"]);
  const ht  = form["MONTANT TTC"] ? (parseFloat(form["MONTANT TTC"]) / (1 + tva / 100)) : 0;
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const handleSave = async () => {
    if (!form["MONTANT TTC"]) return toast.error("Montant TTC requis");
    setSaving(true);
    const ok = await onSave(sale._id, { ...sale, ...form, "MONTANT HT": ht.toFixed(2), "ETAT": "DV" });
    if (ok) onClose();
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg border border-gray-700 shadow-2xl max-h-[90vh] flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="px-5 pt-5 pb-4 border-b border-gray-700/60 flex items-start justify-between">
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider">Confirmation</p>
            <h3 className="text-white font-bold">{sale["NOM DU CLIENT"]} · BC #{sale["NUMERO BC"]}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Montant TTC <span className="text-red-400">*</span></label>
              <input type="number" step="0.01" value={form["MONTANT TTC"]} onChange={e=>set("MONTANT TTC",e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 focus:border-blue-500 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"/>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">TVA</label>
              <select value={form["TAUX TVA"]} onChange={e=>set("TAUX TVA",e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 focus:border-blue-500 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none cursor-pointer">
                {TVA_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {ht > 0 && <p className="text-xs text-emerald-400 -mt-2">CA HT : <strong>{new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(ht)}</strong></p>}

          <div>
            <label className="block text-xs text-gray-400 mb-1">Désignation</label>
            <input type="text" value={form["DESIGNATION"]} onChange={e=>set("DESIGNATION",e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 focus:border-blue-500 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"/>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[["qte","Qté"],["SURFACE","Surface"],["EMPLACEMENT","Emplacement"]].map(([k,l])=>(
              <div key={k}>
                <label className="block text-xs text-gray-400 mb-1">{l}</label>
                <input type="text" value={form[k]} onChange={e=>set(k,e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 focus:border-blue-500 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"/>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[["PREVISION CHANTIER","Prévision chantier"],["DATE PIT","Date PIT"],["DATE TRAVAUX","Date travaux"]].map(([k,l])=>(
              <div key={k}>
                <label className="block text-xs text-gray-400 mb-1">{l}</label>
                <input type="date" value={form[k]} onChange={e=>set(k,e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 focus:border-blue-500 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"/>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-700/60 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm font-medium transition-colors">Annuler</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-[2] py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2">
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <FontAwesomeIcon icon={faCheck}/>}
            Confirmer &amp; PDF
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────
const AllSales = () => {
  const router = useRouter();
  const [sales, setSales]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [month, setMonth]       = useState(new Date().getMonth());
  const [year, setYear]         = useState(new Date().getFullYear());
  const [search, setSearch]     = useState("");
  const [tab, setTab]           = useState("all"); // "all" | "pending" | "confirmed"
  const [confirmSale, setConfirm] = useState(null);
  const abortRef = useRef(null);

  // Fetch
  const fetchSales = useCallback(async () => {
    setLoading(true); setError(null);
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      const res = await fetch(`/api/ventes?month=${month}&year=${year}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(res.statusText);
      setSales((await res.json()).data || []);
    } catch (e) { if (e?.name !== "AbortError") setError(e.message); }
    finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { fetchSales(); return () => abortRef.current?.abort(); }, [fetchSales]);

  // Filtrage
  const filtered = useMemo(() => {
    const q = norm(search);
    return sales
      .filter(s => !isAnnule(s))
      .filter(s => {
        if (tab === "pending")   return !hasMontant(s);
        if (tab === "confirmed") return hasMontant(s);
        return true;
      })
      .filter(s => !q || [s["NOM DU CLIENT"],s["VENDEUR"],s["ADRESSE DU CLIENT"],s["VILLE"],s["DESIGNATION"],s["TELEPHONE"],s["NUMERO BC"]]
        .some(f => norm(f||"").includes(q)));
  }, [sales, search, tab]);

  const counts = useMemo(() => ({
    all:       sales.filter(s => !isAnnule(s)).length,
    pending:   sales.filter(s => !isAnnule(s) && !hasMontant(s)).length,
    confirmed: sales.filter(s => !isAnnule(s) &&  hasMontant(s)).length,
  }), [sales]);

  const totalTTC = useMemo(() =>
    filtered.filter(hasMontant).reduce((s,v) => s + (parseFloat(v["MONTANT TTC"])||0), 0),
  [filtered]);

  // Handlers
  const handleDelete = useCallback(async (sale) => {
    if (!confirm(`Supprimer la vente de ${sale["NOM DU CLIENT"]} ?`)) return;
    try {
      await fetch(`/api/ventes/${sale._id}`, { method: "DELETE" });
      setSales(p => p.filter(s => s._id !== sale._id));
      toast.success("Vente supprimée");
    } catch { toast.error("Erreur lors de la suppression"); }
  }, []);

  const handleConfirmSave = useCallback(async (id, payload) => {
    try {
      const res = await fetch(`/api/ventes/${id}`, {
        method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const { data } = await res.json();
      setSales(p => p.map(s => s._id === id ? data : s));
      toast.success("Confirmée !");
      setTimeout(() => router.push(`/file/details/${id}`), 400);
      return true;
    } catch (e) { toast.error(e.message); return false; }
  }, [router]);

  // CSV
  const EXPORT_COLS = ["DATE DE VENTE","NOM DU CLIENT","prenom","ADRESSE DU CLIENT","VILLE","CP","TELEPHONE","VENDEUR","NUMERO BC","DESIGNATION","MONTANT TTC","TAUX TVA","MONTANT HT","ETAT","PREVISION CHANTIER"];

  const downloadCSV = useCallback(() => {
    if (!filtered.length) return;
    const rows = [EXPORT_COLS.join(";"), ...filtered.map(s => EXPORT_COLS.map(c => s[c]||"").join(";"))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `ventes-${MONTHS[month]}-${year}.csv`; a.click();
  }, [filtered, month, year]);

  // Copie une ligne au format TSV (collable directement dans Excel)
  const copyRow = useCallback(async (sale) => {
    const fmtCell = (v) => {
      const s = String(v ?? "");
      return s.replace(/\t/g, " ").replace(/\r?\n/g, " ");
    };
    const tsv = EXPORT_COLS.map(c => fmtCell(sale[c])).join("\t");
    try {
      await navigator.clipboard.writeText(tsv);
      toast.success("Ligne copiée — collez dans Excel");
    } catch {
      toast.error("Copie impossible");
    }
  }, []);

  if (loading) return <TableSkeleton />;
  if (error) return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-900 flex items-center justify-center">
      <p className="text-red-400">{error}</p>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-900 text-white">
      <div className="px-4 py-4 space-y-4">

        {/* ── Barre du haut ── */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => router.back()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg text-xs border border-gray-700 transition-colors shrink-0">
            <FontAwesomeIcon icon={faChevronLeft} className="text-[10px]"/> Retour
          </button>

          {/* Mois */}
          <div className="flex gap-1 flex-wrap">
            {MONTHS.map((m,i) => (
              <button key={m} onClick={() => { setMonth(i); }}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  month === i ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-500 hover:text-white hover:bg-gray-700 border border-gray-700/60"
                }`}>{m.slice(0,4)}</button>
            ))}
          </div>

          <select value={year} onChange={e => setYear(+e.target.value)}
            className="px-2.5 py-1.5 bg-gray-800 border border-gray-700 text-white text-xs rounded-lg focus:outline-none cursor-pointer">
            {Array.from({length:5},(_,k) => new Date().getFullYear()-k).map(y=>(
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative ml-auto">
            <FontAwesomeIcon icon={faSearch} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none"/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 w-40 transition-colors"/>
          </div>

          {/* Export */}
          <button onClick={downloadCSV} title="Exporter CSV"
            className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors">
            <FontAwesomeIcon icon={faDownload} className="text-xs"/>
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 border-b border-gray-700/60 pb-0">
          {[
            { key:"all",       label:"Toutes",    count: counts.all },
            { key:"pending",   label:"En attente", count: counts.pending },
            { key:"confirmed", label:"Confirmées", count: counts.confirmed },
          ].map(({ key, label, count }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-all -mb-px ${
                tab === key
                  ? key === "confirmed"
                    ? "border-emerald-500 text-emerald-400"
                    : key === "pending"
                    ? "border-amber-500 text-amber-400"
                    : "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}>
              {label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                tab === key ? "bg-current/15 text-current" : "bg-gray-800 text-gray-600"
              }`} style={tab === key ? {backgroundColor:"currentColor", opacity:1} : {}}>
                <span className={tab === key ? "opacity-100" : ""}>{count}</span>
              </span>
            </button>
          ))}

          {/* Total CA (aligné à droite) */}
          {totalTTC > 0 && (
            <div className="ml-auto pb-2 text-right">
              <span className="text-[10px] text-gray-500">CA TTC affiché · </span>
              <span className="text-sm font-bold text-white">
                {new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(totalTTC)}
              </span>
            </div>
          )}
        </div>

        {/* ── Tableau ── */}
        {filtered.length === 0 ? (
          <div className="bg-gray-800/50 border border-dashed border-gray-700 rounded-xl py-16 text-center">
            <p className="text-gray-500 text-sm">Aucune vente trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-700/60">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gray-800 border-b border-gray-700/60">
                  {["Date","Client","Adresse","Ville","Tél","Vendeur","BC","Désignation","Montant TTC","TVA","CA HT","Chantier","Statut","Actions"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {filtered.map((sale, idx) => {
                  const confirmed = hasMontant(sale);
                  return (
                    <tr key={sale._id}
                      className={`group transition-colors ${
                        idx % 2 === 0 ? "bg-gray-900" : "bg-gray-800/30"
                      } hover:bg-gray-700/40`}>

                      {/* Indicateur latéral */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${confirmed ? "bg-emerald-500" : "bg-amber-500"}`}/>
                          <span className="text-gray-300">{fmtD(sale["DATE DE VENTE"])}</span>
                        </div>
                      </td>

                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <p className="text-white font-medium">{sale["NOM DU CLIENT"]}</p>
                        {sale["prenom"] && <p className="text-gray-500 text-[10px]">{sale["prenom"]}</p>}
                      </td>

                      <td className="px-3 py-2.5 text-gray-400 max-w-[160px] truncate">
                        {sale["ADRESSE DU CLIENT"] || "—"}
                      </td>

                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-400">
                        {sale["VILLE"] || "—"}{sale["CP"] ? ` ${sale["CP"]}` : ""}
                      </td>

                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-400 font-mono">
                        {sale["TELEPHONE"] || "—"}
                      </td>

                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-300">
                        {sale["VENDEUR"] || "—"}
                      </td>

                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-400 font-mono">
                        {sale["NUMERO BC"] || "—"}
                      </td>

                      <td className="px-3 py-2.5 text-gray-400 max-w-[140px] truncate">
                        {sale["DESIGNATION"] || "—"}
                      </td>

                      <td className="px-3 py-2.5 whitespace-nowrap text-right font-semibold">
                        {confirmed ? <span className="text-white">{fmtCur(sale["MONTANT TTC"])}</span> : <span className="text-gray-600">—</span>}
                      </td>

                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-500 text-center">
                        {confirmed ? (sale["TAUX TVA"] || "—") : "—"}
                      </td>

                      <td className="px-3 py-2.5 whitespace-nowrap text-right text-gray-400">
                        {confirmed ? fmtCur(sale["MONTANT HT"]) : "—"}
                      </td>

                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">
                        {sale["PREVISION CHANTIER"] ? fmtD(sale["PREVISION CHANTIER"]) : "—"}
                      </td>

                      {/* Badge statut */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {confirmed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full font-semibold">
                            ✓ Confirmé
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full font-semibold">
                            En attente
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => router.push(`/sales/edit/${sale._id}`)}
                            className="w-7 h-7 flex items-center justify-center bg-gray-700 hover:bg-blue-600 rounded-lg transition-colors" title="Modifier">
                            <FontAwesomeIcon icon={faEdit} className="text-[10px]"/>
                          </button>

                          <button onClick={() => copyRow(sale)}
                            className="w-7 h-7 flex items-center justify-center bg-gray-700 hover:bg-indigo-600 rounded-lg transition-colors" title="Copier la ligne (Excel)">
                            <FontAwesomeIcon icon={faCopy} className="text-[10px]"/>
                          </button>

                          {confirmed ? (
                            <button onClick={() => router.push(`/file/details/${sale._id}`)}
                              className="w-7 h-7 flex items-center justify-center bg-gray-700 hover:bg-blue-500 rounded-lg transition-colors" title="Voir PDF">
                              <FontAwesomeIcon icon={faFile} className="text-[10px]"/>
                            </button>
                          ) : (
                            <button onClick={() => setConfirm(sale)}
                              className="w-7 h-7 flex items-center justify-center bg-gray-700 hover:bg-emerald-600 rounded-lg transition-colors" title="Confirmer">
                              <FontAwesomeIcon icon={faCheck} className="text-[10px]"/>
                            </button>
                          )}

                          <button onClick={() => handleDelete(sale)}
                            className="w-7 h-7 flex items-center justify-center bg-gray-700 hover:bg-red-600 rounded-lg transition-colors" title="Supprimer">
                            <FontAwesomeIcon icon={faTrash} className="text-[10px]"/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmSale && (
        <ConfirmModal sale={confirmSale} onClose={() => setConfirm(null)} onSave={handleConfirmSave}/>
      )}

      <ToastContainer position="bottom-center" autoClose={2500} hideProgressBar newestOnTop theme="dark"/>
    </div>
  );
};

export default AllSales;
