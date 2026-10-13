import { MongoClient } from 'mongodb';
import { createApp } from './app.js';

const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 5000 });
try {
  await client.connect();
  const db = client.db(process.env.DB_NAME || 'campus_lost_found');
  const port = Number(process.env.PORT || 3000);
  const server = createApp(db).listen(port, '127.0.0.1', () => console.log(`Campus Lost and Found: http://127.0.0.1:${port}`));
  server.on('error', async error => { console.error(error.message); await client.close(); process.exit(1); });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    server.close(async () => { await client.close(); process.exit(0); });
  });
} catch (error) {
  console.error('Could not connect to MongoDB. Start MongoDB first, or use npm run demo.');
  console.error(error.message);
  await client.close();
  process.exit(1);
}
