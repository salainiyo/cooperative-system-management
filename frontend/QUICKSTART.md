# Quick Start Guide

Get the Cooperative Management System frontend running in 5 minutes!

## Step 1: Prerequisites Check ✅

```bash
# Check Node.js version (needs 18+)
node --version

# Check npm version
npm --version
```

## Step 2: Install Dependencies 📦

```bash
npm install
```

This will install:
- React 18.3.1
- React Router DOM 6.26.1
- Lucide React (icons)
- Tailwind CSS
- Vite

## Step 3: Start Backend API 🔌

Make sure your FastAPI backend is running on `http://localhost:8000`:

```bash
# In your backend directory
uvicorn main:app --reload --port 8000
```

Verify backend is running:
```bash
curl http://localhost:8000/auth/
```

Should return: `{"status": "active"}`

## Step 4: Start Frontend Development Server 🚀

```bash
npm run dev
```

The app will open automatically at `http://localhost:3000`

## Step 5: Login 🔐

Use your admin credentials:
- Email: `admin@cooperative.rw` (or your admin email)
- Password: Your admin password

## 🎉 You're Ready!

### What You Can Do Now:

1. **View Dashboard** - See financial KPIs
2. **Search Members** - Use the top search bar
3. **Add New Member** - Click "Add New Member" button
4. **View Member Profile** - Click any member from search or directory
5. **Add Savings** - Record member deposits
6. **Issue Loans** - Create loans for members with savings
7. **Make Payments** - Process loan repayments with waterfall logic

## Common Issues & Solutions 🔧

### Issue: Can't Login
**Solution**: 
- Check backend is running on port 8000
- Verify credentials in backend database
- Check browser console for CORS errors

### Issue: CORS Error
**Solution**: Add to backend `main.py`:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Issue: White Screen
**Solution**:
- Check browser console for errors
- Verify all dependencies installed: `npm install`
- Clear browser cache and localStorage

### Issue: Search Not Working
**Solution**:
- Type at least 2 characters
- Check backend `/member/search` endpoint
- Verify members exist in database

## File Structure 📁

```
cooperative-cms-frontend/
├── index.html              # HTML entry point
├── package.json            # Dependencies
├── vite.config.js          # Vite configuration
├── tailwind.config.js      # Tailwind configuration
├── postcss.config.js       # PostCSS configuration
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # Main app with routing
    ├── App.css             # Global styles
    ├── api.js              # API client
    └── components/         # All React components
        ├── Login.jsx
        ├── Layout.jsx
        ├── GlobalSearch.jsx
        ├── AdminDashboard.jsx
        ├── MembersDirectory.jsx
        ├── MemberProfile.jsx
        ├── AddMemberModal.jsx
        ├── EditMemberModal.jsx
        ├── AddSavingsModal.jsx
        ├── IssueLoanModal.jsx
        └── MakePaymentModal.jsx
```

## Development Workflow 🔄

### Adding a New Member
1. Click "Members" in sidebar
2. Click "Add New Member" button
3. Fill in the form (all fields required)
4. Click "Create Member"

### Processing a Loan
1. Search for member (top search bar)
2. Click member to view profile
3. Click "Issue New Loan"
4. Enter amount, interest rate, monthly payment
5. System validates against savings balance
6. Click "Issue Loan"

### Making a Payment
1. View member profile
2. Find active loan
3. Click "Payment" button
4. Enter payment amount
5. View waterfall breakdown (Late Fees → Interest → Principal)
6. Click "Record Payment"

## Production Build 🏭

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview
```

Build outputs to `dist/` folder.

## Next Steps 📚

- Read the full [README.md](./README.md) for detailed documentation
- Explore the codebase in `src/components/`
- Customize theme in `src/App.css`
- Add new features or modify existing ones

## Need Help? 💬

- Check browser console for error messages
- Review backend API logs
- Ensure backend endpoints match frontend expectations
- Verify all environment variables are correct

---

Happy managing! 🎊
