// Route désactivée : l'envoi d'email (Sendinblue) a été retiré (commit 93bd38b)
// mais la route référençait encore `config` et `sendEmail` non importés,
// d'où un 500 à chaque appel. À réactiver quand un fournisseur d'email sera branché.
export default async function handler(req, res) {
  return res.status(501).send({ ok: false, code: 'NOT_IMPLEMENTED' });
}
