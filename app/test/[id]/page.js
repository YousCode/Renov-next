"use client";
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { useParams, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';

// Importer PDFViewer dynamiquement pour éviter le rendu côté serveur
const PDFViewer = dynamic(() => import('@react-pdf/renderer').then(mod => mod.PDFViewer), { ssr: false });

// Enregistrer les polices depuis le dossier public
Font.register({
  family: 'Roboto',
  fonts: [
    { src: '/fonts/Roboto-Regular.ttf' },
    { src: '/fonts/Roboto-Bold.ttf', fontWeight: 'bold' },
  ],
});

// Styles pour le document PDF
const styles = StyleSheet.create({
  // ... (votre style existant)
});

// Schéma de validation avec Yup
const VenteSchema = Yup.object().shape({
  "NOM DU CLIENT": Yup.string().required("Le nom du client est obligatoire"),
  "NUMERO BC": Yup.string()
    .matches(/^\d{6}$/, "Le numéro BC doit être un nombre à 6 chiffres")
    .required("Le numéro BC est obligatoire"),
  "TAUX TVA": Yup.number().min(0, "Le taux TVA doit être positif").required("Le taux TVA est obligatoire"),
  "MONTANT TTC": Yup.number().min(0, "Le montant TTC doit être positif").required("Le montant TTC est obligatoire"),
  "DATE DE VENTE": Yup.date().required("La date de vente est obligatoire"),
  // Ajoutez d'autres validations si nécessaire
});

// Composant Document PDF
const MyDocument = ({ sale }) => (
  <Document>
    <Page style={styles.page}>
      {/* ... (votre composant PDF existant) */}
    </Page>
  </Document>
);

// Composant Principal pour Afficher et Modifier les Données et le PDF
const Test = () => {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const saleDate = searchParams.get("date");
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id) {
      const fetchSale = async () => {
        setLoading(true);
        try {
          const response = await fetch(`/api/ventes/${id}`, {
            credentials: "include",
          });
          if (!response.ok) {
            throw new Error(`Échec de la récupération de la vente : ${response.status}`);
          }
          const data = await response.json();
          if (saleDate) {
            data.data["DATE DE VENTE"] = new Date(saleDate).toISOString().split("T")[0];
          }
          setSale(data.data);
        } catch (error) {
          console.error("Erreur lors de la récupération des données de la vente :", error);
          setError(`Erreur : ${error.message}`);
        } finally {
          setLoading(false);
        }
      };
      fetchSale();
    }
  }, [id, saleDate]);

  const handleSave = async (values, { setSubmitting }) => {
    try {
      const response = await fetch(`/api/ventes/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(values),
      });

      if (response.ok) {
        const updatedData = await response.json();
        setSale(updatedData.data);
        alert("Modifications enregistrées avec succès !");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erreur : ${response.status}`);
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des modifications :", error.message);
      alert(`Erreur lors de la sauvegarde : ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-center text-gray-700 text-xl animate-pulse">Chargement...</p>
      </div>
    );
  if (error)
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-center text-red-500 text-xl">{error}</p>
      </div>
    );
  if (!sale) return null;

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <Navbar />
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-center">Modifier la Vente</h1>
        
        {/* Formulaire de Modification avec Formik */}
        <Formik
          initialValues={sale}
          validationSchema={VenteSchema}
          onSubmit={handleSave}
        >
          {({ isSubmitting }) => (
            <Form className="bg-white p-6 rounded-lg shadow-md mb-8">
              <div className="grid grid-cols-2 gap-4">
                {/* Civilité */}
                <div>
                  <label className="block text-gray-700">Civilité:</label>
                  <Field
                    type="text"
                    name="CIVILITE"
                    className="mt-1 p-2 w-full border rounded"
                  />
                  <ErrorMessage name="CIVILITE" component="div" className="text-red-500 text-sm" />
                </div>
                {/* Nom du Client */}
                <div>
                  <label className="block text-gray-700">Nom du Client:</label>
                  <Field
                    type="text"
                    name="NOM DU CLIENT"
                    className="mt-1 p-2 w-full border rounded"
                  />
                  <ErrorMessage name="NOM DU CLIENT" component="div" className="text-red-500 text-sm" />
                </div>
                {/* Prénom */}
                <div>
                  <label className="block text-gray-700">Prénom:</label>
                  <Field
                    type="text"
                    name="prenom"
                    className="mt-1 p-2 w-full border rounded"
                  />
                  <ErrorMessage name="prenom" component="div" className="text-red-500 text-sm" />
                </div>
                {/* Numéro BC */}
                <div>
                  <label className="block text-gray-700">Numéro BC:</label>
                  <Field
                    type="text"
                    name="NUMERO BC"
                    className="mt-1 p-2 w-full border rounded"
                  />
                  <ErrorMessage name="NUMERO BC" component="div" className="text-red-500 text-sm" />
                </div>
               
                {/* Adresse du Client */}
                <div>
                  <label className="block text-gray-700">Adresse du Client:</label>
                  <Field
                    type="text"
                    name="ADRESSE DU CLIENT"
                    className="mt-1 p-2 w-full border rounded"
                  />
                  <ErrorMessage name="ADRESSE DU CLIENT" component="div" className="text-red-500 text-sm" />
                </div>
                {/* Bâtiment */}
                <div>
                  <label className="block text-gray-700">Bâtiment:</label>
                  <Field
                    type="text"
                    name="BATIMENT"
                    className="mt-1 p-2 w-full border rounded"
                  />
                  <ErrorMessage name="BATIMENT" component="div" className="text-red-500 text-sm" />
                </div>
                {/* Code */}
                <div>
                  <label className="block text-gray-700">Code:</label>
                  <Field
                    type="text"
                    name="CODE"
                    className="mt-1 p-2 w-full border rounded"
                  />
                  <ErrorMessage name="CODE" component="div" className="text-red-500 text-sm" />
                </div>
                {/* Étage */}
                <div>
                  <label className="block text-gray-700">Étage:</label>
                  <Field
                    type="number"
                    name="ETAGE"
                    className="mt-1 p-2 w-full border rounded"
                    min="0"
                  />
                  <ErrorMessage name="ETAGE" component="div" className="text-red-500 text-sm" />
                </div>
                {/* Ville */}
                <div>
                  <label className="block text-gray-700">Ville:</label>
                  <Field
                    type="text"
                    name="VILLE"
                    className="mt-1 p-2 w-full border rounded"
                  />
                  <ErrorMessage name="VILLE" component="div" className="text-red-500 text-sm" />
                </div>
                {/* Code Postal */}
                <div>
                  <label className="block text-gray-700">Code Postal (CP):</label>
                  <Field
                    type="text"
                    name="CP"
                    className="mt-1 p-2 w-full border rounded"
                  />
                  <ErrorMessage name="CP" component="div" className="text-red-500 text-sm" />
                </div>
                {/* Téléphone */}
                <div>
                  <label className="block text-gray-700">Téléphone:</label>
                  <Field
                    type="text"
                    name="TELEPHONE"
                    className="mt-1 p-2 w-full border rounded"
                  />
                  <ErrorMessage name="TELEPHONE" component="div" className="text-red-500 text-sm" />
                </div>
                {/* Vendeur */}
                <div>
                  <label className="block text-gray-700">Vendeur:</label>
                  <Field
                    type="text"
                    name="VENDEUR"
                    className="mt-1 p-2 w-full border rounded"
                  />
                  <ErrorMessage name="VENDEUR" component="div" className="text-red-500 text-sm" />
                </div>
                {/* Désignation */}
                <div>
                  <label className="block text-gray-700">Désignation:</label>
                  <Field
                    type="text"
                    name="DESIGNATION"
                    className="mt-1 p-2 w-full border rounded"
                  />
                  <ErrorMessage name="DESIGNATION" component="div" className="text-red-500 text-sm" />
                </div>
                {/* Taux TVA */}
                <div>
                  <label className="block text-gray-700">Taux TVA:</label>
                  <Field
                    type="number"
                    name="TAUX TVA"
                    className="mt-1 p-2 w-full border rounded"
                    step="0.01"
                    min="0"
                  />
                  <ErrorMessage name="TAUX TVA" component="div" className="text-red-500 text-sm" />
                </div>
                {/* Commission Solo */}
                <div>
                  <label className="block text-gray-700">Commission Solo:</label>
                  <Field
                    type="number"
                    name="COMISSION SOLO"
                    className="mt-1 p-2 w-full border rounded"
                    step="0.01"
                    min="0"
                  />
                  <ErrorMessage name="COMISSION SOLO" component="div" className="text-red-500 text-sm" />
                </div>
                {/* Montant TTC */}
                <div>
                  <label className="block text-gray-700">Montant TTC:</label>
                  <Field
                    type="number"
                    name="MONTANT TTC"
                    className="mt-1 p-2 w-full border rounded"
                    step="0.01"
                    min="0"
                  />
                  <ErrorMessage name="MONTANT TTC" component="div" className="text-red-500 text-sm" />
                </div>
                {/* Montant HT */}
                <div>
                  <label className="block text-gray-700">Montant HT:</label>
                  <Field
                    type="number"
                    name="MONTANT HT"
                    className="mt-1 p-2 w-full border rounded"
                    step="0.01"
                    min="0"
                    disabled // Désactiver le champ car calculé automatiquement
                  />
                  <ErrorMessage name="MONTANT HT" component="div" className="text-red-500 text-sm" />
                </div>
                {/* Montant Annulé */}
                <div>
                  <label className="block text-gray-700">Montant Annulé:</label>
                  <Field
                    type="number"
                    name="MONTANT ANNULE"
                    className="mt-1 p-2 w-full border rounded"
                    step="0.01"
                    min="0"
                  />
                  <ErrorMessage name="MONTANT ANNULE" component="div" className="text-red-500 text-sm" />
                </div>
                {/* CA Mensuel */}
                <div>
                  <label className="block text-gray-700">CA Mensuel:</label>
                  <Field
                    type="number"
                    name="CA MENSUEL"
                    className="mt-1 p-2 w-full border rounded"
                    step="0.01"
                    min="0"
                  />
                  <ErrorMessage name="CA MENSUEL" component="div" className="text-red-500 text-sm" />
                </div>
                {/* État */}
                <div>
                  <label className="block text-gray-700">État:</label>
                  <Field
                    as="select"
                    name="ETAT"
                    className="mt-1 p-2 w-full border rounded"
                  >
                    <option value="En attente">En attente</option>
                    <option value="Confirmé">Confirmé</option>
                    <option value="Annulé">Annulé</option>
                    <option value="Valide">Valide</option>
                  </Field>
                  <ErrorMessage name="ETAT" component="div" className="text-red-500 text-sm" />
                </div>
                {/* Date de Vente */}
                <div>
                  <label className="block text-gray-700">Date de Vente:</label>
                  <Field
                    type="date"
                    name="DATE DE VENTE"
                    className="mt-1 p-2 w-full border rounded"
                    required
                  />
                  <ErrorMessage name="DATE DE VENTE" component="div" className="text-red-500 text-sm" />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {isSubmitting ? "Sauvegarde en cours..." : "Sauvegarder les Modifications"}
              </button>
            </Form>
          )}
        </Formik>

        {/* Affichage du PDF Dynamique */}
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-center">Aperçu PDF</h2>
          <div className="w-full h-[1650px] flex items-center justify-center border border-gray-300">
            <PDFViewer style={{ width: '100%', height: '100%' }}>
              <MyDocument sale={formData} />
            </PDFViewer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Test;