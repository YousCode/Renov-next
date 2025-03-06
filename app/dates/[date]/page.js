"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback
} from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faTrash } from "@fortawesome/free-solid-svg-icons";

// 1) ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// 1.1) Helpers / Fonctions utilitaires externes
//--------------------------------------------------------------------

// Formate la date pour l'en-tête (ex: "Planning du Mardi 07/03/2023")
function formatHeaderDate(dateStr) {
  if (!dateStr) return "";
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const dateObj = new Date(dateStr);
  const dayName = days[dateObj.getUTCDay()];
  const day = String(dateObj.getUTCDate()).padStart(2, "0");
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const year = dateObj.getUTCFullYear();
  return `Planning du ${dayName} ${day}/${month}/${year}`;
}

// Normalise "DATE DE VENTE" pour toujours comparer en YYYY-MM-DD
function normalizeDate(dateStr) {
  if (typeof dateStr !== "string" || !dateStr) return "";
  return new Date(dateStr).toISOString().split("T")[0];
}

// Formate un numéro de téléphone en XX XX XX ...
function formatPhoneNumber(number = "") {
  return number.replace(/(\d{2})(?=\d)/g, "$1 ");
}

// Génère un numéro BC unique à 6 chiffres qui n'existe pas déjà
function generateUniqueBCNumber(existingBCNumbers) {
  const generateBC = () => String(Math.floor(100000 + Math.random() * 900000));
  let bcNumber;
  do {
    bcNumber = generateBC();
  } while (existingBCNumbers.includes(bcNumber));
  return bcNumber;
}

// 1.2) Hook personnalisé pour gérer l'état global des ventes
//--------------------------------------------------------------------
function useSales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pour éviter de rappeler fetchSalesData en boucle, on déclare une fonction
  const fetchSalesData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ventes", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to fetch sales data");
      }
      const data = await response.json();
      setSales(data.data || []);
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  // Une fonction pour forcer le rafraîchissement externe si besoin (après ajout, suppr, etc.)
  const refreshSales = () => {
    fetchSalesData();
  };

  return { sales, loading, error, setSales, refreshSales };
}

