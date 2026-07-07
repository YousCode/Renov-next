const Sentry = require("@sentry/node");
// config/index.js est un module ESM (export default) : sous le bundler Next,
// la valeur atterrit sur .default — sans ce fallback, ENVIRONMENT était
// toujours undefined et Sentry.init ne tournait jamais en production
const configModule = require("./config");
const config = configModule.default || configModule;

const SENTRY_DSN = process.env.SENTRY_DSN || "https://1b10c07b6dbfca8fa04ac9cbab4aab83@sentry.selego.co/81";

if (config.ENVIRONMENT === "production" && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: "server",
  });
}

function capture(err) {
  console.error("capture", err);
  if (Sentry && err) {
    Sentry.captureException(err);
  }
}

module.exports = {
  capture,
};
