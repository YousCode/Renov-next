// Run once with: node scripts/createVenteIndexes.js
// Crée les index Mongo qui accélèrent la recherche et le tri des ventes.

require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI manquant dans .env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const ventes = db.collection("ventes");

  const tryCreate = async (spec, opts = {}) => {
    try { await ventes.createIndex(spec, opts); console.log("  + créé :", JSON.stringify(spec)); }
    catch (e) {
      if (e.code === 85 || e.code === 86) console.log("  · déjà présent :", JSON.stringify(spec));
      else throw e;
    }
  };

  // 1) Tri principal — toutes les listes trient par date desc.
  await tryCreate({ "DATE DE VENTE": -1 });

  // 2) Index text pour la recherche multi-champs (10–100× plus rapide qu'un $or regex).
  await tryCreate(
    {
      "NOM DU CLIENT":     "text",
      VENDEUR:             "text",
      TELEPHONE:           "text",
      "NUMERO BC":         "text",
      "ADRESSE DU CLIENT": "text",
      VILLE:               "text",
      DESIGNATION:         "text",
    },
    { name: "ventes_search_text", default_language: "french" },
  );

  // 3) Filtres fréquents.
  await tryCreate({ "NOM DU CLIENT": 1 });
  await tryCreate({ VENDEUR: 1 });

  const idx = await ventes.indexes();
  console.log("Index créés :");
  for (const i of idx) console.log(" -", i.name);

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
