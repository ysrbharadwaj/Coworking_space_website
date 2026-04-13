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
cd backend
npm install
npm start
```

User frontend:

```bash
cd user-frontend
npm install
npm start
```

Admin frontend:

```bash
cd admin-frontend
npm install
npm start
```

