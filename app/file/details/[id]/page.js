"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { MyDocument } from "@/components/SaleDetails";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// PDF components (client-side only)
const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then(m => m.PDFViewer),
  { ssr: false, loading: () => <PDFSkeleton /> }
);
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then(m => m.PDFDownloadLink),
  { ssr: false }
);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const toISO = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toISOString().split("T")[0];
};

// ─────────────────────────────────────────────────────────────
// PDF Skeleton
// ─────────────────────────────────────────────────────────────
const PDFSkeleton = () => (
  <div className="w-full h-full bg-gray-700 rounded-xl flex flex-col items-center justify-center gap-3 animate-pulse">
    <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center">
      <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
    <p className="text-gray-500 text-sm">Génération du PDF…</p>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Champ de formulaire
// ─────────────────────────────────────────────────────────────
const Field = ({ label, type = "text", value, onChange, placeholder }) => (
  <div>
    <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</label>
    <input
      type={type}
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-gray-700 border border-gray-600 hover:border-gray-500 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
    />
  </div>
);

// Select field
const SelectField = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</label>
    <select value={value || ""} onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-700 border border-gray-600 hover:border-gray-500 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors cursor-pointer">
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Section draggable
// ─────────────────────────────────────────────────────────────
const Section = ({ id, title, icon, children, dragHandlers }) => {
  const { onDragStart, onDragOver, onDrop, onDragEnd, isDraggingOver } = dragHandlers(id);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`bg-gray-800 border rounded-xl overflow-hidden transition-all duration-150 ${
        isDraggingOver ? "border-blue-500 shadow-lg shadow-blue-900/30 scale-[1.01]" : "border-gray-700/60"
      }`}
    >
      {/* Handle */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-750 border-b border-gray-700/60 cursor-grab active:cursor-grabbing select-none">
        <svg className="w-3.5 h-3.5 text-gray-600" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/>
          <circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/>
          <circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
        </svg>
        <span className="text-xs">{icon}</span>
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{title}</span>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Dropzone image
// ─────────────────────────────────────────────────────────────
const ImageDropzone = ({ label, value, onChange }) => {
  const [draggingFile, setDraggingFile] = useState(false);
  const inputRef = useRef(null);

  const readFile = (file) => {
    if (!file?.type.startsWith("image/")) return toast.error("Fichier image requis");
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      <div
        onDragOver={e => { e.preventDefault(); setDraggingFile(true); }}
        onDragLeave={() => setDraggingFile(false)}
        onDrop={e => { e.preventDefault(); setDraggingFile(false); readFile(e.dataTransfer.files[0]); }}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl h-24 flex flex-col items-center justify-center cursor-pointer transition-all ${
          draggingFile ? "border-blue-500 bg-blue-500/10" : "border-gray-600 hover:border-gray-500 bg-gray-700/40"
        }`}
      >
        {value ? (
          <img src={value} alt="preview" className="h-full w-full object-contain rounded-xl p-1" />
        ) : (
          <>
            <svg className="w-6 h-6 text-gray-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <p className="text-[11px] text-gray-500">Glisser une image ici</p>
          </>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => readFile(e.target.files[0])} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────
export default function PDFEditorPage() {
  const { id } = useParams();
  const router = useRouter();

  const [form, setForm]           = useState(null);
  const [pdfData, setPdfData]     = useState(null); // version debounced pour le PDF
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [sections, setSections]   = useState(["client","vente","travaux","planification"]);
  const debounceRef = useRef(null);
  const dragSrc     = useRef(null);
  const [dragOver, setDragOver]   = useState(null);

  // Fetch
  useEffect(() => {
    fetch(`/api/ventes/${id}`)
      .then(r => r.json())
      .then(d => {
        const s = d.data || {};
        const normalized = {
          ...s,
          "DATE DE VENTE":     toISO(s["DATE DE VENTE"]),
          "PREVISION CHANTIER": toISO(s["PREVISION CHANTIER"]),
          "DATE PIT":           toISO(s["DATE PIT"]),
          "DATE TRAVAUX":       toISO(s["DATE TRAVAUX"]),
        };
        setForm(normalized);
        setPdfData(normalized);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Mise à jour champ
  const setField = useCallback((key, val) => {
    setForm(f => {
      const next = { ...f, [key]: val };
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setPdfData({ ...next }), 600);
      return next;
    });
  }, []);

  // Sauvegarde
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/ventes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      const { data } = await res.json();
      setForm(data);
      setPdfData(data);
      toast.success("Sauvegardé !");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Drag & drop sections
  const dragHandlers = (sectionId) => ({
    isDraggingOver: dragOver === sectionId,
    onDragStart: () => { dragSrc.current = sectionId; },
    onDragOver: (e) => { e.preventDefault(); setDragOver(sectionId); },
    onDrop: (e) => {
      e.preventDefault();
      if (!dragSrc.current || dragSrc.current === sectionId) return;
      setSections(prev => {
        const arr = [...prev];
        const from = arr.indexOf(dragSrc.current);
        const to   = arr.indexOf(sectionId);
        arr.splice(from, 1);
        arr.splice(to, 0, dragSrc.current);
        return arr;
      });
      setDragOver(null);
    },
    onDragEnd: () => { dragSrc.current = null; setDragOver(null); },
  });

  if (loading || !form) return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center">
        <div className="space-y-2 text-center">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"/>
          <p className="text-gray-500 text-sm">Chargement…</p>
        </div>
      </div>
    </div>
  );

  const SECTION_CONFIG = {
    client: {
      title: "Informations client",
      icon: "👤",
      fields: (
        <>
          <SelectField label="Civilité" value={form["CIVILITE"]} onChange={v => setField("CIVILITE", v)} options={["M.","Mme","M. et Mme"]} />
          <Field label="Nom *"    value={form["NOM DU CLIENT"]}   onChange={v => setField("NOM DU CLIENT", v)} />
          <Field label="Prénom"   value={form["prenom"]}          onChange={v => setField("prenom", v)} />
          <Field label="Téléphone" value={form["TELEPHONE"]}      onChange={v => setField("TELEPHONE", v)} />
          <div className="sm:col-span-2">
            <Field label="Adresse" value={form["ADRESSE DU CLIENT"]} onChange={v => setField("ADRESSE DU CLIENT", v)} />
          </div>
          <Field label="Code postal" value={form["CP"]}   onChange={v => setField("CP", v)} />
          <Field label="Ville"       value={form["VILLE"]} onChange={v => setField("VILLE", v)} />
          <div className="sm:col-span-2">
            <Field label="Bâtiment / Code / Étage" value={form["CODE INTERP etage"]} onChange={v => setField("CODE INTERP etage", v)} />
          </div>
        </>
      ),
    },
    vente: {
      title: "Informations vente",
      icon: "📋",
      fields: (
        <>
          <Field label="Date de vente" type="date" value={form["DATE DE VENTE"]} onChange={v => setField("DATE DE VENTE", v)} />
          <Field label="N° BC"         value={form["NUMERO BC"]}                 onChange={v => setField("NUMERO BC", v)} />
          <div className="sm:col-span-2">
            <Field label="Vendeur" value={form["VENDEUR"]} onChange={v => setField("VENDEUR", v)} />
          </div>
          <Field label="Montant TTC (€)" type="number" value={form["MONTANT TTC"]} onChange={v => setField("MONTANT TTC", v)} />
          <SelectField label="Taux TVA" value={form["TAUX TVA"]} onChange={v => setField("TAUX TVA", v)} options={["0%","5.5%","10%","20%"]} />
        </>
      ),
    },
    travaux: {
      title: "Nature des travaux",
      icon: "🔨",
      fields: (
        <>
          <div className="sm:col-span-2">
            <Field label="Désignation" value={form["DESIGNATION"]} onChange={v => setField("DESIGNATION", v)} />
          </div>
          <Field label="Quantité"    value={form["qte"]}        onChange={v => setField("qte", v)} />
          <Field label="Surface"     value={form["SURFACE"]}    onChange={v => setField("SURFACE", v)} />
          <div className="sm:col-span-2">
            <Field label="Emplacement" value={form["EMPLACEMENT"]} onChange={v => setField("EMPLACEMENT", v)} />
          </div>
          <div className="sm:col-span-2">
            <ImageDropzone label="Image / Photo (glisser-déposer)"
              value={form["_imageUrl"]}
              onChange={v => setField("_imageUrl", v)} />
          </div>
        </>
      ),
    },
    planification: {
      title: "Planification",
      icon: "📅",
      fields: (
        <>
          <Field label="Prévision chantier" type="date" value={form["PREVISION CHANTIER"]} onChange={v => setField("PREVISION CHANTIER", v)} />
          <Field label="Date RDV PIT"       type="date" value={form["DATE PIT"]}            onChange={v => setField("DATE PIT", v)} />
          <Field label="Date travaux"       type="date" value={form["DATE TRAVAUX"]}         onChange={v => setField("DATE TRAVAUX", v)} />
        </>
      ),
    },
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <Navbar />

      {/* ── Barre d'actions ── */}
      <div className="bg-gray-800/80 backdrop-blur border-b border-gray-700/60 px-4 py-2.5 flex items-center gap-3 sticky top-0 z-20">
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-300 hover:text-white transition-colors border border-gray-600">
          ← Retour
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {form["CIVILITE"] ? `${form["CIVILITE"]} ` : ""}{form["NOM DU CLIENT"] || "Client"}{form["prenom"] ? ` ${form["prenom"]}` : ""} · BC #{form["NUMERO BC"]}
          </p>
          <p className="text-[10px] text-gray-500 truncate">
            {[form["ADRESSE DU CLIENT"], form["CP"], form["VILLE"]].filter(Boolean).join(", ") || "Éditeur PDF · glissez les sections pour réorganiser"}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-xs font-semibold text-white transition-colors">
            {saving ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : "💾"}
            {saving ? "Sauvegarde…" : "Sauvegarder"}
          </button>

          {pdfData && (
            <PDFDownloadLink
              document={<MyDocument sale={pdfData} />}
              fileName={`fiche-${form["NOM DU CLIENT"]?.replace(/\s/g,"-")}-${form["NUMERO BC"]}.pdf`}
            >
              {({ loading: dl }) => (
                <button disabled={dl}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-xs font-semibold text-white transition-colors">
                  {dl ? "…" : "⬇"} Télécharger
                </button>
              )}
            </PDFDownloadLink>
          )}
        </div>
      </div>

      {/* ── Split screen ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* Panneau gauche : formulaire */}
        <div className="w-full lg:w-[420px] lg:shrink-0 overflow-y-auto bg-gray-900 border-r border-gray-700/60">
          <div className="p-4 space-y-3">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest px-1">
              ⠿ Glissez les sections pour réorganiser
            </p>

            {sections.map(id => {
              const cfg = SECTION_CONFIG[id];
              if (!cfg) return null;
              return (
                <Section key={id} id={id} title={cfg.title} icon={cfg.icon} dragHandlers={dragHandlers}>
                  {cfg.fields}
                </Section>
              );
            })}
          </div>
        </div>

        {/* Panneau droit : aperçu PDF */}
        <div className="flex-1 bg-gray-950 flex flex-col">
          <div className="p-3 border-b border-gray-800 flex items-center justify-between">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider">Aperçu PDF (mise à jour automatique)</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
              <span className="text-[10px] text-gray-600">Live</span>
            </div>
          </div>

          <div className="flex-1 p-4">
            {pdfData && (
              <PDFViewer style={{ inlineSize: "100%", blockSize: "100%", border: "none", borderRadius: "12px" }}>
                <MyDocument sale={pdfData} />
              </PDFViewer>
            )}
          </div>
        </div>
      </div>

      <ToastContainer position="bottom-center" autoClose={2000} hideProgressBar theme="dark" />
    </div>
  );
}
