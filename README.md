# Nelson Community Tool Shed – WEB701 Web Technologies Project

The Nelson Community Tool Shed is a fictitious charity that runs a "tool library" for the Nelson region. Members (tool donors) list tools on the website, and beneficiaries (borrowers) use a limited balance of digital tokens to borrow them. This repository holds the WEB701 project work: the design (Milestone One), the comparison of five web frameworks (Milestone Two) and, later, the full website (Milestone Three).



## What is in this repository

Each folder is a working proof-of-concept prototype of the same three website requirements, built in a different framework (stack) so they can be compared:

- **R1** – Members and beneficiaries can register, log in and administer their own accounts, using JWT to transfer state.
- **R2** – Members can accept a token in a transaction (a beneficiary offers tokens for a tool, and the member accepts them), using JWT.
- **R3** – The system stores and retrieves user data (tools and transactions) in a real database.

| Folder | Stack | Database | Port | Notes |
|---|---|---|---|---|
| [`mern/`](mern) | MongoDB, Express, React, Node.js | MongoDB (Mongoose) | 5000 | **Recommended stack.** Includes the React PWA client in `mern/client` |
| [`mean/`](mean) | MongoDB, Express, Angular, Node.js | MongoDB (Mongoose) | 5001 | Express back end reused for an Angular front end |
| [`fastapi/`](fastapi) | Python FastAPI | SQLite via SQLAlchemy (PostgreSQL ready) | 8000 | Swagger UI at `/docs` |
| [`blazor/BlazorApi/`](blazor/BlazorApi) | .NET 8 / ASP.NET Core Minimal API (Blazor stack) | SQLite via Entity Framework Core | 3005 | Swagger UI at `/swagger` |
| [`sveltekit/`](sveltekit) | SvelteKit (Node.js) | MongoDB (official driver) | 5173 | File-based API routes in `src/routes/api` |

Every source file is commented to explain how it implements R1, R2 or R3. Look for the `[R1]`, `[R2]`, `[R3]` and `[PWA]` tags.

### Emerging technology – Progressive Web App (PWA)

The MERN prototype is a Progressive Web App. The files are:

- [`mern/client/public/manifest.webmanifest`](mern/client/public/manifest.webmanifest) – app name, icons, colours and shortcuts, which make the site installable.
- [`mern/client/public/service-worker.js`](mern/client/public/service-worker.js) – handles offline caching, push notifications and background sync.
- [`mern/client/src/pwa.js`](mern/client/src/pwa.js) – registers the service worker and handles the install button and push subscription.
- [`mern/utils/push.js`](mern/utils/push.js) and [`mern/routes/push.js`](mern/routes/push.js) – the server side of Web Push.

The PWA is used in four situations on the website:

1. **Offline browsing.** The tool catalogue, the user's token balance and their transactions are cached, so they still display with no connection.
2. **Install to home screen.** An "Install app" button adds the Tool Shed to a phone or desktop like a native app.
3. **Push notifications.** Members are notified of borrow requests, beneficiaries are notified when their token is accepted, and everyone is notified when a new tool is listed.
4. **Background sync.** A borrow request made while offline is queued and sent automatically when the device reconnects.

## Demo accounts

Each prototype seeds its database the first time it runs:

| Email | Password | Role |
|---|---|---|
| member@toolshed.nz | Password123 | Member (tool donor) |
| beneficiary@toolshed.nz | Password123 | Beneficiary (borrower, 5 tokens) |

## How to run

**Prerequisites:** Node.js 20 or later, Python 3.11 or later, the .NET 8 SDK, and MongoDB Community Server running on `mongodb://127.0.0.1:27017`. For MongoDB you can use a MongoDB Atlas connection string in `.env` instead.

```bash
# MERN (API + React PWA on http://localhost:5000)
cd mern
cp .env.example .env          # then edit JWT_SECRET (and VAPID keys: npx web-push generate-vapid-keys)
npm install
npm run client:install
npm run client:build
npm start

# MEAN API (http://localhost:5001)
cd mean && cp .env.example .env && npm install && npm start

# FastAPI (http://localhost:8000/docs)
cd fastapi
python -m venv venv
venv\Scripts\activate          # Windows  (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Blazor / .NET 8 (http://localhost:3005/swagger)
cd blazor/BlazorApi && dotnet run

# SvelteKit (http://localhost:5173/api/tools)
cd sveltekit && cp .env.example .env && npm install && npm run dev
```

## API summary (same in every prototype)

| Method | Endpoint | Auth | Requirement |
|---|---|---|---|
| POST | `/api/auth/register` | – | R1 |
| POST | `/api/auth/login` | – | R1 – returns a JWT |
| GET / PUT | `/api/auth/me` | JWT | R1 – view and update own account |
| GET | `/api/tools?q=&category=` | – | R3 |
| POST | `/api/tools` | JWT (member) | R3 |
| GET / PUT / DELETE | `/api/tools/:id` | JWT (member, owner) | R3 |
| POST | `/api/tools/:id/borrow` | JWT (beneficiary) | R2 – offer tokens |
| GET | `/api/borrowings` | JWT | R2 |
| POST | `/api/borrowings/:id/accept` | JWT (member) | R2 – **accept the token** |
| POST | `/api/borrowings/:id/return` | JWT (member) | R2 |

FastAPI uses snake_case JSON field names (for example `full_name` and `token_cost`), following Python conventions.

## Author

Siyara – WEB701 Web Technologies, NMIT, Semester 2 2026.
