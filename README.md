# Internal Mobility Desk

A role based campus transit app for managing one shared Toto between College, Station and Office.

## Run locally

1. Install Node.js 20.9+ and MongoDB Atlas access.
2. Copy `.env.example` to `.env.local` and set `MONGODB_URI`, `MONGODB_DB`, and a random `AUTH_SECRET` (at least 32 characters).
3. Run `npm install`, then `npm run seed` to create demo accounts.
4. Run `npm run dev` and open http://localhost:3000.

Demo accounts (seeded only when you run the seed command):

| Role | Email | Password |
| --- | --- | --- |
| Student | rahul@campus.demo | RideDemo2026! |
| Employee | priya@campus.demo | RideDemo2026! |
| Rider | ravi@campus.demo | RideDemo2026! |

## Features

- HttpOnly signed session cookies and bcrypt password hashes.
- MongoDB Atlas stores users and trips; server routes enforce roles.
- Rider accepts requests; same date/time requests are marked clashed.
- Per passenger boarding records; completion moves unfinished passengers to missed and retains the trip.
- Personal history includes passenger membership by user id or exact passenger name. Rider history includes all trips.
- Mobility Copilot answers common history and dispatch queries from database records.
- AI is optional; core trip functions do not depend on an AI provider.

## Configuration

See `.env.example`. No secrets belong in source control. Production requires a configured MongoDB URI. The MVP Copilot uses controlled server-side query logic and does not send private trip data to an external AI provider.
