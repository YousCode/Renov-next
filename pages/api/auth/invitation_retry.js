// import connectToDatabase from '../../../lib/mongodb';
// import User from '../../../models/user';
// import Workspace from '../../../models/workspace';
// import crypto from 'crypto';
// import { sendEmail } from '../../../sendinblue.js'; // Assurez-vous d'avoir cette fonction utilitaire
// import { capture } from '../../../sentry.js'; // Assurez-vous d'avoir cette fonction utilitaire
// import { buildGenericTemplate } from '../../../emails.js'; // Assurez-vous d'avoir cette fonction utilitaire

// export default async function handler(req, res) {
//   await connectToDatabase();

//   if (req.method !== 'POST') {
//     res.setHeader('Allow', ['POST']);
//     return res.status(405).end(`Method ${req.method} Not Allowed`);
//   }

//   try {
//     const email = (req.body.email || '').trim().toLowerCase();
//     const user = await User.findOne({ email });

//     if (!user) return res.status(200).send({ ok: true });
//     if (user.registered_at) return res.status(200).send({ ok: false, code: 'USER_ALREADY_REGISTERED' });

//     const workspace = await Workspace.findById(user.workspace_id);
//     const invitation_token = crypto.randomBytes(20).toString('hex');
//     user.set({ invitation_token, invitation_expires: Date.now() + 86400000 * 14 });

//     const template = buildGenericTemplate({
//       title: `Bonjour ${user.name}`,
//       message: `Voici le lien pour activer votre invitation`,
//       cta_link: `${config.APP_URL}/auth/signup?token=${invitation_token}&workspace_id=${workspace._id}`,
//       cta_title: "ACCEPTER l'INVITATION",
//     });

//     await sendEmail(template, {
//       subject: "Kolab - Votre nouvelle invitation",
//       sender: { name: "Kolab", email: "contact@kolab.co" },
//       emailTo: [user.email],
//       tags: ["invitation_retry"],
//     });

//     await user.save();
//     return res.status(200).send({ ok: true });
//   } catch (error) {
//     capture(error);
//     return res.status(500).send({ ok: false, code: 'SERVER_ERROR' });
//   }
// }
