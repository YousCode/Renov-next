"use client";

// ----------------------------------------------------------
// EditSaleImproved.jsx – formulaire de mise à jour de vente
// Version optimisée : React-Hook-Form + Yup + Toastify
// ----------------------------------------------------------

import React, { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useForm, Controller, useWatch } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  faSave,
  faFile,
  faCopy,
  faDownload,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";

//------------------------------------------------------------
// Constantes & helpers
//------------------------------------------------------------
const TVA_MIN = 5.5;
const TVA_MAX = 20;

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
    .number()
    .min(TVA_MIN, `≥ ${TVA_MIN}`)
    .max(TVA_MAX, `≤ ${TVA_MAX}`)
    .required(),
  "MONTANT TTC": yup
    .number()
    .typeError("Nombre invalide")
    .positive("Doit être positif")
    .required(),
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
    formState: { errors, isDirty },
  } = useForm({
    defaultValues: DEFAULT_VALUES,
    resolver: yupResolver(schema),
  });

  //--------------------------------------------------------
  // Charge la vente existante
  //--------------------------------------------------------
  useEffect(() => {
    const fetchSale = async () => {
      try {
        const res = await fetch(`/api/ventes/${id}`);
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        const sale = data.data;

        // Normalise les dates pour les pickers
        sale["DATE DE VENTE"] = sale["DATE DE VENTE"] ? new Date(sale["DATE DE VENTE"]) : queryDate ? new Date(queryDate) : new Date();
        sale["PREVISION CHANTIER"] = sale["PREVISION CHANTIER"] ? new Date(sale["PREVISION CHANTIER"]) : null;

        reset({ ...DEFAULT_VALUES, ...sale });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSale();
  }, [id, queryDate, reset]);

  //--------------------------------------------------------
  // Calcul dynamique du HT sur changement TVA / TTC
  //--------------------------------------------------------
  const ttc = useWatch({ control, name: "MONTANT TTC" });
  const taux = useWatch({ control, name: "TAUX TVA" });

  useEffect(() => {
    const ttcNum = parseFloat(ttc);
    const tauxNum = parseFloat(taux) || 10;
    if (!isNaN(ttcNum)) {
      const ht = ttcNum / (1 + tauxNum / 100);
      setValue("MONTANT HT", ht.toFixed(2), { shouldValidate: false });
    }
  }, [ttc, taux, setValue]);

  //--------------------------------------------------------
  // Soumission
  //--------------------------------------------------------
  const onSubmit = async (values) => {
    try {
      // Convert dates → ISO strings pour l’API
      const payload = {
        ...values,
        "DATE DE VENTE": values["DATE DE VENTE"].toISOString(),
        "PREVISION CHANTIER": values["PREVISION CHANTIER"] ? values["PREVISION CHANTIER"].toISOString() : "",
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
      toast.error(err.message);
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

  // Le composant de champ générique pour factoriser le markup
  const Field = ({ label, name, rules, children }) => (
    <div>
      <label className="block mb-1 font-semibold text-gray-800">
        {label}
      </label>
      {children}
      {errors[name] && (
        <p className="text-red-600 text-xs mt-1">{errors[name].message}</p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-200 to-gray-600">
      <Navbar />
      <div className="max-w-4xl mx-auto py-8 px-4">
        <h2 className="text-2xl font-bold text-white text-center mb-6">Éditer la vente</h2>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white bg-opacity-90 rounded-lg shadow-2xl p-6 grid grid-cols-2 gap-6 text-sm"
        >
          {/* Date de vente */}
          <Field label="Date de Vente" name="DATE DE VENTE">
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
          <Field label="NUMERO BC" name="NUMERO BC">
            <Controller
              control={control}
              name="NUMERO BC"
              render={({ field }) => <input {...field} className="border p-2 rounded w-full" />}
            />
          </Field>

          {/* CIVILITE */}
          <Field label="CIVILITE" name="CIVILITE">
            <Controller
              control={control}
              name="CIVILITE"
              render={({ field }) => <input {...field} className="border p-2 rounded w-full" />}
            />
          </Field>

          {/* NOM & PRENOM */}
          <Field label="Nom" name="NOM DU CLIENT">
            <Controller
              control={control}
              name="NOM DU CLIENT"
              render={({ field }) => <input {...field} className="border p-2 rounded w-full" />}
            />
          </Field>
          <Field label="Prénom" name="prenom">
            <Controller
              control={control}
              name="prenom"
              render={({ field }) => <input {...field} className="border p-2 rounded w-full" />}
            />
          </Field>

          {/* Adresse */}
          <Field label="Adresse" name="ADRESSE DU CLIENT">
            <Controller
              control={control}
              name="ADRESSE DU CLIENT"
              render={({ field }) => <input {...field} className="border p-2 rounded w-full" />}
            />
          </Field>
          <Field label="CODE INTERP etage" name="CODE INTERP etage">
            <Controller
              control={control}
              name="CODE INTERP etage"
              render={({ field }) => <input {...field} className="border p-2 rounded w-full" />}
            />
          </Field>
          <Field label="Ville" name="VILLE">
            <Controller
              control={control}
              name="VILLE"
              render={({ field }) => <input {...field} className="border p-2 rounded w-full" />}
            />
          </Field>
          <Field label="CP" name="CP">
            <Controller
              control={control}
              name="CP"
              render={({ field }) => <input {...field} className="border p-2 rounded w-full" />}
            />
          </Field>

          {/* Téléphone & Vendeur */}
          <Field label="Téléphone" name="TELEPHONE">
            <Controller
              control={control}
              name="TELEPHONE"
              render={({ field }) => <input {...field} className="border p-2 rounded w-full" />}
            />
          </Field>
          <Field label="Vendeur" name="VENDEUR">
            <Controller
              control={control}
              name="VENDEUR"
              render={({ field }) => <input {...field} className="border p-2 rounded w-full" />}
            />
          </Field>

          {/* Designation */}
          <Field label="Désignation" name="DESIGNATION">
            <Controller
              control={control}
              name="DESIGNATION"
              render={({ field }) => <input {...field} className="border p-2 rounded w-full" />}
            />
          </Field>

          {/* TVA & TTC */}
          <Field label="Taux TVA (%)" name="TAUX TVA">
            <Controller
              control={control}
              name="TAUX TVA"
              render={({ field }) => (
                <select {...field} className="border p-2 rounded w-full">
                  {[5.5, 10, 20, 0].map((v) => (
                    <option key={v} value={v}>{v}%</option>
                  ))}
                </select>
              )}
            />
          </Field>
          <Field label="Montant TTC" name="MONTANT TTC">
            <Controller
              control={control}
              name="MONTANT TTC"
              render={({ field }) => <input type="number" step="0.01" min="0" {...field} className="border p-2 rounded w-full" />}
            />
          </Field>

          {/* HT (readonly) */}
          <Field label="Montant HT (calculé)" name="MONTANT HT">
            <Controller
              control={control}
              name="MONTANT HT"
              render={({ field }) => <input {...field} readOnly className="border p-2 rounded w-full bg-gray-100" />}
            />
          </Field>

          {/* Montant annulé */}
          <Field label="Montant annulé" name="MONTANT ANNULE">
            <Controller
              control={control}
              name="MONTANT ANNULE"
              render={({ field }) => <input type="number" step="0.01" min="0" {...field} className="border p-2 rounded w-full" />}
            />
          </Field>

          {/* Etat */}
          <Field label="État" name="ETAT">
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
          <Field label="Prévision chantier" name="PREVISION CHANTIER">
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
          <Field label="Observation" name="OBSERVATION">
            <Controller
              control={control}
              name="OBSERVATION"
              render={({ field }) => <input {...field} className="border p-2 rounded w-full" />}
            />
          </Field>
        </form>

        {/* Boutons */}
        <div className="flex flex-wrap justify-center gap-4 mt-6">
          <button
            onClick={handleSubmit(onSubmit)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded"
          >
            <FontAwesomeIcon icon={faSave} /> Valider
          </button>
          <button
            onClick={() => router.push(`/file/details/${id}`)}
            className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded"
          >
            <FontAwesomeIcon icon={faFile} /> Fichier
          </button>
          <button
            onClick={() => copyCSV(useWatch({ control }))}
            className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded"
          >
            <FontAwesomeIcon icon={faCopy} /> Copier CSV
          </button>
          <button
            onClick={() => downloadCSV(useWatch({ control }))}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded"
          >
            <FontAwesomeIcon icon={faDownload} /> Télécharger CSV
          </button>
        </div>
      </div>
      <ToastContainer position="bottom-center" autoClose={2500} hideProgressBar newestOnTop />
    </div>
  );
};

export default EditSaleImproved;
