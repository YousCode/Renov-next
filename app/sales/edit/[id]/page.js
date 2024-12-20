"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSave, faFile, faCopy, faDownload } from "@fortawesome/free-solid-svg-icons";

const TVA_RATE_DEFAULT = 20; // Taux de TVA par défaut en pourcentage


const EditSale = () => {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const saleDate = searchParams.get("date");
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCustomTVA, setShowCustomTVA] = useState(false);
  const [notification, setNotification] = useState(null); // Pour les messages de notification
  const router = useRouter();

  useEffect(() => {
    const fetchSale = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/ventes/${id}`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`Échec de la récupération de la vente : ${response.status}`);
        }
        const data = await response.json();
        if (saleDate) {
          data.data["DATE DE VENTE"] = new Date(saleDate).toISOString().split("T")[0];
        }
        setSale(data.data);
      } catch (error) {
        console.error("Erreur lors de la récupération des données de la vente :", error);
        setError(`Erreur : ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchSale();
  }, [id, saleDate]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setSale((prev) => {
      const updatedSale = { ...prev, [name]: value };

      // Calculer MONTANT HT en fonction du Montant TTC et du Taux TVA
      if (name === "MONTANT TTC" || name === "TAUX TVA") {
        const montantTTC = parseFloat(updatedSale["MONTANT TTC"]) || 0;
        let tauxTVA = parseFloat(updatedSale["TAUX TVA"]) || TVA_RATE_DEFAULT;
        if (tauxTVA > 1) {
          tauxTVA = tauxTVA / 100;
        }

        const montantHT = montantTTC / (1 + tauxTVA);
        updatedSale["MONTANT HT"] = montantHT > 0 ? montantHT.toFixed(2) : "0.00";
      }

      return updatedSale;
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();

    // Champs obligatoires
    const requiredFields = ["NOM DU CLIENT", "prenom", "ADRESSE DU CLIENT"];
    const missingFields = requiredFields.filter((field) => !sale[field]);

    if (missingFields.length > 0) {
      setNotification({
        type: "error",
        message: `Les champs suivants sont obligatoires : ${missingFields.join(", ")}`,
      });
      return;
    }

    try {
      const response = await fetch(`/api/ventes/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(sale),
      });

      if (response.ok) {
        setNotification({
          type: "success",
          message: "Les données ont été mises à jour avec succès.",
        });
        // Optionnel : redirection après quelques secondes
        setTimeout(() => {
          router.back(); // Retourne à la page précédente
        }, 2000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erreur : ${response.status}`);
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la vente :", error.message);
      setNotification({
        type: "error",
        message: `Erreur lors de la sauvegarde : ${error.message}`,
      });
    }
  };

  const handleFileAction = (saleId) => {
    router.push(`/file/details/${saleId}`);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-center text-gray-700 text-xl animate-pulse">Chargement...</p>
      </div>
    );
  if (error)
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-center text-red-500 text-xl">{error}</p>
      </div>
    );
  if (!sale) return null;

  // Champs à exclure du CSV
  const excludedFields = ["_id", "createdAt", "updatedAt", "__v"];

  // Fonction pour copier les données au format CSV
  const handleCopyCSV = () => {
    const entries = Object.entries(sale).filter(([key]) => !excludedFields.includes(key));
    // Générer une seule ligne CSV avec ; comme séparateur
    const line = entries.map(([key, val]) => val || "").join(";");
    navigator.clipboard.writeText(line)
      .then(()=>setNotification({type:"success",message:"Ligne CSV copiée dans le presse-papiers !"}))
      .catch(()=>setNotification({type:"error",message:"Erreur lors de la copie."}));
  };

  // Fonction pour télécharger les données au format CSV
  const handleDownloadCSV = () => {
    const entries = Object.entries(sale).filter(([key]) => !excludedFields.includes(key));
    const headers = entries.map(([key]) => key).join(";");
    const values = entries.map(([key,val])=> val||"").join(";");
    const csv = headers + "\n" + values;
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`vente_${id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const defaultSale = {
    "DATE DE VENTE": saleDate ? new Date(saleDate).toISOString().split("T")[0] : "",
    CIVILITE: "",
    "NOM DU CLIENT": "",
    prenom: "",
    "ADRESSE DU CLIENT": "",
    "CODE INTERP etage":"",
    VILLE: "",
    CP: "",
    TELEPHONE: "",
    VENDEUR: "",
    DESIGNATION: "",
    "TAUX TVA": "5.5",
    "MONTANT HT": "",
    "MONTANT TTC": "",
    "MONTANT ANNULE": "",
    "ETAT": "",
  };

  const currentSale = { ...defaultSale, ...sale };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-200 to-grey-600">
      <Navbar />
      <div className="max-w-6xl mx-auto py-8 px-4">
        <h2 className="text-3xl text-white font-bold mb-6 text-center animate-fade-in">
          Compléter la vente
        </h2>
        {notification && (
          <div
            className={`p-4 rounded-md mb-6 ${
              notification.type === "success"
                ? "bg-green-500 text-white"
                : "bg-red-500 text-white"
            }`}
          >
            {notification.message}
          </div>
        )}
        <form
          onSubmit={handleSave}
          className="bg-white bg-opacity-80 backdrop-filter backdrop-blur-lg rounded-lg shadow-2xl p-6 animate-slide-up"
        >
          <div className="grid grid-cols-2 gap-6">
            {Object.entries(currentSale).map(([key, value]) => {
              if (
                key === "_id" ||
                key === "createdAt" ||
                key === "updatedAt" ||
                key === "__v"
              ) {
                return null;
              }

              if (key === "ETAT") {
                return (
                  <div className="mb-4 col-span-2" key={key}>
                    <label className="block text-gray-800 font-semibold mb-2">
                      {key.replace(/_/g, " ")}
                    </label>
                    <select
                      className="border border-gray-300 p-2 rounded-md w-full focus:ring-2 focus:ring-blue-500 transition duration-300"
                      name="ETAT"
                      value={value || ""}
                      onChange={handleInputChange}
                    >
                      <option value="">Sélectionner un état</option>
                      <option value="En attente">En attente</option>
                      <option value="Confirmé">Confirmé</option>
                      <option value="Annulé">Annulé</option>
                    </select>
                  </div>
                );
              }

              if (key === "TAUX TVA") {
                return (
                  <div className="mb-4" key={key}>
                    <label className="block text-gray-800 font-semibold mb-2">
                      {key.replace(/_/g, " ")}
                    </label>
                    <select
                      className="border border-gray-300 p-2 rounded-md w-full"
                      name="TAUX TVA"
                      value={value || ""}
                      onChange={(e) => {
                        handleInputChange(e);
                        setShowCustomTVA(e.target.value === "Autre");
                      }}
                    >
                      <option value="0.55">5.5%</option>
                      <option value="0.1">10%</option>
                      <option value="Autre">Autre</option>
                    </select>
                    {showCustomTVA && (
                      <input
                        className="border border-gray-300 p-2 rounded-md w-full mt-2"
                        type="number"
                        name="TAUX TVA"
                        value={value || ""}
                        onChange={handleInputChange}
                        placeholder="Entrez le taux de TVA"
                        step="0.01"
                        min="0"
                      />
                    )}
                  </div>
                );
              }

              if (key === "MONTANT TTC") {
                return (
                  <div className="mb-4" key={key}>
                    <label className="block text-gray-800 font-semibold mb-2">
                      {key.replace(/_/g, " ")}
                    </label>
                    <input
                      className="border border-gray-300 p-2 rounded-md w-full"
                      type="number"
                      name="MONTANT TTC"
                      value={value || ""}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      placeholder="Montant TTC"
                    />
                  </div>
                );
              }

              if (key === "MONTANT HT") {
                return (
                  <div className="mb-4" key={key}>
                    <label className="block text-gray-800 font-semibold mb-2">
                      Montant HT (Calculé)
                    </label>
                    <input
                      className="border border-gray-300 p-2 rounded-md w-full bg-gray-100 cursor-not-allowed"
                      type="text"
                      name="MONTANT HT"
                      value={value || ""}
                      readOnly
                    />
                  </div>
                );
              }

              return (
                <div className="mb-4" key={key}>
                  <label className="block text-gray-800 font-semibold mb-2">
                    {key.replace(/_/g, " ")}
                  </label>
                  <input
                    className="border border-gray-300 p-2 rounded-md w-full"
                    type={key === "DATE DE VENTE" ? "date" : "text"}
                    name={key}
                    value={value || ""}
                    onChange={handleInputChange}
                    required={["NOM DU CLIENT", "prenom", "ADRESSE DU CLIENT"].includes(key)}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <button
              className="bg-blue-500 text-white py-2 px-6 rounded-md hover:bg-blue-600"
              type="submit"
            >
              <FontAwesomeIcon icon={faSave} /> Valider
            </button>
            <button
              onClick={() => handleFileAction(id)}
              className="bg-gray-500 text-white py-2 px-6 rounded-md hover:bg-gray-600"
              type="button"
            >
              <FontAwesomeIcon icon={faFile} /> Fichier
            </button>
            <button
              onClick={handleCopyCSV}
              className="bg-purple-500 text-white py-2 px-6 rounded-md hover:bg-purple-600"
              type="button"
              title="Copier la vente en CSV"
            >
              <FontAwesomeIcon icon={faCopy} /> Copier CSV
            </button>
            <button
              onClick={()=>{
                const entries = Object.entries(sale).filter(([k])=>!excludedFields.includes(k));
                const headers = entries.map(([k])=>k).join(";");
                const values = entries.map(([k,v])=>v||"").join(";");
                const csv = headers+"\n"+values;
                const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
                const url=URL.createObjectURL(blob);
                const a=document.createElement('a');
                a.href=url;
                a.download=`vente_${id}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
              className="bg-green-500 text-white py-2 px-6 rounded-md hover:bg-green-600"
              type="button"
              title="Télécharger la vente au format CSV"
            >
              <FontAwesomeIcon icon={faDownload} /> Télécharger CSV
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSale;