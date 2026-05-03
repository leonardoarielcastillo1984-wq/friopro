import subprocess

# Read missing FK names
with open('/tmp/missing_fk_names.txt', 'r') as f:
    missing = [line.strip() for line in f if line.strip()]

# Extract table and fk name
for line in missing:
    parts = line.split('.')
    if len(parts) != 2:
        continue
    table = parts[0].strip('"')
    fk_name = parts[1].strip('"')
    
    # Get FK details from testing
    cmd = f'docker exec sgi-postgres-testing psql -U sgi -d sgi -tAc "'
    cmd += f"SELECT 'ALTER TABLE ' || conrelid::regclass || ' ADD CONSTRAINT ' || conname || ' FOREIGN KEY (' || (SELECT string_agg('\"' || a.attname || '\"', ',') FROM unnest(c.conkey) k JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k) || ') REFERENCES ' || confrelid::regclass || '(' || (SELECT string_agg('\"' || a.attname || '\"', ',') FROM unnest(c.confkey) k JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k) || ') ON UPDATE ' || CASE confupdtype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END || ' ON DELETE ' || CASE confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END || ';'"
    cmd += f" FROM pg_constraint c WHERE contype = 'f' AND conrelid::regclass::text = '{table}' AND conname = '{fk_name}';"
    cmd += '"'
    
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    sql = result.stdout.strip()
    if sql and sql != ' ?column? ' and not sql.startswith('('):
        print(sql)
    else:
        print(f"-- Failed to generate FK for {table}.{fk_name}")
