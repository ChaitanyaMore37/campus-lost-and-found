# Campus Lost and Found

A small full-stack mini project by **Chaitanya More**, roll no. **50**, class/division **IT-A**.

Students often lose bottles, calculators, notebooks, and other items around campus. This app keeps lost and found notices in one searchable place. It uses plain HTML, CSS and JavaScript, an Express REST API, and a real MongoDB database.

## Requirements

- Node.js 22 or newer (npm is included)
- MongoDB Community Server 7 or newer, with `mongod` available in your terminal
- A modern web browser
- Internet only for installation; after installation the local demo works offline

Install Node.js from https://nodejs.org/en/download and MongoDB using the instructions for your operating system at https://www.mongodb.com/docs/manual/administration/install-community/ . On Windows, add the MongoDB Server `bin` directory to PATH if `mongod --version` is not recognized. Restart the terminal after installing.

## Quick start

Open a terminal in this project folder, then run:

```sh
npm ci
npm run demo
```

Open **http://127.0.0.1:3000**. Keep the terminal open while using the app. Press **Ctrl+C** to stop it.

The demo command starts MongoDB on port **27028** and the web app on port **3000**. Its records are stored in `.data/mongodb` inside this project. Restarting the demo keeps them. The folder is excluded from the submission ZIP and Git.

To add six fictional example notices, keep the demo running and use another terminal in this same folder:

```sh
npm run seed
```

The seed is optional. It does not replace existing notices, and running it twice does not duplicate the examples.

## How to use it

1. Click **Report an item**, choose Lost or Found, and fill in the details.
2. Use a campus desk or collection point in the contact field.
3. Click **Save report**. The notice and counters update.
4. Search by item name, description, or location. Combine type and status filters.
5. Use **Edit** to change a report. Use **Mark returned** when the item is back with its owner.
6. Use **Delete** to remove a report; confirm the prompt. Use **Reset** to clear filters.
7. To reopen a returned report, select **Edit**, change Status to Open, and save.

Counts show all records: Lost and Found count only open notices; Returned counts both types. Filters affect the displayed cards, not the totals.

## Existing MongoDB server

If MongoDB is already running on its standard port 27017, use:

```sh
npm start
```

Optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| MONGODB_URI | mongodb://127.0.0.1:27017 for `start` | Database connection |
| DB_NAME | campus_lost_found | Database name |
| PORT | 3000 | App port |
| DEMO_DB_PORT | 27028 | Isolated demo database port |
| MONGOD_BIN | mongod | MongoDB executable for `demo` |
| TEST_MONGODB_URI | mongodb://127.0.0.1:27028 | Test database connection |

`npm run demo` manages its own local connection and overrides MONGODB_URI. The seed defaults to port 27028; set MONGODB_URI when seeding a different server. No `.env` loader is used; set variables in your terminal.

macOS/Linux example: `PORT=3001 npm run demo`

PowerShell example: `$env:PORT="3001"; npm run demo`

## Tests

Keep `npm run demo` running, then run in another terminal:

```sh
npm test
```

The 11 integration tests cover empty data, create, read, search, filters, edit, status counters, server restart persistence, invalid inputs, invalid IDs, malformed JSON, cross-origin changes and deletion. They create a uniquely named `campus_test_*` database and delete only that test database afterwards. They do not change your demo records.

## Project structure

```text
app.js                 Express API, input validation and static files
server.js              MongoDB connection and server startup
public/index.html      Single-page interface and report form
public/style.css       Responsive layout
public/app.js          Fetch calls, filtering and safe DOM rendering
scripts/demo.js        Starts the local database and app together
scripts/seed.js        Adds optional fictional demo notices
test/api.test.js      Integration tests against real MongoDB
package-lock.json      Exact dependency versions for npm ci
VIVA_GUIDE.md           Short explanation and demonstration script
```

## Database

Database: `campus_lost_found`. Collection: `items`.

Each document has `_id` (ObjectId), `title`, `description`, `type` (Lost/Found), `location`, `contact`, `date` (YYYY-MM-DD), `status` (Open/Returned), `createdAt` and `updatedAt` (MongoDB dates). Validation happens on the server. There is one collection and no relationships to explain. MongoDB creates its normal unique `_id` index.

## REST API

| Method | Endpoint | Operation |
| --- | --- | --- |
| GET | /api/items?q=&type=all&status=all | List and search notices |
| GET | /api/stats | Global open lost, open found and returned totals |
| POST | /api/items | Create a notice |
| PUT | /api/items/:id | Replace editable fields |
| PATCH | /api/items/:id/status | Change Open/Returned status |
| DELETE | /api/items/:id | Delete a notice |

POST and PUT accept JSON with title, description, type, location, contact, date and status. A successful POST returns 201; updates return 200; deletion returns 204. Invalid input returns 400; missing items return 404.

## Scope and limitations

This is a local classroom demonstration without login or permissions. Anyone using the running local app can edit or delete notices. It binds to localhost and is not a public campus deployment. A public version would need authenticated users, record ownership, moderation, and deployment security. Matching and ownership verification are manual. There are no photos, messages, email notifications or automatic matching. Search scans records; pagination and indexes can be added for larger datasets.

## Troubleshooting

- **mongod not found:** install MongoDB Community Server, ensure its binary is on PATH, and reopen the terminal.
- **Port 3000 in use:** stop another instance, or set PORT=3001 using the syntax above.
- **Port 27028 already has a database:** stop the other demo, or choose DEMO_DB_PORT. Set the same port in MONGODB_URI for seed and TEST_MONGODB_URI for tests.
- **Database lock error:** only one demo should use this project folder's `.data/mongodb`. Stop the old instance before restarting. Do not delete database files while MongoDB runs.
- **Cannot connect using npm start:** start your MongoDB service first, or use `npm run demo`.
- **Missing dependencies:** run `npm ci` inside the project folder.
- **Server error or database startup failure:** check the terminal and `.data/mongodb/mongo.log`.

## References

- Express routing: https://expressjs.com/en/starter/basic-routing/
- MongoDB CRUD: https://www.mongodb.com/docs/drivers/node/current/crud/
- Browser Fetch API: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
