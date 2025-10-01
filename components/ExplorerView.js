"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";

// utils
const norm = (v) =>
  (v ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const safe = (obj, key) => (obj && obj[key] != null ? String(obj[key]) : "");

const ExplorerView = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFilter, setSearchFilter] = useState("nom"); // nom | phone | adresse | designation | ville
  const router = useRouter();

  const user = useSelector((state) => state.Auth.user);

  const handleInputChange = async (e) => {
    const raw = e.target.value;
    const term = norm(raw);
    setSearchTerm(raw);

    if (!term) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/ventes/search?searchTerm=${encodeURIComponent(raw)}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      const data = await response.json();

      if (!data.success) {
        setSearchResults([]);
        return;
      }

      // 1) Filtrage côté client selon le champ choisi
      const filtered = data.data.filter((item) => {
        const nom = norm(safe(item, "NOM DU CLIENT"));
        const phone = safe(item, "TELEPHONE"); // on ne normalise pas pour garder les chiffres
        const adresse = norm(safe(item, "ADRESSE DU CLIENT"));
        const designation = norm(safe(item, "DESIGNATION"));
        const ville = norm(safe(item, "VILLE"));
        const cp = norm(safe(item, "CP"));

        switch (searchFilter) {
          case "nom":
            return nom.startsWith(term);
          case "phone":
            return phone.includes(raw); // garder la saisie brute pour les chiffres/espace
          case "adresse":
            return adresse.includes(term);
          case "designation":
            return designation.includes(term);
          case "ville":
            // on cherche sur ville OU code postal
            return ville.includes(term) || cp.includes(term);
          default:
            return false;
        }
      });

      // 2) Regrouper les résultats par client (déduplication)
      const map = new Map();
      for (const sale of filtered) {
        const name = safe(sale, "NOM DU CLIENT");
        const phone = safe(sale, "TELEPHONE");
        const address = safe(sale, "ADRESSE DU CLIENT");
        const designation = safe(sale, "DESIGNATION");
        const city = safe(sale, "VILLE");
        const cp = safe(sale, "CP");
        const key = `${name}|${phone}|${address}|${city}|${cp}`;

        if (!map.has(key)) {
          map.set(key, {
            name,
            phone,
            address,
            designation,
            city,
            cp,
            sales: [sale],
          });
        } else {
          map.get(key).sales.push(sale);
        }
      }

      const uniqueResults = Array.from(map.values());

      // 3) Filtre final sur l’aperçu (utile si l’API renvoie large)
      const finalResults = uniqueResults.filter((result) => {
        switch (searchFilter) {
          case "nom":
            return norm(result.name).startsWith(term);
          case "phone":
            return result.phone.includes(raw);
          case "adresse":
            return norm(result.address).includes(term);
          case "designation":
            return norm(result.designation).includes(term);
          case "ville":
            return norm(result.city).includes(term) || norm(result.cp).includes(term);
          default:
            return false;
        }
      });

      setSearchResults(finalResults);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
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
              <option value="ville">Ville / CP</option>
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
                  {result.name} — {result.phone} — {result.address}
                  {result.city ? ` — ${result.city}${result.cp ? ` (${result.cp})` : ""}` : ""}
                  {result.designation ? ` — ${result.designation}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="lg:h-[calc(100vh-82px)] h-[calc(100vh-68px)] absolute lg:top-20 top-[68px] left-0 w-full">
        <div className="w-full h-[100%] bg-explore-gradient absolute bottom-0" />
        <img alt="bg" src="/explore-bg.png" className="w-full h-full object-cover" />
      </div>
    </>
  );
};

export default ExplorerView;