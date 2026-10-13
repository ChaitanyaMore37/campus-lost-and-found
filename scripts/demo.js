// Starts an isolated local database and the web server with one command.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const root = fileURLToPath(new URL('../', import.meta.url));
const dbPath = fileURLToPath(new URL('../.data/mongodb', import.meta.url));
mkdirSync(dbPath, { recursive: true });
const dbPort = process.env.DEMO_DB_PORT || '27028';
const uri = `mongodb://127.0.0.1:${dbPort}`;
let server;
let stopping = false;
const probe = new MongoClient(uri, { serverSelectionTimeoutMS: 600 });
try {
  await probe.connect();
  console.error(`Port ${dbPort} already has a database. Stop the other demo or choose DEMO_DB_PORT.`);
  await probe.close(); process.exit(1);
} catch { await probe.close(); }
const mongo = spawn(process.env.MONGOD_BIN || 'mongod', ['--dbpath', dbPath, '--port', dbPort, '--bind_ip', '127.0.0.1', '--logpath', `${dbPath}/mongo.log`], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  server?.kill('SIGTERM');
  mongo.kill('SIGTERM');
  process.exitCode = code;
}
mongo.on('error', () => {
  console.error('MongoDB Community Server is required. Install it and make mongod available on PATH. See README.md.');
  stop(1);
});
mongo.on('exit', code => { if (!stopping) { console.error(`MongoDB stopped (${code}). Check .data/mongodb/mongo.log.`); stop(1); } });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
let connected = false;
for (let attempt = 0; attempt < 30 && !stopping; attempt++) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 500 });
  try { await client.connect(); connected = true; } catch { await new Promise(resolve => setTimeout(resolve, 300)); }
  finally { await client.close(); }
  if (connected) break;
}
if (!connected) { console.error('Database did not start. See README.md troubleshooting.'); stop(1); }
if (!stopping) {
  server = spawn(process.execPath, ['server.js'], { cwd: root, stdio: 'inherit', env: { ...process.env, MONGODB_URI: uri } });
  server.on('error', error => { console.error(error.message); stop(1); });
  server.on('exit', code => { if (!stopping) stop(code || 0); });
}
