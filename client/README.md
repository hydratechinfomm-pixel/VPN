# Frontend Setup Instructions

This is the frontend for the Outline VPN Control Panel.

## Installation

```bash
cd client
npm install
```

## Development

```bash
npm start
```

Server will run on http://localhost:3000

## Build

```bash
npm run build
```

## Environment Variables

Create `.env` file:
```
REACT_APP_API_URL=http://localhost:5000/api
```

## Project Structure

```
client/
├── src/
│   ├── api.js              # API client setup
│   ├── context/
│   │   └── AuthContext.jsx # Authentication context
│   ├── pages/              # Page components
│   ├── components/         # Reusable components
│   ├── hooks/              # Custom hooks
│   ├── utils/              # Utility functions
│   ├── styles/             # CSS styles
│   ├── App.jsx             # Main app component
│   └── index.js            # Entry point
├── public/                 # Static files
├── package.json            # Dependencies
└── README.md
```

## Pages to Create

- [ ] LoginPage - User login form
- [ ] RegisterPage - User registration form
- [ ] DashboardPage - Main dashboard with stats
- [ ] AccessKeysPage - Manage access keys
- [ ] ProfilePage - User profile and settings
- [ ] ServersPage - Admin server management
- [ ] UsersPage - Admin user management
- [ ] NotFoundPage - 404 page

## Components to Create

- [ ] Header - Navigation header
- [ ] Sidebar - Navigation sidebar
- [ ] LoginForm - Login form component
- [ ] AccessKeyList - List of access keys
- [ ] AccessKeyForm - Create/edit key form
- [ ] ServerList - List of servers
- [ ] ServerForm - Create/edit server form
- [ ] UserList - List of users
- [ ] StatsCard - Statistics display card
- [ ] Modal - Reusable modal component
- [ ] Alert - Alert notification component

## Styling

Recommended UI frameworks:
- Material-UI (MUI)
- Bootstrap + React Bootstrap
- Tailwind CSS
- Styled Components

## State Management

For larger app, consider:
- Redux Toolkit
- Zustand
- Jotai

Currently using React Context API for authentication.

## Testing

```bash
npm test
```

## Deployment

Build and deploy to:
- Vercel
- Netlify
- GitHub Pages
- AWS S3 + CloudFront
- Traditional web server
