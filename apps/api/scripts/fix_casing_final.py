import subprocess
import re

def run_sql(container, sql):
    cmd = f'docker exec {container} psql -U sgi -d sgi -tAc "{sql}"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout.strip()

# Get all tables from testing
tables_str = run_sql('sgi-postgres-testing', "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")
tables = [t.strip() for t in tables_str.split('\n') if t.strip()]

rename_statements = []
failed_renames = []

for table in tables:
    t_cols_str = run_sql('sgi-postgres-testing', f"SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='{table}' ORDER BY ordinal_position")
    p_cols_str = run_sql('sgi-postgres', f"SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='{table}' ORDER BY ordinal_position")
    
    t_cols = set(c.strip() for c in t_cols_str.split('\n') if c.strip())
    p_cols = set(c.strip() for c in p_cols_str.split('\n') if c.strip())
    
    for t_col in t_cols:
        if t_col not in p_cols:
            # Check if lowercase version exists
            lower_col = t_col.lower()
            if lower_col in p_cols and lower_col != t_col:
                rename_statements.append(f'ALTER TABLE "{table}" RENAME COLUMN "{lower_col}" TO "{t_col}";')
            else:
                failed_renames.append(f'{table}.{t_col}')

print(f'Found {len(rename_statements)} columns to rename')
for stmt in rename_statements:
    print(stmt)

if failed_renames:
    print(f'\nStill missing {len(failed_renames)} columns (need to be added):')
    for col in failed_renames[:20]:
        print(f'  {col}')

with open('/tmp/rename_columns_final.sql', 'w') as f:
    f.write('\n'.join(rename_statements))
