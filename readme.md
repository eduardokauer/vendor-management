# Vendor Management System (VMS)

![Tech Stack](https://img.shields.io/badge/tech_stack-Node.js_|_React_|_PostgreSQL_|_Docker-blue)

A full-stack application for managing vendors, documents, and compliance in the Construction & Real Estate industry.

## Features
- JWT-based authentication (Admin/Vendor roles)
- Vendor compliance tracking
- Document management with expiration alerts
- Dockerized PostgreSQL + Express.js + React stack
- Automated database migrations

## Prerequisites
- Docker & Docker Compose
- Node.js 18.x+
- PostgreSQL client (optional)

## Quick Start

1. Start the development services:

   ```bash
   docker compose up --build -d
   ```

2. Run development migrations:

   ```bash
   chmod +x init-db.sh
   ./init-db.sh
   ```

3. Open the applications:

   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000
   - PostgreSQL: `postgresql://postgres:postgres@localhost:5432/vms_dev`

4. Optional test service:

   ```bash
   docker compose --profile test up --build backend-test
   ```

## Development Notes

- The root documentation file is `readme.md`.
- The Compose services are `postgres`, `backend-dev`, `frontend`, and optional `backend-test`.
- Development uses bind mounts for hot reload in both frontend and backend containers.
- There is no development seed file in this repository. Seed data exists only for tests.

## Project Structure

    backend/
    ├── config/       # DB configuration
    ├── controllers/  # Business logic
    ├── db/           # Knex migrations
    ├── routes/       # API endpoints
    └── index.js      # Server entrypoint
    
    frontend/
    ├── public/       # Static assets
    ├── src/          # React components
    └── vite.config.js

## Environment Configuration

Create `.env` file in `/backend`:

```env
DB_HOST=postgres
DB_PORT=5432
DB_NAME=vms_dev
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your_secure_secret_here
JWT_EXPIRY=24h
```

## Common Commands

- Start development:

  ```bash
  docker compose up --build -d
  ```

- Run migrations:

  ```bash
  docker compose exec backend-dev npx knex migrate:latest
  ```

- Access PostgreSQL from the container:

  ```bash
  docker compose exec postgres psql -U postgres -d vms_dev
  ```

- View backend logs:

  ```bash
  docker compose logs -f backend-dev
  ```

- Run the frontend test container:

  ```bash
  docker compose --profile test up --build backend-test
  ```

## Core API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/vendors` | List all vendors |
| GET | `/api/vendors/:id` | Get single vendor |

## Testing

```bash
# Run all backend tests
docker compose --profile test up --build backend-test

# Run tests with coverage inside the backend test image
docker compose run --rm backend-test npm run test:cov
```
