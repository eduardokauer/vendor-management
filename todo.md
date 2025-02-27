# VMS Project TODO Checklist

This checklist provides a thorough step-by-step guide for developing the Vendor Management Software (VMS). Each section builds on the previous one, ensuring incremental progress and integration at every stage.

---

## Iteration 1: Foundational Setup
- [x] **Repository & Directory Structure:**
  - [x] Initialize a new Git repository.
  - [x] Create top-level directories: `/backend` and `/frontend`.

- [x] **Backend Setup:**
  - [x] Initialize a Node.js project in `/backend` (using `npm init`).
  - [x] Install Express.js.
  - [x] Create an `index.js` file that:
    - [x] Sets up an Express server.
    - [x] Implements a `/api/hello` endpoint returning "Hello World".

- [ ] **Frontend Setup:**
  - [x] Initialize a React project in `/frontend` using Vite.
  - [x] Set up Tailwind CSS (following the official Tailwind installation steps).
  - [x] Create a basic React component (e.g., `App.jsx`) that displays “Welcome to VMS”.

- [x] **Wiring & Documentation:**
  - [x] Provide instructions to run both backend and frontend concurrently in separate terminal windows.

---

## Iteration 2: Backend Core Infrastructure – Database and Authentication
- [ ] **Database Integration:**
  - [ ] Set up a local PostgreSQL database.
  - [ ] Install and configure Knex.js.
  - [ ] Create migration scripts for:
    - [ ] **Users Table:**  
      - Columns: `id` (UUID, primary key), `email`, `password`, `role` (enum: 'admin' or 'vendor').
    - [ ] **Vendors Table:**  
      - Columns: `id` (UUID, primary key), `name`, `contact_email`, `status` (enum: 'Compliant' or 'Non-Compliant').
    - [ ] **Documents Table:**  
      - Columns: `id` (UUID, primary key), `vendor_id` (foreign key), `type`, `file_url`, `uploaded_at` (timestamp), `expires_at` (date).

- [ ] **Authentication Endpoints:**
  - [ ] Implement user registration endpoint.
  - [ ] Implement user login endpoint:
    - [ ] Use JWT to generate a token on successful login.
  - [ ] Create JWT authentication middleware.
  - [ ] Integrate the middleware into at least one protected test route.

- [ ] **Testing & Documentation:**
  - [ ] Write basic tests to verify database connectivity and authentication.
  - [ ] Document how to run migrations and test the endpoints.

---

## Iteration 3: Frontend Authentication Flow
- [ ] **Login Page Implementation:**
  - [ ] Create a React Login component with form inputs for email and password.
  - [ ] Use React Hook Form for form state management.
  - [ ] Apply Yup for validation and display error messages.

- [ ] **API Integration:**
  - [ ] Use Axios to call the backend login endpoint.
  - [ ] On successful login, store the JWT token in global state via React Context API.

- [ ] **Routing and Redirection:**
  - [ ] Set up React Router:
    - [ ] Redirect users to a Dashboard page after login.
    - [ ] Create a placeholder Dashboard component that confirms authentication.

- [ ] **Wiring & Error Handling:**
  - [ ] Integrate the Login page into the overall app routing.
  - [ ] Implement error handling for failed login attempts.
  - [ ] Document instructions for running the frontend with backend integration.

---

## Iteration 4: Backend – Vendor and Document Management Endpoints
- [ ] **Vendor Management Endpoints:**
  - [ ] Create an endpoint to add a new vendor.
  - [ ] Create an endpoint to update an existing vendor.
  - [ ] Create an endpoint to delete a vendor.
  - [ ] Create an endpoint to retrieve a list of vendors (include pagination/search if possible).

- [ ] **Document Management Endpoints:**
  - [ ] Create an endpoint for uploading documents (support various file types).
  - [ ] Create an endpoint for downloading documents.
  - [ ] Implement functionality for:
    - [ ] Managing document versions.
    - [ ] Tracking expiration dates.
    - [ ] Marking vendors as 'Compliant' or 'Non-Compliant' based on document validity.

