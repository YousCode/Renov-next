"use client";

// ----------------------------------------------------------
// EditSaleImproved.jsx – formulaire de mise à jour de vente
// JS pur (aucune annotation TS)
// - le <form> ne soumet jamais (submit natif bloqué)
// - Montant TTC n’éjecte plus le focus (Field mémoïsé hors composant)
// - TVA normalisée (nombre), virgules acceptées
// - bouton "Valider" = seule soumission via handleSubmit(onSubmit)
// ----------------------------------------------------------

import React, { useEffect, useState, memo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useForm, Controller, useWatch } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { faSave, faFile, faCopy, faDownload } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

//------------------------------------------------------------
// Constantes & helpers (JS only)
//------------------------------------------------------------
const TVA_MIN = 0;
const TVA_MAX = 20;

const parseNumber = (v) =>
  Number(String(v ?? "").replace("%", "").replace(",", ".").trim());
const isFiniteNum = (n) => Number.isFinite(n);

const DEFAULT_VALUES = {
  "DATE DE VENTE": new Date(),
  "NUMERO BC": "",
  CIVILITE: "",
  "NOM DU CLIENT": "",
  prenom: "",
  "ADRESSE DU CLIENT": "",
  "CODE INTERP etage": "",
  VILLE: "",
  CP: "",
  TELEPHONE: "",
  VENDEUR: "",
  DESIGNATION: "",
  "TAUX TVA": 10,
  "MONTANT TTC": "",
  "MONTANT HT": "",
  "MONTANT ANNULE": "",
  ETAT: "",
  "PREVISION CHANTIER": null,
  OBSERVATION: "",
};

const schema = yup.object({
  "NOM DU CLIENT": yup.string().required("Nom du client requis"),
  prenom: yup.string().required("Prénom requis"),
  "ADRESSE DU CLIENT": yup.string().required("Adresse requise"),
  "TAUX TVA": yup
    .mixed()
    .transform((_, orig) => parseNumber(orig))
    .test("range", `Entre ${TVA_MIN}% et ${TVA_MAX}%`, (v) => isFiniteNum(v) && v >= TVA_MIN && v <= TVA_MAX)
    .required("Taux requis"),
  "MONTANT TTC": yup
    .mixed()
    .transform((_, orig) => parseNumber(orig))
    .test("pos", "Doit être positif", (v) => isFiniteNum(v) && v >= 0)
    .required("Montant TTC requis"),
});

//------------------------------------------------------------
// Field (défini hors composant + memo pour garder le focus)
//------------------------------------------------------------
const Field = memo(function Field({ label, name, children, errorText }) {
  return (
    <div>
      <label className="block mb-1 font-semibold text-gray-800" htmlFor={name.replace(/\s+/g, "_")}>
        {label}
      </label>
      {children}
      {errorText && <p className="text-red-600 text-xs mt-1">{errorText}</p>}
    </div>
  );
});

