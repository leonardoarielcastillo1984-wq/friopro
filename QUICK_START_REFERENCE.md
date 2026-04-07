# SGI 360 Portal - Quick Start Reference Card

## 🚀 Get Started in 60 Seconds

### Method 1: Fastest (Recommended)
```bash
cd /Users/leonardocastillo/Desktop/APP/SGI\ 360/apps/web
chmod +x run-portal.sh
./run-portal.sh
```
Browser opens automatically. Done! ✅

### Method 2: Using Node.js
```bash
cd /Users/leonardocastillo/Desktop/APP/SGI\ 360/apps/web
node static-server.js
```
Then open: `http://localhost:3000`

### Method 3: Using Python
```bash
cd /Users/leonardocastillo/Desktop/APP/SGI\ 360
python3 -m http.server 3000
```
Then open: `http://localhost:3000/sgi360-portal.html`

---

## 🔐 Login Credentials (Auto-filled)

```
📧 Email:    test@example.com
🔐 Password: Test123!@#
🔑 2FA Code: 123456
```

Just click "Sign In" and "Verify Code"

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `sgi360-portal.html` | Main portal application |
| `SGI360_PORTAL_TESTING_GUIDE.md` | Complete testing guide |
| `PORTAL_IMPLEMENTATION_SUMMARY.md` | Technical documentation |
| `run-portal.sh` | Quick start script |
| `static-server.js` | Node.js server |

**Location**: `/Users/leonardocastillo/Desktop/APP/SGI 360/`

---

## ✨ Features at a Glance

### Login Page
- Professional design with 2FA support
- Test credentials pre-filled
- Error handling and validation

### Dashboard (Default View)
- User welcome message
- Quick stats cards
- Security status
- Account information

### My Profile
- Personal information
- Organization details
- Account timeline

### Security Settings
- 2FA management
- Recovery codes
- Active sessions
- Password change
- Login history

---

## 🎯 Complete Test Flow

1. **Open portal** → Credentials auto-filled
2. **Click "Sign In"** → Moves to 2FA form
3. **Enter "123456"** → Click "Verify Code"
4. **See Dashboard** → Welcome message displayed
5. **Navigate tabs** → Profile, Security settings
6. **Click Logout** → Back to login

**Total time**: ~30 seconds

---

## 🔍 Testing Checklist

### Essential Tests
- [ ] Login with test credentials
- [ ] 2FA verification
- [ ] Navigate to Profile page
- [ ] Open Security Settings
- [ ] Try a modal (e.g., Recovery Codes)
- [ ] Logout
- [ ] Try invalid 2FA code (should error)

### UI Tests
- [ ] Check responsive on mobile (F12, toggle device)
- [ ] Try ESC key to close modals
- [ ] Click outside modal to close
- [ ] Check all buttons have hover effects
- [ ] Verify no console errors (F12)

### Bonus Tests
- [ ] Open login history
- [ ] View active sessions
- [ ] Try change password form
- [ ] View recovery codes
- [ ] Test sidebar menu navigation

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot find module" | Run `npm install` in the web directory |
| Port already in use | Edit static-server.js, change PORT |
| "Cannot GET /" | Ensure sgi360-portal.html is in correct location |
| API errors | Check if backend is running on port 3001 |
| Styling broken | Clear browser cache (Ctrl+Shift+Delete) |

---

## 💻 Browser Requirements

| Browser | Min Version | Status |
|---------|-------------|--------|
| Chrome | 90+ | ✅ |
| Safari | 14+ | ✅ |
| Firefox | 88+ | ✅ |
| Edge | 90+ | ✅ |

---

## 📊 Portal Sections at a Glance

```
LOGIN PAGE (Automatic)
├── Email input (test@example.com)
├── Password input (Test123!@#)
└── 2FA form (123456)

DASHBOARD (After Login)
├── Top Bar (User info, last login)
├── Stats Cards (Security, Sessions, Status)
└── Quick Stats (Account dates)

MY PROFILE
├── Personal Info (Name, Email, ID)
├── Organization (Dept, Role, Level)
└── Timeline (Key dates)

SECURITY SETTINGS
├── 2FA Status (Enabled/Disabled)
├── Recovery Codes (View modal)
├── Sessions (View/manage)
├── Password (Change form)
└── History (Login attempts)

LOGOUT
└── Confirmation → Back to login
```

---

## 🎨 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ESC | Close all modals |
| Tab | Navigate form fields |
| Enter | Submit forms |

---

## 📱 Mobile Testing

On mobile or tablet:
1. Resize browser: F12 → Click device icon
2. Select iPhone or Galaxy preset
3. Navigate using touch
4. Check sidebar adapts
5. Verify buttons are touchable (44x44px+)

---

## 🔧 Customization (Advanced)

### Change Brand Color
In `sgi360-portal.html`, find and change:
```css
#667eea → your-color (primary)
#764ba2 → your-color (secondary)
#1a237e → your-color (sidebar)
```

### Change Test Credentials
Find the test-credentials div and update:
```html
<strong>Test Credentials:</strong>
Email: your@email.com
Password: YourPassword123!
```

### Change Portal Title
```html
<title>Your Portal Name</title>
```

---

## 📞 Get Help

1. **Check errors**: F12 → Console tab
2. **Check network**: F12 → Network tab → Look for API calls
3. **Read guides**:
   - `SGI360_PORTAL_TESTING_GUIDE.md` - Detailed testing
   - `PORTAL_IMPLEMENTATION_SUMMARY.md` - Technical details

---

## ✅ What's Included

✅ Single HTML file (no build needed)
✅ Professional UI design
✅ 2FA integration
✅ Complete dashboard
✅ Security settings
✅ Mobile responsive
✅ Zero dependencies
✅ Test credentials pre-filled
✅ Detailed documentation
✅ Quick start script

---

## 🎯 Next Steps After Testing

1. **For API Integration**: Update fetch URLs to your backend
2. **For Production**: Remove test credentials display
3. **For Security**: Implement CSRF tokens, rate limiting
4. **For Analytics**: Add user tracking
5. **For Notifications**: Implement real-time alerts

---

**Quick Reference Card**
Version: 1.0 | Date: March 16, 2026
Last Updated: Ready to use! ✅

For detailed testing guide, see: `SGI360_PORTAL_TESTING_GUIDE.md`
For implementation details, see: `PORTAL_IMPLEMENTATION_SUMMARY.md`
