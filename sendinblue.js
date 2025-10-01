// sendinblue.js
import SibApiV3Sdk from "sib-api-v3-sdk";

const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications["api-key"];
apiKey.apiKey = process.env.SENDINBLUE_API_KEY; // clé depuis tes variables ENV Vercel

export const transacEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();