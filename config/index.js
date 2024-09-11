const config = {
    secret: process.env.SECRET_KEY || 'YOUR_SECRET_KEY',
    ENVIRONMENT: process.env.NODE_ENV,
    SENDINBLUE_API_KEY: process.env.SENDINBLUE_API_KEY, 

  };
  
  export default config;
  