// 2) ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// 2.1) Composant d'affichage du tableau des ventes (listing + édition)
//--------------------------------------------------------------------
function SalesTable({
  filteredSales,
  editingIndex,
  handleEditSaveClick,
  handleDeleteSale,
  handleInputChange,
  setEditingIndex
}) {
  // Références pour déplacer le focus d'un champ à l'autre
  const clientNameRef = useRef(null);
  const phoneNumberRef = useRef(null);
  const addressRef = useRef(null);
  const orderNumberRef = useRef(null);
  const workDescriptionRef = useRef(null);
  const statusRef = useRef(null);

  // Fonction utilitaire pour gérer le "Enter" et passer au champ suivant
  const handleKeyPress = (e, nextRef) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (nextRef && nextRef.current) {
        nextRef.current.focus();
      }
    }
  };

  const renderRow = (sale, index) => {
    const saleTime = new Date(sale["DATE DE VENTE"]).toLocaleTimeString("fr-FR", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Si on est en mode édition pour cette ligne
    const isEditing = editingIndex === index;

    return (
      <tr key={sale._id || index}>
        {/* Colonne Heure */}
        <td className="border border-black px-2 py-1 whitespace-nowrap">
          {isEditing ? (
            <input
              className="border text-black p-2 rounded-md w-full"
              type="time"
              value={saleTime}
              onChange={(e) => handleInputChange(e, index, "DATE DE VENTE", e.target.value)}
              onKeyDown={(e) => handleKeyPress(e, clientNameRef)}
            />
          ) : (
            `${saleTime} H`
          )}
        </td>

        {/* Nom du client */}
        <td className="border border-black px-2 py-1 whitespace-nowrap">
          {isEditing ? (
            <input
              ref={clientNameRef}
              className="border p-2 rounded-md w-full"
              type="text"
              name="clientName"
              value={sale["NOM DU CLIENT"] || ""}
              onChange={(e) => handleInputChange(e, index, "NOM DU CLIENT", e.target.value)}
              onKeyDown={(e) => handleKeyPress(e, phoneNumberRef)}
            />
          ) : (
            sale["NOM DU CLIENT"] || ""
          )}
        </td>

        {/* Téléphone */}
        <td className="border border-black px-2 py-1 whitespace-nowrap">
          {isEditing ? (
            <input
              ref={phoneNumberRef}
              className="border p-2 rounded-md w-full"
              type="text"
              name="TELEPHONE"
              value={formatPhoneNumber(sale["TELEPHONE"] || "")}
              onChange={(e) => handleInputChange(e, index, "TELEPHONE", e.target.value)}
              onKeyDown={(e) => handleKeyPress(e, addressRef)}
            />
          ) : (
            formatPhoneNumber(sale["TELEPHONE"] || "")
          )}
        </td>

        {/* Ville */}
        <td className="border border-black px-2 py-1 whitespace-nowrap">
          {isEditing ? (
            <input
              ref={addressRef}
              className="border p-2 rounded-md w-full"
              type="text"
              name="VILLE"
              value={sale["VILLE"] || ""}
              onChange={(e) => handleInputChange(e, index, "VILLE", e.target.value)}
              onKeyDown={(e) => handleKeyPress(e, orderNumberRef)}
            />
          ) : (
            sale["VILLE"] || ""
          )}
        </td>

        {/* Vendeur */}
        <td className="border border-black px-2 py-1 whitespace-nowrap">
          {isEditing ? (
            <input
              ref={orderNumberRef}
              className="border p-2 rounded-md w-full"
              type="text"
              name="VENDEUR"
              value={sale["VENDEUR"] || ""}
              onChange={(e) => handleInputChange(e, index, "VENDEUR", e.target.value)}
              onKeyDown={(e) => handleKeyPress(e, workDescriptionRef)}
            />
          ) : (
            sale["VENDEUR"] || ""
          )}
        </td>

        {/* Travaux */}
        <td className="border border-black px-2 py-1 whitespace-nowrap">
          {isEditing ? (
            <input
              ref={workDescriptionRef}
              className="border p-2 rounded-md w-full"
              type="text"
              name="DESIGNATION"
              value={sale["DESIGNATION"] || ""}
              onChange={(e) => handleInputChange(e, index, "DESIGNATION", e.target.value)}
              onKeyDown={(e) => handleKeyPress(e, statusRef)}
            />
          ) : (
            sale["DESIGNATION"] || ""
          )}
        </td>

        {/* ETAT / Résultat */}
        <td className="border border-black px-2 py-1 whitespace-nowrap">
          {isEditing ? (
            <input
              ref={statusRef}
              className="border p-2 text-black rounded-md w-full"
              type="text"
              name="ETAT"
              value={sale["ETAT"] || ""}
              onChange={(e) => handleInputChange(e, index, "ETAT", e.target.value)}
              list="status-options"
            />
          ) : (
            sale["ETAT"] || ""
          )}
          {/* Datalist en mode édition seulement */}
          {isEditing && (
            <datalist id="status-options">
              <option value="EN ATTENTE" />
              <option value="DV" />
              <option value="DNV" />
              <option value="ND" />
            </datalist>
          )}
        </td>

        {/* Actions */}
        <td className="border border-black px-2 py-1 whitespace-nowrap">
          <div className="flex space-x-2">
            <button
              onClick={() => handleEditSaveClick(index, sale["_id"])}
              className={`bg-${isEditing ? "green" : "blue"}-500 text-white p-2 rounded-md`}
              title={isEditing ? "Save" : "Edit"}
            >
              <FontAwesomeIcon icon={faEdit} />
            </button>
            <button
              onClick={() => handleDeleteSale(sale["_id"])}
              className="bg-red-500 text-white p-2 rounded-md"
              title="Delete"
            >
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <>
      {filteredSales.map((sale, index) => renderRow(sale, index))}
    </>
  );
}

// 2.2) Composant pour la ligne d'ajout
//--------------------------------------------------------------------
function AddSaleRow({
  newSale,
  handleInputChange,
  handleAddSale,
  isSearching,
  searchResults,
  handleSelectSale,
  cities,
  vendors
}) {
  // Références pour le focus
  const saleTimeRef = useRef(null);
  const clientNameRef = useRef(null);
  const phoneNumberRef = useRef(null);
  const addressRef = useRef(null);
  const orderNumberRef = useRef(null);
  const workDescriptionRef = useRef(null);
  const statusRef = useRef(null);

  // Navigation au "Enter"
  const handleKeyPress = (e, nextRef) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (nextRef && nextRef.current) {
        nextRef.current.focus();
      }
    }
  };

  return (
    <tr>
      <td className="border border-black px-2 py-1 whitespace-nowrap">
        <input
          ref={saleTimeRef}
          className="border text-black p-2 rounded-md w-full"
          type="time"
          name="saleTime"
          value={newSale.saleTime}
          onChange={(e) => handleInputChange(e, -1, "saleTime", e.target.value)}
          onKeyDown={(e) => handleKeyPress(e, clientNameRef)}
        />
      </td>

      <td className="border border-black px-2 py-1 whitespace-nowrap relative">
        <input
          ref={clientNameRef}
          className="border p-2 rounded-md w-full"
          type="text"
          name="clientName"
          value={newSale.clientName}
          onChange={(e) => handleInputChange(e, -1, "clientName", e.target.value)}
          onKeyDown={(e) => handleKeyPress(e, phoneNumberRef)}
          required
        />
        {isSearching && <div>Searching...</div>}
        {searchResults.length > 0 && (
          <ul className="absolute bg-white shadow-lg mt-1 max-h-60 overflow-auto z-10">
            {searchResults.map((sale, idx) => (
              <li
                key={idx}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-200"
                onMouseDown={(event) => handleSelectSale(sale, event)}
              >
                {sale["NOM DU CLIENT"]} - {sale["TELEPHONE"]}
              </li>
            ))}
          </ul>
        )}
      </td>

      <td className="border border-black px-2 py-1 whitespace-nowrap">
        <input
          ref={phoneNumberRef}
          className="border text-black p-2 rounded-md w-full"
          type="text"
          name="phoneNumber"
          value={formatPhoneNumber(newSale.phoneNumber)}
          onChange={(e) => handleInputChange(e, -1, "phoneNumber", e.target.value)}
          onKeyDown={(e) => handleKeyPress(e, addressRef)}
          required
        />
      </td>

      <td className="border border-black px-2 py-1 whitespace-nowrap">
        <input
          ref={addressRef}
          className="border p-2 rounded-md w-full"
          type="text"
          name="address"
          value={newSale.address}
          onChange={(e) => handleInputChange(e, -1, "address", e.target.value)}
          onKeyDown={(e) => handleKeyPress(e, orderNumberRef)}
          required
          list="city-options"
        />
        <datalist id="city-options">
          {cities.map((city, idx) => (
            <option key={idx} value={city} />
          ))}
        </datalist>
      </td>

      <td className="border border-black px-2 py-1 whitespace-nowrap">
        <input
          ref={orderNumberRef}
          className="border p-2 rounded-md w-full"
          type="text"
          name="orderNumber"
          value={newSale.orderNumber}
          onChange={(e) => handleInputChange(e, -1, "orderNumber", e.target.value)}
          onKeyDown={(e) => handleKeyPress(e, workDescriptionRef)}
          required
          list="vendor-options"
        />
        <datalist id="vendor-options">
          {vendors.map((vendor, idx) => (
            <option key={idx} value={vendor} />
          ))}
        </datalist>
      </td>

      <td className="border border-black px-2 py-1 whitespace-nowrap">
        <input
          ref={workDescriptionRef}
          className="border p-2 rounded-md w-full"
          type="text"
          name="workDescription"
          value={newSale.workDescription}
          onChange={(e) => handleInputChange(e, -1, "workDescription", e.target.value)}
          onKeyDown={(e) => handleKeyPress(e, statusRef)}
          required
        />
      </td>

      <td className="border border-black px-2 py-1 whitespace-nowrap">
        <input
          ref={statusRef}
          className="border p-2 text-black rounded-md w-full"
          type="text"
          name="status"
          value={newSale.status}
          onChange={(e) => handleInputChange(e, -1, "status", e.target.value)}
          required
          list="status-options"
        />
        <datalist id="status-options">
          <option value="EN ATTENTE" />
          <option value="DV" />
          <option value="DNV" />
          <option value="ND" />
        </datalist>
      </td>

      <td className="border border-black px-2 py-1 whitespace-nowrap">
        <button
          onClick={handleAddSale}
          className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition duration-300"
          type="button"
        >
          Ajouter
        </button>
      </td>
    </tr>
  );
}

