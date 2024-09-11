// components/WeeklyCalendar.js
"use client";

import React, { useState, useEffect } from "react";
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const FullCalendarWrapper = dynamic(() => import('./FullCalendarWrapper'), { ssr: false });

export const WeeklyCalendar = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ventes", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch sales data");
      }
      const data = await response.json();
      const eventList = data.data
        .filter((sale) => sale["DATE DE VENTE"])
        .map((sale) => {
          try {
            const date = new Date(sale["DATE DE VENTE"]);
            const formattedDate = date.toISOString().split("T")[0];
            return {
              id: sale._id,
              title: `${sale["NOM DU CLIENT"]} - ${sale["DESIGNATION"]}`,
              start: formattedDate,
              allDay: true,
            };
          } catch (error) {
            console.error("Invalid date found:", sale["DATE DE VENTE"], error);
            return null;
          }
        })
        .filter((event) => event !== null);

      setEvents(eventList);
    } catch (error) {
      console.error("Error fetching sales data:", error);
      setError("Failed to load events. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = (arg) => {
    router.push(`/dates/${arg.dateStr}`);
  };

  const handleEventDrop = async (info) => {
    const { event } = info;
    const newDate = new Date(
      event.start.getTime() - event.start.getTimezoneOffset() * 60000
    ).toISOString().split("T")[0];

    const updatedSale = {
      ...event.extendedProps,
      "DATE DE VENTE": newDate,
    };

    try {
      const response = await fetch(`/api/ventes/${event.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(updatedSale),
      });

      if (!response.ok) {
        throw new Error("Failed to update sale date");
      }

      // Fetch the updated events from the server
      await fetchSalesData();
    } catch (error) {
      console.error("Error updating sale date:", error);
      setError("Failed to update event date. Please try again.");
      info.revert();
    }
  };

  return (
    <div
      style={{ position: "relative", backgroundColor: "#0A3A31" }}
      className="rounded-md px-4"
    >
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      <FullCalendarWrapper
        events={events}
        handleDateClick={handleDateClick}
        handleEventDrop={handleEventDrop}
      />
    </div>
  );
};

export default WeeklyCalendar;
