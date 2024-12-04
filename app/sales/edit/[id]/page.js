"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSave, faFile } from "@fortawesome/free-solid-svg-icons";

const normalizeString = (str) => {
  return str
    ? str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    : "";
};

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
        // Si le taux TVA est supérieur à 1, on considère qu'il est exprimé en pourcentage
        if (tauxTVA > 1) {
          tauxTVA = tauxTVA / 100;
        }

        // Calculer le montant HT
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

  const defaultSale = {
    "DATE DE VENTE": saleDate ? new Date(saleDate).toISOString().split("T")[0] : "",
    CIVILITE: "",
    "NOM DU CLIENT": "",
    prenom: "",
    TE: "",
    "ADRESSE DU CLIENT": "",
    "CODE INTERP etage": "",
    VILLE: "",
    CP: "",
    TELEPHONE: "",
    VENDEUR: "",
    DESIGNATION: "",
    "TAUX TVA": "5.5", // Valeur par défaut
    "MONTANT HT": "",
    "MONTANT TTC": "",
    "MONTANT ANNULE": "",
    "ETAT": "",
    // Ajoutez d'autres champs si nécessaire
  };

  const currentSale = { ...defaultSale, ...sale };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-200 to-grey-600">
      <Navbar />
      <div className="max-w-6xl mx-auto py-8 px-4">
        <h2 className="text-3xl text-white font-bold mb-6 text-center animate-fade-in">
          Compléter la vente
        </h2>
        {/* Affichage des notifications */}
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

              // Champ pour "ETAT"
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

              // Champ pour "TAUX TVA" avec liste déroulante et option personnalisée
              if (key === "TAUX TVA") {
                return (
                  <div className="mb-4" key={key}>
                    <label className="block text-gray-800 font-semibold mb-2">
                      {key.replace(/_/g, " ")}
                    </label>
                    <select
                      className="border border-gray-300 p-2 rounded-md w-full focus:ring-2 focus:ring-blue-500 transition duration-300"
                      name="TAUX TVA"
                      value={value || ""}
                      onChange={(e) => {
                        handleInputChange(e);
                        setShowCustomTVA(e.target.value === "Autre");
                      }}
                    >
                      <option value="5.5">5.5%</option>
                      <option value="10">10%</option>
                      <option value="Autre">Autre</option>
                    </select>
                    {showCustomTVA && (
                      <input
                        className="border border-gray-300 p-2 rounded-md w-full mt-2 focus:ring-2 focus:ring-blue-500 transition duration-300 animate-fade-in"
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

              // Champ pour "MONTANT TTC" en modifiable et "MONTANT HT" en lecture seule
              if (key === "MONTANT TTC") {
                return (
                  <div className="mb-4" key={key}>
                    <label className="block text-gray-800 font-semibold mb-2">
                      {key.replace(/_/g, " ")}
                    </label>
                    <input
                      className="border border-gray-300 p-2 rounded-md w-full focus:ring-2 focus:ring-blue-500 transition duration-300"
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

              // Autres champs
              return (
                <div className="mb-4" key={key}>
                  <label className="block text-gray-800 font-semibold mb-2">
                    {key.replace(/_/g, " ")}
                  </label>
                  <input
                    className="border border-gray-300 p-2 rounded-md w-full focus:ring-2 focus:ring-blue-500 transition duration-300"
                    type={key === "DATE DE VENTE" ? "date" : "text"}
                    name={key}
                    value={value || ""}
                    onChange={handleInputChange}
                    required={["NOM DU CLIENT", "prenom", "ADRESSE DU CLIENT"].includes(key)} // Définir les champs obligatoires
                  />
                </div>
              );
            })}
          </div>

          {/* Ajout d'un espace pour les notes ou autres champs si nécessaire */}
          {/* <div className="mb-4">
            <label className="block text-gray-800 font-semibold mb-2">Notes</label>
            <textarea
              className="border border-gray-300 p-2 rounded-md w-full focus:ring-2 focus:ring-blue-500 transition duration-300"
              name="notes"
              value={sale.notes || ""}
              onChange={handleInputChange}
              placeholder="Ajouter des notes"
            ></textarea>
          </div> */}

          <div className="flex justify-center space-x-4 mt-6">
            <button
              className="bg-blue-500 text-white py-2 px-6 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transform transition duration-300 hover:scale-105"
              type="submit"
            >
              <FontAwesomeIcon icon={faSave} /> Valider
            </button>
            <button
              onClick={() => handleFileAction(id)}
              className="bg-gray-500 text-white py-2 px-6 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transform transition duration-300 hover:scale-105"
              type="button"
            >
              <FontAwesomeIcon icon={faFile} /> Fichier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSale;