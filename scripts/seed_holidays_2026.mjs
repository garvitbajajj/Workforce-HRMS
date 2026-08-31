/**
 * Seeds the 2026 holiday list with location-specific flags.
 * Run this after running the migration script 6_add_holiday_locations.sql.
 *
 * Usage: node scripts/seed_holidays_2026.mjs
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

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

const holidays = [
  { name: 'New Year', date: '2026-01-01', pune: true, indore: true, noida: true, bangalore: true },
  { name: 'Makar Sankranti/Pongal', date: '2026-01-14', pune: false, indore: false, noida: true, bangalore: true },
  { name: 'Republic Day', date: '2026-01-26', pune: true, indore: true, noida: true, bangalore: true },
  { name: 'Holi', date: '2026-03-03', pune: true, indore: false, noida: true, bangalore: false },
  { name: 'Rang Panchami', date: '2026-03-04', pune: false, indore: true, noida: false, bangalore: false },
  { name: 'Gudi Padwa', date: '2026-03-19', pune: false, indore: false, noida: false, bangalore: true },
  { name: 'Labour Day', date: '2026-05-01', pune: true, indore: true, noida: true, bangalore: true },
  { name: 'Independence Day', date: '2026-08-15', pune: true, indore: true, noida: true, bangalore: true },
  { name: 'Ganesh Chaturthi', date: '2026-09-14', pune: true, indore: false, noida: false, bangalore: true },
  { name: 'Anant Chaturdashi', date: '2026-09-25', pune: true, indore: false, noida: false, bangalore: false },
  { name: 'Gandhi Jayanti', date: '2026-10-02', pune: true, indore: true, noida: true, bangalore: true },
  { name: 'Dussehra', date: '2026-10-20', pune: true, indore: false, noida: true, bangalore: true },
  { name: 'Dhanteras', date: '2026-11-06', pune: false, indore: true, noida: false, bangalore: false },
  { name: 'Diwali', date: '2026-11-09', pune: true, indore: true, noida: true, bangalore: true },
  { name: 'Diwali', date: '2026-11-10', pune: false, indore: true, noida: false, bangalore: false },
  { name: 'Christmas', date: '2026-12-25', pune: false, indore: true, noida: true, bangalore: false }
]

async function main() {
  console.log('Seeding 2026 holidays into Supabase...')
  
  // Clear any existing holidays to prevent conflicts/duplicates
  const { error: deleteErr } = await supabase
    .from('holidays')
    .delete()
    .neq('name', '___NON_EXISTENT_HOLIDAY___') // Delete all rows
    
  if (deleteErr) {
    console.error('❌ Error clearing existing holidays:', deleteErr.message)
    console.log('Trying to insert anyway...')
  }

  const { data, error } = await supabase
    .from('holidays')
    .insert(holidays)
    .select()

  if (error) {
    console.error('❌ Error seeding holidays:', error.message)
    console.log('\n👉 IMPORTANT: Please ensure you ran scripts/6_add_holiday_locations.sql in your Supabase SQL Editor first!')
  } else {
    console.log(`✅ Successfully seeded ${data.length} holidays for 2026!`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