- [ ] **File Storage Integration:**
  - [ ] Configure local file storage using a Docker volume.
  - [ ] Implement an environment variable (e.g., `NODE_ENV`) toggle for local vs. Firebase Storage integration.

- [ ] **Wiring & Testing:**
  - [ ] Protect all new endpoints with JWT authentication middleware.
  - [ ] Write tests for these endpoints.
  - [ ] Document API usage with tools like Postman or curl.

---

## Iteration 5: Frontend – Vendor Management and Document Handling UI
- [ ] **Vendor Management UI:**
  - [ ] Create a Vendor Management page that displays a searchable, paginated list of vendors.
  - [ ] Develop forms for adding/editing vendor profiles.
  - [ ] Display the compliance status for each vendor.

- [ ] **Document Handling UI:**
  - [ ] Build a Document Upload component with drag-and-drop functionality.
  - [ ] Display a list or table of uploaded documents:
    - [ ] Show version history.
    - [ ] Indicate expiration dates using color-coded warnings.

- [ ] **API Integration:**
  - [ ] Use Axios to integrate with backend vendor and document endpoints.
  - [ ] Handle responses and display error messages appropriately.

- [ ] **Wiring & Documentation:**
  - [ ] Integrate these UI components into the main app routing (accessible via the Dashboard).
  - [ ] Provide clear instructions on component-backend integration.

---

## Iteration 6: Backend – Notification and Email Integration
- [ ] **Email Notifications:**
  - [ ] Integrate Nodemailer for sending emails.
  - [ ] Implement logic to send automated reminders:
    - [ ] Reminders for vendors: 30, 7, and 1 day before document expiration.
    - [ ] Weekly compliance summary emails to admin users.

- [ ] **Scheduled Tasks:**
  - [ ] Use a scheduling library (e.g., node-cron) to automate email notifications.
  - [ ] Ensure the scheduler queries the database and compiles the necessary data.

- [ ] **Wiring & Configuration:**
  - [ ] Wire the email notification logic into the Express application.
  - [ ] Securely configure email credentials via environment variables.
  - [ ] Write tests to simulate expiration dates and verify email functionality.

---

## Iteration 7: Comprehensive Testing and Integration
- [ ] **Unit Testing:**
  - [ ] Write unit tests for backend endpoints using Jest and Supertest.
  - [ ] Write unit tests for frontend components using React Testing Library.

- [ ] **Integration Testing:**
  - [ ] Develop integration tests covering:
    - [ ] User authentication.
    - [ ] Vendor management.
    - [ ] Document upload and retrieval.

- [ ] **End-to-End Testing:**
  - [ ] Set up a Cypress testing suite to simulate complete user flows (e.g., from login to document management and email notifications).

- [ ] **Wiring & Documentation:**
  - [ ] Ensure all tests run successfully.
  - [ ] Document test suite execution and how to add further tests.
  - [ ] Add test scripts to the package.json files for both backend and frontend.

---

## Iteration 8: Deployment Preparation (Post-System Development)
*Note: This phase is to be handled only after the system development is fully complete and tested.*

- [ ] **Dockerization:**
  - [ ] Create Dockerfiles for backend, frontend, and the database.
  
- [ ] **Deployment Setup:**
  - [ ] Set up deployment configuration on Railway.app.
  - [ ] Configure environment variables for production.

- [ ] **CI/CD Pipeline:**
  - [ ] Set up a CI/CD pipeline using GitHub Actions for automated testing and deployment.

- [ ] **Monitoring & Final Testing:**
  - [ ] Establish monitoring for production.
  - [ ] Run final deployment tests and performance checks.
  
- [ ] **Documentation:**
  - [ ] Provide detailed deployment instructions for future reference.

---
