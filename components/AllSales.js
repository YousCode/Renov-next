"use client";

// --------------------------------------------
// AllSalesImproved.jsx – version sans la colonne « MONTANT »
// --------------------------------------------

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import Tesseract from "tesseract.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEdit,
  faFile,
  faTrash,
  faCopy,
  faDownload,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import Confetti from "react-confetti";
import useWindowSize from "react-use/lib/useWindowSize";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import clsx from "clsx";

// -----------------------------------------------
// Constantes & Helpers
// -----------------------------------------------
const ITEMS_PER_PAGE = 500;

const months = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

const normalizeString = (str) =>
  str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

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

function calculateCommission(sale) {
  const caHT = parseFloat(sale["MONTANT HT"]) || 0;
  const percent = { T1: 0.2, T2: 0.17, T3: 0.15, T4: 0.12, T5: 0.1, T6: 0.06 }[sale["BAREME COM"]] ?? 0.1;
  return (caHT * percent).toFixed(2);
}

function getBaremeBgColor(b) {
  return { T1:"bg-green-300",T2:"bg-blue-300",T3:"bg-purple-300",T4:"bg-yellow-300",T6:"bg-red-300" }[b] || "";
}

// -------------------------------------------------
// Nettoyage / déduplication
// -------------------------------------------------
function processSalesData(salesData) {
  const unique = [], seen = new Set();
  salesData.forEach((sale) => {
    const id = `${normalizeString(sale["NOM DU CLIENT"])}|${formatDate(sale["DATE DE VENTE"])}|${sale["MONTANT TTC"]}|${sale["VENDEUR"]}`;
    if (seen.has(id)) return; seen.add(id);

    let ht = parseFloat(sale["MONTANT HT"]);
    let ttc = parseFloat(sale["MONTANT TTC"]);
    let taux = parseFloat(sale["TAUX TVA"]);

    if (!isNaN(taux) && taux > 0) {
      if (taux > 100) taux /= 100;
      taux = Math.min(Math.max(taux, 0.055), 0.2);
    } else taux = null;

    if (taux) {
      if (isNaN(ttc) && !isNaN(ht)) ttc = ht * (1 + taux);
      if (isNaN(ht) && !isNaN(ttc)) ht = ttc / (1 + taux);
    }

    sale["MONTANT HT"] = (ht ?? 0).toFixed(2);
    sale["MONTANT TTC"] = (ttc ?? 0).toFixed(2);
    sale["TAUX TVA"]      = taux ? `${(taux*100).toFixed(1).replace(".",",")} %` : "";
    sale["BAREME COM"]    = sale["BAREME COM"] || "T5";
    sale["MONTANT COMMISSIONS"] = calculateCommission(sale);

    unique.push(sale);
  });
  return unique;
}

// ------------------------------------------------------------------
// Loader
// ------------------------------------------------------------------
const Loader = () => (
  <div className="flex items-center justify-center py-8">
    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600" />
  </div>
);

