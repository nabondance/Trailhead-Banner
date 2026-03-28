-- Fix RLS policies: restrict to minimum required permissions per table

-- banners: INSERT (analytics write) + SELECT (count display in BannerCount.js)
DROP POLICY IF EXISTS "all" ON banners;
DROP POLICY IF EXISTS "Allow public inserts" ON banners;
DROP POLICY IF EXISTS "Allow public count" ON banners;
CREATE POLICY "Allow public inserts" ON banners
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow public count" ON banners
  FOR SELECT TO anon, authenticated USING (true);

-- rewinds: INSERT (analytics write) + SELECT (count display in RewindCount.js)
DROP POLICY IF EXISTS "Allow public inserts" ON rewinds;
DROP POLICY IF EXISTS "Allow public reads" ON rewinds;
DROP POLICY IF EXISTS "Allow public count" ON rewinds;
CREATE POLICY "Allow public inserts" ON rewinds
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow public count" ON rewinds
  FOR SELECT TO anon, authenticated USING (true);

-- company_banners: INSERT only (no SELECT usage in codebase)
DROP POLICY IF EXISTS "all" ON company_banners;
DROP POLICY IF EXISTS "Allow public inserts" ON company_banners;
CREATE POLICY "Allow public inserts" ON company_banners
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- errors: INSERT only (no SELECT usage in codebase)
DROP POLICY IF EXISTS "all" ON errors;
DROP POLICY IF EXISTS "Allow public inserts" ON errors;
CREATE POLICY "Allow public inserts" ON errors
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- test: drop unused table
DROP TABLE IF EXISTS test;
