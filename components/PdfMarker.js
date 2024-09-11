"use client"; // Assurez-vous que ceci est la première ligne du fichier

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const PdfMaker = () => {
  const { id } = useParams(); // Utiliser useParams() pour extraire les paramètres
  const router = useRouter();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(null); // Pour savoir quelle ligne est en mode édition
  const [updatedSale, setUpdatedSale] = useState({}); // Pour stocker les modifications

  useEffect(() => {
    if (!id) {
      console.log('No ID found in the query');
      setLoading(false);
      return;
    }

    const fetchSale = async () => {
      try {
        console.log(`Fetching sale with ID: ${id}`);
        const response = await fetch(`/api/ventes/${id}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch sale with ID ${id}`);
        }
        const data = await response.json();
        console.log('Data fetched:', data);
        setSale(data.data);
        setUpdatedSale(data.data); // Stocker les données originales pour la modification
      } catch (error) {
        console.error("Error fetching sale:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSale();
  }, [id]);

  const handleEdit = (key) => {
    setEditMode(key);
  };

  const handleInputChange = (key, value) => {
    setUpdatedSale({ ...updatedSale, [key]: value });
  };

  const handleSave = (key) => {
    setSale(updatedSale); // Mettre à jour les données originales avec les modifications
    setEditMode(null); // Quitter le mode édition
  };

  if (loading) {
    return <p className="text-black">Chargement des détails de la vente...</p>;
  }

  if (!sale) {
    return <p className="text-black">Les détails de la vente ne sont pas disponibles.</p>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-black p-4">
      <h1 className="text-2xl font-bold mb-4">
        {sale["NOM DU CLIENT"] ? sale["NOM DU CLIENT"] : "Nom du client non disponible"} - Vente du {new Date(sale["DATE DE VENTE"]).toLocaleDateString("fr-FR")}
      </h1>
      <div className="flex w-full max-w-4xl">
        <div className="w-full bg-black shadow-md p-4">
          <h2 className="text-xl font-bold mb-4">Détails de la Vente</h2>
          <table className="min-w-full bg-black">
            <thead>
              <tr>
                <th className="py-2 px-4 bg-gray-100">Champ</th>
                <th className="py-2 px-4 bg-gray-100">Valeur</th>
                <th className="py-2 px-4 bg-gray-100">Action</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(sale).map((key) => (
                <tr key={key}>
                  <td className="py-2 px-4 border-b">{key}</td>
                  <td className="py-2 px-4 border-b">
                    {editMode === key ? (
                      <input
                        className="bg-gray-100 border rounded p-1"
                        value={updatedSale[key]}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                      />
                    ) : (
                      sale[key]
                    )}
                  </td>
                  <td className="py-2 px-4 border-b">
                    {editMode === key ? (
                      <button
                        className="bg-green-500 text-white p-1 rounded"
                        onClick={() => handleSave(key)}
                      >
                        Sauvegarder
                      </button>
                    ) : (
                      <button
                        className="p-1"
                        onClick={() => handleEdit(key)}
                      >
                        {/* SVG icon for the pencil */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l3 3L21 5l-3-3-9 9zM5 19h14v2H5v-2z" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PdfMaker;