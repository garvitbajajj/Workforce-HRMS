/**
 * Bulk update employee AM (and other fields) from CSV.
 * Matches employees by employee_code and updates: am, grade, level, department,
 * designation, job_role, gender, doj_month, work_location.
 *
 * Usage: node scripts/update_am_from_csv.mjs
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// ── Load .env.local ──────────────────────────────────────────────────────────
function loadEnv() {
  const content = fs.readFileSync('.env.local', 'utf8')
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [key, ...rest] = trimmed.split('=')
    if (key && rest.length) env[key.trim()] = rest.join('=').trim()
  }
  return env
}

const env = loadEnv()
const supabase = createClient(env['VITE_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'])

// ── Parse CSV ────────────────────────────────────────────────────────────────
function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/\r/g, '')
  const lines = raw.split('\n').filter(l => l.trim())
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    // Handle commas inside quoted fields
    const values = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue }
      current += ch
    }
    values.push(current.trim())

    const row = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  })
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const csvPath = 'scripts/company_data_template (1).csv'
  const rows = parseCSV(csvPath)
  console.log(`📄 Loaded ${rows.length} rows from CSV\n`)

  let updated = 0
  let skipped = 0
  let notFound = 0

  for (const row of rows) {
    const empCode = row.employee_code
    if (!empCode) { skipped++; continue }

    // Find the employee by employee_code
    const { data: existing, error: findErr } = await supabase
      .from('employees')
      .select('id, full_name, employee_code, am')
      .eq('employee_code', empCode)
      .maybeSingle()

    if (findErr) {
      console.error(`  ❌ Error finding ${empCode}:`, findErr.message)
      skipped++
      continue
    }

    if (!existing) {
      console.log(`  ⚠️  ${empCode} (${row.full_name}) — not found in DB, skipping`)
      notFound++
      continue
    }

    // Build update payload
    const updateData = {}
    if (row.am) updateData.am = row.am
    if (row.mode) {
      const modeMap = { 'Salary': 'full_time', 'Consultant': 'contract', 'Intern': 'intern', 'Part Time': 'part_time' }
      updateData.employment_type = modeMap[row.mode] || row.mode.toLowerCase()
    }
    if (row.grade) updateData.grade = row.grade
    if (row.level) updateData.level = row.level
    if (row.department) updateData.department = row.department
    if (row.designation) updateData.designation = row.designation
    if (row.job_role) updateData.job_role = row.job_role
    if (row.gender) updateData.gender = row.gender
    if (row.doj_month) updateData.doj_month = row.doj_month
    if (row.work_location) updateData.work_location = row.work_location

    if (Object.keys(updateData).length === 0) {
      console.log(`  ⏭️  ${empCode} (${existing.full_name}) — no fields to update`)
      skipped++
      continue
    }

    const { error: updateErr } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', existing.id)

    if (updateErr) {
      console.error(`  ❌ ${empCode} (${existing.full_name}) — update failed:`, updateErr.message)
      skipped++
    } else {
      const amChanged = existing.am !== row.am
      console.log(`  ✅ ${empCode} (${existing.full_name})${amChanged ? ` — AM: "${existing.am || '(none)'}" → "${row.am}"` : ''}`)
      updated++
    }
  }

  console.log(`\n── Summary ─────────────────────────`)
  console.log(`  ✅ Updated:   ${updated}`)
  console.log(`  ⏭️  Skipped:   ${skipped}`)
  console.log(`  ⚠️  Not found: ${notFound}`)
  console.log(`  📄 Total rows: ${rows.length}`)
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1) })
