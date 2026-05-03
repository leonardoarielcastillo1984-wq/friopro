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
missing_columns = []

for table in tables:
    t_cols_str = run_sql('sgi-postgres-testing', f"SELECT column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='{table}' ORDER BY ordinal_position")
    p_cols_str = run_sql('sgi-postgres', f"SELECT column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='{table}' ORDER BY ordinal_position")
    
    t_cols_info = {}
    for line in t_cols_str.split('\n'):
        parts = line.split('|')
        if len(parts) >= 5:
            t_cols_info[parts[0]] = {
                'data_type': parts[1],
                'udt_name': parts[2],
                'nullable': parts[3],
                'default': parts[4] if len(parts) > 4 else ''
            }
    
    p_cols_info = {}
    for line in p_cols_str.split('\n'):
        parts = line.split('|')
        if len(parts) >= 5:
            p_cols_info[parts[0]] = {
                'data_type': parts[1],
                'udt_name': parts[2],
                'nullable': parts[3],
                'default': parts[4] if len(parts) > 4 else ''
            }
    
    # Check for casing mismatches
    for t_col in t_cols_info:
        if t_col not in p_cols_info:
            # Check if lowercase version exists
            lower_col = t_col.lower()
            if lower_col in p_cols_info and lower_col != t_col:
                rename_statements.append(f'ALTER TABLE "{table}" RENAME COLUMN "{lower_col}" TO "{t_col}";')
            else:
                missing_columns.append(f'{table}.{t_col}')

print(f"Found {len(rename_statements)} columns to rename")
for stmt in rename_statements:
    print(stmt)

print(f"\nStill missing {len(missing_columns)} columns:")
for col in missing_columns[:30]:
    print(f"  {col}")
