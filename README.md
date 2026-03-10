# Co-Working Space Booking Platform

## 🚀 Quick Start

**Start both servers with one command:**

### Windows
```bash
start.bat          # Batch file (double-click or run in CMD)
# OR
.\start.ps1        # PowerShell script
```

### Mac/Linux/Git Bash
```bash
chmod +x start.sh  # First time only
./start.sh
```

This will:
- ✅ Start Backend (http://localhost:3001)
- ✅ Start Frontend (http://localhost:8080)
- ✅ Open browser with smart redirect:
  - **Not logged in** → Redirects to login page
  - **Logged in** → Redirects to home page
- ✅ Checks localStorage for authentication status

📖 **See [README_STARTUP.md](README_STARTUP.md) for detailed startup instructions**

---

## System Design Overview

### Architecture Pattern
**3-Tier Architecture**
```
┌─────────────────────────────────────────────────────────┐
│                  Presentation Layer                      │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │   User Frontend      │  │   Admin Frontend         │ │
│  │  (HTML/CSS/JS)       │  │   (HTML/CSS/JS)          │ │
│  │  Port: 8080          │  │   Port: 8081             │ │
│  └──────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓ HTTP/REST
┌─────────────────────────────────────────────────────────┐
│                   Business Logic Layer                   │
│  ┌─────────────────────────────────────────────────────┐ │
│  │         Node.js + Express.js Backend                │ │
│  │              Port: 3001                             │ │
│  │  ┌──────────────┐  ┌──────────────────────────┐   │ │
│  │  │   Routes     │  │   Business Logic         │   │ │
│  │  │              │  │                          │   │ │
│  │  │ • Hubs       │  │ • Dynamic Pricing        │   │ │
│  │  │ • Workspaces │  │ • Availability Check     │   │ │
│  │  │ • Bookings   │  │ • QR Generation          │   │ │
│  │  │ • Resources  │  │ • Resource Management    │   │ │
│  │  │ • Pricing    │  │ • Validation             │   │ │
│  │  │ • Ratings    │  │                          │   │ │
│  │  │ • QR Codes   │  │                          │   │ │
│  │  └──────────────┘  └──────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓ Supabase Client
┌─────────────────────────────────────────────────────────┐
│                    Data Access Layer                     │
│  ┌─────────────────────────────────────────────────────┐ │
│  │         Supabase (PostgreSQL 15)                    │ │
│  │                                                     │ │
│  │  ┌──────────────────────────────────────────────┐ │ │
│  │  │  9 Tables:                                   │ │ │
│  │  │  • working_hubs      • pricing_rules        │ │ │
│  │  │  • workspaces        • qr_codes             │ │ │
│  │  │  • resources         • time_slots           │ │ │
│  │  │  • bookings          • ratings              │ │ │
│  │  │  • booking_resources                        │ │ │
│  │  └──────────────────────────────────────────────┘ │ │
│  │                                                     │ │
│  │  Features: Auto-generated REST API, Row-Level      │ │
│  │  Security, Real-time subscriptions, Backups        │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## System Components

### 1. Frontend Applications

#### User Frontend (Port 8080)
**Technology**: Vanilla JavaScript, HTML5, CSS3 (No frameworks)

**Key Features**:
- Hub-first navigation (browse hubs → select hub → view workspaces)
- Advanced filtering (type, capacity, availability, city)
- Real-time dynamic pricing display
- Resource selection with quantity
- Booking management (view, cancel)
- QR code display for check-in
- Responsive design with professional color scheme

**State Management**:
```javascript
// Global state variables
currentHub          // Selected working hub
allHubs             // All available hubs
allWorkspaces       // Workspaces for current hub
currentWorkspace    // Workspace being booked
selectedResources   // Array of {id, price, quantity, name}
selectedPaymentMethod // Payment method selection
currentBookingData  // Booking being processed
```

**Page Flow**:
```
Home → Find Spaces → Hub Selection → Workspace Browse → 
Book Modal → Payment Modal → Success → My Bookings
```

#### Admin Frontend (Port 8081)
**Technology**: Vanilla JavaScript, HTML5, CSS3

**Key Features**:
- Dashboard with statistics
- CRUD operations for hubs, workspaces, resources
- Booking management and monitoring
- Pricing rule configuration
- QR code tracking

---

### 2. Backend API (Port 3001)

#### Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js 4.18.2
- **Database Client**: @supabase/supabase-js 2.39.0
- **QR Generation**: qrcode library
- **Environment**: dotenv for configuration
- **CORS**: Enabled for cross-origin requests

#### API Design Pattern
**RESTful API** with consistent response format:
```json
{
  "success": true | false,
  "data": { ... },
  "error": "error message" // only if success = false
}
```

#### Route Structure
```
/api
├── /hubs                   # Hub management
├── /workspaces             # Workspace CRUD & search
├── /resources              # Resource management
├── /bookings               # Booking lifecycle
├── /pricing                # Dynamic pricing engine
│   └── /calculate          # Price calculation endpoint
├── /ratings                # User reviews
└── /qr                     # QR code generation
    ├── /generate/:id
    └── /booking/:id
```

#### Business Logic Modules

**1. Dynamic Pricing Engine** (`backend/utils/pricing.js`)
```javascript
calculateDynamicPrice(workspace_id, base_price, start_time, end_time, booking_type)
```
**Logic**:
- Base price calculation (hourly/daily/monthly)
- Workday premium (+8%): Monday-Friday bookings
- Occupancy surcharge (+5%): When >70% of hub workspaces booked
- Rating premium (+5%): Workspaces with avg rating ≥4.0
- Custom pricing rules from database

**Occupancy Calculation**:
```
1. Get total available workspaces in hub
2. Count unique workspaces with overlapping bookings
3. Occupancy Rate = (booked_workspaces / total_workspaces) × 100
4. If > 70%, apply +5% surcharge
```

**2. Availability Checker**
- Checks for overlapping bookings in same workspace
- Validates time range (end > start)
- Returns boolean availability status

**3. QR Code Generator**
- Generates unique QR code per booking
- Base64 encoded image stored in database
- Contains booking ID for validation

---

### 3. Database Layer (Supabase PostgreSQL)

#### Database Design Principles
- **Normalization**: 3NF (Third Normal Form)
- **Referential Integrity**: Foreign keys with CASCADE DELETE
- **Data Validation**: CHECK constraints for business rules
- **Indexing**: Strategic indexes for query optimization
- **Audit Trail**: created_at, updated_at timestamps

#### Entity Relationship Model
```
working_hubs (1) ─┬─ (M) workspaces ─┬─ (M) resources
                  │                  ├─ (M) bookings ─┬─ (1) qr_codes
                  │                  │                └─ (M) booking_resources ─ (M) resources
                  │                  ├─ (M) pricing_rules
                  │                  ├─ (M) time_slots
                  │                  └─ (M) ratings
```

**Cardinalities**:
- 1 Hub → Many Workspaces (1:M)
- 1 Workspace → Many Bookings (1:M)
- 1 Workspace → Many Resources (1:M)
- 1 Booking → 1 QR Code (1:1)
- Bookings ↔ Resources (M:M via booking_resources)

#### Key Tables

**working_hubs**: Hub locations
- Stores: name, city, address, amenities, contact info
- Index on: city (for location filtering)

**workspaces**: Bookable spaces
- Stores: type, capacity, base_price, is_available
- Foreign Key: hub_id → working_hubs
- Index on: hub_id, type, is_available

**bookings**: Reservation records
- Stores: workspace_id, user_name, start/end_time, status, total_price
- Status values: confirmed, checked_in, completed, cancelled
- Constraint: end_time > start_time
- Indexes: workspace_id, status, (workspace_id, start_time, end_time)

**ratings**: User reviews
- Stores: workspace_id, user_name, rating (1-5), review
- Used for dynamic pricing (+5% if avg ≥4.0)

---

## Data Flow Diagrams

### 1. Booking Creation Flow
```
User Frontend
    │
    ├─ User selects hub
    ├─ Filters workspaces
    ├─ Selects workspace & dates
    │
    ▼
POST /api/pricing/calculate
    │
    ├─ Calculate base price (hourly/daily/monthly)
    ├─ Check workday (Mon-Fri) → +8%
    ├─ Check hub occupancy → +5% if >70%
    ├─ Check workspace rating → +5% if ≥4.0
    │
    ▼
Response: final_price, breakdown, modifiers
    │
    ▼
User Frontend
    │
    ├─ Display pricing breakdown
    ├─ User selects resources (quantity)
    ├─ Calculate resource cost (price × qty × hours)
    ├─ User confirms booking
    │
    ▼
POST /api/bookings
    │
    ├─ Validate: end_time > start_time
    ├─ Insert booking record (status: confirmed)
    ├─ Insert booking_resources records
    │
    ▼
POST /api/qr/generate/:booking_id
    │
    ├─ Generate QR code (Base64 image)
    ├─ Store in qr_codes table
    │
    ▼
Response: booking details + QR code
    │
    ▼
User Frontend
    │
    └─ Display success modal with QR code
```

### 2. Dynamic Pricing Flow
```
Frontend: User enters dates
    │
    ▼
Backend: Calculate base price
    │
    ├─ hourly: base_price × hours
    ├─ daily: base_price × 8
    └─ monthly: base_price × 8 × 22
    │
    ▼
Apply Workday Modifier
    │
    ├─ Check if Mon-Fri
    └─ Add 8% if true
    │
    ▼
Apply Occupancy Modifier
    │
    ├─ Query: Count booked workspaces in hub
    ├─ Calculate: (booked / total) × 100
    └─ Add 5% if > 70%
    │
    ▼
Apply Rating Modifier
    │
    ├─ Query: Get average rating
    └─ Add 5% if ≥ 4.0
    │
    ▼
Return: {final_price, breakdown, hours, occupancy_rate}
```

### 3. Workspace Availability Check
```
User selects workspace + dates
    │
    ▼
Query bookings table
    │
    ├─ WHERE workspace_id = X
    ├─ AND status IN ('confirmed', 'checked_in')
    ├─ AND start_time < requested_end_time
    └─ AND end_time > requested_start_time
    │
    ▼
If overlapping bookings found
    │
    ├─ Show "Currently Booked" badge (if now between start-end)
    └─ Show "Booked Soon" badge (if future booking)
    │
    ▼
Disable "Book Now" button
```

---

## Security & Validation

### Input Validation
**Frontend**:
- Date/time validation (end > start)
- Required field checks
- Email format validation
- Quantity limits (> 0)

**Backend**:
- Schema validation for all requests
- SQL injection prevention (Supabase parameterized queries)
- Type checking (integers, decimals, timestamps)
- Business rule validation

### Database Constraints
```sql
-- Booking time validation
CONSTRAINT valid_time_range CHECK (end_time > start_time)

-- Rating range
CONSTRAINT valid_rating CHECK (rating >= 1 AND rating <= 5)

-- Status validation
CONSTRAINT valid_status CHECK (status IN ('confirmed', 'checked_in', 'completed', 'cancelled'))
```

### API Security
- **Environment Variables**: Supabase credentials in .env (not committed)
- **CORS**: Configured for specific origins
- **Row Level Security**: Supabase RLS policies (can be enabled)
- **Rate Limiting**: Can be added via express-rate-limit

---

## Performance Optimization

### Database Optimization
**Indexes**:
```sql
-- Foreign keys (automatic)
CREATE INDEX idx_workspaces_hub_id ON workspaces(hub_id);
CREATE INDEX idx_bookings_workspace_id ON bookings(workspace_id);

-- Filter fields
CREATE INDEX idx_workspaces_type ON workspaces(type);
CREATE INDEX idx_workspaces_available ON workspaces(is_available);

-- Composite for overlap checks
CREATE INDEX idx_bookings_workspace_time 
ON bookings(workspace_id, start_time, end_time);
```

**Query Optimization**:
- SELECT only needed columns (not SELECT *)
- Use JOINs instead of multiple queries
- Limit result sets appropriately
- Use connection pooling (Supabase PgBouncer)

### Frontend Optimization
- Minimal framework overhead (vanilla JS)
- Lazy loading of workspaces (load per hub)
- Debounced search/filter functions
- Cached hub/workspace data in memory

### Backend Optimization
- Async/await for non-blocking I/O
- Single database connection pool
- Efficient pricing calculation (minimal queries)
- Response compression (can be added)

---

## Scalability Considerations

### Horizontal Scaling
- **Stateless API**: No session data in backend
- **Database Pooling**: Connection reuse
- **Load Balancer Ready**: Multiple backend instances possible

### Vertical Scaling
- **Database**: Supabase auto-scales on paid plans
- **Backend**: Increase Node.js memory/CPU
- **Caching**: Redis can be added for frequently accessed data

### Future Enhancements
- **Caching Layer**: Redis for workspace listings
- **CDN**: Static assets delivery
- **Microservices**: Separate pricing, QR, booking services
- **Message Queue**: Async booking confirmations (RabbitMQ/SQS)
- **Real-time Updates**: WebSocket for live availability

---

## Deployment Architecture

### Development Environment
```
Local Machine
├── Backend: http://localhost:3001
├── User Frontend: http://localhost:8080
└── Admin Frontend: http://localhost:8081

Database: Supabase Cloud (https://chjyfnvwvpbhtlydtcgf.supabase.co)
```

### Production Deployment (Recommended)
```
┌─────────────────────────────────────────┐
│         Cloud Provider (AWS/Azure)       │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Load Balancer (ALB/nginx)        │ │
│  └──────────┬────────────────────────┘ │
│             │                           │
│  ┌──────────▼──────────┐               │
│  │  Backend Instances  │               │
│  │  (EC2/App Service)  │               │
│  │  Port: 3001         │               │
│  └──────────┬──────────┘               │
│             │                           │
│  ┌──────────▼──────────┐               │
│  │  Static Hosting     │               │
│  │  (S3/Blob Storage)  │               │
│  │  - User Frontend    │               │
│  │  - Admin Frontend   │               │
│  └─────────────────────┘               │
└─────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│       Supabase (Database)               │
│       PostgreSQL + Auto-API             │
└─────────────────────────────────────────┘
```

---

## Project Overview

The Co-Working Space Booking Platform is a dynamic, real-time system that allows users to discover, book, and manage workspaces across multiple co-working hubs. The platform supports workspace filtering, resource booking, time-slot management, dynamic pricing, and QR-based check-in, all without requiring user login.

### Goal

To create a flexible workspace booking system where users can:

1) Search spaces by location, capacity, amenities, price, and rating
2) Book hourly, daily, or monthly slots
3) Reserve optional resources like projectors, parking, lockers, or snacks
4) Benefit from dynamic pricing based on workspace type, time, day, and demand/inventory
5) Check in via a QR code system (mock QR acceptable)

---

## 🚀 Project Structure

```
working_space_platform/
├── backend/                     # Node.js Express API
│   ├── routes/
│   │   ├── hubs.js             # Working hubs management
│   │   ├── workspaces.js       # Workspace management & search
│   │   ├── resources.js        # Resource/add-on management
│   │   ├── bookings.js         # Booking management
│   │   ├── pricing.js          # Dynamic pricing rules
│   │   └── qr.js               # QR code generation & scanning
│   ├── utils/
│   │   ├── pricing.js          # Pricing calculation logic
│   │   └── qrGenerator.js      # QR code generator
│   ├── server.js               # Main server file
│   └── package.json
│
├── user-frontend/              # User booking interface
│   ├── index.html
│   ├── app.js
│   └── styles.css
│
├── admin-frontend/             # Admin management dashboard
│   ├── index.html
│   ├── admin.js
│   └── styles.css
│
├── .env                        # Supabase credentials
├── package.json
└── README.md
```

---

## 🛠️ Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- Supabase account (database already configured)

### 1. Install Backend Dependencies
```powershell
cd backend
npm install
```

### 2. Configure Environment Variables
The `.env` file is already set up with Supabase credentials:
```
PROJECT_URL=https://chjyfnvwvpbhtlydtcgf.supabase.co
API_KEY=your_api_key
```

### 3. Start the Backend Server
```powershell
cd backend
npm start
```
Or for development with auto-reload:
```powershell
npm run dev
```

The server will run on `http://localhost:3001`

### 4. Start Frontend Applications

**User Frontend:**
```powershell
cd user-frontend
npm start
```
Opens automatically at `http://localhost:8080`

**Admin Frontend:**
```powershell
cd admin-frontend
npm start
```
Opens automatically at `http://localhost:8081`

**Or start everything at once:**
```powershell
# From root directory
npm install
npm run start-all
```

---

## 📱 Features Implemented

### User Frontend
✅ **Space Discovery & Search**
- Filter by location (city, state)
- Filter by workspace type (meeting room, cabin, hot desk, conference)
- Filter by capacity and price range
- Filter by amenities (Wi-Fi, AC, Coffee, Parking, etc.)

✅ **Booking Flow**
- Select date, start time, and end time
- Choose booking type (hourly, daily, monthly)
- Real-time availability checking
- Dynamic price calculation

✅ **Resource Booking**
- View available resources per workspace
- Add optional resources (projector, locker, parking, snacks)
- See resource availability and pricing

✅ **My Bookings**
- Search bookings by name (no login required)
- View booking details and status
- Cancel bookings
- View QR codes for check-in

✅ **QR Check-in**
- Unique QR code generated for each booking
- Display QR code for workspace access

### Admin Frontend
✅ **Dashboard**
- Overview stats (total hubs, workspaces, bookings, revenue)
- Recent bookings list

✅ **Hub Management**
- Create, read, update, delete working hubs
- Manage location details

✅ **Workspace Management**
- Create, read, update, delete workspaces
- Set workspace type, capacity, price
- Configure amenities

✅ **Resource Management**
- Create, read, update, delete resources
- Set resource pricing and availability

✅ **Booking Management**
- View all bookings
- Filter by status (confirmed, checked_in, cancelled)
- View booking details

✅ **Pricing Rules**
- Create dynamic pricing rules
- Configure demand-based, peak hours, weekend pricing
- Set percentage or flat modifiers

✅ **QR Code Management**
- View all generated QR codes
- Track scanned/unscanned status

### Backend API
✅ **Comprehensive REST API**
- Working Hubs endpoints
- Workspaces with advanced filtering
- Resources with availability checking
- Bookings with dynamic pricing
- Pricing rules engine
- QR code generation and scanning

---

## 🔑 API Endpoints

### Working Hubs
- `GET /api/hubs` - Get all hubs
- `GET /api/hubs/:id` - Get hub by ID
- `POST /api/hubs` - Create hub (Admin)
- `PUT /api/hubs/:id` - Update hub (Admin)
- `DELETE /api/hubs/:id` - Delete hub (Admin)
- `GET /api/hubs/filter/location` - Filter hubs by location

### Workspaces
- `GET /api/workspaces` - Get all workspaces with filters
- `GET /api/workspaces/search` - Search workspaces by amenities
- `GET /api/workspaces/:id` - Get workspace by ID
- `POST /api/workspaces` - Create workspace (Admin)
- `PUT /api/workspaces/:id` - Update workspace (Admin)
- `DELETE /api/workspaces/:id` - Delete workspace (Admin)
- `POST /api/workspaces/:id/check-availability` - Check availability

### Resources
- `GET /api/resources` - Get all resources
- `GET /api/resources/workspace/:workspace_id` - Get resources by workspace
- `GET /api/resources/:id` - Get resource by ID
- `POST /api/resources` - Create resource (Admin)
- `PUT /api/resources/:id` - Update resource (Admin)
- `DELETE /api/resources/:id` - Delete resource (Admin)
- `POST /api/resources/:id/check-availability` - Check resource availability

### Bookings
- `GET /api/bookings` - Get all bookings
- `GET /api/bookings/:id` - Get booking by ID
- `POST /api/bookings` - Create booking
- `PATCH /api/bookings/:id/status` - Update booking status
- `DELETE /api/bookings/:id` - Cancel booking
- `GET /api/bookings/stats/overview` - Get booking statistics (Admin)

### Pricing Rules
- `GET /api/pricing` - Get all pricing rules
- `GET /api/pricing/:id` - Get pricing rule by ID
- `POST /api/pricing` - Create pricing rule (Admin)
- `PUT /api/pricing/:id` - Update pricing rule (Admin)
- `DELETE /api/pricing/:id` - Delete pricing rule (Admin)
- `POST /api/pricing/calculate` - Calculate price for booking

### QR Codes
- `POST /api/qr/generate/:booking_id` - Generate QR code
- `GET /api/qr/booking/:booking_id` - Get QR code for booking
- `POST /api/qr/scan` - Scan QR code (check-in)
- `GET /api/qr` - Get all QR codes (Admin)

---

## 💡 How to Use

### For Users:
1. **Browse Workspaces**: Use the search and filter options to find the perfect workspace
2. **Select Date & Time**: Choose your preferred date and time slot
3. **Add Resources**: Optionally add resources like projectors, parking, etc.
4. **Confirm Booking**: Review the total price and confirm your booking
5. **Get QR Code**: Receive a QR code for check-in
6. **View Bookings**: Search your name to view all your bookings

### For Admins:
1. **Manage Hubs**: Add and configure co-working hub locations
2. **Create Workspaces**: Set up different workspace types with pricing
3. **Add Resources**: Configure available resources and their pricing
4. **Set Pricing Rules**: Create dynamic pricing based on demand, time, or day
5. **Monitor Bookings**: View and manage all bookings in the system
6. **Track QR Codes**: Monitor check-ins and QR code usage

---

## 🗄️ Database Schema (Supabase)

The platform uses the following tables in Supabase:

### Core Tables
1. **working_hubs** - Co-working hub locations
2. **workspaces** - Individual workspaces within hubs
3. **resources** - Add-on resources available per workspace
4. **bookings** - User bookings
5. **booking_resources** - Many-to-many relationship for booking resources
6. **pricing_rules** - Dynamic pricing configuration
7. **time_slots** - Available time slots (optional)
8. **qr_codes** - QR codes for check-in

Detailed schema is provided in the original README sections below.

---

## Database Design (DBML)

 Working Hubs
Table working_hubs {
  id integer [primary key]
  name varchar
  address text
  city varchar
  state varchar
  country varchar
  pincode varchar
  latitude float
  longitude float
  created_at timestamp
}

Workspaces
Table workspaces {
  id integer [primary key]
  hub_id integer [not null]
  name varchar
  type varchar // meeting_room, hotdesk, cabin, conference
  capacity integer
  base_price float
  amenities json // starts empty: []
  created_at timestamp
}

Ref: workspaces.hub_id > working_hubs.id

Resources (Add-ons)
Table resources {
  id integer [primary key]
  workspace_id integer [not null]
  name varchar
  description text
  price_per_slot float
  quantity integer
  created_at timestamp
}

Ref: resources.workspace_id > workspaces.id

Bookings
```
Table bookings {
  id integer [primary key]
  workspace_id integer [not null]
  user_name varchar
  start_time datetime
  end_time datetime
  total_price float
  booking_type varchar // hourly, daily, monthly
  status varchar // confirmed, cancelled, checked_in
  created_at timestamp
}

Ref: bookings.workspace_id > workspaces.id
```

Booking → Resources
```
Table booking_resources {
  id integer [primary key]
  booking_id integer [not null]
  resource_id integer [not null]
  quantity integer
}
```

Ref: booking_resources.booking_id > bookings.id
Ref: booking_resources.resource_id > resources.id

## Dynamic Pricing Rules
```
Table pricing_rules {
  id integer [primary key]
  workspace_id integer
  rule_type varchar // demand, peak_hours, weekend, room_type
  percentage_modifier float
  flat_modifier float
  start_time time
  end_time time
  days json // ["Mon","Tue"] or ["Sat","Sun"]
}


Ref: pricing_rules.workspace_id > workspaces.id
```
## Time Slots
```
Table time_slots {
  id integer [primary key]
  workspace_id integer [not null]
  date date
  start_time time
  end_time time
  is_available boolean
}

Ref: time_slots.workspace_id > workspaces.id
```
## QR Check-In
```
Table qr_codes {
  id integer [primary key]
  booking_id integer [not null]
  qr_value varchar
  created_at timestamp
  scanned_at timestamp
}

Ref: qr_codes.booking_id > bookings.id
```

## Notes
1) Workspaces can be of any type (meeting room, hot desk, cabin, conference hall)

2) Resources are optional per booking

3) Amenities are workspace-level features (may have default)

4) Dynamic pricing is inventory-driven

5) Sample Workflow

6) System shows available workspaces

7) User selects a workspace + date/time + resources

8) System calculates total price using base price + dynamic pricing rules

9) Booking is confirmed, QR code generated

10) User checks in using QR code