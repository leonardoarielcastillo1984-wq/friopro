# SGI 360 Enhanced Portal - Testing Guide

## Overview
The new **sgi360-portal.html** is a comprehensive single-page application that includes:
- ✅ Professional login page with 2FA support
- ✅ Complete dashboard with user welcome and quick stats
- ✅ User profile page with detailed account information
- ✅ Security settings page with 2FA management
- ✅ Modal dialogs for security operations
- ✅ Responsive design for mobile and desktop

## File Location
```
/Users/leonardocastillo/Desktop/APP/SGI 360/sgi360-portal.html
```

## Quick Start

### Option 1: Using Node.js Static Server (Recommended)

1. **Copy the portal file to the web directory:**
```bash
cp /Users/leonardocastillo/Desktop/APP/SGI\ 360/sgi360-portal.html \
   /Users/leonardocastillo/Desktop/APP/SGI\ 360/apps/web/sgi360-portal.html
```

2. **Start the static server:**
```bash
cd /Users/leonardocastillo/Desktop/APP/SGI\ 360/apps/web
node static-server.js
```

3. **Access the portal:**
```
http://localhost:3000
```

### Option 2: Direct File Access
Simply open the file in your browser:
```
file:///Users/leonardocastillo/Desktop/APP/SGI 360/sgi360-portal.html
```

*Note: This method won't work with the API calls if the backend is not running.*

### Option 3: Using Python HTTP Server
```bash
cd /Users/leonardocastillo/Desktop/APP/SGI\ 360
python3 -m http.server 3000
```

Then access: `http://localhost:3000/sgi360-portal.html`

## Testing Credentials

Use these test credentials to login:

| Field | Value |
|-------|-------|
| **Email** | test@example.com |
| **Password** | Test123!@# |
| **2FA Code** | 123456 (or any 6-digit number) |

These credentials are pre-filled in the login form for convenience.

## Complete Testing Flow

### 1. Login Flow

**Step 1: Enter Credentials**
- Email and password are auto-filled with test credentials
- Click "Sign In" to begin the login process
- Expected: You should see the 2FA form

**Step 2: Enter 2FA Code**
- The portal expects a 6-digit code
- Enter: `123456` (or any valid 6-digit code)
- Click "Verify Code"
- Expected: Successfully redirected to the dashboard

**Alternative: Go Back to Login**
- Click "← Back to Login" to return to the login form
- This clears all forms and resets the session

### 2. Dashboard View (Default View)

After successful login, the dashboard shows:

#### Top Bar
- **User Avatar**: Displays initials (JD for John Doe)
- **Welcome Message**: Shows logged-in user's name and email
- **Last Login**: Shows the time of last login

#### Stats Cards
Three key information cards:
1. **Security Status**: Shows "Protected" with 2FA status
2. **Active Sessions**: Shows number of active sessions (1)
3. **Account Status**: Shows account is "Active"

#### Quick Stats Section
- Account Created Date
- Last Password Change Date
- Total Login Attempts
- Failed Attempts (30 days)

### 3. My Profile Page

**Navigation**: Click "👤 My Profile" in the left sidebar

Shows:
- **Personal Information**: Name, Email, Account ID, Account Status
- **Organization Information**: Organization, Department, Role, Access Level
- **Account Timeline**: Key dates and milestones:
  - Account Created
  - 2FA Enabled
  - Last Login
  - Last Password Change

### 4. Security Settings Page

**Navigation**: Click "🔒 Security Settings" in the left sidebar

#### Features Available

1. **Two-Factor Authentication**
   - Status: Shows "✓ Enabled" or "✗ Disabled"
   - Action: "Disable 2FA" button (with confirmation dialog)
   - Description: Explains 2FA protection

2. **Recovery Codes**
   - Displays 6 backup codes
   - Used if you lose access to authenticator app
   - Button: "View Codes" (opens modal with codes)

3. **Active Sessions**
   - Shows all logged-in sessions across devices
   - Displays: Device type, location, IP address, last activity
   - Actions: Sign out individual sessions or all other sessions
   - Button: "View Sessions" (opens modal)

4. **Change Password**
   - Opens form to update account password
   - Requires: Current password, new password, confirmation
   - Validation: Passwords must match and be 8+ characters
   - Button: "Change Password" (opens modal)

5. **Login History**
   - Shows recent login attempts (successful and failed)
   - Displays: Date/time, device, browser, IP address, status
   - Color-coded: Green for success, red for failed attempts
   - Button: "View History" (opens modal)

## Feature Testing Checklist

### Login & Authentication
- [ ] Login page loads with auto-filled credentials
- [ ] "Sign In" button transitions to 2FA form
- [ ] 2FA form accepts 6-digit codes
- [ ] Invalid 2FA code shows error message
- [ ] Valid 2FA code (123456) completes login
- [ ] "Back to Login" button resets forms properly
- [ ] Login errors display appropriate messages

### Dashboard Navigation
- [ ] Menu items highlight when selected
- [ ] "📊 Dashboard" is active by default
- [ ] Clicking menu items switches views smoothly
- [ ] Active page indicator shows current selection
- [ ] Sidebar remains visible during navigation

