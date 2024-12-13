import mongoose from 'mongoose';

const venteSchema = new mongoose.Schema({
  "DATE DE VENTE": { type: Date, required: true },
  "CIVILITE": { type: String },
  "NOM DU CLIENT": { type: String, required: true },
  "prenom": { type: String },
  "NUMERO BC": { type: String, required: true },
  "TE": { type: String },
  "ADRESSE DU CLIENT": { type: String },
  "CODE INTERP etage": { type: String },
  "VILLE": { type: String },
  "CP": { type: String },
  "TELEPHONE": { type: String },
  "VENDEUR": { type: String },
  "DESIGNATION": { type: String },
  "TAUX TVA": { type: Number },
  "COMISSION SOLO": { type: Number },
  "MONTANT TTC": { type: Number },
  "MONTANT HT": { type: Number },
  "MONTANT ANNULE": { type: Number },
  "CA MENSUEL": { type: Number },
  "ETAT": { type: String },
  "Barème COM": { type: Number }, 
  "Montant commissions en €": { type: Number }, 
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Middleware `pre` pour valider et transformer `NUMERO BC`
venteSchema.pre('save', function(next) {
  if (this.isModified('NUMERO BC')) {
    const numeroBC = this['NUMERO BC'].toString();
    this['NUMERO BC'] = numeroBC.replace(/\s/g, '').padStart(6, '0');
    if (!/^\d{6}$/.test(this['NUMERO BC'])) {
      return next(new Error('NUMERO BC doit être au format numérique à 6 chiffres'));
    }
  }
  next();
});

// Middleware pour calculer automatiquement `Montant commissions en €`
venteSchema.pre('save', function(next) {
  if (this.isModified('Barème COM') || this.isModified('MONTANT HT')) {
    const baremeCOM = this["Barème COM"] || 0; 
    const montantHT = this["MONTANT HT"] || 0; 

    // Calcul de la commission en fonction du barème et du montant HT
    this["Montant commissions en €"] = (baremeCOM / 100) * montantHT;
  }
  next();
});

const Vente = mongoose.models.Vente || mongoose.model('Vente', venteSchema);
export default Vente;