/**
 * SCRIPT 4: Create Demo Admin, Team Leader, HR, and Employee Accounts
 * ---------------------------------------------------------------
 * This script creates three demo user accounts in Supabase Auth
 * and inserts/links their corresponding employee profile in public.employees.
 *
 * Demo Accounts Created:
 *   1. Admin:       demo.admin@company.com
 *   2. Team Leader: demo.teamleader@company.com
 *   3. HR:          demo.hr@company.com
 *   4. Employee:    demo.employee@company.com
 *
 * Password for all: Welcome@123
 *
 * HOW TO RUN:
 *   1. Make sure SUPABASE_SERVICE_ROLE_KEY is in your .env.local
 *   2. Run: node scripts/create_demo_users.mjs
 * ---------------------------------------------------------------
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// ── Load env variables from .env.local ──────────────────────────────────────
function loadEnv() {
  try {
    const envFile = readFileSync('.env.local', 'utf-8')
    const env = {}
    for (const line of envFile.split('\n')) {
      const [key, ...rest] = line.split('=')
      if (key && rest.length) env[key.trim()] = rest.join('=').trim()
    }
    return env
  } catch {
    console.error('❌ Could not read .env.local file. Make sure you are running this from the project root.')
    process.exit(1)
  }
}

const env = loadEnv()

const SUPABASE_URL = env['VITE_SUPABASE_URL']
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables. Please ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const DEFAULT_PASSWORD = 'Welcome@123'

const DEMO_USERS = [
  {
    email: 'demo.admin@company.com',
    fullName: 'Demo Admin',
    role: 'admin',
    code: 'EMP-DEMO-ADMIN',
    designation: 'System Administrator'
  },
  {
    email: 'demo.teamleader@company.com',
    fullName: 'Demo Team Leader',
    role: 'team_leader',
    code: 'EMP-DEMO-TL',
    designation: 'Engineering Team Leader'
  },
  {
    email: 'demo.hr@company.com',
    fullName: 'Demo HR',
    role: 'hr',
    code: 'EMP-DEMO-HR',
    designation: 'HR Specialist'
  },
  {
    email: 'demo.employee@company.com',
    fullName: 'Demo Employee',
    role: 'employee',
    code: 'EMP-DEMO-EMP',
    designation: 'Recruitment Specialist'
  }
]

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║         Create Demo Testing Accounts — HRMS          ║')
  console.log('╚══════════════════════════════════════════════════════╝\n')

  for (const user of DEMO_USERS) {
    console.log(`👤 Processing ${user.fullName} (${user.email})...`)

    try {
      // 1. Create auth user (skips email verification)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { role: user.role, full_name: user.fullName }
      })

      let userId = authData?.user?.id

      if (authError) {
        if (authError.message.includes('already been registered') || authError.code === 'email_exists') {
          console.log(`  ℹ️  Auth account already exists. Retrieving existing ID...`)
          const { data: userList } = await supabase.auth.admin.listUsers()
          const existing = userList?.users?.find(u => u.email === user.email)
          if (existing) {
            userId = existing.id
          } else {
            throw new Error('Could not find existing user ID in Auth list.')
          }
        } else {
          throw authError
        }
      }

      // 2. Check if employee profile already exists
      const { data: existingEmp } = await supabase
        .from('employees')
        .select('id')
        .eq('email', user.email)
        .maybeSingle()

      if (existingEmp) {
        console.log(`  ℹ️  Employee profile already exists. Updating existing profile...`)
        const { error: updateError } = await supabase
          .from('employees')
          .update({
            user_id: userId,
            role: user.role,
            designation: user.designation,
            employee_code: user.code
          })
          .eq('id', existingEmp.id)

        if (updateError) throw updateError
      } else {
        console.log(`  ➕ Creating new employee profile...`)
        const { data: newEmp, error: insertError } = await supabase
          .from('employees')
          .insert({
            user_id: userId,
            employee_code: user.code,
            full_name: user.fullName,
            email: user.email,
            role: user.role,
            designation: user.designation,
            joining_date: new Date().toISOString().split('T')[0],
            salary: 80000.00,
            status: 'active',
            department: user.role === 'hr' ? 'HR' : 'Engineering'
          })
          .select()
          .single()

        if (insertError) throw insertError

        // Add default leave balance
        const { data: lt } = await supabase
          .from('leave_types')
          .select('id')
          .eq('code', 'PL')
          .maybeSingle()

        if (lt && newEmp) {
          await supabase.from('leave_balances').insert({
            employee_id: newEmp.id,
            leave_type_id: lt.id,
            year: new Date().getFullYear(),
            total_allocated: 21,
            carry_forward_days: 0
          })
        }
      }

      console.log(`  ✅ Successfully configured!\n`)

    } catch (err) {
      console.error(`  ❌ Error: ${err.message}\n`)
    }
  }

  console.log('══════════════════════════════════════════════════════')
  console.log('Demo Users configure success!')
  console.log('Login credentials:')
  console.log('  1. Admin:   demo.admin@company.com    / Welcome@123')
  console.log('  2. Manager: demo.manager@company.com  / Welcome@123')
    console.log('  2. Team Leader: demo.teamleader@company.com / Welcome@123')
  console.log('  3. HR:      demo.hr@company.com       / Welcome@123')
  console.log('  4. Employee:demo.employee@company.com / Welcome@123')
  console.log('══════════════════════════════════════════════════════\n')
}

main().catch(err => {
  console.error(err)
})
