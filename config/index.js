const config = {
    // même secret que lib/auth.js ; le fallback disparaîtra quand JWT_SECRET
    // sera défini sur Vercel (toutes les sessions seront alors invalidées une fois)
    secret: process.env.JWT_SECRET || process.env.SECRET_KEY || 'YOUR_SECRET_KEY',
    ENVIRONMENT: process.env.NODE_ENV,
    

  };
  
  export default config;
  