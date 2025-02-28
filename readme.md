# Vendor Management System (VMS)

A full-stack application for managing vendors, documents, and compliance in the Construction & Real Estate industry.

![Tech Stack](https://img.shields.io/badge/tech_stack-Node.js_|_React_|_PostgreSQL_|_Docker-success)

## Features ✨
- JWT-based user authentication (Admin/Vendor roles)
- Vendor management with compliance tracking
- Document upload/management with expiration tracking
- Dockerized PostgreSQL database
- REST API backend with Express.js
- Modern React frontend with Tailwind CSS
- Automated database migrations

## Prerequisites 📋
- Node.js v18+
- Docker & Docker Compose
- PostgreSQL client (optional)

---

# Getting Started 🚀

## 1. Local Development Setup

### Clone Repository

git clone https://github.com/yourusername/vendor-management-system.git
cd vendor-management-system
Install Dependencies
bash
Copy
# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
Configure Environment
Create .env file in /backend:


DB_HOST=localhost
DB_PORT=5432
DB_NAME=vms_dev
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your_secure_secret_here
JWT_EXPIRY=24h
2. Running with Docker 🐳
Start Containers

docker-compose up --build
Services will be available at:

Backend API: http://localhost:3000

Frontend: http://localhost:5173

PostgreSQL: postgres://postgres:postgres @localhost:5432/vms_dev

Stop Containers

docker-compose down
3. Database Migrations 🛢️
Run Initial Setup
bash
Copy
# Make script executable
chmod +x init-db.sh

# Run migrations (and seeds if needed)
./init-db.sh --seed
Manual Migration Commands

# Run migrations
docker exec vms-backend npx knex migrate:latest

# Rollback migrations
docker exec vms-backend npx knex migrate:rollback

Project Structure 📂
├── backend/              # Node.js/Express API
│   ├── config/          # Database configuration
│   ├── controllers/     # Business logic
│   ├── db/              # Database migrations
│   ├── routes/          # API endpoints
│   └── ...             
│
├── frontend/            # React application
│   ├── public/         
│   ├── src/            
│   └── ...             
│
├── db/                  # Database init scripts
├── docker-compose.yml   # Container orchestration
└── init-db.sh           # Database setup script

API Endpoints 🔌
Method	Endpoint	Description
POST	/api/auth/register	User registration
POST	/api/auth/login	User login
GET	/api/auth/me	Get current user
GET	/api/vendors	List all vendors
GET	/api/vendors/:id	Get single vendor
Troubleshooting 🔧
Database Connection Issues:

Verify PostgreSQL is running: docker ps

Check logs: docker logs vms-postgres

Test connection: pg_isready -h localhost -p 5432

Migration Errors:

Ensure UUID extension is created:

docker exec vms-postgres psql -U postgres -d vms_dev -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
Port Conflicts:

Update ports in docker-compose.yml if default ports are in use

💡 Pro Tip: Use Postman to test API endpoints and TablePlus for database inspection.