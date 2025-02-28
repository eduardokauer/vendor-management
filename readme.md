# Vendor Management System (VMS)

![Tech Stack](https://img.shields.io/badge/tech_stack-Node.js_|_React_|_PostgreSQL_|_Docker-blue)

A full-stack application for managing vendors, documents, and compliance in the Construction & Real Estate industry.

## Features ✨
- JWT-based authentication (Admin/Vendor roles)
- Vendor compliance tracking
- Document management with expiration alerts
- Dockerized PostgreSQL + Express.js + React stack
- Automated database migrations

## Prerequisites 📋
- Docker & Docker Compose
- Node.js 18.x+
- PostgreSQL client (optional)

██████████████████████████████████████████
## 🚀 Quick Start

1. Clone repository:
    $ git clone https://github.com/yourusername/vms.git
    $ cd vms

2. Start containers:
    $ docker-compose up --build

3. Run migrations:
    $ chmod +x init-db.sh
    $ ./init-db.sh --seed

Services will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- PostgreSQL: postgres://postgres:postgres@localhost:5432/vms_dev
██████████████████████████████████████████

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

Create .env file in /backend:

    DB_HOST=postgres
    DB_PORT=5432
    DB_NAME=vms_dev
    DB_USER=postgres
    DB_PASSWORD=postgres
    JWT_SECRET=your_secure_secret_here
    JWT_EXPIRY=24h

## Common Commands

▸ Start development:
    $ docker-compose up --build

▸ Run migrations:
    $ docker exec vms-backend npx knex migrate:latest

▸ Access PostgreSQL:
    $ docker exec -it vms-postgres psql -U postgres

▸ View backend logs:
    $ docker logs vms-backend -f

## API Reference

│ Method │ Endpoint           │ Description        │
├────────┼────────────────────┼────────────────────┤
│ POST   │ /api/auth/register │ User registration  │
│ POST   │ /api/auth/login    │ User login         │
│ GET    │ /api/vendors       │ List all vendors   │
│ GET    │ /api/vendors/:id   │ Get vendor details │
