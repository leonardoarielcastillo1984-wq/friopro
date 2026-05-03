#!/bin/bash
# Generate ALTER TABLE statements for missing FKs

# Read testing FKs into associative array
declare -A testing_fks
while IFS='|' read -r table fk_name columns ref_table ref_columns on_update on_delete; do
    key="$table.$fk_name"
    testing_fks["$key"]="$table|$fk_name|$columns|$ref_table|$ref_columns|$on_update|$on_delete"
done < /tmp/testing_fk_details.txt

# Read prod FKs and mark as found
declare -A prod_fks
while IFS='|' read -r table fk_name columns ref_table ref_columns on_update on_delete; do
    key="$table.$fk_name"
    prod_fks["$key"]=1
done < /tmp/prod_fk_details.txt

# Generate missing FKs
> /tmp/apply_missing_fks_final.sql
for key in "${!testing_fks[@]}"; do
    if [ -z "${prod_fks[$key]}" ]; then
        IFS='|' read -r table fk_name columns ref_table ref_columns on_update on_delete <<< "${testing_fks[$key]}"
        
        # Format columns with quotes
        quoted_cols=$(echo "$columns" | sed 's/[^,]*/"&"/g')
        quoted_ref_cols=$(echo "$ref_columns" | sed 's/[^,]*/"&"/g')
        
        echo "ALTER TABLE \"$table\" ADD CONSTRAINT \"$fk_name\" FOREIGN KEY ($quoted_cols) REFERENCES \"$ref_table\"($quoted_ref_cols) ON UPDATE $on_update ON DELETE $on_delete;" >> /tmp/apply_missing_fks_final.sql
    fi
done

echo "Generated $(wc -l < /tmp/apply_missing_fks_final.sql) ALTER TABLE statements"
head -20 /tmp/apply_missing_fks_final.sql
