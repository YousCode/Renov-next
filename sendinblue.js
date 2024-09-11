import fetch from 'node-fetch';
import { SENDINBLUE_API_KEY } from './config';

// Fonction d'API pour Sendinblue
const api = async (path, options = {}) => {
  const res = await fetch(`https://api.sendinblue.com/v3${path}`, {
    ...options,
    headers: {
      'api-key': SENDINBLUE_API_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw res;
  const contentType = res.headers.raw()['content-type'];

  if (contentType && contentType.length && contentType[0].includes('application/json')) {
    return await res.json();
  }

  return await res.text();
};

// Fonction pour séparer l'email et le nom
function splitEmailAndName(email) {
  const regex = /(.*), (.*)/;
  const match = email.match(regex);
  if (match) {
    return { name: match[1], email: match[match.length - 1] };
  }
  return { email };
}

// Envoi d'un email
export async function sendEmail(htmlContent, { subject, sender, emailTo = [], attachment = null, params = null, tags = [], cc = [], replyTo }) {
  const body = { to: emailTo.map((email) => splitEmailAndName(email)), sender, htmlContent, subject };
  if (params) body.params = params;
  if (attachment) body.attachment = attachment;
  if (tags.length) body.tags = tags;
  if (cc.length) body.cc = cc.map((email) => splitEmailAndName(email));
  if (replyTo) body.replyTo = { email: replyTo };
  const response = await api('/smtp/email', { method: 'POST', body: JSON.stringify(body) });

  return response;
}

// Envoi d'un template d'email
export async function sendTemplate(id, { params, emailTo, cc, bcc, attachment } = {}) {
  const body = { templateId: parseInt(id) };
  if (emailTo) body.to = emailTo.map((email) => ({ email }));
  if (cc?.length) body.cc = cc;
  if (bcc?.length) body.bcc = bcc;
  if (params) body.params = params;
  if (attachment) body.attachment = attachment;
  const mail = await api('/smtp/email', { method: 'POST', body: JSON.stringify(body) });
  return mail;
}

// Création d'un contact
export async function createContact({ email, attributes, emailBlacklisted, smsBlacklisted, listIds, updateEnabled, smtpBlacklistSender } = {}) {
  const body = {
    email,
    attributes,
    emailBlacklisted,
    smsBlacklisted,
    listIds,
    updateEnabled,
    smtpBlacklistSender,
  };

  return await api('/contacts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// Suppression d'un contact
export async function deleteContact(id) {
  const identifier = typeof id === 'string' ? encodeURIComponent(id) : id;

  return await api(`/contacts/${identifier}`, {
    method: 'DELETE',
  });
}

// Mise à jour d'un contact
export async function updateContact(id, { attributes, emailBlacklisted, smsBlacklisted, listIds, unlinkListIds, smtpBlacklistSender } = {}) {
  const identifier = typeof id === 'string' ? encodeURIComponent(id) : id;

  const body = {
    attributes,
    emailBlacklisted,
    smsBlacklisted,
    listIds,
    unlinkListIds,
    smtpBlacklistSender,
  };

  return await api(`/contacts/${identifier}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

// Synchronisation des contacts
export async function sync(obj, type) {
  try {
    const user = JSON.parse(JSON.stringify(obj));

    if (!user) {
      console.log('ERROR WITH ', obj);
    }

    const email = user.email;

    const attributes = {};
    for (let i = 0; i < Object.keys(user).length; i++) {
      const key = Object.keys(user)[i];
      if (key.indexOf('_at') !== -1) {
        if (user[key]) {
          if (typeof user[key] === 'string') {
            attributes[key.toUpperCase()] = user[key].slice(0, 10);
          } else {
            console.log('WRONG', user[key]);
          }
        }
      } else {
        attributes[key.toUpperCase()] = user[key];
      }
    }

    attributes.FIRSTNAME && (attributes.PRENOM = attributes.FIRSTNAME);
    attributes.LASTNAME && (attributes.NOM = attributes.LASTNAME);
    attributes.TYPE = type.toUpperCase();
    attributes.REGISTRED = !!attributes.REGISTRED_AT;

    let listIds = attributes.TYPE === 'USER' ? [8] : [20];

    delete attributes.EMAIL;
    delete attributes.PASSWORD;
    delete attributes.__V;
    delete attributes._ID;
    delete attributes.LASTNAME;
    delete attributes.FIRSTNAME;

    const ok = await updateContact(email, { attributes, listIds });
    if (!ok) await createContact({ email, attributes, listIds });
  } catch (e) {
    console.log('error', e);
  }
}

// Désynchronisation des contacts
export async function unsync(obj) {
  try {
    await deleteContact(obj.email);
  } catch (e) {
    console.log("Can't delete in sendinblue", obj.email);
  }
}
