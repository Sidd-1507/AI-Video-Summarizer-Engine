const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');

async function run() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  console.log(`[Dev] Started mongodb-memory-server at ${uri}`);
  
  process.env.MONGODB_URI = uri;
  process.env.REDIS_URL = 'redis://localhost:6379'; // Dummy
  
  // Fake the firebase admin so it doesn't crash if missing
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const configPath = './src/config/firebase.js';
    const original = fs.readFileSync(configPath, 'utf8');
    fs.writeFileSync(configPath, original.replace('admin.initializeApp(', 'console.log("[Firebase] stubbed"); //admin.initializeApp('));
    
    setTimeout(() => {
      fs.writeFileSync(configPath, original);
    }, 5000);
  }

  require('./src/server.js');
}

run();
