"use client"; // Assurez-vous que ceci est la première ligne du fichier

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Page, Text, View, Document, StyleSheet,Image,Font } from '@react-pdf/renderer';
import { useParams, useSearchParams } from 'next/navigation';

const PDFViewer = dynamic(() => import('@react-pdf/renderer').then(mod => mod.PDFViewer), { ssr: false });

Font.register({
  family: 'Roboto',
  fonts: [
    { src: '../Roboto-Regular.ttf' }, // Roboto regular
    { src: '../Roboto-Bold.ttf', fontWeight: 'bold' }, // Roboto bold
  ],
});


const MyDocument = ({ sale }) => (
  <Document>
   <Page style={styles.page}>
      {/* Logo section (absolute positioning) */}
      <Image style={styles.logo} src="../logorenov.png" />

      {/* Header section */}
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Fiche de Pose</Text>
      </View>

      {/* Section Client à gauche */}
      <View style={styles.clientInfo}>
        <Text style={styles.subHeader}>Client:</Text>
        <Text style={styles.text}>Civilité: {sale.CIVILITE}</Text>
        <Text style={styles.text}>Nom: {sale["NOM DU CLIENT"]}</Text>
        <Text style={styles.text}>Prénom: {sale.prenom}</Text>
        <Text style={styles.text}>Adresse: {sale["ADRESSE DU CLIENT"]}, {sale.CP}</Text>
        <Text style={styles.text}>Bâtiment: {sale.BATIMENT}</Text>
        <Text style={styles.text}>Code: {sale.CODE}</Text>
        <Text style={styles.text}>Étage: {sale.ETAGE}</Text>
        <Text style={styles.text}>Ville: {sale.VILLE}</Text>
        <Text style={styles.text}>Téléphone: {sale.TELEPHONE}</Text>
        {/* <Text style={styles.text}>TEST: {sale["CODE INTERP etage"]}</Text> */}
      </View>

      {/* Nature des travaux et Délai d'intervention en gras */}
      <View style={styles.section}>
        <Text style={styles.boldText}>Nature des travaux: {sale.NATURE_TRAVAUX}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.boldText}>Délai d&apos;intervention: {sale.DELAI_INTERVENTION}</Text>
      </View>

      {/* Section Date du rendez-vous de PIT et Désignation des travaux alignées */}
      <View style={styles.row}>
        <View style={styles.pitInfo}>
          <Text style={styles.boldText}>Date du rendez-vous de PIT:</Text>
          <Text style={styles.text}>Jour: {sale.PIT_JOUR}</Text>
          <Text style={styles.text}>Mois: {sale.PIT_MOIS}</Text>
          <Text style={styles.text}>Année: {sale.PIT_ANNEE}</Text>

          <Text style={styles.boldText}>Date des travaux:</Text>
          <Text style={styles.text}>Jour: {sale.TRAVAUX_JOUR}</Text>
          <Text style={styles.text}>Mois: {sale.TRAVAUX_MOIS}</Text>
          <Text style={styles.text}>Année: {sale.TRAVAUX_ANNEE}</Text>
        </View>

        <View style={styles.designationInfo}>
          <Text style={styles.boldText}>Désignation des travaux:</Text>
          <Text style={styles.text}>Nature des travaux: {sale.NATURE_TRAVAUX}</Text>
          <Text style={styles.text}>Désignation: {sale.DESIGNATION}</Text>
          <Text style={styles.text}>Côte: {sale.COTE}</Text>
          <Text style={styles.text}>Surface: {sale.SURFACE}</Text>
          <Text style={styles.text}>Emplacement: {sale.EMPLACEMENT}</Text>
        </View>
      </View>

      {/* Vendeur en bas de la page en gras */}
      <View style={styles.vendeurInfo}>
        <Text style={styles.boldText}>Vendeur:</Text>
        <Text style={styles.text}>Nom: {sale.VENDEUR}</Text>
      </View>
    </Page>
  </Document>
);



const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    padding: 30,
    backgroundColor: '#ffffff', // Fond légèrement gris
  },
  headerContainer: {
    flexDirection: 'row', // To align the logo and text in one row
    justifyContent: 'center', // Center the text
    alignItems: 'center', // Align items vertically
    marginBottom: 20,
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center', // Center text horizontally
    flex: 1, // Ensures the text stays centered
  },
  logo: {
    position: 'absolute', // Absolute positioning to prevent layout disruption
    top: 10, // Positioning from the top of the page
    right: 10, // Positioning from the right of the page
    width: 155, // Set logo width to 155px
    height: 155, // Set logo height to 155px
  },
  subHeader: {
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'left',
    fontWeight: 'bold',
    color: '#333333',
  },
  text: {
    fontSize: 12,
    marginBottom: 5,
    fontFamily: 'Roboto', // Use Roboto regular for regular text
  },
  boldText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#333333',
    fontFamily: 'Roboto', // Use Roboto bold for bold text
    fontWeight: 'bold',
  },
  clientInfo: {
    marginBottom: 60,
    marginTop: 20,
    paddingBottom: 10,
  },
  section: {
    marginBottom: 60, // Espace entre les sections (ajustez si besoin)
  },
  travauxInfo: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  designationInfo: {
    width: '50%',
    alignSelf: 'flex-end',
    paddingLeft: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  vendeurInfo: {
    marginTop: 'auto',
    paddingTop: 10,
    textAlign: 'left',
    marginBottom: 20,
  },
  pitInfo: {
    width: '50%',
  },
});


const Test = () => {
  const { id } = useParams(); 
  const [sale, setSale] = useState(null);

  useEffect(() => {
    if (id) {
      const fetchSale = async () => {
        const response = await fetch(`/api/ventes/${id}`);
        const data = await response.json();
        setSale(data.data);
      };
      fetchSale();
    }
    // const fetchSale = async () => {
    //   const response = await fetch('/api/ventes/66702b1bd7aaf91d39e92cfe');
    //   const data = await response.json();
    //   setSale(data.data); // Assurez-vous que la structure de data est correcte
    // };
    // fetchSale();
  }, []);

  if (!sale) {
    return <p>Chargement des données...</p>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-4">
      <p>Fiche de pose</p>
      <div className="w-full h-[1650px] flex items-center justify-center">
        <PDFViewer style={{ width: '100%', height: '100%' }}>
          <MyDocument sale={sale} />
        </PDFViewer>
      </div>
    </main>
  );
}

export default Test;
