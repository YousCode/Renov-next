"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faTrash } from "@fortawesome/free-solid-svg-icons";

const importCities = async () => (await import("./cities.json")).default;
const importVendors = async () => (await import("./vendors.json")).default;

const generateUniqueBCNumber = (existingBCNumbers) => {
  const generateBC = () => String(Math.floor(100000 + Math.random() * 900000));
  let bcNumber;
  do {
    bcNumber = generateBC();
  } while (existingBCNumbers.includes(bcNumber));
  return bcNumber;
};

const formatDate = (dateStr) => {
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const dateObj = new Date(dateStr);
  const dayName = days[dateObj.getUTCDay()];
  const day = String(dateObj.getUTCDate()).padStart(2, "0");
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const year = dateObj.getUTCFullYear();
  return `Planning du ${dayName} ${day}/${month}/${year}`;
};

const normalizeDate = (dateStr) => {
  // Si la variable est vide ou n'est pas une chaîne, on renvoie quelque chose par défaut
  if (typeof dateStr !== "string" || !dateStr) {
    return "";
  }

  if (dateStr.includes("/")) {
    const [year, month, day] = dateStr.split("/");
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`)
      .toISOString()
      .split("T")[0];
  }

  return new Date(dateStr).toISOString().split("T")[0];
};

const formatPhoneNumber = (number = "") => number.replace(/(\d{2})(?=\d)/g, "$1 ");

const DateDetails = () => {
  const { date } = useParams();
  const router = useRouter();

  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [existingBCNumbers, setExistingBCNumbers] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [inputTotalAmount, setInputTotalAmount] = useState(0); // Ce state ne semble pas utilisé
  const [cities, setCities] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const MIN_ROWS = 15;
  const formRef = useRef(null);

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

  const saleTimeRef = useRef(null);
  const clientNameRef = useRef(null);
  const phoneNumberRef = useRef(null);
  const addressRef = useRef(null);
  const orderNumberRef = useRef(null);
  const workDescriptionRef = useRef(null);
  const statusRef = useRef(null);

  useEffect(() => {
    const fetchSalesData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/ventes`, { credentials: "include" });
        if (!response.ok) {
          throw new Error("Failed to fetch sales data");
        }
        const data = await response.json();
        setSales(data.data || []);
        setExistingBCNumbers(data.data.map((sale) => sale["NUMERO BC"]));
        calculateTotalAmount(data.data);
      } catch (err) {
        setError(`Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    const fetchCitiesAndVendors = async () => {
      const [citiesData, vendorsData] = await Promise.all([importCities(), importVendors()]);
      setCities(citiesData);
      setVendors(vendorsData);
    };

    fetchSalesData();
    fetchCitiesAndVendors();
  }, []);

  useEffect(() => {
    if (!date || !sales.length) return;
    const normalizedInputDate = new Date(`${date}T00:00:00.000Z`).toISOString().split("T")[0];
    const filtered = sales.filter((sale) => normalizeDate(sale["DATE DE VENTE"]) === normalizedInputDate);
    filtered.sort(
      (a, b) => new Date(a["DATE DE VENTE"]).getTime() - new Date(b["DATE DE VENTE"]).getTime()
    );
    setFilteredSales(filtered);
    calculateTotalAmount(filtered);
  }, [date, sales]);

  const calculateTotalAmount = (salesData) => {
    const total = salesData.reduce((sum, sale) => {
      const resultValueStr = sale["RESULTAT"] ? sale["RESULTAT"].replace(/[^0-9.-]+/g, "") : "0";
      const resultValue = parseFloat(resultValueStr) || 0;
      const statusValue = sale["ETAT"] ? sale["ETAT"].match(/\d+/) : null;
      const statusNumber = statusValue ? parseFloat(statusValue[0]) : 0;
      return sum + resultValue + statusNumber;
    }, 0);
    setTotalAmount(total);
    setInputTotalAmount(total); // si vous voulez vous en servir
  };

  const performSearch = async (searchTerm) => {
    setIsSearching(true);
    try {
      if (searchTerm.length > 1) {
        const response = await fetch(`/api/ventes/search?searchTerm=${encodeURIComponent(searchTerm)}`);
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
  };

  const handleInputChange = (e, index, field, value) => {
    if (index === -1) {
      setNewSale((prev) => ({ ...prev, [field]: value.toUpperCase() }));
    } else {
      const updatedSales = [...filteredSales];
      updatedSales[index][field] = value.toUpperCase();
      setFilteredSales(updatedSales);
    }

    if (field === "clientName") {
      performSearch(value);
      const matchingSale = sales.find(
        (sale) => sale["NOM DU CLIENT"].toUpperCase() === value.toUpperCase()
      );
      if (matchingSale) {
        setNewSale((prev) => ({
          ...prev,
          phoneNumber: matchingSale["TELEPHONE"],
          address: matchingSale["VILLE"],
        }));
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectSale = (sale, event) => {
    event.stopPropagation();
    setNewSale((prev) => ({
      ...prev,
      clientName: sale["NOM DU CLIENT"].toUpperCase(),
      phoneNumber: sale["TELEPHONE"],
      orderNumber: sale["VENDEUR"].toUpperCase(),
      address: sale["VILLE"],
    }));
    setSearchResults([]);
  };

  const handleAddSale = async (event) => {
    event.preventDefault();
    const saleDate = new Date(`${date}T00:00:00.000Z`);
    const [hours, minutes] = newSale.saleTime.split(":");
    saleDate.setUTCHours(hours, minutes);

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
      setSales((prev) => [...prev, savedSale.data]);
      setNewSale(defaultNewSale);
      calculateTotalAmount([...sales, savedSale.data]);
    } catch (error) {
      console.error("Error saving new sale:", error.message);
    }
  };

  const handleEditSaveClick = (index, saleId) => {
    if (editingIndex === index) {
      handleEditSale(saleId, index);
      setEditingIndex(null);
    } else {
      setEditingIndex(index);
    }
  };

  const handleEditSale = async (saleId, index) => {
    const saleToUpdate = filteredSales[index];
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
      const updatedSale = await response.json();
      const updatedSales = [...filteredSales];
      updatedSales[index] = updatedSale.data;
      setFilteredSales(updatedSales);
      calculateTotalAmount(updatedSales);
    } catch (error) {
      console.error("Error updating sale:", error.message);
    }
  };

  const handleDeleteSale = async (saleId) => {
    try {
      const response = await fetch(`/api/ventes/${saleId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to delete sale");
      }
      const updatedAllSales = sales.filter((s) => s._id !== saleId);
      setSales(updatedAllSales);
      const updatedFiltered = filteredSales.filter((s) => s._id !== saleId);
      setFilteredSales(updatedFiltered);
      calculateTotalAmount(updatedFiltered);
    } catch (error) {
      console.error("Error deleting sale:", error.message);
    }
  };

  const handleKeyPress = (e, nextFieldRef) => {
    if (e.key === "Enter") {
      e.preventDefault();
      nextFieldRef.current.focus();
    }
  };

  const emptyRowsCount = Math.max(0, MIN_ROWS - filteredSales.length - 1);
  const formattedDate = formatDate(date);

  return (
    <>
      <Navbar />
      <div ref={formRef} className="p-6 font-garamond">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => router.back()} className="px-4 py-2 bg-gray-700 text-white rounded-lg">
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
                <tbody style={{ backgroundColor: "#FFFACD" }} className="divide-y divide-gray-200">
                  {filteredSales.map((sale, index) => (
                    <tr key={index}>
                      {/* Colonne Heure */}
                      <td className="border border-black px-2 py-1 whitespace-nowrap">
                        {editingIndex === index ? (
                          <input
                            className="border text-black p-2 rounded-md w-full"
                            type="time"
                            value={new Date(sale["DATE DE VENTE"]).toLocaleTimeString("fr-FR", {
                              timeZone: "UTC",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            onChange={(e) =>
                              handleInputChange(e, index, "DATE DE VENTE", e.target.value)
                            }
                            onKeyDown={(e) => handleKeyPress(e, clientNameRef)}
                          />
                        ) : (
                          `${new Date(sale["DATE DE VENTE"]).toLocaleTimeString("fr-FR", {
                            timeZone: "UTC",
                            hour: "2-digit",
                            minute: "2-digit",
                          })} H`
                        )}
                      </td>

                      {/* Colonne Nom */}
                      <td className="border border-black px-2 py-1 whitespace-nowrap">
                        {editingIndex === index ? (
                          <input
                            ref={clientNameRef}
                            className="border p-2 rounded-md w-full"
                            type="text"
                            name="clientName"
                            value={sale["NOM DU CLIENT"]}
                            onChange={(e) =>
                              handleInputChange(e, index, "NOM DU CLIENT", e.target.value)
                            }
                            onKeyDown={(e) => handleKeyPress(e, phoneNumberRef)}
                          />
                        ) : (
                          sale["NOM DU CLIENT"]
                        )}
                      </td>

                      {/* Colonne Téléphone */}
                      <td className="border border-black px-2 py-1 whitespace-nowrap">
                        {editingIndex === index ? (
                          <input
                            ref={phoneNumberRef}
                            className="border p-2 rounded-md w-full"
                            type="text"
                            name="phoneNumber"
                            value={formatPhoneNumber(sale["TELEPHONE"])}
                            onChange={(e) =>
                              handleInputChange(e, index, "TELEPHONE", e.target.value)
                            }
                            onKeyDown={(e) => handleKeyPress(e, addressRef)}
                          />
                        ) : (
                          formatPhoneNumber(sale["TELEPHONE"])
                        )}
                      </td>

                      {/* Colonne Ville */}
                      <td className="border border-black px-2 py-1 whitespace-nowrap">
                        {editingIndex === index ? (
                          <input
                            ref={addressRef}
                            className="border p-2 rounded-md w-full"
                            type="text"
                            name="address"
                            value={sale["VILLE"]}
                            onChange={(e) => handleInputChange(e, index, "VILLE", e.target.value)}
                            onKeyDown={(e) => handleKeyPress(e, orderNumberRef)}
                          />
                        ) : (
                          sale["VILLE"]
                        )}
                      </td>

                      {/* Colonne Vendeur */}
                      <td className="border border-black px-2 py-1 whitespace-nowrap">
                        {editingIndex === index ? (
                          <input
                            ref={orderNumberRef}
                            className="border p-2 rounded-md w-full"
                            type="text"
                            name="orderNumber"
                            value={sale["VENDEUR"]}
                            onChange={(e) => handleInputChange(e, index, "VENDEUR", e.target.value)}
                            onKeyDown={(e) => handleKeyPress(e, workDescriptionRef)}
                          />
                        ) : (
                          sale["VENDEUR"]
                        )}
                      </td>

                      {/* Colonne Travaux (designation) */}
                      <td className="border border-black px-2 py-1 whitespace-nowrap">
                        {editingIndex === index ? (
                          <input
                            ref={workDescriptionRef}
                            className="border p-2 rounded-md w-full"
                            type="text"
                            name="workDescription"
                            value={sale["DESIGNATION"]}
                            onChange={(e) =>
                              handleInputChange(e, index, "DESIGNATION", e.target.value)
                            }
                            onKeyDown={(e) => handleKeyPress(e, statusRef)}
                          />
                        ) : (
                          sale["DESIGNATION"]
                        )}
                      </td>

                      {/* Colonne Résultat / ETAT */}
                      <td className="border border-black px-2 py-1 whitespace-nowrap">
                        {editingIndex === index ? (
                          <input
                            ref={statusRef}
                            className="border p-2 text-black rounded-md w-full"
                            type="text"
                            name="status"
                            value={sale["ETAT"]}
                            onChange={(e) => handleInputChange(e, index, "ETAT", e.target.value)}
                            list="status-options"
                          />
                        ) : (
                          sale["ETAT"]
                        )}
                        <datalist id="status-options">
                          <option value="EN ATTENTE" />
                          <option value="DV" />
                          <option value="DNV" />
                          <option value="ND" />
                        </datalist>
                      </td>

                      {/* Colonne Actions */}
                      <td className="border border-black px-2 py-1 whitespace-nowrap">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditSaveClick(index, sale["_id"])}
                            className={`bg-${editingIndex === index ? "green" : "blue"}-500 text-white p-2 rounded-md`}
                            title={editingIndex === index ? "Save" : "Edit"}
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
                  ))}

                  {/* Ligne d'ajout */}
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
                    <td className="border border-black px-2 py-1 whitespace-nowrap">
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

                  {/* Lignes vides (pour le style) */}
                  {Array.from({ length: emptyRowsCount }).map((_, i) => (
                    <tr key={`empty-${i}`}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="border border-black px-2 py-1 whitespace-nowrap">
                          &nbsp;
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end items-center mt-4">
              <label className="mr-2 text-lg font-bold" style={{ color: "orange" }}>
                Total €:
              </label>
              <span className="text-lg font-bold">{totalAmount.toFixed(2)}</span>
            </div>
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
};

export default DateDetails;