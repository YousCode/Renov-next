import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN, // Remplacez par votre DSN Sentry
  tracesSampleRate: 1.0,
});

export default Sentry;
