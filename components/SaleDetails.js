"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image,
  Font,
} from "@react-pdf/renderer";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  { ssr: false }
);

Font.register({
  family: "Roboto",
  fonts: [
    { src: "../../Roboto-Regular.ttf" },
    { src: "../../Roboto-Bold.ttf", fontWeight: "bold" },
  ],
});

// Fonction pour formater les dates au format français
const formatDateFR = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const MyDocument = ({ sale }) => (
  <Document>
    <Page style={styles.page}>
      {/* Logo et en-tête */}
      <View style={styles.logoHeaderContainer}>
        <Image style={styles.logo} src="../../logorenov.png" />
        <View style={styles.logoTextContainer}>
          <Text style={styles.logoText}>Facture</Text>
          <Text style={styles.logoText}>Poseur</Text>
        </View>
      </View>

      {/* Contenu principal */}
      <View style={styles.mainContent}>
        {/* Titre */}
        <View style={styles.headerContainer}>
          <Text style={styles.header}>FICHE CLIENT</Text>
        </View>

        {/* Informations Client */}
        <View style={styles.clientInfo}>
          <Text style={styles.green}>
            Date de vente: {formatDateFR(sale["DATE DE VENTE"])}
          </Text>
          <Text style={styles.green}>
            Bon de commande N°: {sale["NUMERO BC"] || ""}
          </Text>
          <Text style={styles.text}>
            Civilité: {sale.CIVILITE || ""}
          </Text>
          <Text style={styles.textB}>
            Nom: {sale["NOM DU CLIENT"] || ""}
          </Text>
          <Text style={styles.textB}>
            Prénom: {sale.prenom || ""}
          </Text>
          <Text style={styles.text}>
            Adresse: {sale["ADRESSE DU CLIENT"] || ""},{" "}
            {sale.CP || ""}
          </Text>
          <Text style={styles.text}>Ville: {sale.VILLE || ""}</Text>
          <Text style={styles.text}>
            Bâtiment, Code, Étage: {sale["CODE INTERP etage"] || ""}
          </Text>
          <Text style={styles.text}>
            Téléphone: {sale.TELEPHONE || ""}
          </Text>
        </View>

        {/* Nature des travaux */}
        <View style={styles.section}>
          <Text style={styles.boldText}>
            Nature des travaux: {sale.DESIGNATION || ""}
          </Text>
        </View>

        {/* Délai d'intervention */}
        <View style={styles.section}>
          <Text style={styles.boldText}>
            Délai d&apos;intervention: {formatDateFR(sale.DELAI_INTERVENTION)}
          </Text>
        </View>

        {/* Dates supplémentaires */}
        <View style={styles.row}>
          <View style={styles.section}>
            <Text style={styles.boldText}>
              Date du rendez-vous de PIT: {formatDateFR(sale["DATE PIT"])}
            </Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.boldText}>
              Date des travaux: {formatDateFR(sale["DATE TRAVAUX"])}
            </Text>
          </View>
        </View>

        {/* Tableau des travaux */}
        <View style={styles.section}>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={[styles.tableColHeader, styles.tableColDesignation]}>
                <Text style={styles.tableCellHeader}>
                  Désignation des travaux:
                </Text>
              </View>
              <View style={[styles.tableColHeader, styles.tableColQte]}>
                <Text style={styles.tableCellHeader}>Qté</Text>
              </View>
              <View
                style={[
                  styles.tableColHeader,
                  styles.tableColSurfaceEmplacement,
                ]}
              >
                <Text style={styles.tableCellHeader}>Surface</Text>
              </View>
              <View
                style={[
                  styles.tableColHeader,
                  styles.tableColSurfaceEmplacement,
                ]}
              >
                <Text style={styles.tableCellHeader}>Emplacement</Text>
              </View>
            </View>
            <View style={styles.tableRow}>
              <View style={[styles.tableCol, styles.tableColDesignation]}>
                <Text style={styles.tableCell}>
                  {sale.DESIGNATION || ""}
                </Text>
              </View>
              <View style={[styles.tableCol, styles.tableColQte]}>
                <Text style={styles.tableCell}>{sale.qte || ""}</Text>
              </View>
              <View
                style={[styles.tableCol, styles.tableColSurfaceEmplacement]}
              >
                <Text style={styles.tableCell}>
                  {sale.SURFACE || ""}
                </Text>
              </View>
              <View
                style={[styles.tableCol, styles.tableColSurfaceEmplacement]}
              >
                <Text style={styles.tableCell}>
                  {sale.EMPLACEMENT || ""}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bannière et informations du vendeur */}
        <View style={styles.bannerContainer}>
          <Image style={styles.bannerImage} src="../../important.jpg" />
        </View>
        <View style={styles.vendeurInfo}>
          <Text style={styles.VENDEURText}>
            VENDEUR: {sale.VENDEUR || ""}
          </Text>
        </View>
      </View>
    </Page>
  </Document>
);

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
  },
  logoHeaderContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0, // Ensure it stretches across the top
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between", // Space between the image and the text container
    padding: 10,
  },
  logo: {
    width: 120,
    height: 120,
  },
  logoTextContainer: {
    flexDirection: "column",
    justifyContent: "space-between", // Space between the two texts
    height: 80, // Match the height of the logo
    paddingRight: 120,
  },
  logoText: {
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: "Roboto",
  },
  mainContent: {
    marginTop: 110, // Adjust to avoid overlapping with the logo header
    padding: 30,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "left",
    alignItems: "center",
    marginBottom: 0,
  },
  green: {
    fontSize: 14,
    color: "#217626",
    fontWeight: "bold",
    fontFamily: "Roboto",
    paddingLeft: 5,
  },
  header: {
    fontFamily: "Roboto",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "left",
    flex: 1,
    backgroundColor: "#cccfcf",
    paddingLeft: 5,
  },
  text: {
    fontSize: 14,
    marginBottom: 5,
    paddingLeft: 5,
    fontFamily: "Roboto",
  },
  textB: {
    fontSize: 14,
    marginBottom: 5,
    fontFamily: "Roboto",
    fontWeight: "bold",
    paddingLeft: 5,
  },
  boldText: {
    marginBottom: 5,
    paddingLeft: 5,
    fontFamily: "Roboto",
    fontWeight: "bold",
    fontSize: 20,
    textAlign: "left",
    backgroundColor: "#cccfcf",
  },
  clientInfo: {
    paddingBottom: 0,
  },
  section: {
    marginBottom: 10,
  },
  travauxInfo: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
  },
  VENDEURText: {
    fontSize: 12,
    fontFamily: "Roboto",
    fontWeight: "bold",
  },
  table: {
    display: "table",
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    flexDirection: "row",
  },
  tableColHeader: {
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    backgroundColor: "#cccfcf",
    padding: 5,
    justifyContent: "flex-end",
  },
  tableCol: {
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 5,
    height: 50,
    justifyContent: "flex-end",
  },
  tableCellHeader: {
    fontSize: 12,
    fontFamily: "Roboto",
    fontWeight: "bold",
    textAlign: "center",
    verticalAlign: "bottom",
  },
  tableCell: {
    fontSize: 12,
    textAlign: "left",
    verticalAlign: "bottom",
  },
  tableColDesignation: {
    width: "45%",
  },
  tableColQte: {
    width: "10%",
  },
  tableColSurfaceEmplacement: {
    width: "22.5%",
  },
  bannerContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#000000",
    width: "100%",
    height: 90,
    padding: 5,
  },
  bannerImage: {
    height: 80,
    width: 90,
    // marginRight: 10,
  },
});

const Test = () => {
  const [sale, setSale] = useState(null);
  const { id } = useParams();

  useEffect(() => {
    if (id) {
      const fetchSale = async () => {
        const response = await fetch(`/api/ventes/${id}`);
        const data = await response.json();
        setSale(data.data);
      };
      fetchSale();
    }
  }, [id]);

  if (!sale) {
    return <p>Chargement des données...</p>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-4">
      <p>Fiche de Pose</p>
      <div className="w-full h-[1650px] flex items-center justify-center">
        <PDFViewer style={{ width: "100%", height: "100%" }}>
          <MyDocument sale={sale} />
        </PDFViewer>
      </div>
    </main>
  );
};

export default Test;
