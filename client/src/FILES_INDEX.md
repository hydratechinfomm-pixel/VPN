# Frontend File Structure Index

## Pages (8 files)
- `LoginPage.jsx` - Authentication login with demo credentials
- `RegisterPage.jsx` - User registration form
- `DashboardPage.jsx` - Main dashboard with statistics and server list
- `ServersPage.jsx` - VPN server management (CRUD operations)
- `AccessKeysPage.jsx` - Manage access keys with filtering
- `UsersPage.jsx` - User administration (Admin only)
- `ProfilePage.jsx` - User profile and settings
- `NotFoundPage.jsx` - 404 error page

## Components (8 files)
- `Header.jsx` - Top navigation header with user menu
- `Sidebar.jsx` - Left navigation sidebar with menu items
- `DashboardStats.jsx` - Statistics cards component
- `ServerList.jsx` - Simple server list for dashboard
- `ServerListAdvanced.jsx` - Advanced server table with actions
- `ServerForm.jsx` - Modal form for creating/editing servers
- `AccessKeyList.jsx` - Access key table with expandable details
- `AccessKeyForm.jsx` - Modal form for access key management
- `UserList.jsx` - User management table with role selection

## Context (1 file)
- `AuthContext.jsx` - Global authentication state and methods

## Styles (8 files)
- `global.css` - Global styles, layout, and base components
- `auth.css` - Authentication pages styling
- `dashboard.css` - Dashboard page styling
- `servers.css` - Server management styling
- `accesskeys.css` - Access keys styling
- `users.css` - User management styling
- `profile.css` - Profile page styling
- `notfound.css` - 404 page styling

## Root Files
- `api.js` - Axios API client with all endpoints
- `App.jsx` - Main app routing and layout
- `index.js` - React entry point
- `.env` - Environment configuration

## Total: 32+ files
