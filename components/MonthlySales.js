"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Confetti from "react-confetti";
import useWindowSize from "react-use/lib/useWindowSize";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEdit,
  faFile,
  faMoneyBillWave,
  faTimes,
  faTrash,
  faCopy,
} from "@fortawesome/free-solid-svg-icons";

const normalizeString = (str) =>
  str
    ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    : "";

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

const processSalesData = (salesData) => {
  const uniqueSales = [];
  const seen = new Set();

  salesData.forEach((sale) => {
    const identifier = `${normalizeString(sale["Client"])}|${formatDate(
      sale["Date vente"]
    )}|${sale["Montant vente TTC (€)"]}|${sale["VENDEUR"]}`;

    if (!seen.has(identifier)) {
      seen.add(identifier);

      let montantHT = parseFloat(sale["CA HT (€)"]);
      let montantTTC = parseFloat(sale["Montant vente TTC (€)"]);
      let tva = parseFloat((sale["Taux TVA"]||"").replace("%","")) || 5.5;
      if (tva > 1) tva = tva/100;

      if (isNaN(montantTTC) && !isNaN(montantHT)) {
        montantTTC = montantHT * (1 + tva);
        sale["Montant vente TTC (€)"] = montantTTC.toFixed(2);
      }

      if (isNaN(montantHT) && !isNaN(montantTTC)) {
        montantHT = montantTTC / (1 + tva);
        sale["CA HT (€)"] = montantHT.toFixed(2);
      }

      if (isNaN(montantHT) && isNaN(montantTTC)) {
        sale["CA HT (€)"] = "0.00";
        sale["Montant vente TTC (€)"] = "0.00";
      }

      uniqueSales.push(sale);
    }
  });

  return uniqueSales;
};

const ITEMS_PER_PAGE = 500;

