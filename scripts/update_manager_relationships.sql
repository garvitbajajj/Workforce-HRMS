-- ============================================================
-- SQL SCRIPT: Update Employee Roles and Establish Team Leaders
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Update the system role to 'manager' for the 9 team leaders
UPDATE public.employees 
SET role = 'manager'
WHERE full_name IN (
  'Aakash Kag',
  'Divya Jhajharia',
  'Neha Verma',
  'Praveen Mishra',
  'Preeti Chandorkar',
  'Saandeep k Das',
  'Shubha Guruprasad',
  'Shubha Nadig',
  'Shubha N',
  'Tamanna Dhattiwala',
  'Ajit Pawar'
);

-- 2. Link Team Members to their respective Team Leaders (Aakash Kag)
UPDATE public.employees 
SET manager_id = (SELECT id FROM public.employees WHERE full_name = 'Aakash Kag' LIMIT 1)
WHERE full_name IN ('Suman Yadav', 'Sara Khan', 'Ankita Chouhan', 'Shriya Rajpurohit');

-- 3. Link Team Members to their respective Team Leaders (Divya Jhajharia)
UPDATE public.employees 
SET manager_id = (SELECT id FROM public.employees WHERE full_name = 'Divya Jhajharia' LIMIT 1)
WHERE full_name IN ('Satish Verma', 'Surya Dey', 'Ankita Ghosal');

-- 4. Link Team Members to their respective Team Leaders (Neha Verma)
UPDATE public.employees 
SET manager_id = (SELECT id FROM public.employees WHERE full_name = 'Neha Verma' LIMIT 1)
WHERE full_name IN ('Tejal Khadke', 'Ritu Singhal', 'Rani Sankar', 'Sakshi Mane', 'Maithilee Binekar', 'Vaishali Baskar', 'UshaSree', 'Shamli Gangalwar');

-- 5. Link Team Members to their respective Team Leaders (Praveen Mishra)
UPDATE public.employees 
SET manager_id = (SELECT id FROM public.employees WHERE full_name = 'Praveen Mishra' LIMIT 1)
WHERE full_name IN ('Faisal Shah', 'Harsh Ranjan', 'Neha Kumari', 'Avneesh Singh', 'Akanksha Mishra', 'Vaishnavi Gupta', 'Chandan Sah', 'Shiva Kant Singh', 'Shivani Devi');

-- 6. Link Team Members to their respective Team Leaders (Preeti Chandorkar)
UPDATE public.employees 
SET manager_id = (SELECT id FROM public.employees WHERE full_name = 'Preeti Chandorkar' LIMIT 1)
WHERE full_name IN ('Sonal Garg', 'Gaurav Rajak', 'Saumya Tiwari', 'Palak Parikh');

-- 7. Link Team Members to their respective Team Leaders (Shubha N / Shubha Guruprasad)
UPDATE public.employees 
SET manager_id = (SELECT id FROM public.employees WHERE (full_name = 'Shubha Guruprasad' OR full_name = 'Shubha N' OR full_name = 'Shubha Nadig') LIMIT 1)
WHERE full_name IN ('Niveditha B', 'Nikita Lahadke', 'Shubha B');

-- 8. Link Team Members to their respective Team Leaders (Tamanna Dhattiwala)
UPDATE public.employees 
SET manager_id = (SELECT id FROM public.employees WHERE full_name = 'Tamanna Dhattiwala' LIMIT 1)
WHERE full_name IN ('Shobha Mahato', 'Shivani Sarolikar', 'Pratibha Dhongade', 'Tausif Sayyed');

-- 9. Link Team Members to their respective Team Leaders (Ajit Pawar)
UPDATE public.employees 
SET manager_id = (SELECT id FROM public.employees WHERE full_name = 'Ajit Pawar' LIMIT 1)
WHERE full_name IN ('Arpita Udole');
