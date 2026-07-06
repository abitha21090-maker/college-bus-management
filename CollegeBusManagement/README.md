# College Bus Management System

A full-stack app for managing a college's bus fleet: admins manage buses,
drivers, routes, students, and staff; students and staff register, book a
route, see their assigned bus/driver, track the bus stop-by-stop live, and
file complaints; drivers run the trip and share their live location.

- `server/` — Node.js + Express + MongoDB API. See `server/README.md`.
- `client/` — Plain HTML/CSS/JS frontend (no build step, no framework).

## Portals

| Portal  | Sign up page              | Sign in page          |
|---------|----------------------------|------------------------|
| Student | `student-register.html`    | `student-login.html`   |
| Staff   | `staff-register.html`      | `staff-login.html`     |
| Driver  | `driver-register.html`     | `driver-login.html`    |
| Admin   | `admin-register.html`      | `admin-login.html`     |

All four sign up from the homepage (`client/index.html`).

## Quick start

1. **Backend**
   ```bash
   cd server
   npm install
   # edit .env with your MongoDB URI, a JWT secret, and ADMIN_SIGNUP_CODE
   npm run dev
   ```
   The API listens on `http://localhost:5000` by default.

2. **Frontend**
   Open `client/index.html` directly in a browser, or serve the `client/`
   folder with any static file server (e.g. the VS Code "Live Server"
   extension, or `npx serve client`). The frontend expects the API at
   `http://localhost:5000/api` — change `API_BASE_URL` in
   `client/css/js/main.js` if your backend runs elsewhere.

3. **Create your first admin account**
   Admins now self-register from `client/admin-register.html`, but need the
   shared invite code you set as `ADMIN_SIGNUP_CODE` in `server/.env` (change
   it from the default before going live, and only share it with people who
   should get admin access). Once signed in, use the dashboard to add
   drivers, buses, and routes — or let drivers self-register too.

## How booking + tracking work

1. A student or staff member registers, then submits a **route request**
   (their dept/roll-or-staff-ID, preferred route, and boarding stop).
2. An admin reviews pending requests on the dashboard and **allocates** a
   route/bus if there's a free seat — this links the rider to that bus and
   driver.
3. The driver starts their shift from the Driver portal: **Start trip**
   (departs the first stop), **Mark arrived at next stop** for each stop
   along the route, and **End trip** at the last stop. They can also turn on
   live GPS sharing.
4. Students/staff on that route see, in real time: which stop the bus has
   reached, when it departed, whether it's approaching *their* boarding
   point, and the bus's live position on a map.

## Notes

- Passwords are hashed with bcrypt; sessions use JWTs stored in
  `localStorage` on the client.
- Everyone (student, staff, driver, admin) now has a public sign-up page.
  Admin sign-up is gated by `ADMIN_SIGNUP_CODE` since that role controls the
  whole system.
