import subprocess
import sys

def run_cmd(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout.strip()

# Get all tables from testing
tables_str = run_cmd("docker exec sgi-postgres-testing psql -U sgi -d sgi -tAc \"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;\"")
tables = [t.strip() for t in tables_str.split("\n") if t.strip()]

mismatches = []
for table in tables:
    t_cols_str = run_cmd(f"docker exec sgi-postgres-testing psql -U sgi -d sgi -tAc \"SELECT column_name FROM information_schema.columns WHERE table_name='{table}' ORDER BY ordinal_position;\"")
    p_cols_str = run_cmd(f"docker exec sgi-postgres psql -U sgi -d sgi -tAc \"SELECT column_name FROM information_schema.columns WHERE table_name='{table}' ORDER BY ordinal_position;\"")
    
    t_cols = set(c.strip() for c in t_cols_str.split("\n") if c.strip())
    p_cols = set(c.strip() for c in p_cols_str.split("\n") if c.strip())
    
    if t_cols != p_cols:
        missing = t_cols - p_cols
        extra = p_cols - t_cols
        if missing or extra:
            mismatches.append({
                "table": table,
                "testing": sorted(t_cols),
                "prod": sorted(p_cols),
                "missing": sorted(missing),
                "extra": sorted(extra)
            })

print(f"Found {len(mismatches)} tables with column mismatches")
for m in mismatches[:50]:
    print(f"\n=== {m['table']} ===")
    if m["missing"]:
        print(f"  Missing in prod: {m['missing']}")
    if m["extra"]:
        print(f"  Extra in prod: {m['extra']}")
