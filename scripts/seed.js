import { MongoClient } from 'mongodb';
const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27028', { serverSelectionTimeoutMS: 5000 });
try {
  await client.connect();
  const items = client.db(process.env.DB_NAME || 'campus_lost_found').collection('items');
  // Stable IDs make reseeding safe; existing reports are never replaced.
  const examples = [
    ['Blue water bottle', 'Lost', 'Library, second floor', 'Steel bottle with a blue lid. Last seen near the reading tables.', 'Library help desk', 'Open'],
    ['Scientific calculator', 'Found', 'Computer lab 2', 'Black scientific calculator in a grey cover. Identify the model to collect it.', 'IT department office', 'Open'],
    ['Black umbrella', 'Found', 'Main entrance', 'A compact black umbrella left on the bench near the security cabin.', 'Security desk', 'Open'],
    ['Green notebook', 'Lost', 'Room A-204', 'Green spiral notebook with handwritten programming notes.', 'IT department office', 'Open'],
    ['Silver keychain', 'Found', 'Canteen', 'Two keys on a silver ring. The owner confirmed the identifying details.', 'Canteen counter', 'Returned'],
    ['Canvas pencil pouch', 'Found', 'Reading room', 'Beige pouch containing pens and pencils. Ask at the desk to identify it.', 'Library help desk', 'Open']
  ];
  const { ObjectId } = await import('mongodb');
  for (const [i, row] of examples.entries()) {
    const [title, type, location, description, contact, status] = row;
    const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    await items.updateOne({ _id: new ObjectId(`00000000000000000000000${i + 1}`) }, { $setOnInsert: { title, type, location, description, contact, status, date, createdAt: new Date(Date.now() - i * 1000), updatedAt: new Date() } }, { upsert: true });
  }
  console.log('Six fictional demo notices are available. Existing reports were preserved.');
} catch (error) { console.error('Seed failed. Start npm run demo first.', error.message); process.exitCode = 1; }
finally { await client.close(); }
