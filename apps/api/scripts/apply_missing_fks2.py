import subprocess
import psycopg2

def get_fks(host, database, user, password=''):
    """Get all foreign keys from a database"""
    conn = psycopg2.connect(
        host=host,
        database=database,
        user=user,
        password=password
    )
    cur = conn.cursor()
    
    cur.execute("""
        SELECT 
            c.conrelid::regclass::text as table_name,
            c.conname as fk_name,
            c.confrelid::regclass::text as ref_table,
            CASE c.confupdtype 
                WHEN 'a' THEN 'NO ACTION' 
                WHEN 'r' THEN 'RESTRICT' 
                WHEN 'c' THEN 'CASCADE' 
                WHEN 'n' THEN 'SET NULL' 
                WHEN 'd' THEN 'SET DEFAULT' 
            END as on_update,
            CASE c.confdeltype 
                WHEN 'a' THEN 'NO ACTION' 
                WHEN 'r' THEN 'RESTRICT' 
                WHEN 'c' THEN 'CASCADE' 
                WHEN 'n' THEN 'SET NULL' 
                WHEN 'd' THEN 'SET DEFAULT' 
            END as on_delete
        FROM pg_constraint c
        WHERE c.contype = 'f'
        ORDER BY c.conrelid::regclass::text, c.conname
    """)
    
    fks = {}
    for row in cur.fetchall():
        table_name, fk_name, ref_table, on_update, on_delete = row
        fks[f"{table_name}.{fk_name}"] = {
            'table': table_name,
            'fk_name': fk_name,
            'ref_table': ref_table,
            'on_update': on_update,
            'on_delete': on_delete
        }
    
    # Get columns for each FK
    for fk_key, fk_info in fks.items():
        cur.execute("""
            SELECT 
                a.attname as column_name,
                af.attname as ref_column
            FROM pg_constraint c
            JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
            JOIN unnest(c.confkey) WITH ORDINALITY AS fk(attnum, ord) ON fk.ord = k.ord
            JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = fk.attnum
            WHERE c.contype = 'f' AND c.conrelid::regclass::text = %s AND c.conname = %s
            ORDER BY k.ord
        """, (fk_info['table'], fk_info['fk_name']))
        
        columns = []
        ref_columns = []
        for row in cur.fetchall():
            columns.append(row[0])
            ref_columns.append(row[1])
        
        fk_info['columns'] = columns
        fk_info['ref_columns'] = ref_columns
    
    cur.close()
    conn.close()
    
    return fks

# Get FKs from testing and prod
testing_fks = get_fks('sgi-postgres-testing', 'sgi', 'sgi')
prod_fks = get_fks('sgi-postgres', 'sgi', 'sgi')

# Find missing FKs
missing = set(testing_fks.keys()) - set(prod_fks.keys())

print(f"Missing FKs: {len(missing)}")
for fk in sorted(missing):
    print(f"  {fk}")

# Generate ALTER TABLE statements
alter_statements = []
for fk_key in sorted(missing):
    fk = testing_fks[fk_key]
    cols = ', '.join(f'"{c}"' for c in fk['columns'])
    ref_cols = ', '.join(f'"{c}"' for c in fk['ref_columns'])
    
    stmt = f'ALTER TABLE "{fk["table"]}" ADD CONSTRAINT "{fk["fk_name"]}" FOREIGN KEY ({cols}) REFERENCES "{fk["ref_table"]}"({ref_cols}) ON UPDATE {fk["on_update"]} ON DELETE {fk["on_delete"]};'
    alter_statements.append(stmt)

with open('/tmp/apply_missing_fks_final.sql', 'w') as f:
    f.write('\n'.join(alter_statements))

print(f"\nGenerated {len(alter_statements)} ALTER TABLE statements")
for stmt in alter_statements[:5]:
    print(stmt)
