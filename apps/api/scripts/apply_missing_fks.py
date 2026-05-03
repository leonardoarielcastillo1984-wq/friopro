import subprocess

def run_sql(container, sql):
    cmd = f'docker exec {container} psql -U sgi -d sgi -tAc "{sql}"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout.strip()

# Get missing FK names
# testing FKs
testing_fks = run_sql('sgi-postgres-testing', """
SELECT conrelid::regclass::text || '.' || conname 
FROM pg_constraint 
WHERE contype = 'f' 
ORDER BY conrelid::regclass::text, conname
""")

# prod FKs
prod_fks = run_sql('sgi-postgres', """
SELECT conrelid::regclass::text || '.' || conname 
FROM pg_constraint 
WHERE contype = 'f' 
ORDER BY conrelid::regclass::text, conname
""")

testing_set = set(line.strip() for line in testing_fks.split('\n') if line.strip())
prod_set = set(line.strip() for line in prod_fks.split('\n') if line.strip())

missing = sorted(testing_set - prod_set)

print(f"Missing FKs: {len(missing)}")
for fk in missing[:10]:
    print(f"  {fk}")

# Generate ALTER TABLE statements for each missing FK
alter_statements = []
failed = []

for fk in missing:
    parts = fk.split('.')
    if len(parts) != 2:
        continue
    table = parts[0].strip('"')
    fk_name = parts[1].strip('"')
    
    # Get FK details from testing
    result = run_sql('sgi-postgres-testing', f"""
SELECT 'ALTER TABLE ' || conrelid::regclass || ' ADD CONSTRAINT ' || conname || 
       ' FOREIGN KEY (' || (SELECT string_agg('"' || a.attname || '"', ',') 
                            FROM unnest(c.conkey) k 
                            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k) || 
       ') REFERENCES ' || confrelid::regclass || 
       '(' || (SELECT string_agg('"' || a.attname || '"', ',') 
               FROM unnest(c.confkey) k 
               JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k) || 
       ') ON UPDATE ' || CASE confupdtype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END || 
       ' ON DELETE ' || CASE confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END || ';'
FROM pg_constraint c
WHERE contype = 'f' AND conrelid::regclass::text = '{table}' AND conname = '{fk_name}';
""")
    
    sql = result.strip()
    if sql and not sql.startswith('(') and '||' not in sql:
        alter_statements.append(sql)
    else:
        failed.append(fk)

with open('/tmp/apply_missing_fks_final.sql', 'w') as f:
    f.write('\n'.join(alter_statements))

print(f"\nGenerated {len(alter_statements)} ALTER TABLE statements")
print(f"Failed to generate: {len(failed)}")
for f in failed[:10]:
    print(f"  {f}")
