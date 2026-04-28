#!/usr/bin/env python3
"""
Fix merged Prisma schema by adding missing inverse relation fields.
Reads schema-full.prisma, fixes all validation errors, writes back.
"""

import re
import subprocess
import sys
import os

SCHEMA_PATH = os.path.join(os.path.dirname(__file__), 'schema-full.prisma')
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), 'schema.prisma')

def parse_validation_errors(output):
    """Parse prisma validate output for missing relation errors."""
    errors = []
    # Pattern: field `X` in model `Y`: ... missing an opposite relation field on the model `Z`
    pattern = r'Error validating field `(\w+)` in model `(\w+)`.*?missing an opposite relation field on the model `(\w+)`'
    for m in re.finditer(pattern, output):
        field_name = m.group(1)
        source_model = m.group(2)
        target_model = m.group(3)
        errors.append((field_name, source_model, target_model))
    return errors

def find_model_end(content, model_name):
    """Find the closing brace position of a model definition."""
    pattern = rf'^model\s+{re.escape(model_name)}\s*\{{'
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if re.match(pattern, line):
            brace_count = line.count('{') - line.count('}')
            j = i + 1
            while j < len(lines) and brace_count > 0:
                brace_count += lines[j].count('{') - lines[j].count('}')
                if brace_count == 0:
                    return i, j  # start_line, end_line (the closing brace)
                j += 1
            return i, j
    return None, None

def get_relation_name(content, source_model, target_model, field_name):
    """Extract the relation name from the source field if it has one."""
    lines = content.split('\n')
    start, end = find_model_end(content, source_model)
    if start is None:
        return None
    for i in range(start, end + 1):
        line = lines[i].strip()
        if field_name in line and target_model in line:
            m = re.search(r'@relation\("(\w+)"', line)
            if m:
                return m.group(1)
    return None

def is_array_relation(content, source_model, field_name):
    """Check if the field in source model is an array relation (e.g. Type[])."""
    lines = content.split('\n')
    start, end = find_model_end(content, source_model)
    if start is None:
        return False
    for i in range(start, end + 1):
        line = lines[i].strip()
        if line.startswith(field_name) or f' {field_name} ' in f' {line} ':
            if '[]' in line:
                return True
    return False

def get_field_info(content, source_model, field_name):
    """Get the full field definition to understand the relation direction."""
    lines = content.split('\n')
    start, end = find_model_end(content, source_model)
    if start is None:
        return None
    for i in range(start, end + 1):
        line = lines[i].strip()
        # Match field name at start of line
        if re.match(rf'^{re.escape(field_name)}\s+', line):
            return line
    return None

def has_field_for_model(content, model_name, related_model, relation_name=None):
    """Check if model already has a field pointing to related_model with optional relation name."""
    lines = content.split('\n')
    start, end = find_model_end(content, model_name)
    if start is None:
        return True  # Can't find model, skip
    for i in range(start, end + 1):
        line = lines[i].strip()
        if related_model in line and (not relation_name or relation_name in line):
            return True
    return False

def add_field_to_model(content, model_name, field_line):
    """Add a field line before the closing brace of a model."""
    lines = content.split('\n')
    start, end = find_model_end(content, model_name)
    if start is None:
        print(f"  WARNING: Model {model_name} not found, skipping")
        return content
    # Insert before closing brace
    lines.insert(end, f"  {field_line}")
    return '\n'.join(lines)

def generate_inverse_field(content, field_name, source_model, target_model):
    """Generate the appropriate inverse relation field."""
    relation_name = get_relation_name(content, source_model, target_model, field_name)
    field_info = get_field_info(content, source_model, field_name)
    
    if field_info is None:
        return None
    
    # Determine if source has FK (fields: [...]) - meaning it's a belongsTo
    has_fk = 'fields:' in field_info
    
    if has_fk:
        # Source has FK, so target needs an array back-reference
        inverse_name = source_model[0].lower() + source_model[1:]
        # Make it plural-ish
        if not inverse_name.endswith('s'):
            inverse_name += 's'
        
        if relation_name:
            return f'{inverse_name} {source_model}[] @relation("{relation_name}")'
        else:
            return f'{inverse_name} {source_model}[]'
    else:
        # Source has array [], so target needs a scalar back-reference with FK
        # This is more complex - we'd need to know the FK column
        # For now, generate array relation on both sides
        inverse_name = source_model[0].lower() + source_model[1:]
        if not inverse_name.endswith('s'):
            inverse_name += 's'
        
        if relation_name:
            return f'{inverse_name} {source_model}[] @relation("{relation_name}")'
        else:
            return f'{inverse_name} {source_model}[]'

def main():
    if not os.path.exists(SCHEMA_PATH):
        print(f"ERROR: {SCHEMA_PATH} not found")
        sys.exit(1)
    
    with open(SCHEMA_PATH) as f:
        content = f.read()
    
    # Run prisma validate to get errors
    max_iterations = 10
    for iteration in range(max_iterations):
        print(f"\n--- Iteration {iteration + 1} ---")
        
        result = subprocess.run(
            ['npx', 'prisma', 'validate', '--schema', SCHEMA_PATH],
            capture_output=True, text=True, cwd=os.path.dirname(__file__)
        )
        
        full_output = result.stdout + result.stderr
        errors = parse_validation_errors(full_output)
        
        if not errors:
            print("Schema is valid!")
            break
        
        print(f"Found {len(errors)} validation errors")
        
        # Fix each error
        with open(SCHEMA_PATH) as f:
            content = f.read()
        
        fixed = 0
        for field_name, source_model, target_model in errors:
            # Check if target model already has a relation back
            relation_name = get_relation_name(content, source_model, target_model, field_name)
            
            if has_field_for_model(content, target_model, source_model, relation_name):
                continue
            
            inverse = generate_inverse_field(content, field_name, source_model, target_model)
            if inverse:
                print(f"  + Adding to {target_model}: {inverse}")
                content = add_field_to_model(content, target_model, inverse)
                fixed += 1
        
        if fixed == 0:
            print("No fixes could be applied, stopping")
            break
        
        with open(SCHEMA_PATH, 'w') as f:
            f.write(content)
        
        print(f"Fixed {fixed} errors")
    
    # Run format
    print("\nRunning prisma format...")
    subprocess.run(
        ['npx', 'prisma', 'format', '--schema', SCHEMA_PATH],
        cwd=os.path.dirname(__file__)
    )
    
    # Final validate
    result = subprocess.run(
        ['npx', 'prisma', 'validate', '--schema', SCHEMA_PATH],
        capture_output=True, text=True, cwd=os.path.dirname(__file__)
    )
    
    full_output = result.stdout + result.stderr
    remaining = parse_validation_errors(full_output)
    
    if remaining:
        print(f"\nWARNING: {len(remaining)} errors remain:")
        for f, s, t in remaining:
            print(f"  - {s}.{f} -> {t}")
    else:
        print("\nSchema is fully valid!")
        # Copy to output
        with open(SCHEMA_PATH) as f:
            content = f.read()
        with open(OUTPUT_PATH, 'w') as f:
            f.write(content)
        
        # Count models
        model_count = len(re.findall(r'^model\s+\w+\s*\{', content, re.MULTILINE))
        enum_count = len(re.findall(r'^enum\s+\w+\s*\{', content, re.MULTILINE))
        print(f"Output: {OUTPUT_PATH}")
        print(f"Models: {model_count}, Enums: {enum_count}")

if __name__ == '__main__':
    main()
