import subprocess

def run_sql(container, sql):
    cmd = f'docker exec {container} psql -U sgi -d sgi -tAc "{sql}"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout.strip()

tables = ["emergency_resources","environmental_actions","environmental_aspects","equipments","hazards","licenses","payment_transactions","project_milestones","risk_actions","subscriptions","usage_events"]

testing_cols = {}
for table in tables:
    cols_str = run_sql("sgi-postgres-testing", f"SELECT column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='{table}' ORDER BY ordinal_position")
    testing_cols[table] = {}
    for line in cols_str.split("\n"):
        parts = line.split("|")
        if len(parts) >= 5:
            testing_cols[table][parts[0]] = {
                "data_type": parts[1],
                "udt_name": parts[2],
                "nullable": parts[3],
                "default": parts[4] if len(parts) > 4 else ""
            }

prod_cols = {}
for table in tables:
    cols_str = run_sql("sgi-postgres", f"SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='{table}'")
    prod_cols[table] = set(c.strip() for c in cols_str.split("\n") if c.strip())

alter_statements = []
for table in testing_cols:
    for col_name, col_info in testing_cols[table].items():
        if col_name not in prod_cols[table]:
            dtype = col_info["data_type"]
            udt = col_info["udt_name"]
            if dtype == "USER-DEFINED":
                type_str = udt.lower()
            elif dtype == "timestamp with time zone":
                type_str = "TIMESTAMPTZ"
            elif dtype == "timestamp without time zone":
                type_str = "TIMESTAMP"
            elif dtype == "character varying":
                type_str = "VARCHAR"
            elif dtype == "double precision":
                type_str = "DOUBLE PRECISION"
            else:
                type_str = dtype.upper()
            
            nullable = " NOT NULL" if col_info["nullable"] == "NO" else ""
            default_str = ""
            if col_info["default"] and col_info["default"] != "":
                default_str = f" DEFAULT {col_info['default']}"
            
            alter_statements.append(f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "{col_name}" {type_str}{nullable}{default_str};')

with open("/tmp/add_missing_cols3.sql", "w") as f:
    f.write("\n".join(alter_statements))

print(f"Generated {len(alter_statements)} ALTER TABLE statements")
for stmt in alter_statements:
    print(stmt)
