/**
 * SCRIPT 3: Convert Company Excel CSV → Supabase-Ready CSV
 * ----------------------------------------------------------
 * This script reads your company's Excel export (saved as CSV)
 * and renames the column headers + transforms values to match
 * the Supabase employees table schema exactly.
 *
 * HOW TO USE:
 *   1. Save your Excel file as CSV (File → Save As → CSV UTF-8)
 *      and place it in the same folder as this script, named: employees_raw.csv
 *   2. Open a terminal in the project root
 *   3. Run: node scripts/3_convert_csv_for_import.mjs
 *   4. A new file "employees_import.csv" will be created in the scripts/ folder
 *   5. Import THAT file into Supabase → Table Editor → employees → Import Data
 * ----------------------------------------------------------
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Config ────────────────────────────────────────────────────────────────
const INPUT_FILE  = join(__dirname, 'employees_raw.csv')   // Your Excel-exported CSV
const OUTPUT_FILE = join(__dirname, 'employees_import.csv') // Supabase-ready CSV

// ── Column Name Mapping (Excel Header → DB Column Name) ──────────────────
const COLUMN_MAP = {
  'Employee Name':    'full_name',
  'Employee ID':      'employee_code',
  'Official Emai ID': 'email',         // Note: "Emai" typo in original Excel header
  'Official Email ID':'email',          // In case it has the correct spelling
  'Mode':             'employment_type',
  'DOJ':              'joining_date',
  'DOJ Month':        'doj_month',
  'Status':           'status',
  'Team':             'department',
  'Location':         'work_location',
  'Gender':           'gender',
  'AM':               'am',
  'Grade':            'grade',
  'Level':            'level',
  'Designation':      'designation',
  'Role':             'job_role',       // Mapped to job_role (not the system role column)
}

// ── Value Transformations ────────────────────────────────────────────────
// Maps original cell values to DB-accepted values

function transformValue(dbColumn, rawValue) {
  const val = (rawValue || '').trim()

  switch (dbColumn) {
    // employment_type: Salary → full_time, Consultant → contract
    case 'employment_type':
      if (val.toLowerCase() === 'salary')     return 'full_time'
      if (val.toLowerCase() === 'consultant') return 'contract'
      return 'full_time' // default

    // status: Active → active (must be lowercase for DB check constraint)
    case 'status':
      const statusMap = {
        'active':     'active',
        'inactive':   'inactive',
        'terminated': 'terminated',
        'on leave':   'on_leave',
      }
      return statusMap[val.toLowerCase()] || 'active'

    // gender: Keep as-is (Male/Female match DB constraint)
    case 'gender':
      if (val === 'Male' || val === 'Female' || val === 'Other') return val
      return val || null

    // joining_date: Convert from various formats to YYYY-MM-DD
    case 'joining_date':
      if (!val) return null
      // Try to parse various date formats
      const d = new Date(val)
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0] // YYYY-MM-DD
      }
      // Try DD-Mon-YY format e.g. "17-Feb-20"
      const parts = val.match(/(\d{1,2})[\/\-]([A-Za-z]+|\d{1,2})[\/\-](\d{2,4})/)
      if (parts) {
        const months = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 }
        const day   = parseInt(parts[1])
        const month = isNaN(parts[2]) ? (months[parts[2].toLowerCase().slice(0,3)] ?? 0) : parseInt(parts[2]) - 1
        const year  = parts[3].length === 2 ? 2000 + parseInt(parts[3]) : parseInt(parts[3])
        return new Date(year, month, day).toISOString().split('T')[0]
      }
      return val // Return as-is if can't parse

    // All other values: just trim and return
    default:
      return val || null
  }
}

// ── Parse CSV (handles quoted fields with commas inside) ─────────────────
function parseCSV(content) {
  const rows = []
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    if (!line.trim()) continue
    const cols = []
    let cur = '', inQuotes = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"' && line[i+1] === '"') { cur += '"'; i++; continue }
      if (line[i] === '"') { inQuotes = !inQuotes; continue }
      if (line[i] === ',' && !inQuotes) { cols.push(cur); cur = ''; continue }
      cur += line[i]
    }
    cols.push(cur)
    rows.push(cols)
  }
  return rows
}

// ── Serialize CSV ────────────────────────────────────────────────────────
function toCSV(rows) {
  return rows.map(row =>
    row.map(cell => {
      if (cell === null || cell === undefined) return ''
      const s = String(cell)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }).join(',')
  ).join('\n')
}

// ── Main ─────────────────────────────────────────────────────────────────
console.log('╔══════════════════════════════════════════════════════╗')
console.log('║     CSV Converter: Excel → Supabase Format           ║')
console.log('╚══════════════════════════════════════════════════════╝\n')

let raw
try {
  raw = readFileSync(INPUT_FILE, 'utf-8')
  console.log(`✅ Read input file: ${INPUT_FILE}`)
} catch {
  console.error(`❌ Could not find input file: ${INPUT_FILE}`)
  console.error(`\nPlease save your Excel file as CSV and name it:`)
  console.error(`   scripts/employees_raw.csv\n`)
  process.exit(1)
}

const parsed   = parseCSV(raw)
const headers  = parsed[0]
const dataRows = parsed.slice(1)

console.log(`📋 Found ${dataRows.length} employee rows with ${headers.length} columns`)
console.log(`   Original headers: ${headers.join(', ')}\n`)

// Map each header to its DB column name
const mappedHeaders = headers.map(h => COLUMN_MAP[h.trim()] || h.trim())

// Add the system 'role' column (everyone gets 'employee' by default)
// You can manually change specific employees to 'hr' or 'manager' after import
const outputHeaders = [...mappedHeaders, 'role']

// Remove duplicate 'email' if it appears twice (from typo variants)
const seenHeaders = new Set()
const uniqueIndexes = []
const uniqueHeaders = []
for (let i = 0; i < outputHeaders.length; i++) {
  if (!seenHeaders.has(outputHeaders[i])) {
    seenHeaders.add(outputHeaders[i])
    uniqueIndexes.push(i < mappedHeaders.length ? i : -1)
    uniqueHeaders.push(outputHeaders[i])
  }
}

console.log(`✅ Mapped headers: ${uniqueHeaders.join(', ')}\n`)

// Build output rows
const outputRows = [uniqueHeaders]
let skipped = 0

for (const row of dataRows) {
  // Skip completely empty rows
  if (row.every(c => !c.trim())) { skipped++; continue }

  const newRow = []
  for (let i = 0; i < uniqueHeaders.length; i++) {
    const idx = uniqueIndexes[i]
    if (idx === -1) {
      // system role column — default to 'employee'
      newRow.push('employee')
    } else {
      const dbCol = uniqueHeaders[i]
      const raw   = row[idx] || ''
      newRow.push(transformValue(dbCol, raw))
    }
  }
  outputRows.push(newRow)
}

const csvContent = toCSV(outputRows)
writeFileSync(OUTPUT_FILE, csvContent, 'utf-8')

console.log('═══════════════════════════════════════')
console.log('           CONVERSION COMPLETE')
console.log('═══════════════════════════════════════')
console.log(`✅ Converted: ${outputRows.length - 1} employees`)
if (skipped) console.log(`⚠️  Skipped:   ${skipped} empty rows`)
console.log(`\n📄 Output file: ${OUTPUT_FILE}`)
console.log('\nNext steps:')
console.log('  1. Go to Supabase → Table Editor → employees')
console.log('  2. Click "Import Data from CSV"')
console.log('  3. Upload the file: scripts/employees_import.csv')
console.log('  4. Verify the column mapping preview looks correct')
console.log('  5. Click Import!\n')
