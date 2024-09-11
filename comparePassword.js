const bcrypt = require('bcryptjs');

const hashedPassword = '$2a$10$7ome1XGI/YlUZNnbBvgohuornPqugezG2N7eLKXslUOlLMEUup51i';
const plainPassword = '12Selego';

bcrypt.compare(plainPassword, hashedPassword, (err, isMatch) => {
  if (err) {
    console.error('Erreur lors de la comparaison des mots de passe:', err);
  } else {
    console.log('Les mots de passe correspondent:', isMatch);
  }
});