### Dashboard View
- [ ] User avatar displays initials correctly
- [ ] Welcome message shows user name and email
- [ ] Last login time displays correctly
- [ ] All three stat cards render properly
- [ ] Quick stats show placeholder data
- [ ] Cards have proper styling and shadows

### Profile View
- [ ] All profile fields display correctly
- [ ] Personal information section shows all data
- [ ] Organization information section complete
- [ ] Account timeline shows all key dates
- [ ] Responsive layout on mobile

### Security Settings View
- [ ] All 5 security items display
- [ ] 2FA status badge shows correct status
- [ ] Recovery codes modal opens and displays 6 codes
- [ ] Sessions modal shows active sessions
- [ ] Change password form has validation
- [ ] Login history modal shows past attempts
- [ ] Color coding for login status (green/red)

### Modal Dialogs
- [ ] Each modal opens without errors
- [ ] Close button (×) works in modals
- [ ] Clicking background closes modal
- [ ] ESC key closes all open modals
- [ ] Form validation shows appropriate errors
- [ ] Form success messages display correctly

### Logout Functionality
- [ ] Logout button visible in sidebar footer
- [ ] Logout shows confirmation dialog
- [ ] Confirming logout returns to login page
- [ ] Canceling logout keeps user logged in
- [ ] All forms clear after logout

### Responsive Design
- [ ] Sidebar adapts on mobile (< 768px)
- [ ] Main content area responsive
- [ ] Forms fit properly on small screens
- [ ] Modals centered on all screen sizes
- [ ] No horizontal scrolling

### Styling & UX
- [ ] Professional color scheme (purple gradient)
- [ ] Smooth animations and transitions
- [ ] Hover effects on buttons
- [ ] Focus states for accessibility
- [ ] Icons display correctly
- [ ] Text is readable with good contrast

## Simulated Data

The portal currently uses simulated/placeholder data. When integrated with the real API, the following will update:

### From User Data
- User name (from JWT or session)
- User email (from JWT or session)
- Account creation date
- Last login timestamp
- 2FA enabled status

### From API Endpoints
- `/api/auth/login` - Initial authentication
- `/api/2fa/verify` - 2FA verification
- `/api/auth/2fa-complete` - Complete login flow
- `/api/user/profile` - User information
- `/api/security/sessions` - Active sessions
- `/api/security/login-history` - Login history

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `ESC` | Close all open modals |
| `Tab` | Navigate between form fields |
| `Enter` | Submit forms in modals |

## Browser Compatibility

Tested and works on:
- ✅ Chrome/Chromium 90+
- ✅ Safari 14+
- ✅ Firefox 88+
- ✅ Edge 90+

## Performance Notes

- Single HTML file: No build process needed
- CSS: All inline for quick loading
- JavaScript: Vanilla JS, no dependencies
- Bundle size: ~35KB (minified would be ~25KB)

## Integration with Backend API

The portal is designed to work with your existing backend at `http://localhost:3001`.

### Required API Endpoints

1. **POST /api/auth/login**
   ```json
   Request: { "email": "test@example.com", "password": "Test123!@#" }
   Response: { "requires2FA": true, "sessionToken": "..." }
   ```

2. **POST /api/2fa/verify**
   ```json
   Request: { "sessionToken": "...", "token": "123456" }
   Response: { "verified": true }
   ```

3. **POST /api/auth/2fa-complete**
   ```json
   Request: { "sessionToken": "..." }
   Response: { "accessToken": "...", "user": {...} }
   ```

## Troubleshooting

### "Cannot fetch from API" error
- Ensure backend is running on port 3001
- Check CORS headers are enabled
- Verify API endpoints are responding

### Modal not closing
- Try pressing ESC key
- Click outside the modal background
- Refresh the page

### Styling looks broken
- Clear browser cache (Ctrl+Shift+Delete)
- Check if CSS is loading (F12 > Network > Find .html file)
- Try different browser

### 2FA form not showing
- Check browser console for errors (F12)
- Verify login API is responding
- Check network tab to see API responses

## Next Steps for Production

1. **Remove test credentials display**
   - Remove the blue test-credentials box in login form

2. **Integrate real API endpoints**
   - Update fetch URLs to production endpoints
   - Add proper error handling
   - Implement token refresh logic

3. **Add real user data loading**
   - Fetch user profile on login success
   - Load actual login history
   - Show real active sessions

4. **Security hardening**
   - Validate all form inputs
   - Implement rate limiting on frontend
   - Add CSRF token validation
   - Use secure session storage

5. **Analytics integration**
   - Track user navigation
   - Monitor login success/failure rates
   - Log user actions for audit trail

6. **Notification system**
   - Real-time notifications for login attempts
   - Security alerts
   - Account activity updates

## Support

For issues or questions about the portal:
1. Check the browser console for errors (F12)
2. Verify the backend API is running
3. Test with the provided test credentials first
4. Check this guide's troubleshooting section

---

**Version**: 1.0
**Last Updated**: March 16, 2026
**Status**: Ready for Testing ✅
