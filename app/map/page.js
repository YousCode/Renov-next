"use client";

import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";

const ClientsMap = dynamic(() => import("@/components/ClientsMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[calc(100vh-82px)] text-gray-600">
      Chargement de la carte…
    </div>
  ),
});

const MapPage = () => {
  return (
    <>
      <Navbar />
      <ClientsMap />
    </>
  );
};

export default MapPage;
