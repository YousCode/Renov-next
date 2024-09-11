"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSave, faEdit, faFile } from "@fortawesome/free-solid-svg-icons";

const EditSale = () => {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const saleDate = searchParams.get("date");
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const fetchSale = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/ventes/${id}`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch sale with status ${response.status}`);
        }
        const data = await response.json();
        if (saleDate) {
          data.data["DATE DE VENTE"] = new Date(saleDate).toISOString().split("T")[0];
        }
        setSale(data.data);
      } catch (error) {
        console.error("Error fetching sale data:", error);
        setError(`Error: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchSale();
  }, [id, saleDate]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSale((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
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
        router.back(); // Retourne à la page précédente
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error: ${response.status}`);
      }
    } catch (error) {
      console.error("Error saving sale:", error.message);
    }
  };

  const handleEditSale = (saleId, saleDate) => {
    router.push(`/sales/edit/${saleId}?date=${saleDate}`);
  };

  const handleFileAction = (saleId) => {
    router.push(`/file/details/${saleId}`);
  };

  if (loading) return <p className="text-center text-gray-700">Loading...</p>;
  if (error) return <p className="text-center text-red-500">{error}</p>;
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
    "TAUX TVA": "",
    "MONTANT TTC ": "",
    "MONTANT HT": "",
    "MONTANT ANNULE": "",
  };

  const currentSale = { ...defaultSale, ...sale };

  return (
    <div>
      <Navbar />
      <div style={{ backgroundColor: "#005C47" }} className="max-w-4xl mx-auto p-6 bg-gray-100 rounded-lg shadow-md">
        <h2 className="text-2xl text-[#B0FFE9] font-bold mb-6 text-center">Compléter la vente</h2>
        <form onSubmit={handleSave}>
          {Object.entries(currentSale).map(
            ([key, value]) =>
              key !== "_id" &&
              key !== "createdAt" &&
              key !== "updatedAt" &&
              key !== "__v" && (
                <div className="mb-4" key={key}>
                  <label className="block text-[#B0FFE9] capitalize">
                    {key.replace(/_/g, " ")}
                  </label>
                  <input
                    className="border p-2 rounded-md w-full text-black"
                    type={key === "DATE DE VENTE" ? "date" : "text"}
                    name={key}
                    value={value || ""}
                    onChange={handleInputChange}
                    required={["NOM DU CLIENT", "DATE DE VENTE"].includes(key)}
                  />
                </div>
              )
          )}
          <div className="mb-4">
            <label className="block text-[#B0FFE9]">Status</label>
            <select
              className="border p-2 rounded-md w-full"
              name="ETAT"
              value={currentSale["ETAT"]}
              onChange={handleInputChange}
            >
              <option value="En attente">En attente</option>
              <option value="Confirmé">Confirmé</option>
              <option value="Annulé">Annulé</option>
            </select>
          </div>
          <div className="flex justify-center space-x-4">
            <button
              className="bg-blue-500 text-white py-2 px-4 rounded-md mt-4 hover:bg-blue-600 transition duration-300"
              type="submit"
            >
              <FontAwesomeIcon icon={faSave} /> Validé
            </button>
            <button
              onClick={() => handleFileAction(id)}
              className="bg-gray-500 text-white py-2 px-4 rounded-md mt-4 hover:bg-gray-600 transition duration-300"
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