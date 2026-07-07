// Route désactivée : l'implémentation passport était cassée (API callback
// Mongoose supprimée en v7, stratégie 'user' jamais enregistrée) et
// renvoyait un 500 à chaque appel. La session se vérifie via /api/auth/me.
export default async function handler(req, res) {
  return res.status(501).send({ ok: false, code: 'NOT_IMPLEMENTED' });
}
