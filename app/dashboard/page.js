"use client";

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarAlt, faSearch, faChartBar } from "@fortawesome/free-solid-svg-icons";

const Dashboard = () => {
  const user = useSelector((state) => state.auth ? state.auth.user : null);

  // On retire la référence à t("…"), en mettant directement les chaînes
  const [statusFilterCalendar, setStatusFilterCalendar] = useState("À faire");
  const [assignedToFilterCalendar, setAssignedToFilterCalendar] = useState({ name: '', value: '' });
  const [projectFilterCalendar, setProjectFilterCalendar] = useState({ name: "Tous projets", value: "all" });

  const router = useRouter();

  useEffect(() => {
    if (user) {
      setAssignedToFilterCalendar({ name: user.name, value: user._id });
    }
  }, [user]);

  const today = new Date().toISOString().split('T')[0];

  return (
    <>
      <Navbar />
      <section
        className="flex flex-col items-center justify-center min-h-screen bg-cover bg-center"
        style={{ backgroundImage: "url('/explore-bg.png')" }}
      >
        <div className="z-10 p-4 w-full max-w-screen-md mx-auto space-y-10">
          {/* Section Planning */}
          <div
            className="bg-white bg-opacity-90 p-6 rounded-lg shadow-lg transform transition-transform hover:scale-105 cursor-pointer text-center"
            onClick={() => router.push(`/dates/${today}`)}
          >
            <h2 className="text-xl font-bold mb-4 text-yellow-400">
              <FontAwesomeIcon icon={faCalendarAlt} className="mr-2" />
              Planning
            </h2>
          </div>

          {/* Section Recherche de Clients */}
          <div
            className="bg-white bg-opacity-90 p-6 rounded-lg shadow-lg transform transition-transform hover:scale-105 cursor-pointer text-center"
            onClick={() => router.push('/explorer')}
          >
            <h2 className="text-xl font-bold mb-4 text-blue-400">
              <FontAwesomeIcon icon={faSearch} className="mr-2" />
              Recherche de Clients
            </h2>
          </div>

          {/* Section Statistiques */}
          <div
            className="bg-white bg-opacity-90 p-6 rounded-lg shadow-lg transform transition-transform hover:scale-105 cursor-pointer text-center"
            onClick={() => router.push('/statistics')}
          >
            <h2 className="text-xl font-bold mb-4 text-green-400">
              <FontAwesomeIcon icon={faChartBar} className="mr-2" />
              Statistiques
            </h2>
          </div>
        </div>
      </section>
    </>
  );
};

export default Dashboard;