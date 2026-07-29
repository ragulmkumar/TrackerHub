# TrackerHub Frontend

React-based frontend application for the TrackerHub Indoor Positioning System.

## Overview

This is the frontend component of the TrackerHub system. It provides a user interface for visualizing tracker positions and configuring the system.

**Note**: The frontend is currently in a minimal state, displaying only a placeholder text. Actual UI components for visualization and configuration are planned for future implementation.

## Technology Stack

- **Framework**: React 19.2.7
- **Build Tool**: Vite 8.1.1
- **Styling**: Tailwind CSS 4.3.3
- **Language**: JavaScript (ESM)
- **Development Tools**: ESLint for code quality

## Project Structure

```
client/
├── src/
│   ├── assets/         # Static assets (images, icons, etc.)
│   ├── components/     # Reusable UI components
│   │   └── ...         # To be implemented
│   ├── pages/          # Page-level components
│   │   └── ...         # To be implemented
│   ├── App.jsx         # Root application component
│   ├── main.jsx        # Application entry point
│   └── index.css       # Global styles (Tailwind import)
├── public/             # Static public files
│   └── ...             # To be implemented
├── index.html          # HTML template
├── vite.config.js      # Vite configuration
├── package.json        # NPM dependencies and scripts
├── eslint.config.js    # ESLint configuration
└── README.md           # This file
```

## Features

### Current Implementation

- ⚡ **Fast Development**: Vite provides instant server start and hot module replacement
- 🎨 **Styling**: Tailwind CSS for utility-first styling
- 🔧 **Code Quality**: ESLint configured with React recommended rules
- 🌐 **API Proxy**: Development server proxies `/api` requests to backend
- 📱 **Responsive Design**: Built with mobile-first approach

### Planned Features

- 📊 **Real-time Dashboard**: Visualize tracker positions on a map
- ⚙️ **Configuration UI**: Manage beacons, maps, and system settings
- 📱 **Responsive Layout**: Optimized for desktop and mobile viewing
- 🔔 **Notifications**: System alerts and status updates
- 📥 **Data Export**: Export tracking history and reports
- 🔐 **User Authentication**: Secure access to the system

## Getting Started

### Prerequisites

- Node.js 20+
- npm 9+ or yarn

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/trackerhub.git
cd trackerhub/client

# Install dependencies
npm install
```

### Development Server

```bash
npm run dev
```

The application will be available at http://localhost:3715

### Production Build

```bash
npm run build
```

Outputs optimized static assets to the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

Serves the built application from `dist/` at http://localhost:4173

### Linting

```bash
npm run lint
```

Runs ESLint on all JavaScript/JSX files.

## Configuration

### Vite Configuration (`vite.config.js`)

The frontend uses Vite with the following configuration:

- React plugin for JSX support
- Tailwind CSS plugin for styling
- Development server:
  - Host: 0.0.0.0 (accessible from other devices on network)
  - Port: 3715
  - API Proxy: Requests to `/api` are forwarded to `http://backend:8022`

### Environment Variables

The frontend supports environment variables prefixed with `VITE_`:

| Variable       | Description               | Example                                              |
| -------------- | ------------------------- | ---------------------------------------------------- |
| `VITE_API_URL` | Base URL for API requests | `/api` (proxied in dev) or `https://api.example.com` |

In development, the proxy in `vite.config.js` forwards `/api` requests to the backend service.

## Available Scripts

In the `client` directory, you can run:

| Script            | Description                       |
| ----------------- | --------------------------------- |
| `npm run dev`     | Start development server with HMR |
| `npm run build`   | Build for production              |
| `npm run lint`    | Run ESLint                        |
| `npm run preview` | Preview production build locally  |

## API Integration

The frontend communicates with the TrackerHub backend via REST API and WebSocket.

### API Proxy (Development)

During development, Vite proxies requests starting with `/api` to the backend:

```
http://localhost:3715/api/config/web  →  http://backend:8022/api/config/web
```

### Production Deployment

In production, the frontend should be served from the same origin as the backend, or CORS should be properly configured.

### Endpoints

- **GET** `/api/config/web` - Get web UI configuration
- **POST** `/api/config/web` - Update web UI configuration
- **GET** `/api/server-runtime-config` - Get server runtime configuration
- **POST** `/api/server-runtime-config` - Update server runtime configuration
- **GET** `/api/trackers` - Get all tracker states
- **WS** `/ws` - WebSocket for real-time tracker updates

## Styling

The project uses Tailwind CSS for styling. Key features:

- Utility-first approach for rapid UI development
- Responsive design prefixes (sm:, md:, lg:, xl:, 2xl:)
- Dark mode support
- Customizable via `tailwind.config.js` (not yet configured)

### Current Usage

- `index.css`: Imports Tailwind CSS base, components, and utilities
- Components: Style using Tailwind classes directly in JSX

## Development Guidelines

### Code Organization

- Components go in `src/components/`
- Pages (route components) go in `src/pages/`
- Assets (images, icons, etc.) go in `src/assets/`
- Styles can be co-located with components or in CSS files

### Component Structure

```jsx
import React from "react";

const MyComponent = () => {
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      {/* Component content */}
    </div>
  );
};

export default MyComponent;
```

### Styling Conventions

- Use utility classes for layout, spacing, typography
- Create component-specific classes in CSS when needed
- Follow mobile-first approach for responsive design
- Use semantic HTML elements where possible

## Building for Production

```bash
# Create optimized production build
npm run build

# Outputs to ./dist/
# Contains:
# - index.html
# - assets/ (JS, CSS, images with content hashes)
```

The build output can be served by any static web server.

## Docker Support

The frontend includes a multi-stage Dockerfile for efficient containerization:

### Development

```bash
docker build -t trackerhub-frontend-dev --target development .
```

### Production

```bash
docker build -t trackerhub-frontend-production --target production .
```

## Environment Variables in Docker

When running via Docker Compose, environment variables can be set in:

- `docker-compose-dev.yml` for development
- `docker-compose-prod.yml` for production

Example:

```yaml
environment:
  - VITE_API_URL=/api
```

## Troubleshooting

### "Failed to resolve module" errors

1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Ensure Node.js version is compatible (v20+)

### CSS not applying

1. Verify Tailwind is properly installed
2. Check that `index.css` imports Tailwind
3. Ensure classes are spelled correctly
4. Verify content paths in `tailwind.config.js` (if customized)

### Proxy not working in development

1. Check `vite.config.js` server.proxy configuration
2. Verify backend is running and accessible
3. Ensure API requests are made to paths starting with `/api`

### HMR not working

1. Save files to trigger updates (autosave may be disabled)
2. Check browser console for HMR connection errors
3. Verify network connectivity if accessing from another device

## Future Enhancements

Based on the current implementation, planned improvements include:

- [ ] Implement actual UI components for tracker visualization
- [ ] Add map display (using Leaflet, Mapbox, or similar)
- [ ] Create configuration forms for beacons and maps
- [ ] Add real-time position updates via WebSocket
- [ ] Implement loading states and error handling
- [ ] Add unit and integration tests
- [ ] Implement responsive layouts for mobile devices
- [ ] Add internationalization (i18n) support
- [ ] Optimize bundle size with code splitting
- [ ] Implement service worker for PWA capabilities

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- React team for the wonderful UI library
- Vite team for the fast build tool
- Tailwind CSS team for the utility-first CSS framework
- ESLint team for maintaining code quality standards
