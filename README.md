# EcoPredict — AI-Powered Food Waste Prediction & Prevention

EcoPredict is a full-stack kitchen demand forecasting, waste analytics, and surplus food redistribution platform built for restaurants, college hostels, institutional canteens, and event organizers.

---

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, React Router, Recharts, Lucide Icons
- **Backend:** Node.js, Express REST API, express-rate-limit, CORS, Cookie Parser
- **Database:** SQLite via Prisma ORM (`prisma/schema.prisma`) — zero external DB setup
- **Authentication:** JWT stored in `httpOnly` cookies, `bcryptjs` password hashing, RBAC (`ADMIN` & `VENDOR`)
- **Forecasting Engine:** Weighted Moving Average (WMA) + empirical day-of-week seasonality + special-event uplift + 90% confidence intervals (`ml/forecaster.ts`)
- **Testing:** Vitest unit tests for auth utilities and forecasting logic

---

## Quick Start

### 1. One-Command Install & Database Setup
```bash
npm install && npx prisma generate && npx prisma db push
```

### 2. One-Command Run (Development)
```bash
npm run dev
```
The app and API run together on `http://localhost:3000`. On first boot, `server.ts` automatically seeds 60 days of realistic meal history, 5 local NGO partners, active surplus listings, and both demo accounts.

### 3. Production Build & Start
```bash
npm run build && npm start
```

### 4. Run Tests
```bash
npm test
```

---

## Demo Credentials

| Role | Email | Password | Organization |
| :--- | :--- | :--- | :--- |
| **Vendor** | `vendor@ecopredict.io` | `Vendor@1234` | GreenPlate Campus Canteen |
| **Admin** | `admin@ecopredict.io` | `Admin@1234` | Metro Dining Operations |

*(You can also click the one-click **Demo Vendor** or **Demo Admin** buttons directly on the `/login` screen.)*

---

## Folder Structure

```text
├── ml/
│   └── forecaster.ts         # Weighted moving average + weekday + event forecast engine
├── prisma/
│   └── schema.prisma         # SQLite models (User, DailyEntry, SurplusListing, NgoPartner, PickupRequest)
├── server/
│   ├── app.ts                # Express app, CORS, cookie-parser, error handling
│   ├── db.ts                 # Prisma singleton
│   ├── seed.ts               # 60-day realistic dataset + NGOs + demo accounts
│   ├── middleware/auth.ts    # JWT httpOnly verification, RBAC guards, rate limiter
│   ├── utils/authUtils.ts    # Bcrypt, JWT signing, strength scoring, sanitization
│   └── routes/               # Auth, Entries, Predictions, Surplus, Alerts, Admin routes
├── src/
│   ├── components/           # Layout, ProtectedRoute, Skeletons
│   ├── context/              # AuthContext, ThemeContext, ToastContext
│   ├── pages/                # AuthPage, Dashboard, DailyEntry, Predictions, Analytics, Surplus, Alerts, Settings
│   └── App.tsx               # React Router configuration
├── tests/                    # Vitest tests for auth & forecasting engine
└── server.ts                 # Full-stack entrypoint (Express + Vite middleware)
```

---

## REST API Documentation

### Authentication (`/api/auth`)
- `POST /api/auth/signup` — Register new vendor organization (sets `httpOnly` JWT cookie)
- `POST /api/auth/login` — Authenticate user & issue `httpOnly` JWT cookie
- `POST /api/auth/logout` — Clear auth session cookie
- `GET /api/auth/me` — Fetch current authenticated user profile
- `POST /api/auth/forgot-password` — Generate simulated 6-digit password reset code
- `POST /api/auth/reset-password` — Verify code and update password
- `PUT /api/auth/profile` — Update user profile, org info, threshold & notification preferences
- `PUT /api/auth/password` — Change account password

### Meal Logs & Analytics (`/api/entries`)
- `GET /api/entries` — List entries with optional `startDate`, `endDate`, `mealType`, `category`, `scope=all` (Admin)
- `GET /api/entries/summary` — Compute KPI totals, 14-day trend, category breakdown, and CO₂/cost savings
- `GET /api/entries/export.csv` — Download filtered analytics as CSV
- `POST /api/entries` — Log prepared, consumed, leftover kg, headcount, and special event flag
- `DELETE /api/entries/:id` — Remove an entry

### AI Demand Forecasting (`/api/predictions`)
- `GET /api/predictions/forecast` — Query tomorrow & 7-day weighted forecast (`mealType`, `days`, `specialEvent`, `eventLabel`)

### Surplus Redistribution (`/api/surplus`)
- `GET /api/surplus` — List surplus food items & seeded local NGO partners
- `POST /api/surplus` — Publish a new surplus batch
- `POST /api/surplus/:id/request-pickup` — Schedule NGO courier pickup
- `PATCH /api/surplus/:id/collect` — Mark surplus batch as collected

### Alerts & Admin (`/api/alerts`, `/api/admin`)
- `GET /api/alerts` — Evaluate predicted waste & historical spikes against configured threshold
- `PUT /api/alerts/threshold` — Update waste threshold percentage
- `GET /api/admin/organizations` — Admin-only multi-organization oversight metrics

---

## Screenshots

- `[Screenshot Placeholder: Split-Screen Login & Registration]`
- `[Screenshot Placeholder: Executive Sustainability Dashboard (Light & Dark Mode)]`
- `[Screenshot Placeholder: 7-Day AI Demand & Prep Forecast with Factor Explanations]`
- `[Screenshot Placeholder: Surplus Food Redistribution & NGO Dispatch]`
