"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import {
  Page, Text, View, Document, StyleSheet, Image, Font,
} from "@react-pdf/renderer";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then(m => m.PDFViewer),
  { ssr: false }
);

// ─────────────────────────────────────────────────────────────
// Enregistrement des polices (lazy, côté client uniquement)
// ─────────────────────────────────────────────────────────────
let fontsReady = false;
function ensureFonts() {
  if (fontsReady || typeof window === "undefined") return;
  const base = window.location.origin;
  Font.register({
    family: "Roboto",
    fonts: [
      { src: `${base}/Roboto-Regular.ttf` },
      { src: `${base}/Roboto-Bold.ttf`, fontWeight: "bold" },
    ],
  });
  fontsReady = true;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric" });
};

// ─────────────────────────────────────────────────────────────
// Document PDF
// ─────────────────────────────────────────────────────────────
export const MyDocument = ({ sale }) => {
  ensureFonts();
  const base = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <Document>
      <Page style={s.page}>

        {/* ── En-tête ── */}
        <View style={s.header}>
          <Image style={s.logo} src={`${base}/logorenov.png`} />
          <View style={s.headerText}>
            <Text style={s.headerLabel}>Facture</Text>
            <Text style={s.headerLabel}>Poseur</Text>
          </View>
        </View>

        {/* ── Corps ── */}
        <View style={s.body}>

          {/* Titre */}
          <View style={s.titleBar}>
            <Text style={s.title}>FICHE CLIENT</Text>
          </View>

          {/* Infos client */}
          <View style={s.clientBlock}>
            <Text style={s.green}>Date de vente : {fmtDate(sale["DATE DE VENTE"])}</Text>
            <Text style={s.green}>Bon de commande N° : {sale["NUMERO BC"] || ""}</Text>
            <Text style={s.line}>Civilité : {sale["CIVILITE"] || ""}</Text>
            <Text style={s.lineBold}>Nom : {sale["NOM DU CLIENT"] || ""}</Text>
            <Text style={s.lineBold}>Prénom : {sale["prenom"] || ""}</Text>
            <Text style={s.line}>Adresse : {sale["ADRESSE DU CLIENT"] || ""}{sale["CP"] ? `, ${sale["CP"]}` : ""}</Text>
            <Text style={s.line}>Ville : {sale["VILLE"] || ""}</Text>
            <Text style={s.line}>Bâtiment / Code / Étage : {sale["CODE INTERP etage"] || ""}</Text>
            <Text style={s.line}>Téléphone : {sale["TELEPHONE"] || ""}</Text>
          </View>

          {/* Nature des travaux */}
          <View style={s.sectionBar}>
            <Text style={s.sectionTitle}>Nature des travaux : {sale["DESIGNATION"] || ""}</Text>
          </View>

          {/* Délai */}
          <View style={s.sectionBar}>
            <Text style={s.sectionTitle}>Délai d'intervention : {fmtDate(sale["PREVISION CHANTIER"])}</Text>
          </View>

          {/* Dates PIT / Travaux */}
          <View style={s.row}>
            <View style={[s.sectionBar, { flex: 1, marginRight: 4 }]}>
              <Text style={s.sectionTitle}>Date RDV PIT : {fmtDate(sale["DATE PIT"])}</Text>
            </View>
            <View style={[s.sectionBar, { flex: 1, marginLeft: 4 }]}>
              <Text style={s.sectionTitle}>Date des travaux : {fmtDate(sale["DATE TRAVAUX"])}</Text>
            </View>
          </View>

          {/* Tableau travaux */}
          <View style={s.table}>
            <View style={s.tableHead}>
              <Text style={[s.cell, s.cellWide]}>Désignation des travaux :</Text>
              <Text style={s.cell}>Qté</Text>
              <Text style={s.cell}>Surface</Text>
              <Text style={s.cell}>Emplacement</Text>
            </View>
            <View style={s.tableRow}>
              <Text style={[s.cellData, s.cellWide]}>{sale["DESIGNATION"] || ""}</Text>
              <Text style={s.cellData}>{sale["qte"] || ""}</Text>
              <Text style={s.cellData}>{sale["SURFACE"] || ""}</Text>
              <Text style={s.cellData}>{sale["EMPLACEMENT"] || ""}</Text>
            </View>
          </View>

          {/* Bannière importante */}
          <View style={s.banner}>
            <Image style={s.bannerImg} src={`${base}/important.jpg`} />
          </View>

          {/* Vendeur */}
          <View style={s.vendeurRow}>
            <Text style={s.vendeur}>VENDEUR : {sale["VENDEUR"] || ""}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page:        { backgroundColor: "#fff" },
  header:      { position:"absolute", top:0, left:0, right:0, flexDirection:"row", alignItems:"center", justifyContent:"space-between", padding:10 },
  logo:        { width:110, height:110 },
  headerText:  { flexDirection:"column", justifyContent:"space-between", height:70, paddingRight:110 },
  headerLabel: { fontSize:14, fontWeight:"bold", fontFamily:"Roboto" },

  body:        { marginTop:115, paddingHorizontal:30, paddingBottom:20 },

  titleBar:    { backgroundColor:"#cccfcf", marginBottom:6 },
  title:       { fontFamily:"Roboto", fontSize:22, fontWeight:"bold", paddingLeft:6, paddingVertical:2 },

  clientBlock: { marginBottom:8 },
  green:       { fontSize:13, color:"#217626", fontWeight:"bold", fontFamily:"Roboto", paddingLeft:5, marginBottom:2 },
  line:        { fontSize:13, fontFamily:"Roboto", paddingLeft:5, marginBottom:2 },
  lineBold:    { fontSize:13, fontFamily:"Roboto", fontWeight:"bold", paddingLeft:5, marginBottom:2 },

  sectionBar:  { backgroundColor:"#cccfcf", marginBottom:8, paddingVertical:3, paddingLeft:5 },
  sectionTitle:{ fontFamily:"Roboto", fontWeight:"bold", fontSize:16 },

  row:         { flexDirection:"row", marginBottom:8 },

  table:       { borderWidth:1, borderColor:"#ccc", marginBottom:10 },
  tableHead:   { flexDirection:"row", backgroundColor:"#cccfcf", borderBottomWidth:1, borderBottomColor:"#ccc" },
  tableRow:    { flexDirection:"row" },
  cell:        { flex:1, fontSize:11, fontFamily:"Roboto", fontWeight:"bold", textAlign:"center", padding:5, borderRightWidth:1, borderRightColor:"#ccc" },
  cellWide:    { flex:2.5 },
  cellData:    { flex:1, fontSize:11, fontFamily:"Roboto", padding:5, height:50, borderRightWidth:1, borderRightColor:"#ccc" },

  banner:      { borderWidth:1, borderColor:"#000", height:90, marginBottom:6, overflow:"hidden" },
  bannerImg:   { width:90, height:80, margin:5 },

  vendeurRow:  { paddingLeft:5 },
  vendeur:     { fontSize:12, fontFamily:"Roboto", fontWeight:"bold" },
});

// ─────────────────────────────────────────────────────────────
// Composant standalone (page /file/details/[id])
// ─────────────────────────────────────────────────────────────
const SaleDetails = () => {
  const { id } = useParams();
  const [sale, setSale] = useState(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/ventes/${id}`)
      .then(r => r.json())
      .then(d => setSale(d.data));
  }, [id]);

  if (!sale) return (
    <main className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </main>
  );

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-4 bg-gray-900">
      <p className="text-white font-semibold">Fiche de Pose</p>
      <div className="w-full h-[1650px]">
        <PDFViewer style={{ inlineSize:"100%", blockSize:"100%" }}>
          <MyDocument sale={sale} />
        </PDFViewer>
      </div>
    </main>
  );
};

export default SaleDetails;
