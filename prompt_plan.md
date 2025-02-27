### Prompt 1: Project Initialization and Foundational Setup

We are building a Vendor Management Software (VMS) for Construction & Real Estate businesses. The first step is to set up the project structure. Please generate code and setup instructions that do the following:

1. **Repository and Directory Structure:**
   - Initialize a new Git repository.
   - Create two top-level directories: `/backend` and `/frontend`.

2. **Backend Setup:**
   - Initialize a Node.js project inside `/backend` (using `npm init`).
   - Install Express.js.
   - Create a basic `index.js` file that sets up an Express server with a `/api/hello` endpoint returning a simple "Hello World" message.

3. **Frontend Setup:**
   - Initialize a React project in `/frontend` using Vite.
   - Set up Tailwind CSS (using the official Tailwind installation steps) for styling.
   - Create a basic React component (e.g., `App.jsx`) that displays “Welcome to VMS” on the home page.

4. **Wiring:**
   - Ensure that the backend and frontend are independent but document instructions on how to run both concurrently (for example, using separate terminal windows).

This foundational code should be self-contained, with clear instructions on how to install dependencies and run both parts.

### Prompt 2: Backend Core Infrastructure – Database and Authentication Setup

Building on the initial setup, please now extend the backend with the following features:

1. **Database Integration:**
   - Set up PostgreSQL as the database.
   - Install Knex.js and configure it.
   - Create migration scripts for the following tables based on the specification:
     - `Users`: Columns include `id` (UUID, primary key), `email`, `password`, and `role` (enum with values 'admin' or 'vendor').
     - `Vendors`: Columns include `id` (UUID, primary key), `name`, `contact_email`, and `status` (enum: 'Compliant' or 'Non-Compliant').
     - `Documents`: Columns include `id` (UUID, primary key), `vendor_id` (foreign key), `type`, `file_url`, `uploaded_at` (timestamp), and `expires_at` (date).

2. **Authentication Endpoints:**
   - Implement user registration and login endpoints.
   - Use JWT-based authentication. On successful login, the endpoint should return a signed JWT.
   - Include middleware for protecting routes using the JWT.

3. **Wiring:**
   - Integrate the database configuration with your Express app.
   - Ensure that authentication middleware is wired into at least one test route to demonstrate protected access.

Provide clear comments and instructions on how to run the migration and test the authentication endpoints.


### Prompt 3: Frontend Authentication Flow

Now, enhance the frontend by implementing a secure login flow. Please generate code and instructions that:

1. **Login Page:**
   - Create a React component for a Login page that includes form inputs for email and password.
   - Use React Hook Form for handling form state and Yup for validation.
   - Display validation error messages appropriately.

2. **API Integration:**
   - Use Axios to call the backend login endpoint.
   - On successful login, store the returned JWT token in a global state (using React Context API).

3. **Routing and Redirection:**
   - Set up React Router so that after successful authentication, the user is redirected to a basic Dashboard page.
   - Create a placeholder Dashboard component that confirms the user is logged in.

4. **Wiring:**
   - Ensure that the Login page is integrated into the overall app routing.
   - Provide instructions on how to run the frontend so that it communicates with the backend’s authentication endpoint.

Ensure that the code builds on the initial setup and includes error handling for failed login attempts.


### Prompt 4: Backend – Vendor and Document Management Endpoints

With the authentication foundation in place, please extend the backend to support vendor and document management. Generate code for the following:

1. **Vendor Management Endpoints:**
   - Create REST API endpoints to:
     - Add a new vendor.
     - Update an existing vendor.
     - Delete a vendor.
     - Retrieve a list of vendors (with pagination and search if possible).

2. **Document Management Endpoints:**
   - Create endpoints for:
     - Uploading documents (supporting various file types).
     - Downloading documents.
     - Managing document versions and tracking expiration dates.
   - Implement logic to mark a vendor as 'Compliant' or 'Non-Compliant' based on document validity.

3. **File Storage Integration:**
   - For local development, configure file storage using a Docker volume.
   - Include an environment variable (e.g., NODE_ENV) to toggle between local file storage and a placeholder for Firebase Storage integration.

4. **Wiring:**
   - Ensure these new endpoints are protected by the JWT authentication middleware.
   - Document how these endpoints interact with the database migrations created earlier.

Include comments that explain how each endpoint works and how to test them with a tool like Postman or curl.


### Prompt 5: Frontend – Vendor Management and Document Handling UI

Enhance the frontend to integrate with the new backend endpoints for vendor and document management. Please generate code for:

1. **Vendor Management UI:**
   - Create a Vendor Management page that:
     - Displays a list of vendors in a searchable and paginated table.
     - Provides forms to add or edit vendor profiles.
     - Shows compliance status for each vendor.

2. **Document Handling UI:**
   - Build a Document Upload component with a drag-and-drop interface.
   - Display a table or list showing the uploaded documents, including version history and expiration dates (use color-coding for warnings).

3. **API Integration:**
   - Use Axios to call the backend vendor and document endpoints.
   - Handle responses and error messages appropriately.
  
4. **Wiring:**
   - Ensure these UI components are integrated into the main application routing (for example, accessible from the Dashboard).
   - Provide instructions on how the frontend components are wired with the backend endpoints.

Add comments and documentation in the code to explain how the UI interacts with the backend and what environment configurations are required.

### Prompt 6: Backend – Notification and Email Integration

Now, extend the backend to handle automated notifications. Please generate code for:

1. **Email Notifications:**
   - Integrate Nodemailer to send email notifications.
   - Create logic to send:
     - Automated reminders to vendors (30, 7, and 1 day before document expiration).
     - Weekly compliance summary emails to admin users.

2. **Scheduled Tasks:**
   - Use a scheduling library (e.g., node-cron) to trigger these email notifications at the appropriate times.
   - Ensure the tasks query the database for upcoming expirations and compile the necessary information.

3. **Wiring:**
   - Wire the email notification logic into your existing Express application.
   - Include comments explaining how to configure email credentials securely (e.g., using environment variables).

Document testing instructions so that a developer can simulate expiration dates and verify that the correct emails are sent.

### Prompt 7: Comprehensive Testing and Integration

For the final development iteration (before deployment), focus on testing and ensuring all parts work together. Please generate code and instructions for:

1. **Unit Tests:**
   - Write unit tests for the backend endpoints using Jest and Supertest.
   - Write unit tests for the frontend components using React Testing Library.

2. **Integration Tests:**
   - Create tests that cover critical API flows, such as user authentication, vendor management, and document uploads.
   - Ensure these tests simulate both successful and error scenarios.

3. **End-to-End Tests:**
   - Set up a basic Cypress testing suite to cover complete user flows from login to document management and email notifications.
  
4. **Wiring and Refactoring:**
   - Verify that all tests run successfully and that the frontend and backend communicate as expected.
   - Document any necessary steps to run the entire test suite.
   - Provide instructions on how to refactor or add new tests as the project evolves.

Ensure that all test code is integrated into the project repository and that the test scripts are added to the package.json files for both frontend and backend.
