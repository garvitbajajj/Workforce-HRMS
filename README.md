# WorkForce HRMS — Developer & AI Onboarding Guide

Welcome to the **WorkForce HRMS (Human Resource Management System)** repository. This document serves as a comprehensive overview of the architecture, database schema, state flow, and operational scripts for developers and AI agents working on this codebase.

---

## 🗂 Project Structure

```
workforce-hrms/
├── index.html              # Frontend entry & global CSS variable
├── vite.config.js          # Vite configuration
├── package.json            # Frontend dependencies (React, Recharts, PapaParse, XLSX)
├── schema.sql              # Initial PostgreSQL schema (outlines tables & relations)
├── src/
│   ├── main.jsx            # Entry point for React
│   ├── App.jsx             # Route layout dispatcher
│   ├── store.jsx           # Global state (React Context + direct Supabase client)
│   ├── supabaseClient.js   # Supabase client initializer
│   ├── components/
│   │   └── Layout.jsx      # Shared UI layout (navigation sidebar, topbar, cards, buttons)
│   └── pages/
│       ├── Login.jsx       # Authentication panel
│       ├── Dashboard.jsx   # Role-based stats widgets & charts
│       ├── Employees.jsx   # Employee directory & directory management
│       ├── Attendance.jsx  # Attendance logs calendar & regularization requests
│       ├── Leaves.jsx      # Leave submission & approval forms
│       ├── Holidays.jsx    # Public holiday list (filtered by office location)
│       ├── Reports.jsx     # Export reports (payroll, leaves, attendance)
│       ├── Profile.jsx     # Logged-in employee details view (emergency contact, bank details)
│       ├── Policies.jsx    # Company policies preview panel (pdf viewer)
│       └── DevDashboard.jsx # Developer console (system health, database stats, query tool)
├── backend/
│   ├── server.js           # Optional Express REST API server
│   ├── package.json        # Backend dependency configurations
│   ├── schema.sql          # PostgreSQL schema (identical to root schema.sql)
│   └── railway.toml        # Production deployment file
└── scripts/
    ├── 1_migrate_employees_table.sql      # Add gender, am, grade, level, doj_month, and job_role columns
    ├── 1b_fix_grade_constraint.sql        # Validates checks on employee grade constraints (HB 1.1 to HB 5.2)
    ├── 2_bulk_create_auth_users.mjs       # Creates Supabase auth credentials from prepared import CSV
    ├── 3_convert_csv_for_import.mjs       # Maps and reformats raw company data CSV for bulk import
    ├── 5_add_profile_fields.sql           # Migration for emergency contact and bank details columns
    ├── 6_add_holiday_locations.sql        # Adds Pune, Indore, Noida, Bangalore location flags to Holidays
    ├── 8_notification_ack.sql             # Adds acknowledged_by column to notifications to track read status
    ├── 9_attendance_corrections.sql       # Schema for the attendance_corrections regularization table
    ├── 10_password_reset_function.sql     # SECURITY DEFINER function to log and notify password requests
    ├── 11_monthly_leave_accrual.sql       # pg_cron routine to auto-accrue 1.75 days of leaves on the 1st of every month
    ├── 12_admin_change_password.sql       # SECURITY DEFINER function enabling admins/HR to change passwords
    ├── 13_add_notification_reactions.sql  # Adds JSONB reactions column to notifications table
    ├── 14_add_dev_role.sql                # Adds is_dev column to employees and assigns developer status
    ├── company_data_template (1).csv      # Template detailing company employees database columns
    ├── create_demo_users.mjs              # Seeds testing profiles for Admin, HR, Manager, and Employee
    ├── employees_import.csv               # Post-processed employee directory ready for database upload
    ├── employees_raw.csv                  # Raw employee directory data prior to formatting
    ├── Leave, Attendance and Holiday Policy.pdf # Official PDF handbook of company regulations
    ├── Leave_Attendance_Policy.txt        # Plaintext format of Leave, Attendance, and Holiday regulations
    ├── seed_holidays_2026.mjs             # Populates holidays table with regional flags for 2026
    ├── update_am_from_csv.mjs             # Imports manager mapping, grade, level, and doj_month from CSV
    └── update_manager_relationships.sql   # Updates employee manager_id keys based on team leader structure
```

---

## 🤖 AI Agent Quick Start & Architecture Context

