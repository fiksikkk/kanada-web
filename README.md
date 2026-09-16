# web-client

Web front end for a smart-home control panel. It renders a pannable/zoomable
floor plan, lets you open a room and control its devices (lights, dimmers,
shutters) in real time over WebSocket, and includes session-based auth with
TOTP two-factor login and an admin screen for managing users and per-room
access.

This client talks to a companion backend service (not included in this repo)
that authenticates users, brokers a WebSocket connection, and relays device
commands/status to an [iRidium](https://iridi.com/) home-automation gateway.

## Stack

- [React 19](https://react.dev/) + [React Router](https://reactrouter.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) for dev server/build
- [oxlint](https://oxc.rs/) for linting

## Features

- Pan/zoom floor-plan view with per-room hotspots
- Live device control over WebSocket: on/off switches, dimmers, shutters
  (open/stop/close + position slider), with optimistic UI updates
- Connection-aware UI: distinguishes "browser ↔ backend" from
  "backend ↔ iRidium gateway" connectivity and disables controls accordingly
- Login with session cookies, TOTP-based 2FA setup/verification, recovery
  codes
- Admin screen to create/edit/delete users and restrict a user's access to
  specific rooms

## Getting started

```bash
npm install
cp .env.example .env   # then edit values for your backend
npm run dev
```

The app expects a compatible backend running separately (see
[Environment variables](#environment-variables) below).

### Scripts

| Script            | Description                              |
| ------------------ | ----------------------------------------- |
| `npm run dev`       | Start the Vite dev server                 |
| `npm run build`     | Type-check and build for production       |
| `npm run preview`   | Preview the production build locally      |
| `npm run typecheck` | Run TypeScript in `--noEmit` mode         |
| `npm run lint`      | Run oxlint                                |

## Environment variables

See [.env.example](.env.example).

| Variable              | Description                                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`     | Base URL of the backend HTTP API. Required in dev when the client and backend run on different ports. Leave empty in production if served same-origin (e.g. behind a reverse proxy). |
| `VITE_WS_URL`           | URL of the backend's WebSocket gateway. Same same-origin behavior as above when left empty.                                                          |

## Project layout

```
src/
  api/           HTTP client and typed request/response shapes
  components/    Shared UI (account menu, error boundary, route guard, ...)
  context/       Auth context/provider
  pages/         Route-level screens (login, 2FA, settings, admin users)
  App.tsx        Floor-plan viewer and device control panel
```

## Note on assets

The app imports its floor plan from `src/assets/floor-plan.png`, which is
**not included in this repo** (gitignored) since it's specific to one real
house. To run the app, drop your own floor plan image at that path — see
[floor-plan.example.svg](src/assets/floor-plan.example.svg) for the expected
aspect ratio (761×1013) and a generic layout generated from the
`ROOM_HOTSPOTS` coordinates in `App.tsx`. Adjust `ROOM_HOTSPOTS` (and
`IMAGE_WIDTH`/`IMAGE_HEIGHT` if your image has a different aspect ratio) to
match your own layout.

## License

MIT — see [LICENSE](LICENSE).
