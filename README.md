# Co-Working Space Booking Platform

## Overview
This project is a full-stack co-working booking platform with:

- User frontend on `http://localhost:8080`
- Admin frontend on `http://localhost:8081`
- Backend API on `http://localhost:3001`
- Supabase (PostgreSQL) as the database

The platform supports authentication, booking holds, waitlist automation, QR-based entry, dynamic pricing, and EmailJS notification events.

## Current Feature Set

### User Features
- Sign up/login with JWT auth
- Browse hubs and workspaces
- Dynamic pricing breakdown
- Resource add-ons per booking
- Real-time availability checks
- Slot hold before payment to prevent race conditions
- Waitlist join/leave for blocked slots
- Payment flow with booking confirmation
- Booking detail page with QR code
- Booking cancellation

### Admin Features
- Admin login route and protected admin APIs
- Dashboard and CRUD for hubs/workspaces/resources/pricing
- Booking and transaction views
- QR scanner page with camera/manual scan
- Check-in marking (`checked_in`) via QR scan
- Waitlist management screen

### Backend Features
- Express REST API
- Supabase integration
- Dynamic pricing engine
- Hold and slot-lock workflow
- Waitlist promotion workflow
- QR generation, retrieval, and scan validation
- EmailJS event emails (confirmation and reminder; thank-you optional)

## Architecture

```
User Frontend (8080)  ---->
                          Backend API (3001) ----> Supabase PostgreSQL
Admin Frontend (8081) ---->
```

## Startup

### Option 1: User app + backend

- Windows: `start.bat` or `start.ps1`
- Mac/Linux/Git Bash: `./start.sh`

Starts:
- Backend (`3001`)
- User frontend (`8080`)

### Option 2: Admin app + backend

- Windows: `start-admin.bat`
- Mac/Linux/Git Bash: `./start-admin.sh`

Starts:
- Backend (`3001`)
- Admin frontend (`8081`)

### Option 3: Manual start

Backend:

```bash
## Overview
This project is a full-stack co-working booking platform with:

- User frontend on `http://localhost:8080`
- Admin frontend on `http://localhost:8081`
- Backend API on `http://localhost:3001`
- Supabase (PostgreSQL) as the database

The platform supports authentication, booking holds, waitlist automation, QR-based entry, dynamic pricing, and EmailJS notification events.

## Current Feature Set

### User Features
- Sign up/login with JWT auth
- Browse hubs and workspaces
- Dynamic pricing breakdown
- Resource add-ons per booking
- Real-time availability checks
- Slot hold before payment to prevent race conditions
- Waitlist join/leave for blocked slots
- Payment flow with booking confirmation
- Booking detail page with QR code
- Booking cancellation

### Admin Features
- Admin login route and protected admin APIs
- Dashboard and CRUD for hubs/workspaces/resources/pricing
- Booking and transaction views
- QR scanner page with camera/manual scan
- Check-in marking (`checked_in`) via QR scan
- Waitlist management screen

### Backend Features
- Express REST API
- Supabase integration
- Dynamic pricing engine
- Hold and slot-lock workflow
- Waitlist promotion workflow
- QR generation, retrieval, and scan validation
- EmailJS event emails (confirmation and reminder; thank-you optional)

## Architecture

```
User Frontend (8080)  ---->
                          Backend API (3001) ----> Supabase PostgreSQL
Admin Frontend (8081) ---->
```

## Startup

### Option 1: User app + backend

- Windows: `start.bat` or `start.ps1`
- Mac/Linux/Git Bash: `./start.sh`

Starts:
- Backend (`3001`)
- User frontend (`8080`)

### Option 2: Admin app + backend

- Windows: `start-admin.bat`
- Mac/Linux/Git Bash: `./start-admin.sh`

Starts:
- Backend (`3001`)
- Admin frontend (`8081`)

### Option 3: Manual start

Backend:

```bash
cd backend
npm install
npm start
```

User frontend:
User frontend:

```bash
```bash
cd user-frontend
npm install
npm install
npm start
```

Admin frontend:

Admin frontend:

```bash
```bash
cd admin-frontend
npm install
npm install
npm start
```

## Environment Variables

Project root `.env`:

