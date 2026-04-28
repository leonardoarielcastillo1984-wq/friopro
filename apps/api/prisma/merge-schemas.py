#!/usr/bin/env python3
"""
Merge Prisma schemas intelligently, removing duplicates.
Strategy: Use root schema as base, add unique models from partial schemas.
"""

import re
import sys

def extract_models_and_enums(content):
    """Extract all model and enum definitions from schema content."""
    models = {}
    enums = {}
    
    lines = content.split('\n')
    i = 0
    total_lines = len(lines)
    
    while i < total_lines:
        line = lines[i]
        stripped = line.strip()
        
        # Skip empty lines and comments
        if not stripped or stripped.startswith('//') or stripped.startswith('/*') or stripped.startswith('*'):
            i += 1
            continue
        
        # Check for model definition (must start at beginning of line)
        model_match = re.match(r'^model\s+(\w+)\s*\{', line)
        if model_match:
            name = model_match.group(1)
            block_lines = [line]
            brace_count = line.count('{') - line.count('}')
            i += 1
            while i < total_lines and brace_count > 0:
                line = lines[i]
                block_lines.append(line)
                brace_count += line.count('{') - line.count('}')
                i += 1
            models[name] = '\n'.join(block_lines)
            continue
        
        # Check for enum definition (must start at beginning of line)
        enum_match = re.match(r'^enum\s+(\w+)\s*\{', line)
        if enum_match:
            name = enum_match.group(1)
            block_lines = [line]
            brace_count = line.count('{') - line.count('}')
            i += 1
            while i < total_lines and brace_count > 0:
                line = lines[i]
                block_lines.append(line)
                brace_count += line.count('{') - line.count('}')
                i += 1
            enums[name] = '\n'.join(block_lines)
            continue
        
        i += 1
    
    return models, enums

def extract_header(content):
    """Extract generator and datasource blocks from schema."""
    lines = content.split('\n')
    header_lines = []
    in_block = False
    brace_count = 0
    
    for line in lines:
        if not in_block:
            if re.match(r'^(generator|datasource)\s+\w+\s*\{', line):
                in_block = True
                brace_count = line.count('{') - line.count('}')
                header_lines.append(line)
            elif line.strip() and not line.startswith('//') and not line.startswith('/*'):
                # Stop at first non-comment, non-empty line that's not a generator/datasource
                if not re.match(r'^(model|enum)\s+\w+', line):
                    continue
                else:
                    break
        else:
            header_lines.append(line)
            brace_count += line.count('{') - line.count('}')
            if brace_count <= 0:
                in_block = False
                brace_count = 0
    
    return '\n'.join(header_lines)

def main():
    import os
    
    # Check files exist
    files_to_check = [
        '/app/prisma/schema.prisma',
        '/app/apps/api/prisma/schema-api.prisma',
        '/app/apps/api/prisma/schema-saas.prisma',
        '/app/apps/api/prisma/schema-project360.prisma'
    ]
    for f in files_to_check:
        if not os.path.exists(f):
            print(f"ERROR: File not found: {f}")
            sys.exit(1)
        print(f"✓ Found: {f}")
    
    # Read root schema
    with open('/app/prisma/schema.prisma', 'r') as f:
        root_content = f.read()
    
    # Read partial schemas
    with open('/app/apps/api/prisma/schema-api.prisma', 'r') as f:
        api_content = f.read()
    with open('/app/apps/api/prisma/schema-saas.prisma', 'r') as f:
        saas_content = f.read()
    with open('/app/apps/api/prisma/schema-project360.prisma', 'r') as f:
        p360_content = f.read()
    
    # Extract from root schema
    root_models, root_enums = extract_models_and_enums(root_content)
    header = extract_header(root_content)
    print(f"✓ Extracted {len(root_models)} models and {len(root_enums)} enums from root schema")
    print(f"  Root models: {list(root_models.keys())}")
    
    # Extract from partial schemas
    api_models, api_enums = extract_models_and_enums(api_content)
    saas_models, saas_enums = extract_models_and_enums(saas_content)
    p360_models, p360_enums = extract_models_and_enums(p360_content)
    print(f"✓ API: {len(api_models)} models, SaaS: {len(saas_models)} models, P360: {len(p360_models)} models")
    
    # Combine: root takes precedence, add unique models from partials
    all_models = dict(root_models)  # Start with root
    all_enums = dict(root_enums)
    
    # Add from API schema (only if not in root)
    for name, model in api_models.items():
        if name not in all_models:
            all_models[name] = model
    for name, enum in api_enums.items():
        if name not in all_enums:
            all_enums[name] = enum
    
    # Add from SaaS schema (only if not in root)
    for name, model in saas_models.items():
        if name not in all_models:
            all_models[name] = model
    for name, enum in saas_enums.items():
        if name not in all_enums:
            all_enums[name] = enum
    
    # Add from Project360 schema (only if not in root)
    for name, model in p360_models.items():
        if name not in all_models:
            all_models[name] = model
    for name, enum in p360_enums.items():
        if name not in all_enums:
            all_enums[name] = enum
    
    # Write merged schema
    output = []
    output.append(header)
    output.append('')
    
    # Add enums first
    for enum_name in sorted(all_enums.keys()):
        output.append(all_enums[enum_name])
        output.append('')
    
    # Add models
    for model_name in sorted(all_models.keys()):
        output.append(all_models[model_name])
        output.append('')
    
    with open('/app/apps/api/prisma/schema.prisma', 'w') as f:
        f.write('\n'.join(output))
    
    print(f"Schema merged successfully:")
    print(f"  - {len(root_models)} models from root")
    print(f"  - {len(api_models)} models from api")
    print(f"  - {len(saas_models)} models from saas")
    print(f"  - {len(p360_models)} models from project360")
    print(f"  - {len(all_models)} total unique models")

if __name__ == '__main__':
    main()
