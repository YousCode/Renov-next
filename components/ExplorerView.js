"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from 'react-redux';

const ExplorerView = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFilter, setSearchFilter] = useState("nom");
  const router = useRouter();

  const user = useSelector((state) => state.Auth.user);

  const handleInputChange = async (e) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    if (term) {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/ventes/search?searchTerm=${encodeURIComponent(term)}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.success) {
          const uniqueResults = Array.from(new Set(data.data.map(sale => ({
            name: sale["NOM DU CLIENT"],
            phone: sale["TELEPHONE"],
            address: sale["ADRESSE DU CLIENT"],
            designation: sale["DESIGNATION"],
            sales: data.data.filter(item => {
              switch (searchFilter) {
                case "nom":
                  return item["NOM DU CLIENT"].toLowerCase().startsWith(term);
                case "phone":
                  return item["TELEPHONE"].includes(term);
                case "adresse":
                  return item["ADRESSE DU CLIENT"].toLowerCase().includes(term);
                case "designation":
                  return item["DESIGNATION"].toLowerCase().includes(term);
                default:
                  return false;
              }
            })
          }))));
          setSearchResults(uniqueResults.filter(result => {
            switch (searchFilter) {
              case "nom":
                return result.name.toLowerCase().startsWith(term);
              case "phone":
                return result.phone.includes(term);
              case "adresse":
                return result.address.toLowerCase().includes(term);
              case "designation":
                return result.designation.toLowerCase().includes(term);
              default:
                return false;
            }
          }));
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectSale = (sales) => {
    const query = new URLSearchParams({ sales: JSON.stringify(sales) }).toString();
    router.push(`/search-client?${query}`);
  };

  const handleViewAllSales = () => {
    router.push("/all-sales");
  };

  return (
    <>
      <section className="lg:h-[calc(100vh-82px)] h-[calc(100vh-68px)] absolute lg:top-20 top-[68px] left-0 w-full z-20 flex items-center justify-center">
        <div className="sm:max-w-xl mx-5 lg:mx-auto w-full space-y-5">
          <div className="relative flex items-center space-x-2">
            <input
              type="text"
              value={searchTerm}
              onChange={handleInputChange}
              className="w-full p-3 pl-10 border text-black border-gray-300 rounded-lg search-input"
              placeholder={`Rechercher par ${searchFilter}`}
            />
            <select
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="p-3 border text-black border-gray-300 rounded-lg"
            >
              <option value="nom">Nom</option>
              <option value="phone">Téléphone</option>
              <option value="adresse">Adresse</option>
              <option value="designation">Désignation</option>
            </select>
            {isSearching && <div>Recherche en cours...</div>}
          </div>
          <button
            onClick={handleViewAllSales}
            className="w-full bg-green-500 text-white p-3 rounded-lg mt-4"
          >
            Toutes les ventes
          </button>
        {searchResults.length > 0 && (
          <ul className="bg-white shadow-lg mt-4 max-h-60 text-black overflow-auto z-10 w-full border border-gray-300 rounded-lg">
            {searchResults.map((result, index) => (
              <li
                key={index}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-200"
                onClick={() => handleSelectSale(result.sales)}
              >
                {result.name} - {result.phone} - {result.address} - {result.designation}
              </li>
            ))}
          </ul>
        )}
        </div>
      </section>
      <div className="lg:h-[calc(100vh-82px)] h-[calc(100vh-68px)] absolute lg:top-20 top-[68px] left-0 w-full">
        <div className="w-full h-[100%] bg-explore-gradient absolute bottom-0" />
        <img
          alt="bg"
          src="/explore-bg.png"
          className="w-full h-full object-cover"
        />
      </div>
    </>
  );
};

export default ExplorerView;