```env
PROJECT_URL=...
API_KEY=...
GOOGLE_CLIENT_ID=...

EMAILJS_SERVICE_ID=...
EMAILJS_PUBLIC_KEY=...
EMAILJS_PRIVATE_KEY=...
EMAILJS_TEMPLATE_BOOKING_CONFIRMATION=...
EMAILJS_TEMPLATE_DEADLINE_REMINDER=...
EMAILJS_TEMPLATE_THANK_YOU=...
BOOKING_DEADLINE_REMINDER_MINUTES=30
BOOKING_EMAIL_JOB_INTERVAL_MS=300000
```

Notes:
- Leaving `EMAILJS_TEMPLATE_THANK_YOU` empty disables thank-you emails.
- Reminder mail scheduling runs from backend startup.

## Recent Changes Included

### Booking Hold and Waitlist
- Added slot holds before payment (`/api/bookings/holds`)
- Added user waitlist APIs:
  - `POST /api/bookings/waitlist`
  - `GET /api/bookings/waitlist/my`
  - `DELETE /api/bookings/waitlist/:id`
- Added admin waitlist APIs:
  - `GET /api/bookings/waitlist`
  - `POST /api/bookings/waitlist/:id/reorder`
  - `POST /api/bookings/waitlist/:id/promote`

### QR Workflow
- Deterministic booking QR value support (`BOOKING-<id>`)
- Flexible scan payload parsing
- Admin-protected QR scan endpoint
- Check-in state transition to `checked_in`
- Admin scanner UI and manual fallback handling

### EmailJS Event Emails
- Added backend EmailJS sender service
- Added booking confirmation email trigger after successful booking
- Added scheduled deadline reminder job
- Added optional completion thank-you job
- Added dedupe event tracking table migration

### Validation and Compatibility Fixes
- Fixed booking form datetime validation precision
- Improved booking form validation error feedback
- Backward compatibility for DBs without `bookings.payment_status`

## Database Migrations

Run these in Supabase SQL editor as needed for current features:

- `database/migration-booking-holds-and-slot-locks.sql`
- `database/migration-booking-waitlist.sql`
- `database/migration-email-events.sql`

Core schema file:

- `database/schema.sql`

## API Summary

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/admin-login`

### Hubs/Workspaces/Resources
- `GET /api/hubs`
- `GET /api/workspaces`
- `GET /api/resources`

### Pricing
- `POST /api/pricing/calculate`

### Bookings
- `POST /api/bookings/availability`
- `POST /api/bookings/holds`
- `DELETE /api/bookings/holds/:holdToken`
- `POST /api/bookings`
- `GET /api/bookings/my`
- `PATCH /api/bookings/:id/status`

### Waitlist
- `POST /api/bookings/waitlist`
- `GET /api/bookings/waitlist/my`
- `DELETE /api/bookings/waitlist/:id`
- `GET /api/bookings/waitlist` (admin)
- `POST /api/bookings/waitlist/:id/reorder` (admin)
- `POST /api/bookings/waitlist/:id/promote` (admin)

### QR
- `POST /api/qr/generate/:booking_id`
- `GET /api/qr/booking/:booking_id`
- `POST /api/qr/scan` (admin)
- `GET /api/qr` (admin)

## Email Event Behavior

### Confirmation Email
- Triggered after successful booking creation.
- Includes booking metadata and QR image.

### Deadline Reminder Email
- Triggered by scheduler.
- Criteria:
  - booking status is `confirmed` or `checked_in`
  - booking `end_time` is within reminder window.

### Thank-You Email
- Triggered for `completed` bookings only when thank-you template is configured.

### Dedupe
- Sent events are tracked in `booking_email_events`.
- Each `booking_id + event_type` is sent once.

## Troubleshooting

### Port already in use (`EADDRINUSE`)
- Stop processes on ports `3001`, `8080`, `8081` before restart.
- Avoid running multiple startup scripts at the same time.

### CORS or 426 response on backend URL
- Ensure backend Express process is the one bound to `3001`.
- Verify `http://localhost:3001/health` returns JSON from this project.

### Email not sending
- Confirm EmailJS keys/template IDs in `.env`.
- Ensure EmailJS account security allows backend/API usage.
- Check backend logs for EmailJS error details.

## Repository Structure

```text
backend/
  routes/
  services/
  utils/
  server.js
admin-frontend/
  *.html
  js/
user-frontend/
  *.html
  js/
database/
  schema.sql
  migration-*.sql
start.bat|start.ps1|start.sh
start-admin.bat|start-admin.sh
```