const MonthlySales = () => {
  const [sales, setSales] = useState([]);
  const [displayedSales, setDisplayedSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("Date vente");
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
  const { width, height } = useWindowSize();

  useEffect(() => {
    fetchSales();
  }, [selectedMonth, selectedYear]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/ventes");
      if (!response.ok) {
        throw new Error(`Échec de la récupération des ventes : ${response.statusText}`);
      }
      const data = await response.json();
      const processed = processSalesData(data.data);
      setSales(processed);
      filterSales(processed);
    } catch (error) {
      console.error("Erreur lors de la récupération des ventes :", error);
      setError(`Erreur : ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filterSales = (salesData) => {
    let filtered = salesData.filter((sale) => {
      const date = new Date(sale["Date vente"]);
      const etat = normalizeString(sale.ETAT || "");
      return (
        date.getMonth() === selectedMonth &&
        date.getFullYear() === selectedYear &&
        !isExcludedState(etat) &&
        !hiddenSales.includes(sale._id)
      );
    });

    if (searchTerm) {
      filtered = filtered.filter((sale) =>
        ["Client","VENDEUR","désignation produit","BC"].some(field =>
          normalizeString(sale[field]||"").includes(searchTerm)
        )
      );
    }

    filtered.sort((a,b) => {
      let valueA = a[sortField];
      let valueB = b[sortField];

      if (sortField === "Date vente") {
        valueA = valueA ? new Date(valueA) : new Date(0);
        valueB = valueB ? new Date(valueB) : new Date(0);
      } else if (sortField === "CA HT (€)" || sortField === "Montant vente TTC (€)") {
        valueA = parseFloat(valueA);
        valueB = parseFloat(valueB);
      } else {
        valueA = normalizeString(valueA);
        valueB = normalizeString(valueB);
      }

      if (valueA < valueB) return sortOrder==="asc"?-1:1;
      if (valueA > valueB) return sortOrder==="asc"?1:-1;
      return 0;
    });

    setTotalPages(Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage-1)*ITEMS_PER_PAGE;
    const endIndex = startIndex+ITEMS_PER_PAGE;
    const paginated = filtered.slice(startIndex,endIndex);
    setDisplayedSales(paginated);
  };

  useEffect(()=>{
    filterSales(sales);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sales,searchTerm,sortField,sortOrder,currentPage,hiddenSales,selectedMonth,selectedYear]);

  const handleSearchChange = (e) => {
    setSearchTerm(normalizeString(e.target.value));
    setCurrentPage(1);
  };

  const handleRowDoubleClick = (sale) => {
    setSelectedSale(sale);
    setPayments(sale.payments||[]);
    setIsModalOpen(true);
  };

  const handleCopySale = (sale) => {
    const fields = [
      formatDate(sale["Date vente"]),
      sale["Client"] || "",
      sale["VENDEUR"] || "",
      sale["BC"] || "",
      sale["désignation produit"] || "",
      sale["Montant vente TTC (€)"] || "",
      sale["Taux TVA"] || "",
      sale["CA HT (€)"] || "",
      sale["Barème COM"] || "",
      sale["Montant commissions en €"] || ""
    ];
    const line=fields.join(";");
    navigator.clipboard.writeText(line)
      .then(()=>alert("Ligne copiée pour Excel !"))
      .catch(err=>{alert("Erreur copie.");console.error(err);});
  };

  const handleAddPayment = () => {
    if (!newPaymentAmount || !newPaymentDate) {
      alert("Veuillez remplir tous les champs.");
      return;
    }
    const montant = parseFloat(newPaymentAmount);
    if (isNaN(montant)||montant<=0) {
      alert("Montant invalide.");
      return;
    }
    const newPayment = {
      montant,
      date:newPaymentDate,
      comment:newPaymentComment,
      id:Date.now()
    };

    setPayments(prev=>[...prev,newPayment]);
    setSales(prev=>prev.map(s=>s._id===selectedSale._id?{...s,payments:[...(s.payments||[]),newPayment]}:s));

    setNewPaymentAmount("");
    setNewPaymentDate("");
    setNewPaymentComment("");
  };

  const extractAmountFromText=(text)=>{
    const regex=/(\d+[\.,\s]\d{2})/g;
    const matches=text.match(regex);
    if(matches&&matches.length>0){
      return matches[0].replace(",",".").replace(" ","");
    }
    return null;
  };

  const handleImageUpload = async (e) => {
    const file=e.target.files[0];
    if(!file)return;

    setOcrLoading(true);
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const {data:{text}}= await Tesseract.recognize(file,"fra");
      const amount = extractAmountFromText(text);
      if(amount){
        setNewPaymentAmount(amount);
      } else {
        alert("Aucun montant détecté.");
      }
    }catch(err){
      console.error("Erreur OCR:",err);
      alert("Erreur OCR.");
    }finally{
      setOcrLoading(false);
    }
  };

  const calculateTotalPaid=()=>payments.reduce((sum,p)=>sum+p.montant,0);

  const calculateProgress=()=>{
    const totalPaid=calculateTotalPaid();
    const totalAmount=parseFloat(selectedSale?.["Montant vente TTC (€)"])||parseFloat(selectedSale?.["CA HT (€)"])||0;
    return totalAmount>0?(totalPaid/totalAmount)*100:0;
  };

  const calculateSaleProgress=(sale)=>{
    const totalPaid=(sale.payments||[]).reduce((sum,p)=>sum+parseFloat(p.montant),0);
    const totalAmount = parseFloat(sale["Montant vente TTC (€)"])||parseFloat(sale["CA HT (€)"])||0;
    return totalAmount>0?(totalPaid/totalAmount)*100:0;
  };

  const calculateTotalHT=()=>{
    return displayedSales.reduce((sum,sale)=>{
      const etat=normalizeString(sale.ETAT||"");
      if(etat==="annule")return sum;
      const ht=parseFloat(sale["CA HT (€)"]);
      return sum+(isNaN(ht)?0:ht);
    },0);
  };

  const calculateTotalTTC=()=>{
    return displayedSales.reduce((sum,sale)=>{
      const etat=normalizeString(sale.ETAT||"");
      if(etat==="annule")return sum;
      const ttc=parseFloat(sale["Montant vente TTC (€)"]);
      return sum+(isNaN(ttc)?0:ttc);
    },0);
  };

  const handleHideSale=(sale)=>{
    const confirmation=confirm("Cacher cette vente ?");
    if(!confirmation)return;
    const updated=[...hiddenSales,sale._id];
    setHiddenSales(updated);
    localStorage.setItem("hiddenSales",JSON.stringify(updated));

    setSales(prev=>prev.filter(s=>s._id!==sale._id));
    setDisplayedSales(prev=>prev.filter(s=>s._id!==sale._id));
    alert("Vente cachée.");
  };

  const handleSaveSale=async()=>{
    try{
      const updatedSale=selectedSale;
      const response=await fetch(`/api/ventes/${updatedSale._id}`,{
        method:"PUT",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(updatedSale)
      });
      if(response.ok){
        const data=await response.json();
        setSales(prev=>prev.map(s=>s._id===data.data._id?data.data:s));
        alert("Vente mise à jour !");
        setIsModalOpen(false);
      } else {
        const errorData=await response.json();
        throw new Error(errorData.message||`Erreur : ${response.status}`);
      }
    }catch(err){
      console.error("Erreur save:",err.message);
      alert(`Erreur sauvegarde : ${err.message}`);
    }
  };

  if(loading)return<p className="text-center text-gray-700">Chargement...</p>;
  if(error)return<p className="text-center text-red-500">{error}</p>;

  const months=[
    "Janvier","Février","Mars","Avril","Mai","Juin",
    "Juillet","Août","Septembre","Octobre","Novembre","Décembre"
  ];

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-800 p-2 font-arial text-xs">
      <div className="flex items-center w-full mb-2 justify-between">
        <button onClick={()=>router.back()} className="px-2 py-1 bg-gray-700 text-white rounded text-xs">Retour</button>
        <div className="flex space-x-2">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Rechercher..."
            className="w-40 p-1 border border-gray-300 rounded text-xs"
          />
          <label className="text-white text-xs">Trier par :</label>
          <select
            value={sortField}
            onChange={(e)=>setSortField(e.target.value)}
            className="p-1 border border-gray-300 rounded text-xs"
          >
            <option value="Date vente">Date vente</option>
            <option value="Client">Client</option>
            <option value="VENDEUR">VENDEUR</option>
            <option value="désignation produit">désignation produit</option>
            <option value="Montant vente TTC (€)">Montant vente TTC</option>
            <option value="CA HT (€)">CA HT</option>
            <option value="Taux TVA">Taux TVA</option>
            <option value="Barème COM">Barème COM</option>
            <option value="Montant commissions en €">Montant com</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e)=>setSortOrder(e.target.value)}
            className="p-1 border border-gray-300 rounded text-xs"
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>
      </div>

      <div className="w-full overflow-x-auto mb-16">
        <table ref={tableRef} className="min-w-full bg-white text-gray-800 text-xs">
          <thead className="bg-gray-700 text-white">
            <tr>
              <th className="px-1 py-1">Date vente</th>
              <th className="px-1 py-1">Client</th>
              <th className="px-1 py-1">VENDEUR</th>
              <th className="px-1 py-1">BC</th>
              <th className="px-1 py-1">désignation produit</th>
              <th className="px-1 py-1">Montant vente TTC (€)</th>
              <th className="px-1 py-1">Taux TVA</th>
              <th className="px-1 py-1">CA HT (€)</th>
              <th className="px-1 py-1">Barème COM</th>
              <th className="px-1 py-1">Montant commissions en €</th>
              <th className="px-1 py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedSales.map((sale)=>{
              const etat=normalizeString(sale.ETAT||"");
              let rowClass="bg-yellow-200"; 
              if(etat==="annule"){
                rowClass="bg-red-200 animate-blink";
              } else if(!sale["Client"]){
                rowClass="animate-blink-yellow";
              }

              const progress=calculateSaleProgress(sale);

              return(
                <tr
                  key={sale._id}
                  className={`${rowClass} hover:bg-yellow-100`}
                  onDoubleClick={()=>handleRowDoubleClick(sale)}
                >
                  <td className="border px-1 py-1 relative">
                    {formatDate(sale["Date vente"])}
                    <div className="absolute bottom-0 left-0 w-full">
                      <div className="w-full bg-gray-300 rounded-full h-1">
                        <div
                          className="bg-green-500 h-1 rounded-full"
                          style={{width:`${progress}%`}}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="border px-1 py-1">{sale["Client"]||""}</td>
                  <td className="border px-1 py-1">{sale["VENDEUR"]||""}</td>
                  <td className="border px-1 py-1">{sale["BC"]||""}</td>
                  <td className="border px-1 py-1">{sale["désignation produit"]||""}</td>
                  <td className="border px-1 py-1 text-right">{sale["Montant vente TTC (€)"]?formatNumber(sale["Montant vente TTC (€)"]):""}</td>
                  <td className="border px-1 py-1">{sale["Taux TVA"]||""}</td>
                  <td className="border px-1 py-1 text-right">{sale["CA HT (€)"]?formatNumber(sale["CA HT (€)"]):""}</td>
                  <td className="border px-1 py-1">{sale["Barème COM"]||""}</td>
                  <td className="border px-1 py-1 text-right">{sale["Montant commissions en €"]?formatNumber(sale["Montant commissions en €"]):""}</td>
                  <td className="border px-1 py-1 flex space-x-1 justify-center">
                    <button
                      onClick={()=>router.push(`/sales/edit/${sale._id}`)}
                      className="px-1 py-1 bg-blue-500 text-white rounded text-xxs"
                      title="Modifier"
                    >
                      <FontAwesomeIcon icon={faEdit}/>
                    </button>
                    <button
                      onClick={()=>router.push(`/file/details/${sale._id}`)}
                      className="px-1 py-1 bg-green-500 text-white rounded text-xxs"
                      title="Détails fichier"
                    >
                      <FontAwesomeIcon icon={faFile}/>
                    </button>
                    <button
                      onClick={()=>handleRowDoubleClick(sale)}
                      className="px-1 py-1 bg-yellow-500 text-white rounded text-xxs"
                      title="Paiements"
                    >
                      <FontAwesomeIcon icon={faMoneyBillWave}/>
                    </button>
                    <button
                      onClick={()=>handleCopySale(sale)}
                      className="px-1 py-1 bg-purple-500 text-white rounded text-xxs"
                      title="Copier pour Excel"
                    >
                      <FontAwesomeIcon icon={faCopy}/>
                    </button>
                    <button
                      onClick={()=>handleHideSale(sale)}
                      className="px-1 py-1 bg-red-500 text-white rounded text-xxs"
                      title="Cacher"
                    >
                      <FontAwesomeIcon icon={faTrash}/>
                    </button>
                  </td>
                </tr>
              );
            })}

            <tr
              className="bg-gray-300 font-bold cursor-pointer"
              onMouseEnter={()=>setShowConfetti(true)}
              onMouseLeave={()=>setShowConfetti(false)}
            >
              <td colSpan="5" className="border px-1 py-1 text-right">Totaux :</td>
              <td className="border px-1 py-1 text-right">{formatNumber(calculateTotalTTC())}</td>
              <td className="border px-1 py-1"></td>
              <td className="border px-1 py-1 text-right">{formatNumber(calculateTotalHT())}</td>
              <td className="border px-1 py-1"></td>
              <td className="border px-1 py-1"></td>
              <td className="border px-1 py-1"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex justify-center items-center space-x-2 mt-2">
        <button
          onClick={()=>setCurrentPage(prev=>Math.max(prev-1,1))}
          disabled={currentPage===1}
          className="px-2 py-1 bg-gray-500 text-white rounded-lg disabled:opacity-50 text-xs"
        >
          Précédent
        </button>
        <span className="text-white text-xs">Page {currentPage} sur {totalPages}</span>
        <button
          onClick={()=>setCurrentPage(prev=>Math.min(prev+1,totalPages))}
          disabled={currentPage===totalPages}
          className="px-2 py-1 bg-gray-500 text-white rounded-lg disabled:opacity-50 text-xs"
        >
          Suivant
        </button>
      </div>

      {showConfetti&&<Confetti width={width} height={height}/>}

      {isModalOpen&&selectedSale&&(
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white w-11/12 md:w-2/3 lg:w-1/2 p-4 rounded-lg overflow-y-auto max-h-screen">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-xs">
                Paiements pour {selectedSale["Client"]}
              </h2>
              <button
                onClick={()=>setIsModalOpen(false)}
                className="text-gray-600 hover:text-gray-800 text-xs"
              >
                <FontAwesomeIcon icon={faTimes} size="lg"/>
              </button>
            </div>

            <div className="mb-4 border-b pb-2">
              <h3 className="text-sm font-semibold mb-1 text-xs">Aperçu</h3>
              <p><strong>Date : </strong>{formatDate(selectedSale["Date vente"])}</p>
              <p><strong>Client : </strong>{selectedSale["Client"]}</p>
              <p><strong>Vendeur : </strong>{selectedSale["VENDEUR"]}</p>
              <p><strong>Produit : </strong>{selectedSale["désignation produit"]}</p>
              <p><strong>TTC : </strong>{formatNumber(selectedSale["Montant vente TTC (€)"])}</p>
              <p><strong>HT : </strong>{formatNumber(selectedSale["CA HT (€)"])}</p>
            </div>

            <div className="mb-4">
              <h3 className="font-bold text-xs mb-1">Prévision Chantier :</h3>
              <input
                type="date"
                value={selectedSale["PREVISION CHANTIER"]||""}
                onChange={(e)=>{
                  const upd={...selectedSale,"PREVISION CHANTIER":e.target.value};
                  setSelectedSale(upd);
                  setSales(prev=>prev.map(s=>s._id===upd._id?upd:s));
                }}
                className="w-full p-1 border border-gray-300 rounded text-xs"
              />
            </div>

            <div className="mb-4">
              <button
                onClick={handleSaveSale}
                className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
              >
                Sauvegarder
              </button>
            </div>

            <div className="mb-4">
              <h3 className="font-bold text-xs mb-1">Progression Paiements :</h3>
              <div className="w-full bg-gray-200 rounded-full h-4 mb-1">
                <div className="bg-green-500 h-4 rounded-full" style={{width:`${calculateProgress()}%`}}></div>
              </div>
              <p><strong>Total : </strong>{formatNumber(parseFloat(selectedSale["Montant vente TTC (€)"])||parseFloat(selectedSale["CA HT (€)"])||0)}</p>
              <p><strong>Payé : </strong>{formatNumber(calculateTotalPaid())}</p>
              <p><strong>Restant : </strong>{formatNumber((parseFloat(selectedSale["Montant vente TTC (€)"])||parseFloat(selectedSale["CA HT (€)"])||0)-calculateTotalPaid())}</p>
            </div>

            <div className="mb-4">
              <h3 className="font-bold text-xs mb-1">Historique Paiements :</h3>
              {payments.length>0?(
                <ul className="list-disc ml-4 text-xs">
                  {payments.map((p)=>(
                    <li key={p.id}>{formatDate(p.date)} - {formatNumber(p.montant)} {p.comment?`(${p.comment})`:""}</li>
                  ))}
                </ul>
              ):<p className="text-xs">Aucun paiement</p>}
            </div>

            <div className="mb-4">
              <h3 className="font-bold text-xs mb-1">Ajouter un Paiement :</h3>
              <input
                type="number"
                step="0.01"
                value={newPaymentAmount}
                onChange={(e)=>setNewPaymentAmount(e.target.value)}
                placeholder="Montant"
                className="p-1 border border-gray-300 rounded text-xs w-full mb-1"
              />
              <input
                type="date"
                value={newPaymentDate}
                onChange={(e)=>setNewPaymentDate(e.target.value)}
                className="p-1 border border-gray-300 rounded text-xs w-full mb-1"
              />
              <textarea
                value={newPaymentComment}
                onChange={(e)=>setNewPaymentComment(e.target.value)}
                placeholder="Commentaire"
                className="p-1 border border-gray-300 rounded text-xs w-full mb-1"
              ></textarea>
              <div className="flex items-center mb-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="p-1 text-xs"
                />
                {ocrLoading&&<span className="text-gray-600 text-xs ml-2">Analyse...</span>}
              </div>
              <button
                onClick={handleAddPayment}
                className="px-2 py-1 bg-green-500 text-white rounded text-xs"
              >
                Ajouter paiement
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="fixed bottom-0 left-0 w-full bg-gray-700 text-white py-2 flex flex-col md:flex-row justify-between items-center px-2 text-xs">
        <div className="flex space-x-1 overflow-x-auto mb-1 md:mb-0">
          {months.map((m,i)=>(
            <button
              key={i}
              onClick={()=>{setSelectedMonth(i);setCurrentPage(1);}}
              className={`px-1 py-1 rounded whitespace-nowrap ${selectedMonth===i?"bg-blue-500":"bg-gray-600"}`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex items-center space-x-1">
          <label htmlFor="year" className="text-xs">Année :</label>
          <select
            id="year"
            value={selectedYear}
            onChange={(e)=>{setSelectedYear(Number(e.target.value));setCurrentPage(1);}}
            className="p-1 bg-gray-600 rounded text-white text-xs"
          >
            {Array.from({length:10},(_,j)=>{
              const y=(new Date().getFullYear())-j;
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>
        </div>
      </footer>

      <style jsx>{`
        @keyframes blink {
          0% {opacity:1;}
          50% {opacity:0.5;}
          100% {opacity:1;}
        }
        .animate-blink {
          animation:blink 1s infinite;
        }
        .animate-blink-yellow{
          animation:blink-yellow 1s infinite;
          background-color:#fff3cd;
        }
        @keyframes blink-yellow {
          0% {background-color:#fff3cd;}
          50% {background-color:#ffecb5;}
          100% {background-color:#fff3cd;}
        }
        th,td {
          padding:2px;
          border:1px solid #d1d5db;
          white-space:nowrap;
          text-align:center;
          font-family:Arial,sans-serif;
          font-size:11px;
        }
        th {
          font-weight:bold;
        }
        button:hover {
          opacity:0.8;
        }
      `}</style>
    </div>
  );
};

export default MonthlySales;