/**
 * SCRIPT 2: Bulk Create Supabase Auth Accounts for All Employees
 * ---------------------------------------------------------------
 * This script reads all employees from the database who don't have
 * a login account yet, and creates one for each with the default password.
 *
 * HOW TO RUN:
 *   1. Add SUPABASE_SERVICE_ROLE_KEY to your .env.local (see instructions below)
 *   2. Open a terminal in your project root directory
 *   3. Run: node scripts/2_bulk_create_auth_users.mjs
 * ---------------------------------------------------------------
 * REQUIREMENTS:
 *   - Node.js installed
 *   - VITE_SUPABASE_URL already set in .env.local
 *   - SUPABASE_SERVICE_ROLE_KEY must be set in .env.local
 *
 * HOW TO GET YOUR SERVICE ROLE KEY:
 *   Supabase Dashboard → Project Settings (gear icon) → API → service_role key
 *   ⚠️  NEVER commit this key to GitHub. It has full admin access.
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
  console.error('❌ Missing required environment variables:')
  if (!SUPABASE_URL)       console.error('   - VITE_SUPABASE_URL not found in .env.local')
  if (!SERVICE_ROLE_KEY)   console.error('   - SUPABASE_SERVICE_ROLE_KEY not found in .env.local')
  console.error('\nPlease add SUPABASE_SERVICE_ROLE_KEY to your .env.local file.')
  console.error('Get it from: Supabase Dashboard → Project Settings → API → service_role key')
  process.exit(1)
}

// ── Use Service Role key for admin-level auth operations ──────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const DEFAULT_PASSWORD = 'Welcome@123'

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║       Bulk Auth Account Creator — WorkForce HRMS     ║')
  console.log('╚══════════════════════════════════════════════════════╝\n')

  // ── Fetch employees without a linked auth account ──────────────────────
  console.log('📋 Fetching employees without login accounts...')
  const { data: employees, error: fetchError } = await supabase
    .from('employees')
    .select('id, full_name, email, role')
    .is('user_id', null)

  if (fetchError) {
    console.error('❌ Failed to fetch employees:', fetchError.message)
    process.exit(1)
  }

  if (!employees || employees.length === 0) {
    console.log('✅ All employees already have login accounts. Nothing to do!')
    process.exit(0)
  }

  console.log(`Found ${employees.length} employee(s) without login accounts.\n`)

  // ── Track results ──────────────────────────────────────────────────────
  const results = { success: [], failed: [] }

  // ── Process each employee ──────────────────────────────────────────────
  for (const emp of employees) {
    if (!emp.email) {
      console.warn(`⚠️  Skipping "${emp.full_name}" — no email address found.`)
      results.failed.push({ name: emp.full_name, reason: 'No email address' })
      continue
    }

    process.stdout.write(`  Creating account for ${emp.full_name} (${emp.email})... `)

    try {
      // Step 1: Create the auth user with Service Role (skips email confirmation)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: emp.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true, // Mark email as already confirmed so they can log in immediately
        user_metadata: { role: emp.role || 'employee', full_name: emp.full_name }
      })

      if (authError) {
        // If user already exists in auth, try to find them and link
        if (authError.message.includes('already been registered') || authError.code === 'email_exists') {
          console.warn(`⚠️  Already registered in auth. Attempting to link...`)
          
          // Search for existing auth user
          const { data: userList } = await supabase.auth.admin.listUsers()
          const existingUser = userList?.users?.find(u => u.email === emp.email)
          
          if (existingUser) {
            await supabase
              .from('employees')
              .update({ user_id: existingUser.id })
              .eq('id', emp.id)
            console.log(`✅ Linked existing auth user.`)
            results.success.push({ name: emp.full_name, email: emp.email, note: 'Linked existing' })
          } else {
            console.error(`❌ Could not find in auth.`)
            results.failed.push({ name: emp.full_name, reason: authError.message })
          }
          continue
        }

        throw authError
      }

      // Step 2: Link the new auth user ID to the employee record
      const { error: updateError } = await supabase
        .from('employees')
        .update({ user_id: authData.user.id })
        .eq('id', emp.id)

      if (updateError) throw updateError

      console.log(`✅ Done`)
      results.success.push({ name: emp.full_name, email: emp.email })

    } catch (err) {
      console.error(`❌ Failed — ${err.message}`)
      results.failed.push({ name: emp.full_name, email: emp.email, reason: err.message })
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300))
  }

  // ── Print Summary ──────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════')
  console.log('              SUMMARY')
  console.log('═══════════════════════════════════════')
  console.log(`✅ Successfully created: ${results.success.length}`)
  console.log(`❌ Failed:              ${results.failed.length}`)
  
  if (results.failed.length > 0) {
    console.log('\nFailed accounts:')
    results.failed.forEach(f => console.log(`  - ${f.name}: ${f.reason}`))
  }

  console.log(`\n🔑 Default password for all new accounts: "${DEFAULT_PASSWORD}"`)
  console.log('📧 Employees can now log in with their official email and this password.')
  console.log('   Remind them to change their password after first login!\n')
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