// ------------------------------------------------------------------
// Barre de filtres & contrôles
// ------------------------------------------------------------------
const FiltersBar = ({
  showAllSales,toggleShowAll,
  searchTerm,onSearchChange,
  sortField,setSortField,
  sortOrder,setSortOrder,
  copyCSV,downloadCSV,
  selectedMonth,setSelectedMonth,
  selectedYear,setSelectedYear,
}) => (
  <div className="flex flex-col items-center w-full mb-2 text-[10px]">
    <div className="flex flex-wrap items-center justify-center gap-1 mb-1">
      <button onClick={toggleShowAll} className="px-2 py-1 bg-blue-500 text-white rounded">
        {showAllSales ? "Afficher mensuelles" : "Afficher toutes"}
      </button>
      <input
        value={searchTerm} onChange={onSearchChange}
        placeholder="Rechercher"
        className="w-40 p-1 border border-gray-300 rounded"
        aria-label="Rechercher"
      />
      <select value={sortField} onChange={e=>setSortField(e.target.value)} className="p-1 border rounded">
        {["DATE DE VENTE","NOM DU CLIENT","MONTANT HT","MONTANT TTC","VENDEUR","DESIGNATION","PREVISION CHANTIER"]
          .map(f=>(<option key={f} value={f}>{f}</option>))}
      </select>
      <select value={sortOrder} onChange={e=>setSortOrder(e.target.value)} className="p-1 border rounded">
        <option value="asc">Asc</option><option value="desc">Desc</option>
      </select>
      <button onClick={copyCSV} className="px-2 py-1 bg-purple-500 text-white rounded" title="Copier CSV">
        <FontAwesomeIcon icon={faCopy}/>
      </button>
      <button onClick={downloadCSV} className="px-2 py-1 bg-green-500 text-white rounded" title="Télécharger CSV">
        <FontAwesomeIcon icon={faDownload}/>
      </button>
    </div>

    {!showAllSales && (
      <div className="flex gap-1 flex-wrap justify-center">
        {months.map((m,i)=>(
          <button key={m} onClick={()=>setSelectedMonth(i)}
            className={clsx("px-1 py-1 rounded whitespace-nowrap",
              selectedMonth===i?"bg-blue-500 text-white":"bg-gray-600 text-white")}>
            {m}
          </button>
        ))}
        <select value={selectedYear} onChange={e=>setSelectedYear(+e.target.value)} className="p-1 bg-gray-600 text-white rounded">
          {Array.from({length:10},(_,k)=>new Date().getFullYear()-k).map(y=>(
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
    )}
  </div>
);

// ------------------------------------------------------------------
// Tableau des ventes
// ------------------------------------------------------------------
const SalesTable = ({
  sales,showAllSales,onDoubleClick,onEdit,onDetails,onCopy,onHide,
}) => (
  <div className="w-full overflow-x-auto mb-8 text-[10px]">
    <table className="min-w-full bg-white text-gray-800">
      <thead className="bg-gray-700 text-white">
        {showAllSales ? (
          <tr>{[
            "DATE DE VENTE","NOM DU CLIENT","prenom","NUMERO BC","ADRESSE DU CLIENT",
            "CODE INTERP etage","VILLE","CP","TELEPHONE","VENDEUR",
            "DESIGNATION","TAUX TVA","MONTANT TTC","MONTANT HT",
            "PREVISION CHANTIER","OBSERVATION","Actions",
          ].map(h=><th key={h} className="border px-1 py-1">{h}</th>)}</tr>
        ) : (
          <tr>{[
            "Date vente","Client","VENDEUR","BC","désignation produit",
            "Montant vente TTC (€)","TVA","CA HT (€)","Barème COM",
            "Montant commissions en €","Actions",
          ].map(h=><th key={h} className="border px-1 py-1">{h}</th>)}</tr>
        )}
      </thead>
      <tbody>
        {sales.map((sale)=>{
          const cancelled = normalizeString(sale.ETAT)==="annule";
          const warnAddr  = !sale["ADRESSE DU CLIENT"] || !sale.VILLE;
          const rowClass  = clsx({"bg-red-200 animate-pulse":cancelled,"animate-pulse bg-yellow-100":warnAddr});
          const ttc = parseFloat(sale["MONTANT TTC"])||0,
                ht  = parseFloat(sale["MONTANT HT"]) ||0,
                paid = (sale.payments||[]).reduce((s,p)=>s+parseFloat(p.montant),0),
                progress = ttc>0?paid/ttc*100:0;

          return (
            <tr key={sale._id} className={`${rowClass} hover:bg-gray-100`} onDoubleClick={()=>onDoubleClick(sale)}>
              {showAllSales ? (
                <>
                  <td className="border px-1 py-1">{formatDate(sale["DATE DE VENTE"])}</td>
                  <td className="border px-1 py-1">{sale["NOM DU CLIENT"]}</td>
                  <td className="border px-1 py-1">{sale["prenom"]||""}</td>
                  <td className="border px-1 py-1">{sale["NUMERO BC"]}</td>
                  <td className="border px-1 py-1">{sale["ADRESSE DU CLIENT"]}</td>
                  <td className="border px-1 py-1">{sale["CODE INTERP etage"]}</td>
                  <td className="border px-1 py-1">{sale["VILLE"]}</td>
                  <td className="border px-1 py-1">{sale["CP"]}</td>
                  <td className="border px-1 py-1">{sale["TELEPHONE"]}</td>
                  <td className="border px-1 py-1">{sale["VENDEUR"]}</td>
                  <td className="border px-1 py-1">{sale["DESIGNATION"]}</td>
                  <td className="border px-1 py-1">{sale["TAUX TVA"]}</td>
                  <td className="border px-1 py-1 text-right">{formatNumber(ttc)}</td>
                  <td className="border px-1 py-1 text-right">{formatNumber(ht)}</td>
                  <td className="border px-1 py-1">{sale["PREVISION CHANTIER"]?formatDate(sale["PREVISION CHANTIER"]):""}</td>
                  <td className="border px-1 py-1">{sale["OBSERVATION"]}</td>
                  <td className="border px-1 py-1"><ActionButtons sale={sale} {...{onEdit,onDetails,onCopy,onHide}}/></td>
                </>
              ) : (
                <>
                  <td className="border px-1 py-1 relative">
                    {formatDate(sale["DATE DE VENTE"])}
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-300">
                      <div className="bg-green-500 h-1" style={{width:`${progress}%`}}/>
                    </div>
                  </td>
                  <td className="border px-1 py-1">{sale["NOM DU CLIENT"]}</td>
                  <td className="border px-1 py-1">{sale["VENDEUR"]}</td>
                  <td className="border px-1 py-1">{sale["NUMERO BC"]}</td>
                  <td className="border px-1 py-1">{sale["DESIGNATION"]}</td>
                  <td className="border px-1 py-1 text-right">{formatNumber(ttc)}</td>
                  <td className="border px-1 py-1">{sale["TAUX TVA"]}</td>
                  <td className="border px-1 py-1 text-right">{formatNumber(ht)}</td>
                  <td className={`border px-1 py-1 ${getBaremeBgColor(sale["BAREME COM"])}`}>{sale["BAREME COM"]}</td>
                  <td className="border px-1 py-1 text-right">{formatNumber(sale["MONTANT COMMISSIONS"])}</td>
                  <td className="border px-1 py-1"><ActionButtons sale={sale} {...{onEdit,onDetails,onCopy,onHide}}/></td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

// ------------------------------------------------------------------
// Totaux (TTC & HT uniquement)
// ------------------------------------------------------------------
const TotalsRow = ({ showAllSales,totalTTC,totalHT }) => (
  <tr className="bg-gray-200 font-bold">
    {showAllSales ? (
      <>
        <td colSpan={12} className="border px-1 py-1 text-right">Totaux :</td>
        <td className="border px-1 py-1 text-right">{formatNumber(totalTTC)}</td>
        <td className="border px-1 py-1 text-right">{formatNumber(totalHT)}</td>
        <td colSpan={3} className="border px-1 py-1"/>
      </>
    ) : (
      <>
        <td colSpan={5} className="border px-1 py-1 text-right">Totaux :</td>
        <td className="border px-1 py-1 text-right">{formatNumber(totalTTC)}</td>
        <td className="border px-1 py-1"/>
        <td className="border px-1 py-1 text-right">{formatNumber(totalHT)}</td>
        <td colSpan={3} className="border px-1 py-1"/>
      </>
    )}
  </tr>
);

// ------------------------------------------------------------------
// Boutons d'actions
// ------------------------------------------------------------------
const ActionButtons = ({ sale,onEdit,onDetails,onCopy,onHide }) => (
  <div className="flex justify-center gap-1">
    <button onClick={()=>onEdit(sale)} className="px-1 py-1 bg-blue-500 text-white rounded" aria-label="Modifier">
      <FontAwesomeIcon icon={faEdit}/>
    </button>
    <button onClick={()=>onDetails(sale)} className="px-1 py-1 bg-green-500 text-white rounded" aria-label="Détails">
      <FontAwesomeIcon icon={faFile}/>
    </button>
    <button onClick={()=>onCopy(sale)} className="px-1 py-1 bg-purple-500 text-white rounded" aria-label="Copier">
      <FontAwesomeIcon icon={faCopy}/>
    </button>
    <button onClick={()=>onHide(sale)} className="px-1 py-1 bg-red-500 text-white rounded" aria-label="Cacher">
      <FontAwesomeIcon icon={faTrash}/>
    </button>
  </div>
);

// ------------------------------------------------------------------
// Modal Paiements (inchangé)
// ------------------------------------------------------------------
const PaymentModal = ({ sale,payments,setPayments,onClose,onSave }) => {
  const { width,height } = useWindowSize();
  const [newPayment,setNewPayment] = useState({ amount:"",date:"",comment:"" });
  const [ocrLoading,setOcrLoading] = useState(false);

  const totalPaid = useMemo(()=>payments.reduce((s,p)=>s+p.montant,0),[payments]);
  const totalAmount = parseFloat(sale["MONTANT TTC"])||parseFloat(sale["MONTANT HT"])||0;
  const progress = totalAmount>0?totalPaid/totalAmount*100:0;

  const extractAmount = (txt)=>txt.match(/(\\d+[\\.,]\\d{2})/)?.[1].replace(",",".");

  const handleImageUpload = async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    setOcrLoading(true);
    try{
      const { data } = await Tesseract.recognize(file,"fra");
      const amt = extractAmount(data.text);
      if(amt) setNewPayment(p=>({...p,amount:amt})); else toast.warn("Aucun montant détecté");
    }catch{ toast.error("Erreur OCR"); } finally{ setOcrLoading(false); }
  };

  const addPayment = ()=>{
    const amt = parseFloat(newPayment.amount);
    if(isNaN(amt)||!newPayment.date) return toast.error("Champs invalides");
    setPayments(p=>[...p,{ id:Date.now(),montant:amt,date:newPayment.date,comment:newPayment.comment }]);
    setNewPayment({ amount:"",date:"",comment:"" });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 text-[10px]">
      <div className="bg-white w-11/12 md:w-2/3 lg:w-1/2 p-2 rounded-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xs font-bold">Paiements – {sale["NOM DU CLIENT"]}</h2>
          <button onClick={onClose} aria-label="Fermer"><FontAwesomeIcon icon={faTimes}/></button>
        </div>

        <div className="mb-1 text-xs">
          <p>Total : {formatNumber(totalAmount)}</p>
          <p>Payé : {formatNumber(totalPaid)}</p>
          <div className="w-full h-2 bg-gray-200 rounded">
            <div className="h-2 bg-green-500 rounded" style={{width:`${progress}%`}}/>
          </div>
        </div>

        <div className="mb-2">
          <h3 className="font-semibold">Historique :</h3>
          {payments.length
            ? <ul className="list-disc ml-4">{payments.map(p=><li key={p.id}>{formatDate(p.date)} – {formatNumber(p.montant)} {p.comment&&`(${p.comment})`}</li>)}</ul>
            : <p>Aucun paiement.</p>}
        </div>

        <div className="space-y-1">
          <input type="number" step="0.01" value={newPayment.amount} onChange={e=>setNewPayment(p=>({...p,amount:e.target.value}))}
                 placeholder="Montant" className="p-1 border rounded w-full"/>
          <input type="date" value={newPayment.date} onChange={e=>setNewPayment(p=>({...p,date:e.target.value}))}
                 className="p-1 border rounded w-full"/>
          <textarea value={newPayment.comment} onChange={e=>setNewPayment(p=>({...p,comment:e.target.value}))}
                    placeholder="Commentaire" className="p-1 border rounded w-full"/>
          <input type="file" accept="image/*" onChange={handleImageUpload}/>
          {ocrLoading&&<span>Analyse OCR…</span>}
          <button onClick={addPayment} className="px-2 py-1 bg-green-600 text-white rounded">Ajouter</button>
        </div>

        <button onClick={onSave} className="mt-2 px-2 py-1 bg-blue-600 text-white rounded">Sauvegarder</button>
      </div>
      <Confetti width={width} height={height} recycle={false} numberOfPieces={150}/>
    </div>
  );
};

// ------------------------------------------------------------------
// Composant principal
// ------------------------------------------------------------------
const AllSales = () => {
  const router = useRouter();
  const [sales,setSales] = useState([]);
  const [showAllSales,setShowAllSales] = useState(true);
  const [selectedMonth,setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear,setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm,setSearchTerm] = useState("");
  const [sortField,setSortField] = useState("DATE DE VENTE");
  const [sortOrder,setSortOrder] = useState("asc");
  const [currentPage,setCurrentPage] = useState(1);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState(null);
  const [modalSale,setModalSale] = useState(null);
  const [hiddenSales,setHiddenSales] = useState(()=>typeof window==="undefined"?[]:JSON.parse(localStorage.getItem("hiddenSales")||"[]"));

  const fetchSales = useCallback(async ()=>{
    setLoading(true);
    try{
      const res = await fetch("/api/ventes");
      if(!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setSales(processSalesData(data.data));
    }catch(err){ setError(err.message); } finally{ setLoading(false);}
  },[]);

  useEffect(()=>{ fetchSales(); },[fetchSales]);

  // Filtres
  const filteredSales = useMemo(()=>sales.filter(s=>{
    if(hiddenSales.includes(s._id)) return false;
    const d = new Date(s["DATE DE VENTE"]);
    if(!showAllSales && (d.getMonth()!==selectedMonth||d.getFullYear()!==selectedYear)) return false;
    if(searchTerm){
      const n = normalizeString(searchTerm);
      const fields=[s["NOM DU CLIENT"],s["TELEPHONE"],s["ADRESSE DU CLIENT"],s["VENDEUR"],s["DESIGNATION"]];
      if(!fields.some(f=>normalizeString(f||"").includes(n))) return false;
    }
    return true;
  }),[sales,hiddenSales,showAllSales,selectedMonth,selectedYear,searchTerm]);

  const sortedSales = useMemo(()=>[...filteredSales].sort((a,b)=>{
    let A=a[sortField], B=b[sortField];
    if(sortField.includes("DATE")){ A=new Date(A||0); B=new Date(B||0); }
    else if(sortField.includes("MONTANT")){ A=parseFloat(A)||0; B=parseFloat(B)||0; }
    else{ A=normalizeString(A); B=normalizeString(B);}
    if(A<B) return sortOrder==="asc"?-1:1;
    if(A>B) return sortOrder==="asc"?1:-1;
    return 0;
  }),[filteredSales,sortField,sortOrder]);

  const paginatedSales = useMemo(()=>{
    const start=(currentPage-1)*ITEMS_PER_PAGE;
    return sortedSales.slice(start,start+ITEMS_PER_PAGE);
  },[sortedSales,currentPage]);

  const totalPages = Math.max(1,Math.ceil(sortedSales.length/ITEMS_PER_PAGE));

  // Totaux (TTC & HT)
  const [totalTTC,totalHT] = useMemo(()=>{
    let ttc=0,ht=0;
    paginatedSales.forEach(s=>{
      if(normalizeString(s.ETAT)==="annule") return;
      ttc+=parseFloat(s["MONTANT TTC"])||0;
      ht +=parseFloat(s["MONTANT HT"]) ||0;
    });
    return [ttc,ht];
  },[paginatedSales]);

  // Handlers
  const handleHideSale = (sale)=>{
    if(confirm("Cacher cette vente ?")){
      const updated=[...hiddenSales,sale._id];
      setHiddenSales(updated);
      localStorage.setItem("hiddenSales",JSON.stringify(updated));
      toast.success("Vente cachée");
    }
  };

  const handleCopySale = (sale)=>{
    const txt = `Date : ${formatDate(sale["DATE DE VENTE"])}\nClient : ${sale["NOM DU CLIENT"]}\nMontant TTC : ${formatNumber(sale["MONTANT TTC"])}`;
    navigator.clipboard.writeText(txt).then(()=>toast.success("Copié !"));
  };

  const handleCopyCSV = ()=>{
    if(!paginatedSales.length) return toast.info("Rien à copier");
    const fields=["DATE DE VENTE","NOM DU CLIENT","MONTANT TTC","MONTANT HT"];
    const csv=[fields.join(";"),...paginatedSales.map(s=>fields.map(f=>s[f]||"").join(";"))].join("\n");
    navigator.clipboard.writeText(csv).then(()=>toast.success("CSV copié"));
  };

  const handleDownloadCSV = ()=>{
    if(!paginatedSales.length) return toast.info("Rien à télécharger");
    const blob=new Blob([paginatedSales.map(s=>Object.values(s).join(";")).join("\n")],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download="ventes.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const handleSaveModalSale = async ()=>{
    if(!modalSale) return;
    try{
      const res = await fetch(`/api/ventes/${modalSale._id}`,{
        method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(modalSale)
      });
      if(!res.ok) throw new Error(await res.text());
      toast.success("Sauvegardé !");
      setModalSale(null); fetchSales();
    }catch(err){ toast.error(err.message);}
  };

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  if(loading) return <Loader/>;
  if(error)  return <p className="text-red-600">Erreur : {error}</p>;

  return (
    <div className="min-h-screen bg-gray-800 text-[10px] p-2 flex flex-col items-center">
      <button onClick={()=>router.back()} className="mb-1 px-2 py-1 bg-gray-700 text-white rounded">Retour</button>

      <FiltersBar
        showAllSales={showAllSales}
        toggleShowAll={()=>setShowAllSales(v=>!v)}
        searchTerm={searchTerm}
        onSearchChange={e=>{setSearchTerm(e.target.value); setCurrentPage(1);}}
        sortField={sortField} setSortField={setSortField}
        sortOrder={sortOrder} setSortOrder={setSortOrder}
        copyCSV={handleCopyCSV} downloadCSV={handleDownloadCSV}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
      />

      <SalesTable
        sales={paginatedSales} showAllSales={showAllSales}
        onDoubleClick={setModalSale}
        onEdit={s=>router.push(`/sales/edit/${s._id}`)}
        onDetails={s=>router.push(`/file/details/${s._id}`)}
        onCopy={handleCopySale} onHide={handleHideSale}
      />

      {/* Pagination */}
      {totalPages>1 && (
        <div className="flex gap-1 mb-2">
          <button disabled={currentPage===1} onClick={()=>setCurrentPage(p=>p-1)}
                  className="px-2 py-1 bg-gray-600 text-white rounded disabled:opacity-50">←</button>
          <span className="self-center text-white">{currentPage} / {totalPages}</span>
          <button disabled={currentPage===totalPages} onClick={()=>setCurrentPage(p=>p+1)}
                  className="px-2 py-1 bg-gray-600 text-white rounded disabled:opacity-50">→</button>
        </div>
      )}

      {/* Totaux (table cachée pour alignement) */}
      <table className="hidden" aria-hidden="true"><tbody>
        <TotalsRow showAllSales={showAllSales} totalTTC={totalTTC} totalHT={totalHT}/>
      </tbody></table>

      {modalSale && (
        <PaymentModal
          sale={modalSale}
          payments={modalSale.payments||[]}
          setPayments={p=>setModalSale(s=>({...s,payments:p}))}
          onClose={()=>setModalSale(null)}
          onSave={handleSaveModalSale}
        />
      )}

      <ToastContainer position="bottom-center" autoClose={2500} hideProgressBar newestOnTop/>
    </div>
  );
};

export default AllSales;