//------------------------------------------------------------
// Main component
//------------------------------------------------------------
const EditSaleImproved = () => {
  const router = useRouter();
  const { id } = useParams();
  const searchParams = useSearchParams();
  const queryDate = searchParams.get("date");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // React-Hook-Form
  const {
    control,
    handleSubmit,
    setValue,
    reset,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: DEFAULT_VALUES,
    resolver: yupResolver(schema),
    mode: "onChange",
  });

  // Watch nécessaires
  const ttc = useWatch({ control, name: "MONTANT TTC" });
  const taux = useWatch({ control, name: "TAUX TVA" });

  //--------------------------------------------------------
  // Charge la vente existante
  //--------------------------------------------------------
  useEffect(() => {
    const fetchSale = async () => {
      try {
        const res = await fetch(`/api/ventes/${id}`);
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        const sale = data.data || {};

        const dv = sale["DATE DE VENTE"] || queryDate || new Date().toISOString();
        const pc = sale["PREVISION CHANTIER"] || null;

        const rawTaux = parseNumber(sale["TAUX TVA"]);
        const tauxNum = isFiniteNum(rawTaux) ? Math.max(TVA_MIN, Math.min(TVA_MAX, rawTaux)) : 10;

        reset({
          ...DEFAULT_VALUES,
          ...sale,
          "DATE DE VENTE": dv ? new Date(dv) : new Date(),
          "PREVISION CHANTIER": pc ? new Date(pc) : null,
          "TAUX TVA": tauxNum,
        });
      } catch (err) {
        setError(err.message || "Erreur lors du chargement");
      } finally {
        setLoading(false);
      }
    };
    fetchSale();
  }, [id, queryDate, reset]);

  //--------------------------------------------------------
  // Calcul dynamique du HT sur changement TVA / TTC
  //--------------------------------------------------------
  useEffect(() => {
    const ttcNum = parseNumber(ttc);
    const tauxNum = isFiniteNum(parseNumber(taux)) ? parseNumber(taux) : 10;
    if (isFiniteNum(ttcNum)) {
      const ht = ttcNum / (1 + tauxNum / 100);
      setValue("MONTANT HT", ht.toFixed(2), { shouldValidate: false, shouldDirty: true });
    }
  }, [ttc, taux, setValue]);

  //--------------------------------------------------------
  // Soumission (uniquement via le bouton "Valider")
  //--------------------------------------------------------
  const onSubmit = async (values) => {
    try {
      const payload = {
        ...values,
        "TAUX TVA": isFiniteNum(values["TAUX TVA"]) ? Number(values["TAUX TVA"]) : 10,
        "MONTANT TTC": isFiniteNum(parseNumber(values["MONTANT TTC"])) ? String(parseNumber(values["MONTANT TTC"])) : "0",
        "MONTANT HT": isFiniteNum(parseNumber(values["MONTANT HT"])) ? String(parseNumber(values["MONTANT HT"])) : "0",
        "DATE DE VENTE":
          values["DATE DE VENTE"] instanceof Date ? values["DATE DE VENTE"].toISOString() : values["DATE DE VENTE"],
        "PREVISION CHANTIER": values["PREVISION CHANTIER"]
          ? values["PREVISION CHANTIER"] instanceof Date
            ? values["PREVISION CHANTIER"].toISOString()
            : values["PREVISION CHANTIER"]
          : "",
      };

      const res = await fetch(`/api/ventes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Vente mise à jour !");
      setTimeout(() => router.back(), 1200);
    } catch (err) {
      toast.error(err.message || "Erreur lors de l’enregistrement");
    }
  };

  //--------------------------------------------------------
  // CSV helpers
  //--------------------------------------------------------
  const copyCSV = (data) => {
    const csvLine = Object.values(data).join(";");
    navigator.clipboard.writeText(csvLine).then(() => toast.success("CSV copié !"));
  };

  const downloadCSV = (data) => {
    const csv = [Object.keys(data).join(";"), Object.values(data).join(";")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vente_${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  //--------------------------------------------------------
  if (loading) return <div className="flex h-screen items-center justify-center">Chargement…</div>;
  if (error) return <div className="text-red-600 text-center mt-10">Erreur : {error}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-200 to-gray-600">
      <Navbar />
      <div className="max-w-4xl mx-auto py-8 px-4">
        <h2 className="text-2xl font-bold text-white text-center mb-6">Éditer la vente</h2>

        {/* ⚠️ On neutralise TOTALEMENT le submit natif du formulaire */}
        <form
          onSubmit={(e) => e.preventDefault()} // ← le form ne soumet JAMAIS
          onKeyDownCapture={(e) => {
            // Sécurité globale : bloque Enter au niveau du form
            if (e.key === "Enter") e.preventDefault();
          }}
          noValidate
          className="bg-white bg-opacity-90 rounded-lg shadow-2xl p-6 grid grid-cols-2 gap-6 text-sm"
        >
          {/* Date de vente */}
          <Field label="Date de Vente" name="DATE DE VENTE" errorText={errors["DATE DE VENTE"]?.message}>
            <Controller
              control={control}
              name="DATE DE VENTE"
              render={({ field }) => (
                <DatePicker
                  selected={field.value}
                  onChange={field.onChange}
                  className="border p-2 rounded w-full"
                  dateFormat="dd/MM/yyyy"
                />
              )}
            />
          </Field>

          {/* NUMERO BC */}
          <Field label="NUMERO BC" name="NUMERO BC" errorText={errors["NUMERO BC"]?.message}>
            <Controller control={control} name="NUMERO BC" render={({ field }) => <input {...field} className="border p-2 rounded w-full" />} />
          </Field>

          {/* CIVILITE */}
          <Field label="CIVILITE" name="CIVILITE" errorText={errors["CIVILITE"]?.message}>
            <Controller control={control} name="CIVILITE" render={({ field }) => <input {...field} className="border p-2 rounded w-full" />} />
          </Field>

          {/* NOM & PRENOM */}
          <Field label="Nom" name="NOM DU CLIENT" errorText={errors["NOM DU CLIENT"]?.message}>
            <Controller control={control} name="NOM DU CLIENT" render={({ field }) => <input {...field} className="border p-2 rounded w-full" />} />
          </Field>
          <Field label="Prénom" name="prenom" errorText={errors["prenom"]?.message}>
            <Controller control={control} name="prenom" render={({ field }) => <input {...field} className="border p-2 rounded w-full" />} />
          </Field>

          {/* Adresse */}
          <Field label="Adresse" name="ADRESSE DU CLIENT" errorText={errors["ADRESSE DU CLIENT"]?.message}>
            <Controller control={control} name="ADRESSE DU CLIENT" render={({ field }) => <input {...field} className="border p-2 rounded w-full" />} />
          </Field>
          <Field label="CODE INTERP etage" name="CODE INTERP etage" errorText={errors["CODE INTERP etage"]?.message}>
            <Controller control={control} name="CODE INTERP etage" render={({ field }) => <input {...field} className="border p-2 rounded w-full" />} />
          </Field>
          <Field label="Ville" name="VILLE" errorText={errors["VILLE"]?.message}>
            <Controller control={control} name="VILLE" render={({ field }) => <input {...field} className="border p-2 rounded w-full" />} />
          </Field>
          <Field label="CP" name="CP" errorText={errors["CP"]?.message}>
            <Controller control={control} name="CP" render={({ field }) => <input {...field} className="border p-2 rounded w-full" />} />
          </Field>

          {/* Téléphone & Vendeur */}
          <Field label="Téléphone" name="TELEPHONE" errorText={errors["TELEPHONE"]?.message}>
            <Controller control={control} name="TELEPHONE" render={({ field }) => <input {...field} className="border p-2 rounded w-full" />} />
          </Field>
          <Field label="Vendeur" name="VENDEUR" errorText={errors["VENDEUR"]?.message}>
            <Controller control={control} name="VENDEUR" render={({ field }) => <input {...field} className="border p-2 rounded w-full" />} />
          </Field>

          {/* Designation */}
          <Field label="Désignation" name="DESIGNATION" errorText={errors["DESIGNATION"]?.message}>
            <Controller control={control} name="DESIGNATION" render={({ field }) => <input {...field} className="border p-2 rounded w-full" />} />
          </Field>

          {/* TVA */}
          <Field label="Taux TVA (%)" name="TAUX TVA" errorText={errors["TAUX TVA"]?.message}>
            <Controller
              control={control}
              name="TAUX TVA"
              render={({ field }) => (
                <select
                  {...field}
                  value={field.value ?? 10}
                  onChange={(e) => field.onChange(parseNumber(e.target.value))}
                  className="border p-2 rounded w-full"
                >
                  {[0, 5.5, 10, 20].map((v) => (
                    <option key={v} value={v}>
                      {v}%
                    </option>
                  ))}
                </select>
              )}
            />
          </Field>

          {/* TTC – empêche tout submit/blur parasite */}
          <Field label="Montant TTC" name="MONTANT TTC" errorText={errors["MONTANT TTC"]?.message}>
            <Controller
              control={control}
              name="MONTANT TTC"
              render={({ field }) => (
                <input
                  id="MONTANT_TTC"
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="next"
                  autoComplete="off"
                  {...field}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value.replace(",", ".");
                    field.onChange(val);
                  }}
                  className="border p-2 rounded w-full"
                />
              )}
            />
          </Field>

          {/* HT (readonly) */}
          <Field label="Montant HT (calculé)" name="MONTANT HT" errorText={errors["MONTANT HT"]?.message}>
            <Controller control={control} name="MONTANT HT" render={({ field }) => <input {...field} readOnly className="border p-2 rounded w-full bg-gray-100" />} />
          </Field>

          {/* Montant annulé */}
          <Field label="Montant annulé" name="MONTANT ANNULE" errorText={errors["MONTANT ANNULE"]?.message}>
            <Controller
              control={control}
              name="MONTANT ANNULE"
              render={({ field }) => (
                <input
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="next"
                  autoComplete="off"
                  {...field}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onChange={(e) => field.onChange(e.target.value.replace(",", "."))}
                  className="border p-2 rounded w-full"
                />
              )}
            />
          </Field>

          {/* Etat */}
          <Field label="État" name="ETAT" errorText={errors["ETAT"]?.message}>
            <Controller
              control={control}
              name="ETAT"
              render={({ field }) => (
                <select {...field} className="border p-2 rounded w-full">
                  <option value="">Sélectionner…</option>
                  <option value="En attente">En attente</option>
                  <option value="Confirmé">Confirmé</option>
                  <option value="Annulé">Annulé</option>
                </select>
              )}
            />
          </Field>

          {/* Prévision chantier */}
          <Field label="Prévision chantier" name="PREVISION CHANTIER" errorText={errors["PREVISION CHANTIER"]?.message}>
            <Controller
              control={control}
              name="PREVISION CHANTIER"
              render={({ field }) => (
                <DatePicker
                  selected={field.value}
                  onChange={field.onChange}
                  className="border p-2 rounded w-full"
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Choisir une date"
                />
              )}
            />
          </Field>

          {/* Observation */}
          <Field label="Observation" name="OBSERVATION" errorText={errors["OBSERVATION"]?.message}>
            <Controller control={control} name="OBSERVATION" render={({ field }) => <input {...field} className="border p-2 rounded w-full" />} />
          </Field>
        </form>

        {/* Boutons */}
        <div className="flex flex-wrap justify-center gap-4 mt-6">
          {/* ✅ Unique manière d'envoyer le formulaire */}
          <button type="button" onClick={handleSubmit(onSubmit)} className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded">
            <FontAwesomeIcon icon={faSave} /> Valider
          </button>

          <button type="button" onClick={() => router.push(`/file/details/${id}`)} className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded">
            <FontAwesomeIcon icon={faFile} /> Fichier
          </button>

          <button type="button" onClick={() => copyCSV(getValues())} className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded">
            <FontAwesomeIcon icon={faCopy} /> Copier CSV
          </button>
          <button type="button" onClick={() => downloadCSV(getValues())} className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded">
            <FontAwesomeIcon icon={faDownload} /> Télécharger CSV
          </button>
        </div>
      </div>

      <ToastContainer position="bottom-center" autoClose={2500} hideProgressBar newestOnTop />
    </div>
  );
};

export default EditSaleImproved;