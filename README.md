# QMate

QMate is a proposed queue-management platform for government offices. It replaces crowded, paper-based waiting lines with organized digital queues for individual service counters. Citizens can join the queue for the service they need, while office employees manage that queue and officials monitor service delivery and employee performance from dedicated panels.

## The Problem

Government offices often run several service counters at once, each with a different purpose and waiting line. Without a shared, live view, citizens may wait without knowing their place or when they will be served, employees have limited tools for handling missed turns, and management has little consistent data about how queues are moving.

## How QMate Works

1. An office configures its service counters and assigns employees to manage them.
2. A citizen selects the required service and joins its counter queue.
3. Geofencing can be used to confirm that a citizen is at or near the office before marking them as arrived. Arrival rules should be configurable for each office.
4. The assigned employee calls the next eligible citizen and updates the queue as service progresses.
5. Live queue changes are shared with the relevant panels over WebSockets.
6. Higher-level officials review operational and employee performance information across the office or organization.

## Planned Features

- **Separate queues by service counter:** Citizens wait in the queue relevant to their requested service, rather than one undifferentiated line.
- **Geofenced arrival confirmation:** Arrival status can be based on the citizen's location relative to the office, subject to office-configured distance and timing rules.
- **Live queue updates:** WebSocket communication can keep citizen, employee, and official views synchronized as turns are called and statuses change.
- **Employee queue controls:** Employees can call the next person, mark a service as in progress or complete, and record exceptions.
- **No-show and late-arrival handling:** Configurable grace periods, missed-turn statuses, re-queue or skip rules, and employee overrides can help keep the queue moving while treating citizens consistently.
- **Official monitoring panel:** Authorized officials can review queue activity and service metrics across employees and counters.
- **Performance reporting:** Potential measures include people served, average waiting and service times, queue volumes, and counter utilization. Metrics should be interpreted in context and made transparent to staff.
- **Role-based access:** Separate experiences and permissions for citizens, counter employees, office administrators, and higher-level officials.

## Benefits

- **Less time spent in physical lines:** Citizens can see queue progress and avoid waiting shoulder-to-shoulder for their turn.
- **Clearer expectations:** Queue position and status updates make the service process easier to understand.
- **More consistent queue handling:** Shared rules for arrivals, missed turns, and exceptions reduce ad hoc decisions.
- **Better use of counter capacity:** Employees can see the next eligible person and respond to delays or counter changes.
- **Operational visibility:** Managers can identify busy services, bottlenecks, and staffing needs using queue data.
- **Accountability with context:** Performance information can support coaching and service improvement rather than relying only on anecdotal reports.
- **A foundation for accessible public service:** Digital queue information can be complemented by in-office assistance and non-digital options for citizens who cannot or do not wish to use a smartphone.

## Technology

- **Frontend:** React, Vite, GSAP, and Font Awesome
- **Backend:** Node.js and Express.js
- **Real-time communication:** WebSockets
- **Database:** PostgreSQL
- **Planned hosting:** Vercel for the frontend and Render for the backend
- **Development assistance:** GitHub Copilot

## Project Status

Currently under development

## Team

- **Om Gangajaliya** - Leader
- **Nikhil Gangajaliya** - Team Member

## Development Setup

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Available frontend checks and build commands, run from `frontend/`:

```bash
npm run lint
npm run build
npm run preview
```

### Backend

```bash
cd backend
npm install
npm run dev
```

For local development, copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL`, `DB_SSL`, and a random `JWT_SECRET` of at least 32 characters. Set `OFFICE_TIMEZONE` to the IANA timezone used by the government office (defaults to `Asia/Kolkata`) for same-day booking-hour checks. Copy `frontend/.env.example` to `frontend/.env` to configure `VITE_API_URL`; it should point to the backend origin. Keep `.env` files out of version control.

The API checks the database connection before listening and exposes `GET /health` as a database health check. Citizen registration and login are available at `POST /api/auth/register` and `POST /api/auth/login`.

Before enabling citizen queue booking on an existing database, run `backend/src/db/migrations/001_queue_booking_metadata.sql` once against the Render PostgreSQL database. It ensures the office-level `buffer_time_minutes` column exists and creates the employee holiday table used to disable booking on holiday dates.

On Render, add `DATABASE_URL`, `DB_SSL=true`, `JWT_SECRET`, `CORS_ORIGINS`, and `OFFICE_TIMEZONE` to the backend web service. `CORS_ORIGINS` must include the deployed frontend origin. Set the frontend's `VITE_API_URL` to the backend service origin and rebuild/redeploy the frontend after changing it. Use `npm start` as the backend start command.