If you are an AI assistant working on this project, pay close attention to these patterns:

### 1. Unified State & Database Mapping ([src/store.jsx](file:///c:/Users/GARVIT/Desktop/Huntsmen-Barons_HRMS/src/store.jsx))
* **Direct Supabase Binding**: The frontend uses `@supabase/supabase-js` directly to select, insert, update, and delete rows in your Supabase DB. State variables synchronise automatically via the `loadAllData` function on page loads or mutations.
* **Database ↔ Frontend Mapping**: Database snake_case columns are mapped to camelCase variables in the frontend inside `mapEmployeeFromDb`:
  * `employee_code` → `empCode`
  * `full_name` → `firstName` (split by space) and `lastName`
  * `department` → `departmentId`
  * `joining_date` → `joiningDate`
  * `manager_id` → `managerId`
  * `work_location` → `workLocation`
  * `is_dev` → `isDev`

### 2. System Roles vs. Job Roles
* **`role` (System Role)**: Stored in both the `users` and `employees` tables. Value can be `admin`, `hr`, `team_leader` (mapped/normalized from `manager` via `normalizeRole`), or `employee`. This controls UI accessibility, navigation links, and database query filters (e.g. team leaders only query their own department/direct reports).
* **`job_role` (Job/Functional Role)**: Stored in the `employees` table. Free-form text describing the business designation (e.g. `Talent Specialist`, `Recruitment Specialist`), separate from permissions logic.

### 3. Location-Based Holidays ([src/pages/Holidays.jsx](file:///c:/Users/GARVIT/Desktop/Huntsmen-Barons_HRMS/src/pages/Holidays.jsx))
* The public holiday calendar utilizes boolean toggles (`pune`, `indore`, `noida`, `bangalore`) added to the `holidays` table in the database. 
* Employees default to viewing holidays relevant to their `workLocation` (matched to one of the location flags).

