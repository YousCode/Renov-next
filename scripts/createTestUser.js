const connectToDatabase = require('../lib/mongodb');
const User = require('../models/user');

async function createTestUser() {
  await connectToDatabase();

  const email = 'test@example.com';
  const password = 'password123';
  const name = 'Test User';

  const user = new User({ email, password, name });
  await user.save();

  console.log('Test user created:', user);
}

createTestUser().catch(error => {
  console.error('Error creating test user:', error);
  process.exit(1);
});
