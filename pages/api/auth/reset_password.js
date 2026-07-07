// Route désactivée : l'implémentation passport était cassée (API callback
// Mongoose supprimée en v7, stratégie 'user' jamais enregistrée) et
// renvoyait un 500 à chaque appel. À réimplémenter avec une vérification
// du cookie JWT (comme /api/auth/me) lors de la refonte de l'authentification.
export default async function handler(req, res) {
  return res.status(501).send({ ok: false, code: 'NOT_IMPLEMENTED' });
}
