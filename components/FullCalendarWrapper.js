// components/FullCalendarWrapper.js
"use client";

import React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import frLocale from "@fullcalendar/core/locales/fr";

const FullCalendarWrapper = ({ events, handleDateClick, handleEventDrop }) => {
  return (
    <FullCalendar
      plugins={[dayGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth",
      }}
      hiddenDays={[0]}
      dateClick={handleDateClick}
      events={events}
      locale={frLocale}
      eventClassNames="bg-[#2da58d] text-white p-2 rounded-md border-[#004225]"
      editable={true}
      droppable={true}
      eventDrop={handleEventDrop}
      height="auto"
      dayHeaderClassNames="bg-[#004225] text-white"
      dayCellClassNames="border border-gray-500"
    />
  );
};

export default FullCalendarWrapper;