### 4. Developer Console Access ([src/pages/DevDashboard.jsx](file:///c:/Users/GARVIT/Desktop/Huntsmen-Barons_HRMS/src/pages/DevDashboard.jsx))
* Only employees flagged with `isDev = true` (configured via [14_add_dev_role.sql](file:///c:/Users/GARVIT/Desktop/Huntsmen-Barons_HRMS/scripts/14_add_dev_role.sql)) can view the Developer Console. This panel monitors real-time database counts, Supabase ping times, and recent system notifications activity.

---

## ⚡ Setup and Execution (Local & Supabase)

### Frontend Local Run
1. Make sure you have a `.env.local` file in your root folder:
   ```env
   VITE_SUPABASE_URL=https://[your-project-id].supabase.co
   VITE_SUPABASE_ANON_KEY=[your-anon-public-key]
   SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key-for-backend-scripts]
   ```
2. Install dependencies and spin up Vite dev server:
   ```bash
   npm install
   npm run dev
   ```
3. Default credentials for demo accounts (once created via `create_demo_users.mjs`):
   * **Admin**: `demo.admin@company.com` / `Welcome@123`
   * **Team Leader / Manager**: `demo.teamleader@company.com` / `Welcome@123`
   * **HR**: `demo.hr@company.com` / `Welcome@123`
   * **Employee**: `demo.employee@company.com` / `Welcome@123`

---

## 🗄️ Database Tables Schema Reference

The PostgreSQL schema consists of:

### `departments`
* `id` (UUID, Primary Key, Defaults to `uuid_generate_v4()`)
* `name` (VARCHAR, Unique)
* `head_id` (UUID, References `employees.id`)
* `created_at` (TIMESTAMPTZ, Defaults to `NOW()`)

### `employees`
* `id` (UUID, Primary Key, Defaults to `uuid_generate_v4()`)
* `user_id` (UUID, References Supabase Auth / `users.id`)
* `employee_code` (VARCHAR, Unique)
* `full_name` (VARCHAR)
* `email` (VARCHAR, Unique)
* `phone` (VARCHAR)
* `department` (VARCHAR) — Stores department name or ID mapping
* `designation` (VARCHAR)
* `role` (VARCHAR: `admin`, `hr`, `team_leader`, `employee`)
* `joining_date` (DATE)
* `salary` (NUMERIC)
* `manager_id` (UUID, References `employees.id`)
* `gender` (VARCHAR: `Male`, `Female`, `Other`)
* `am` (VARCHAR - Account Manager name string)
* `grade` (VARCHAR - `HB 1.1` to `HB 5.2`)
* `level` (VARCHAR - `Level 1` to `Level 5`)
* `doj_month` (VARCHAR)
* `job_role` (VARCHAR)
* `work_location` (VARCHAR)
* `emergency_contact` (TEXT)
* `bank_details` (TEXT)
* `is_dev` (BOOLEAN, Defaults to `false`)

### `attendance_logs` (tracked as `attendance` table in Supabase)
* `id` (UUID, Primary Key, Defaults to `uuid_generate_v4()`)
* `employee_id` (UUID, References `employees.id`)
* `work_date` (DATE)
* `clock_in` (TIMESTAMPTZ)
* `clock_out` (TIMESTAMPTZ)
* `hours_worked` (NUMERIC)
* `is_late` (BOOLEAN) — Evaluates `true` if clock-in is after `09:30 AM`
* `early_logout` (BOOLEAN) — Evaluates `true` if clock-out is before `05:30 PM`
* `ip_address` (VARCHAR)
* `status` (VARCHAR: `present`, `absent`, `half_day`, `holiday`, `wfh`)

### `leave_balances`
* `id` (UUID, Primary Key, Defaults to `uuid_generate_v4()`)
* `employee_id` (UUID, References `employees.id`)
* `year` (INT)
* `paid_balance` (NUMERIC)
* `unpaid_balance` (NUMERIC)
* `carried_forward` (NUMERIC)
* `updated_at` (TIMESTAMPTZ, Defaults to `NOW()`)

### `leave_requests`
* `id` (UUID, Primary Key, Defaults to `uuid_generate_v4()`)
* `employee_id` (UUID, References `employees.id`)
* `approved_by` (UUID, References `employees.id`)
* `start_date` (DATE)
* `end_date` (DATE)
* `total_days` (INT)
* `leave_type` (VARCHAR: `paid`, `unpaid`)
* `status` (VARCHAR: `pending`, `approved`, `rejected`, `cancelled`)
* `reason` (TEXT)
* `rejection_note` (TEXT)
* `created_at` (TIMESTAMPTZ, Defaults to `NOW()`)
* `updated_at` (TIMESTAMPTZ, Defaults to `NOW()`)

### `notifications`
* `id` (UUID, Primary Key, Defaults to `uuid_generate_v4()`)
* `employee_id` (UUID, References `employees.id`)
* `title` (VARCHAR)
* `message` (TEXT)
* `type` (VARCHAR: `info`, `success`, `warning`, `danger`)
* `is_read` (BOOLEAN, Defaults to `false`)
* `created_at` (TIMESTAMPTZ, Defaults to `NOW()`)
* `acknowledged_by` (UUID[], Defaults to `{}`) — Tracks employee IDs acknowledging the message
* `reactions` (JSONB, Defaults to `{}`) — Stores user reactions

### `holidays`
* `id` (UUID, Primary Key, Defaults to `uuid_generate_v4()`)
* `date` (DATE, Unique)
* `name` (VARCHAR)
* `year` (INT, Generated expression based on `date`)
* `pune` (BOOLEAN, Defaults to `true`)
* `indore` (BOOLEAN, Defaults to `true`)
* `noida` (BOOLEAN, Defaults to `true`)
* `bangalore` (BOOLEAN, Defaults to `true`)

### `attendance_corrections`
* `id` (UUID, Primary Key, Defaults to `uuid_generate_v4()`)
* `employee_id` (UUID, References `employees.id`)
* `work_date` (DATE)
* `clock_in` (TIMESTAMPTZ)
* `clock_out` (TIMESTAMPTZ)
* `reason` (TEXT)
* `status` (VARCHAR: `pending`, `approved`, `rejected`, Defaults to `pending`)
* `approved_by` (UUID, References `employees.id`)
* `created_at` (TIMESTAMPTZ, Defaults to `NOW()`)
* `updated_at` (TIMESTAMPTZ, Defaults to `NOW()`)

---

## 🛠️ Database Setup & Utility Scripts

All schema setup, migrations, and seeder scripts reside in the `scripts/` directory:

### 1. Schema Init & Migrations (PostgreSQL)
* **Initial Setup**: Run `schema.sql` at the root directory in your Supabase SQL editor to create the initial tables.
* **Employee Columns Update**: Execute [1_migrate_employees_table.sql](file:///c:/Users/GARVIT/Desktop/Huntsmen-Barons_HRMS/scripts/1_migrate_employees_table.sql) to add company-specific data columns (grade, gender, level, account manager, job role) to `employees`.
* **Grade Constraints Validation**: Run [1b_fix_grade_constraint.sql](file:///c:/Users/GARVIT/Desktop/Huntsmen-Barons_HRMS/scripts/1b_fix_grade_constraint.sql) to update grading rules (`HB 1.1` - `HB 5.2`).
* **Profile Fields Expansion**: Run [5_add_profile_fields.sql](file:///c:/Users/GARVIT/Desktop/Huntsmen-Barons_HRMS/scripts/5_add_profile_fields.sql) to add emergency contact and banking details columns to the database.
* **Regional Holiday Flags**: Run [6_add_holiday_locations.sql](file:///c:/Users/GARVIT/Desktop/Huntsmen-Barons_HRMS/scripts/6_add_holiday_locations.sql) to add Pune, Indore, Noida, and Bangalore toggles to the `holidays` table.
* **Acknowledge and Read Tracking**: Apply [8_notification_ack.sql](file:///c:/Users/GARVIT/Desktop/Huntsmen-Barons_HRMS/scripts/8_notification_ack.sql) to log user notifications read/acknowledge states.
* **Attendance Regularization Requests**: Apply [9_attendance_corrections.sql](file:///c:/Users/GARVIT/Desktop/Huntsmen-Barons_HRMS/scripts/9_attendance_corrections.sql) to initialize the correction workflow schema.
* **Password Recovery Request Notifications**: Apply [10_password_reset_function.sql](file:///c:/Users/GARVIT/Desktop/Huntsmen-Barons_HRMS/scripts/10_password_reset_function.sql) to enable notification triggers to admin when users request password resets.
* **Monthly Leave Accruals**: Apply [11_monthly_leave_accrual.sql](file:///c:/Users/GARVIT/Desktop/Huntsmen-Barons_HRMS/scripts/11_monthly_leave_accrual.sql) to register a PostgreSQL cron routine (`pg_cron`) accruing 1.75 days of leaves on the 1st of every month automatically.
* **Admin-Privileged Password Resets**: Apply [12_admin_change_password.sql](file:///c:/Users/GARVIT/Desktop/Huntsmen-Barons_HRMS/scripts/12_admin_change_password.sql) to install the security-definer function enabling password modifications directly from the frontend admin dashboard.
* **Reactions Support**: Apply [13_add_notification_reactions.sql](file:///c:/Users/GARVIT/Desktop/Huntsmen-Barons_HRMS/scripts/13_add_notification_reactions.sql) to support notification reactions.
* **Developer System Access Flags**: Run [14_add_dev_role.sql](file:///c:/Users/GARVIT/Desktop/Huntsmen-Barons_HRMS/scripts/14_add_dev_role.sql) to add the dev toggle to employees and provision access.
* **Reporting Managers Synchronization**: Execute [update_manager_relationships.sql](file:///c:/Users/GARVIT/Desktop/Huntsmen-Barons_HRMS/scripts/update_manager_relationships.sql) to establish employee manager mappings in public schema.

### 2. Seeding & Data Utilities (MJS Scripts)
* **Seed Holidays**: Execute `node scripts/seed_holidays_2026.mjs` to populate regional holiday calendars for 2026.
* **Demo Users Setup**: Execute `node scripts/create_demo_users.mjs` to provision dummy credentials (`Welcome@123`) for administrative, HR, management, and general employees.
* **Format Raw CSV Directory**: Run `node scripts/3_convert_csv_for_import.mjs` to scrub, normalize, and export the raw employee Excel CSV data into clean DB-compatible datasets.
* **Register Auth Credentials in Bulk**: Execute `node scripts/2_bulk_create_auth_users.mjs` using `SUPABASE_SERVICE_ROLE_KEY` to automate the registration of authentication users in Supabase Auth from the formatted employee directory CSV.
* **Sync Company Fields**: Execute `node scripts/update_am_from_csv.mjs` to update custom company fields (Grade, Level, Account Manager, joining month) from the CSV data matches.
