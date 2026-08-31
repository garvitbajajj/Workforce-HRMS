-- ══════════════════════════════════════════════════════════════
-- WorkForce HRMS - PostgreSQL Schema
-- Run once to initialize the database
-- ══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Departments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL UNIQUE,
  head_id       UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Users (auth) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'employee'
                  CHECK (role IN ('admin', 'hr', 'team_leader', 'employee')),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Employees ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  emp_code       VARCHAR(20) UNIQUE NOT NULL,
  first_name     VARCHAR(100) NOT NULL,
  last_name      VARCHAR(100) NOT NULL,
  phone          VARCHAR(20),
  department_id  UUID REFERENCES departments(id),
  designation    VARCHAR(150),
  joining_date   DATE,
  salary         NUMERIC(12, 2) DEFAULT 0,
  manager_id     UUID REFERENCES employees(id),
  office_ip      VARCHAR(50),
  geo_lat        VARCHAR(30),
  geo_lng        VARCHAR(30),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE departments ADD CONSTRAINT fk_dept_head
  FOREIGN KEY (head_id) REFERENCES employees(id) ON DELETE SET NULL;

-- ── Attendance Logs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date    DATE NOT NULL,
  clock_in     TIMESTAMPTZ NOT NULL,
  clock_out    TIMESTAMPTZ,
  hours_worked NUMERIC(4, 2),
  is_late      BOOLEAN DEFAULT FALSE,
  early_logout BOOLEAN DEFAULT FALSE,
  ip_address   VARCHAR(60),
  status       VARCHAR(20) DEFAULT 'present'
                 CHECK (status IN ('present', 'absent', 'half_day', 'holiday', 'wfh')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, work_date)
);

-- ── Leave Balances ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_balances (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year             INT NOT NULL,
  paid_balance     NUMERIC(5, 2) DEFAULT 0,
  unpaid_balance   NUMERIC(5, 2) DEFAULT 0,
  carried_forward  NUMERIC(5, 2) DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, year)
);

-- ── Leave Requests ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  approved_by     UUID REFERENCES employees(id),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  total_days      INT NOT NULL,
  leave_type      VARCHAR(20) NOT NULL CHECK (leave_type IN ('paid', 'unpaid')),
  status          VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reason          TEXT,
  rejection_note  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notifications ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL,
  message      TEXT,
  type         VARCHAR(20) DEFAULT 'info'
                 CHECK (type IN ('info', 'success', 'warning', 'danger')),
  is_read      BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Holidays ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS holidays (
  id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date     DATE NOT NULL UNIQUE,
  name     VARCHAR(200) NOT NULL,
  year     INT GENERATED ALWAYS AS (EXTRACT(YEAR FROM date)::INT) STORED
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_attendance_employee ON attendance_logs(employee_id);
CREATE INDEX idx_attendance_date ON attendance_logs(work_date);
CREATE INDEX idx_leave_req_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_req_status ON leave_requests(status);
CREATE INDEX idx_notif_employee ON notifications(employee_id, is_read);
CREATE INDEX idx_leave_bal_emp ON leave_balances(employee_id, year);

-- ── Seed: Default Departments ─────────────────────────────────
INSERT INTO departments (name) VALUES
  ('Engineering'),
  ('Product'),
  ('Design'),
  ('HR'),
  ('Finance')
ON CONFLICT (name) DO NOTHING;

-- ── Seed: Admin User ──────────────────────────────────────────
-- Password: admin123 (change after first login!)
-- bcrypt hash of "admin123"
INSERT INTO users (email, password_hash, role) VALUES
  ('admin@company.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh.i', 'admin')
ON CONFLICT (email) DO NOTHING;

-- ── Seed: Public Holidays 2025 ────────────────────────────────
INSERT INTO holidays (date, name) VALUES
  ('2025-01-26', 'Republic Day'),
  ('2025-04-14', 'Dr. Ambedkar Jayanti'),
  ('2025-04-18', 'Good Friday'),
  ('2025-05-01', 'Maharashtra Day'),
  ('2025-08-15', 'Independence Day'),
  ('2025-10-02', 'Gandhi Jayanti'),
  ('2025-10-24', 'Dussehra'),
  ('2025-11-01', 'Diwali'),
  ('2025-12-25', 'Christmas')
ON CONFLICT (date) DO NOTHING;

-- ── Seed: Sample Employees (10) ──────────────────────────────
INSERT INTO employees (emp_code, first_name, last_name, phone, department_id, designation, joining_date, salary)
VALUES
  ('EMP001', 'Alice',  'Sharma',  '9123450001', (SELECT id FROM departments WHERE name='Engineering'), 'Software Engineer', '2024-01-15', 75000.00),
  ('EMP002', 'Rahul',  'Verma',   '9123450002', (SELECT id FROM departments WHERE name='Product'),     'Product Manager',  '2023-07-01', 85000.00),
  ('EMP003', 'Priya',  'Kumar',   '9123450003', (SELECT id FROM departments WHERE name='Design'),      'UX Designer',       '2022-11-10', 65000.00),
  ('EMP004', 'Vikram', 'Singh',   '9123450004', (SELECT id FROM departments WHERE name='Engineering'), 'DevOps Engineer',   '2024-03-20', 72000.00),
  ('EMP005', 'Sana',   'Patel',   '9123450005', (SELECT id FROM departments WHERE name='HR'),          'HR Executive',      '2021-05-04', 50000.00),
  ('EMP006', 'Ankit',  'Mehta',   '9123450006', (SELECT id FROM departments WHERE name='Finance'),     'Accountant',        '2020-09-15', 54000.00),
  ('EMP007', 'Neha',   'Rao',     '9123450007', (SELECT id FROM departments WHERE name='Engineering'), 'Frontend Engineer', '2023-02-01', 70000.00),
  ('EMP008', 'Rohan',  'Gupta',   '9123450008', (SELECT id FROM departments WHERE name='Product'),     'Business Analyst',  '2022-06-12', 63000.00),
  ('EMP009', 'Kavya',  'Iyer',    '9123450009', (SELECT id FROM departments WHERE name='Design'),      'Graphic Designer',  '2021-12-01', 48000.00),
  ('EMP010', 'Manish', 'Joshi',   '9123450010', (SELECT id FROM departments WHERE name='Engineering'), 'QA Engineer',       '2023-08-22', 56000.00)
ON CONFLICT (emp_code) DO NOTHING;

-- ── Monthly Accrual Function ──────────────────────────────────
CREATE OR REPLACE FUNCTION accrue_monthly_leaves()
RETURNS void AS $$
BEGIN
  UPDATE leave_balances
  SET paid_balance = paid_balance + 1.75,
      updated_at = NOW()
  WHERE year = EXTRACT(YEAR FROM NOW())::INT;
END;
$$ LANGUAGE plpgsql;

-- Run monthly accrual on 1st of each month (cron job)
-- SELECT cron.schedule('0 0 1 * *', 'SELECT accrue_monthly_leaves()');
-- (Requires pg_cron extension on Supabase or neon.tech)

COMMENT ON TABLE employees IS 'Core employee records linked to user auth';
COMMENT ON TABLE attendance_logs IS 'Daily clock-in/out with IP and late detection';
COMMENT ON TABLE leave_balances IS 'Per-employee per-year leave balance tracking';
COMMENT ON TABLE leave_requests IS 'Leave requests with full approval workflow';
