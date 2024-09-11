// import connectToDatabase from '../../../lib/mongodb';
// import User from '../../../models/user';
// import Workspace from '../../../models/workspace';
// import crypto from 'crypto';
// import { sendTemplate } from '../../../sendinblue.js'; // Assurez-vous d'avoir cette fonction utilitaire
// import { capture } from '../../../sentry.js'; // Assurez-vous d'avoir cette fonction utilitaire
// import passport from '../../../lib/passport';

// export default async function handler(req, res) {
//   await connectToDatabase();

//   passport.authenticate(['user', 'admin'], { session: false }, async (err, user, info) => {
//     if (err) return res.status(500).send({ ok: false, error: 'Authentication error' });
//     if (!user) return res.status(401).send({ ok: false, message: 'Unauthorized' });

//     try {
//       const body = {
//         email: (req.body.email || '').toLowerCase(),
//         workspace_id: user.workspace_id || req.body.workspace_id, // if created by admin
//         workspace_name: user.workspace_name || req.body.workspace_name, // if created by admin
//         name: req.body.name,
//         invitation_token: crypto.randomBytes(20).toString('hex'),
//         invitation_expires: Date.now() + 86400000 * 30, // 30 days
//         status: 'ACCEPTED', // TEMP setting it here
//       };

//       const newUser = await User.create(body);
//       await newUser.save();

//       const user_name = user._type === 'admin' ? "L'équipe Kolab" : user.name;

//       await sendTemplate(44, {
//         emailTo: [newUser.email],
//         params: {
//           name: newUser.name,
//           sender: user_name,
//           workspace_name: newUser.workspace_name,
//           cta: `${config.APP_URL}/auth/signup/${newUser.workspace_id}`,
//         },
//       });

//       return res.status(200).send({ ok: true, user: newUser });
//     } catch (error) {
//       if (error.code === 11000) return res.status(400).send({ ok: false, code: 'USER_ALREADY_REGISTERED' });
//       capture(error);
//       return res.status(500).send({ ok: false, error, code: 'SERVER_ERROR' });
//     }
//   })(req, res);
// }