// 3) ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// 3) Composant principal DateDetails
//--------------------------------------------------------------------
export default function DateDetails() {
  const { date } = useParams();
  const router = useRouter();

  // Récupère les ventes (sales) via le hook
  const { sales, loading, error, setSales, refreshSales } = useSales();

  // Gère la recherche de clients
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // Gère le mode édition
  const [editingIndex, setEditingIndex] = useState(null);

  // Villes / vendeurs
  const [cities, setCities] = useState([]);
  const [vendors, setVendors] = useState([]);

  // Nouveau sale (ligne d'ajout)
  const defaultNewSale = {
    clientName: "",
    phoneNumber: "",
    address: "",
    orderNumber: "",
    workDescription: "",
    montantHT: "",
    status: "EN ATTENTE",
    saleTime: "",
  };
  const [newSale, setNewSale] = useState(defaultNewSale);

  const MySwal = withReactContent(Swal);

  // Au montage, on importe les JSON (cities/vendors)
  useEffect(() => {
    async function fetchCitiesAndVendors() {
      const [citiesData, vendorsData] = await Promise.all([
        import("./cities.json").then((mod) => mod.default),
        import("./vendors.json").then((mod) => mod.default),
      ]);
      setCities(citiesData);
      setVendors(vendorsData);
    }
    fetchCitiesAndVendors();
  }, []);

  // 3.1) Calculer filteredSales + totalAmount selon la "date" choisie
  //-----------------------------------------------------------------
  const filteredSales = useMemo(() => {
    if (!date || !sales.length) return [];
    const normalizedInputDate = new Date(`${date}T00:00:00.000Z`)
      .toISOString()
      .split("T")[0];

    return sales
      .filter((sale) => normalizeDate(sale["DATE DE VENTE"]) === normalizedInputDate)
      .sort((a, b) => new Date(a["DATE DE VENTE"]) - new Date(b["DATE DE VENTE"]));
  }, [date, sales]);

  const totalAmount = useMemo(() => {
    return filteredSales.reduce((sum, sale) => {
      // Suppose qu'on additionne un champ "RESULTAT" + un éventuel nombre dans "ETAT"
      const resultValueStr = sale["RESULTAT"]
        ? sale["RESULTAT"].replace(/[^0-9.-]+/g, "")
        : "0";
      const resultValue = parseFloat(resultValueStr) || 0;

      const statusValue = sale["ETAT"] ? sale["ETAT"].match(/\d+/) : null;
      const statusNumber = statusValue ? parseFloat(statusValue[0]) : 0;
      return sum + resultValue + statusNumber;
    }, 0);
  }, [filteredSales]);

  // 3.2) Recherche de clients (auto-complétion)
  //-----------------------------------------------------------------
  async function performSearch(searchTerm) {
    setIsSearching(true);
    try {
      if (searchTerm.length > 1) {
        const response = await fetch(
          `/api/ventes/search?searchTerm=${encodeURIComponent(searchTerm)}`
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.success) {
          setSearchResults(
            data.data.filter((sale) =>
              sale["NOM DU CLIENT"].toUpperCase().startsWith(searchTerm.toUpperCase())
            )
          );
        } else {
          setSearchResults([]);
        }
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  }

  // 3.3) Gestion du changement dans les inputs
  //-----------------------------------------------------------------
  function handleInputChange(e, index, field, value) {
    // Si on modifie la ligne d'ajout (index === -1)
    if (index === -1) {
      // Mettez en majuscules si nécessaire
      if (field === "clientName") {
        setNewSale((prev) => ({ ...prev, [field]: value.toUpperCase() }));
        performSearch(value); // auto-complétion si on tape le nom
        // S'il existe déjà un client du même nom, on pré-remplit
        const matchingSale = sales.find(
          (s) => s["NOM DU CLIENT"]?.toUpperCase() === value.toUpperCase()
        );
        if (matchingSale) {
          setNewSale((prev) => ({
            ...prev,
            phoneNumber: matchingSale["TELEPHONE"] || "",
            address: matchingSale["VILLE"] || "",
            orderNumber: matchingSale["VENDEUR"] || "",
          }));
        }
      } else {
        // Champs classiques
        setNewSale((prev) => ({ ...prev, [field]: value.toUpperCase() }));
      }
      setSearchResults([]);
    } else {
      // On modifie une vente existante en mode édition
      const updated = [...filteredSales];
      // Pour que la modification soit bien répercutée sur 'sales', on doit copier 'sales' aussi
      // => on retrouve la vente dans 'sales' via l'_id
      const saleId = updated[index]._id;
      updated[index][field] = value.toUpperCase();

      // Mettre à jour filteredSales dans le state "sales"
      // On reconstruit un nouveau tableau complet (sales) en remplaçant l'élément
      const newAllSales = sales.map((s) => {
        if (s._id === saleId) {
          return { ...s, [field]: value.toUpperCase() };
        }
        return s;
      });

      setSales(newAllSales); // On force le refresh
    }
  }

  function handleSelectSale(sale, event) {
    event.stopPropagation();
    setNewSale((prev) => ({
      ...prev,
      clientName: sale["NOM DU CLIENT"].toUpperCase(),
      phoneNumber: sale["TELEPHONE"] || "",
      orderNumber: sale["VENDEUR"] || "",
      address: sale["VILLE"] || "",
    }));
    setSearchResults([]);
  }

  // 3.4) Ajout d'une nouvelle vente
  //-----------------------------------------------------------------
  async function handleAddSale(event) {
    event.preventDefault();
    const saleDate = new Date(`${date}T00:00:00.000Z`);
    const [hours, minutes] = newSale.saleTime.split(":");
    saleDate.setUTCHours(hours || 0, minutes || 0);

    // On génère un nouveau BC
    const existingBCNumbers = sales.map((sale) => sale["NUMERO BC"]);
    const numeroBC = generateUniqueBCNumber(existingBCNumbers);

    const newSaleEntry = {
      "DATE DE VENTE": saleDate.toISOString(),
      "NOM DU CLIENT": newSale.clientName,
      TELEPHONE: newSale.phoneNumber,
      VILLE: newSale.address,
      "NUMERO BC": numeroBC,
      VENDEUR: newSale.orderNumber,
      DESIGNATION: newSale.workDescription,
      "MONTANT HT": newSale.montantHT,
      ETAT: newSale.status,
    };

    try {
      const response = await fetch("/api/ventes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSaleEntry),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error: ${response.status}`);
      }
      const savedSale = await response.json();
      // On ajoute la nouvelle vente au tableau global
      setSales((prev) => [...prev, savedSale.data]);
      // On remet à zéro le formulaire
      setNewSale(defaultNewSale);
    } catch (error) {
      console.error("Error saving new sale:", error.message);
    }
  }

  // 3.5) Édition d'une vente (PUT)
  //-----------------------------------------------------------------
  async function handleEditSale(saleId, index) {
    // La vente à jour est déjà dans "sales", on récupère la version la plus récente
    const saleToUpdate = sales.find((s) => s._id === saleId);
    if (!saleToUpdate) return;

    try {
      const response = await fetch(`/api/ventes/${saleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saleToUpdate),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error: ${response.status}`);
      }
      const updatedSaleResp = await response.json(); // { success, data: {...} }
      const updatedSale = updatedSaleResp.data;

      // Mettre à jour la liste globale 'sales'
      const newAllSales = sales.map((s) => (s._id === saleId ? updatedSale : s));
      setSales(newAllSales);

    } catch (error) {
      console.error("Error updating sale:", error.message);
    }
  }

  // 3.6) Bouton Edit/Save
  //-----------------------------------------------------------------
  function handleEditSaveClick(index, saleId) {
    if (editingIndex === index) {
      // On sauvegarde
      handleEditSale(saleId, index);
      setEditingIndex(null);
    } else {
      // On passe en mode édition
      setEditingIndex(index);
    }
  }

  // 3.7) Suppression d'une vente
  //-----------------------------------------------------------------
  async function handleDeleteSale(saleId) {
    try {
      const response = await fetch(`/api/ventes/${saleId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to delete sale");
      }
      // On enlève la vente supprimée
      const updatedAllSales = sales.filter((s) => s._id !== saleId);
      setSales(updatedAllSales);
    } catch (error) {
      console.error("Error deleting sale:", error.message);
    }
  }

  // 3.8) Rendu JSX
  //-----------------------------------------------------------------
  const MIN_ROWS = 15;
  const emptyRowsCount = Math.max(0, MIN_ROWS - filteredSales.length - 1);

  const formattedDate = formatHeaderDate(date);

  return (
    <>
      <Navbar />

      <div className="p-6 font-garamond">
        {/* Bouton retour + titre */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg"
          >
            Retour
          </button>

          <h2 className="text-2xl text-black font-bold">
            {formattedDate}
            <input
              type="date"
              value={date}
              onChange={(e) => router.push(`/dates/${e.target.value}`)}
              className="ml-1 border p-1 rounded-sm text-sm bg-transparent"
            />
          </h2>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p>{error}</p>
        ) : (
          <>
            <div className="overflow-x-auto mb-4">
              <table
                className="min-w-full divide-y divide-gray-200 border border-black"
                style={{ backgroundColor: "#FFFACD" }}
              >
                <thead style={{ backgroundColor: "#FFFACD" }}>
                  <tr>
                    <th className="border border-black px-2 py-1 text-left text-xs font-medium uppercase tracking-wider">
                      Heure
                    </th>
                    <th className="border border-black px-2 py-1 text-left text-xs font-medium uppercase tracking-wider">
                      Nom
                    </th>
                    <th className="border border-black px-2 py-1 text-left text-xs font-medium uppercase tracking-wider">
                      Tel
                    </th>
                    <th className="border border-black px-2 py-1 text-left text-xs font-medium uppercase tracking-wider">
                      Ville
                    </th>
                    <th className="border border-black px-2 py-1 text-left text-xs font-medium uppercase tracking-wider">
                      Vtc
                    </th>
                    <th className="border border-black px-2 py-1 text-left text-xs font-medium uppercase tracking-wider">
                      Travaux
                    </th>
                    <th className="border border-black px-2 py-1 text-left text-xs font-medium uppercase tracking-wider">
                      Résultat
                    </th>
                    <th className="border border-black px-2 py-1 text-left text-xs font-medium uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody
                  style={{ backgroundColor: "#FFFACD" }}
                  className="divide-y divide-gray-200"
                >
                  {/* Lignes existantes (filtrées) */}
                  <SalesTable
                    filteredSales={filteredSales}
                    editingIndex={editingIndex}
                    handleEditSaveClick={handleEditSaveClick}
                    handleDeleteSale={handleDeleteSale}
                    handleInputChange={handleInputChange}
                    setEditingIndex={setEditingIndex}
                  />

                  {/* Ligne d'ajout */}
                  <AddSaleRow
                    newSale={newSale}
                    handleInputChange={handleInputChange}
                    handleAddSale={handleAddSale}
                    isSearching={isSearching}
                    searchResults={searchResults}
                    handleSelectSale={handleSelectSale}
                    cities={cities}
                    vendors={vendors}
                  />

                  {/* Lignes vides */}
                  {Array.from({ length: emptyRowsCount }).map((_, i) => (
                    <tr key={`empty-${i}`}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td
                          key={j}
                          className="border border-black px-2 py-1 whitespace-nowrap"
                        >
                          &nbsp;
                        </td>
                      ))}
                      <td className="border border-black px-2 py-1 whitespace-nowrap"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Affichage du total */}
            <div className="flex justify-end items-center mt-4">
              <label className="mr-2 text-lg font-bold" style={{ color: "orange" }}>
                Total €:
              </label>
              <span className="text-lg font-bold">{totalAmount.toFixed(2)}</span>
            </div>

            {/* Bouton Valider le planning */}
            <button
              onClick={() => {
                MySwal.fire({
                  title: "Succès",
                  text: "Le planning a été validé avec succès",
                  icon: "success",
                  confirmButtonText: "OK",
                }).then(() => {
                  router.push("/dashboard");
                });
                // Jouer un son
                new Audio("/bell-sound.mp3").play();
              }}
              className="bg-blue-500 text-white py-2 px-4 rounded-md mt-4 hover:bg-blue-600 transition duration-300"
            >
              Valider le planning
            </button>
          </>
        )}
      </div>
    </>
  );
}