# System Architecture Overview

## Frontend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     REACT APPLICATION                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   App.jsx (Routing)                   │  │
│  │                                                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │  │
│  │  │   /login     │  │      /       │  │  /members  │ │  │
│  │  │              │  │              │  │            │ │  │
│  │  │ Login.jsx    │  │ Dashboard    │  │ Directory  │ │  │
│  │  └──────────────┘  └──────────────┘  └────────────┘ │  │
│  │                                                        │  │
│  │         ┌─────────────────────────────┐               │  │
│  │         │   /member/:id (Protected)   │               │  │
│  │         │                             │               │  │
│  │         │    MemberProfile.jsx        │               │  │
│  │         │    (Command Center)         │               │  │
│  │         └─────────────────────────────┘               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              API Layer (api.js)                       │  │
│  │                                                        │  │
│  │  - fetchWithAuth() - JWT token management            │  │
│  │  - Auto refresh tokens on 401                         │  │
│  │  - Centralized error handling                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ HTTP/HTTPS
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  BACKEND API (FastAPI)                       │
│                http://localhost:8000                         │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │  Auth    │  │ Members  │  │ Savings  │  │   Loans    │ │
│  │ /auth/*  │  │/member/* │  │/savings/*│  │  /loan/*   │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘ │
│                                                              │
│  ┌──────────┐  ┌──────────────────────────────────────┐   │
│  │ Payments │  │       Admin Dashboard                 │   │
│  │/payment/*│  │    /admin/dashboard-stats             │   │
│  └──────────┘  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
App
├── BrowserRouter
│   └── Routes
│       ├── /login → Login
│       └── / → Layout (Protected)
│           ├── Sidebar Navigation
│           ├── GlobalSearch (Header)
│           └── Outlet (Page Content)
│               ├── / → AdminDashboard
│               ├── /members → MembersDirectory
│               └── /member/:id → MemberProfile
│                   ├── Member Info Card
│                   ├── Savings Summary
│                   ├── Active Loans List
│                   ├── Completed Loans List
│                   └── Action Modals
│                       ├── AddSavingsModal
│                       ├── IssueLoanModal
│                       ├── MakePaymentModal
│                       └── EditMemberModal
```

## Data Flow

### 1. Authentication Flow
```
User enters credentials
     │
     ▼
Login.jsx calls api.login()
     │
     ▼
Backend validates & returns tokens
     │
     ▼
Tokens stored in localStorage
     │
     ▼
User redirected to Dashboard
     │
     ▼
All subsequent requests use fetchWithAuth()
     │
     ▼
401 response? → Auto refresh token → Retry request
```

### 2. Member Search & Navigation Flow
```
User types in GlobalSearch
     │
     ▼
Debounced API call to /member/search
     │
     ▼
Results displayed in dropdown
     │
     ▼
User clicks member
     │
     ▼
Navigate to /member/:id
     │
     ▼
MemberProfile loads full details from /member/{id}
     │
     ▼
Display: Profile + Savings + Active Loans + History
```

### 3. Loan Payment Flow (Waterfall Logic)
```
User clicks "Payment" on active loan
     │
     ▼
MakePaymentModal opens with loan data
     │
     ▼
User enters payment amount
     │
     ▼
Frontend calculates breakdown:
  1. Late Fees (paid first)
  2. Interest (paid second)
  3. Principal (remaining)
     │
     ▼
User confirms payment
     │
     ▼
POST /payment/{loan_id} with amount
     │
     ▼
Backend applies waterfall logic & updates loan
     │
     ▼
Frontend refreshes member profile
     │
     ▼
Updated balances displayed
```

## State Management

### Local Component State
- Form inputs (useState)
- Loading states
- Error messages
- Modal visibility

### API-Driven State
- Member data (fetched from `/member/{id}`)
- Dashboard stats (fetched from `/admin/dashboard-stats`)
- Search results (fetched from `/member/search`)

### Persistent State
- JWT tokens (localStorage)
- User session (localStorage)

## Key Design Principles

### 1. No Manual ID Input
❌ Never ask user to type `member_id`, `loan_id`, etc.
✅ Use contextual navigation: Search → Select → View → Act

### 2. Single Source of Truth
- Member data fetched once from `/member/{id}`
- IDs passed as props to modals
- Refresh after mutations

### 3. Optimistic UI Updates
- Show loading states immediately
- Display errors gracefully
- Reload data on success

### 4. Error Resilience
- Try/catch on all API calls
- Automatic token refresh on 401
- User-friendly error messages
- Network failure handling

## API Request Headers

```javascript
// Every authenticated request includes:
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <access_token>"
}
```

## Business Logic Locations

| Logic                      | Location                |
|----------------------------|-------------------------|
| Authentication             | api.js                  |
| Token refresh              | api.js (fetchWithAuth)  |
| Loan eligibility check     | IssueLoanModal.jsx      |
| Payment waterfall preview  | MakePaymentModal.jsx    |
| Waterfall calculation      | Backend (services.py)   |
| Interest accrual           | Backend (models.py)     |
| Late fees calculation      | Backend (models.py)     |

## Security Features

- ✅ JWT-based authentication
- ✅ Automatic token refresh
- ✅ Protected routes (ProtectedRoute wrapper)
- ✅ Token blacklisting on logout
- ✅ HTTPS ready (production)
- ✅ No sensitive data in localStorage (only tokens)
- ✅ CSRF protection via Bearer tokens

## Performance Optimizations

- Debounced search (300ms)
- Pagination for member lists (20 per page)
- Lazy loading for routes (future)
- CSS animations hardware-accelerated
- Minimal re-renders (useEffect dependencies)

## Deployment Checklist

- [ ] Update API_BASE in `api.js` to production URL
- [ ] Build production bundle: `npm run build`
- [ ] Test production build: `npm run preview`
- [ ] Configure CORS on backend for production domain
- [ ] Enable HTTPS on backend
- [ ] Set secure cookie flags (if using cookies)
- [ ] Add rate limiting
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Configure CDN for static assets
- [ ] Enable gzip compression
- [ ] Add service worker for offline support (optional)

---

This architecture ensures a scalable, maintainable, and secure frontend application.
