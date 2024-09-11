"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faTrash, faFile } from "@fortawesome/free-solid-svg-icons";

const importCities = async () => {
  return (await import('./cities.json')).default;
};

const importVendors = async () => {
  return (await import('./vendors.json')).default;
};

const generateUniqueBCNumber = (existingBCNumbers) => {
  let bcNumber;
  const generateBC = () => String(Math.floor(100000 + Math.random() * 900000));

  do {
    bcNumber = generateBC();
  } while (existingBCNumbers.includes(bcNumber));

  return bcNumber;
};

const DateDetails = () => {
  const { date } = useParams();
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [existingBCNumbers, setExistingBCNumbers] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [inputTotalAmount, setInputTotalAmount] = useState(0);
  const [cities, setCities] = useState([]);
  const [vendors, setVendors] = useState([]);
  const MIN_ROWS = 15;
  const router = useRouter();
  const formRef = useRef(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

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
    if (dateStr.includes("/")) {
      const [year, month, day] = dateStr.split("/");
      return new Date(`${year}-${month}-${day}T00:00:00.000Z`).toISOString().split("T")[0];
    }
    return new Date(dateStr).toISOString().split("T")[0];
  };

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
      } catch (error) {
        console.error("Error fetching sales data:", error);
        setError(`Error: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    const fetchCitiesAndVendors = async () => {
      const citiesData = await importCities();
      const vendorsData = await importVendors();
      setCities(citiesData);
      setVendors(vendorsData);
    };

    fetchSalesData();
    fetchCitiesAndVendors();
  }, []);

  useEffect(() => {
    if (!date || !sales.length) return;

    const normalizedInputDate = new Date(`${date}T00:00:00.000Z`).toISOString().split("T")[0];

    const filtered = sales.filter((sale) => {
      const saleDate = normalizeDate(sale["DATE DE VENTE"]);
      return saleDate === normalizedInputDate;
    });

    filtered.sort((a, b) => new Date(a["DATE DE VENTE"]).getTime() - new Date(b["DATE DE VENTE"]).getTime());

    setFilteredSales(filtered);
    calculateTotalAmount(filtered);
  }, [date, sales]);

  const calculateTotalAmount = (salesData) => {
    const total = salesData.reduce((sum, sale) => {
      const resultValueStr = sale["RESULTAT"] ? sale["RESULTAT"].replace(/[^0-9.-]+/g, "") : "0";
      const resultValue = parseFloat(resultValueStr) || 0;

      // Check for numeric values in the ETAT field
      const statusValue = sale["ETAT"] ? sale["ETAT"].match(/\d+/) : null;
      const statusNumber = statusValue ? parseFloat(statusValue[0]) : 0;

      return sum + resultValue + statusNumber;
    }, 0);
    setTotalAmount(total);
    setInputTotalAmount(total);
  };

  const performSearch = async (searchTerm) => {
    setIsSearching(true);
    try {
      const response = await fetch(`/api/ventes/search?searchTerm=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success) {
        setSearchResults(data.data);
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

    if (field === "clientName" && value.length > 2) {
      performSearch(value);
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
      "NOM DU CLIENT": newSale.clientName.toUpperCase(),
      TELEPHONE: newSale.phoneNumber,
      "ADRESSE DU CLIENT": newSale.address.toUpperCase(),
      "NUMERO BC": numeroBC,
      VENDEUR: newSale.orderNumber.toUpperCase(),
      DESIGNATION: newSale.workDescription.toUpperCase(),
      "MONTANT HT": newSale.montantHT,
      ETAT: newSale.status.toUpperCase(),
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
      // If the row is already being edited, save the changes
      handleEditSale(saleId, index);
      setEditingIndex(null); // Exit the editing mode
    } else {
      // If the row is not being edited, enter the editing mode
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
      const updatedSales = sales.filter((sale) => sale._id !== saleId);
      setSales(updatedSales);
      const updatedFilteredSales = filteredSales.filter((sale) => sale._id !== saleId);
      setFilteredSales(updatedFilteredSales);
      calculateTotalAmount(updatedFilteredSales);
    } catch (error) {
      console.error("Error deleting sale:", error.message);
    }
  };

  const formatPhoneNumber = (number) => {
    return number.replace(/(\d{2})(?=\d)/g, "$1 ");
  };

  const emptyRowsCount = Math.max(0, MIN_ROWS - filteredSales.length - 1);
  const formattedDate = formatDate(date);

  return (
    <>
      <Navbar />
      <div ref={formRef} className="p-6 font-garamond">
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
          <p>Error: {error}</p>
        ) : (
          <>
            <div className="overflow-x-auto mb-4">
              <table
                className="min-w-full divide-y divide-gray-200 border border-black"
                style={{ backgroundColor: "#FFFACD" }}
              >
                <thead style={{ backgroundColor: "#FFFACD" }}>
                  <tr>
                    <th className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-black uppercase tracking-wider border border-black">
                      Heure
                    </th>
                    <th className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-black uppercase tracking-wider border border-black">
                      Nom
                    </th>
                    <th className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-black uppercase tracking-wider border border-black">
                      Tel
                    </th>
                    <th className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-black uppercase tracking-wider border border-black">
                      Ville
                    </th>
                    <th className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-black uppercase tracking-wider border border-black">
                      Vtc
                    </th>
                    <th className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-black uppercase tracking-wider border border-black">
                      Travaux
                    </th>
                    <th className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-black uppercase tracking-wider border border-black">
                      Résultat
                    </th>
                    <th className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-black uppercase tracking-wider border border-black">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody
                  style={{ backgroundColor: "#FFFACD" }}
                  className="divide-y divide-gray-200"
                >
                  {filteredSales.map((sale, index) => (
                    <tr key={index}>
                      <td className="text-black px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                        {index === editingIndex ? (
                          <input
                            className="border text-black p-2 rounded-md w-full"
                            type="time"
                            value={new Date(sale["DATE DE VENTE"]).toLocaleTimeString("fr-FR", { timeZone: "UTC" })}
                            onChange={(e) => handleInputChange(e, index, "DATE DE VENTE", e.target.value)}
                          />
                        ) : (
                          new Date(sale["DATE DE VENTE"]).toLocaleTimeString("fr-FR", { timeZone: "UTC" })
                        )}
                      </td>
                      <td className="text-black px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                        {index === editingIndex ? (
                          <input
                            className="border p-2 rounded-md w-full"
                            type="text"
                            name="clientName"
                            value={sale["NOM DU CLIENT"]}
                            onChange={(e) => handleInputChange(e, index, "NOM DU CLIENT", e.target.value)}
                          />
                        ) : (
                          sale["NOM DU CLIENT"]
                        )}
                      </td>
                      <td className="text-black px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                        {index === editingIndex ? (
                          <input
                            className="border p-2 rounded-md w-full"
                            type="text"
                            name="phoneNumber"
                            value={formatPhoneNumber(sale["TELEPHONE"])}
                            onChange={(e) => handleInputChange(e, index, "TELEPHONE", e.target.value)}
                          />
                        ) : (
                          formatPhoneNumber(sale["TELEPHONE"])
                        )}
                      </td>
                      <td className="text-black px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                        {index === editingIndex ? (
                          <input
                            className="border p-2 rounded-md w-full"
                            type="text"
                            name="address"
                            value={sale["ADRESSE DU CLIENT"]}
                            onChange={(e) => handleInputChange(e, index, "ADRESSE DU CLIENT", e.target.value)}
                          />
                        ) : (
                          sale["ADRESSE DU CLIENT"]
                        )}
                      </td>
                      <td className="text-black px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                        {index === editingIndex ? (
                          <input
                            className="border p-2 rounded-md w-full"
                            type="text"
                            name="orderNumber"
                            value={sale["VENDEUR"]}
                            onChange={(e) => handleInputChange(e, index, "VENDEUR", e.target.value)}
                          />
                        ) : (
                          sale["VENDEUR"]
                        )}
                      </td>
                      <td className="text-black px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                        {index === editingIndex ? (
                          <input
                            className="border p-2 rounded-md w-full"
                            type="text"
                            name="workDescription"
                            value={sale["DESIGNATION"]}
                            onChange={(e) => handleInputChange(e, index, "DESIGNATION", e.target.value)}
                          />
                        ) : (
                          sale["DESIGNATION"]
                        )}
                      </td>
                      <td className="text-black px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                        {index === editingIndex ? (
                          <input
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
                      <td className="text-black px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditSaveClick(index, sale["_id"])}
                            className={`bg-${editingIndex === index ? "green" : "blue"}-500 text-white p-2 rounded-md`}
                            title={editingIndex === index ? "Save" : "Edit"}
                          >
                            <FontAwesomeIcon icon={editingIndex === index ? faEdit : faEdit} />
                          </button>

                          <button
                            onClick={() => handleDeleteSale(sale["_id"])}
                            className="bg-red-500 text-white p-2 rounded-md"
                            title="Delete"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                          {/* <button
                            // onClick={() =>}
                            className="bg-green-500 text-white p-2 rounded-md"
                            title="File"
                          >
                            <FontAwesomeIcon icon={faFile} />
                          </button> */}
                        </div>
                      </td>

                    </tr>
                  ))}
                  <tr>
                    <td className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                      <input
                        className="border text-black p-2 rounded-md w-full"
                        type="time"
                        name="saleTime"
                        value={newSale.saleTime}
                        onChange={(e) => handleInputChange(e, -1, "saleTime", e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                      <input
                        className="border p-2 rounded-md w-full"
                        type="text"
                        name="clientName"
                        value={newSale.clientName}
                        onChange={(e) => handleInputChange(e, -1, "clientName", e.target.value)}
                        onBlur={() => setSearchResults([])}
                        onFocus={() =>
                          newSale.clientName.length > 2 && setSearchResults(searchResults)
                        }
                        required
                      />
                      {isSearching && <div>Searching...</div>}
                      {searchResults.length > 0 && (
                        <ul className="absolute bg-white shadow-lg mt-1 max-h-60 overflow-auto z-10">
                          {searchResults.map((sale, index) => (
                            <li
                              key={index}
                              className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-200"
                              onMouseDown={(event) => handleSelectSale(sale, event)}
                            >
                              {sale["NOM DU CLIENT"]} - {sale["TELEPHONE"]}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap text-black border border-black">
                      <input
                        className="border text-black p-2 rounded-md w-full"
                        type="text"
                        name="phoneNumber"
                        value={formatPhoneNumber(newSale.phoneNumber)}
                        onChange={(e) => handleInputChange(e, -1, "phoneNumber", e.target.value)}
                        required
                      />
                    </td>
                    <td className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                      <input
                        className="border p-2 rounded-md w-full"
                        type="text"
                        name="address"
                        value={newSale.address}
                        onChange={(e) => handleInputChange(e, -1, "address", e.target.value)}
                        required
                        list="city-options"
                      />
                      <datalist id="city-options">
                        {cities.map((city, idx) => (
                          <option key={idx} value={city} />
                        ))}
                      </datalist>
                    </td>
                    <td className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                      <input
                        className="border p-2 rounded-md w-full"
                        type="text"
                        name="orderNumber"
                        value={newSale.orderNumber}
                        onChange={(e) => handleInputChange(e, -1, "orderNumber", e.target.value)}
                        required
                        list="vendor-options"
                      />
                      <datalist id="vendor-options">
                        {vendors.map((vendor, idx) => (
                          <option key={idx} value={vendor} />
                        ))}
                      </datalist>
                    </td>
                    <td className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                      <input
                        className="border p-2 rounded-md w-full"
                        type="text"
                        name="workDescription"
                        value={newSale.workDescription}
                        onChange={(e) => handleInputChange(e, -1, "workDescription", e.target.value)}
                        required
                      />
                    </td>
                    <td className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                      <input
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
                    <td className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                      <button
                        onClick={handleAddSale}
                        className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition duration-300"
                        type="button"
                      >
                        Ajouter
                      </button>
                    </td>
                  </tr>
                  {Array.from({ length: emptyRowsCount }).map((_, index) => (
                    <tr key={`empty-${index}`}>
                      <td className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                        &nbsp;
                      </td>
                      <td className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                        &nbsp;
                      </td>
                      <td className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                        &nbsp;
                      </td>
                      <td className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                        &nbsp;
                      </td>
                      <td className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                        &nbsp;
                      </td>
                      <td className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                        &nbsp;
                      </td>
                      <td className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                        &nbsp;
                      </td>
                      <td className="px-2 py-1 md:px-4 md:py-2 lg:px-6 lg:py-3 whitespace-nowrap border border-black">
                        &nbsp;
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end items-center mt-4">
              <label className="mr-2 text-lg font-bold" style={{ color: 'orange' }}>Total €:</label>
              <span className="text-lg font-bold">{totalAmount.toFixed(2)}</span>
            </div>
            <button
              onClick={() => {
                MySwal.fire({
                  title: 'Succès',
                  text: 'Le planning a été validé avec succès',
                  icon: 'success',
                  confirmButtonText: 'OK'
                }).then(() => {
                  router.push("/dashboard");
                });
                new Audio('/bell-sound.mp3').play();
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
