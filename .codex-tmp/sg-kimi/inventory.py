from pathlib import Path
import csv, hashlib, re, os

SRC = Path('/Users/leonardocastillo/Desktop/SG Calidad')
OUT = Path('/Users/leonardocastillo/Desktop/APP/SGI respaldo 360/outputs/sg-kimi-work')
OUT.mkdir(parents=True, exist_ok=True)

rev_patterns = [
    re.compile(r'(?:^|[_\-\s])(?:REV(?:ISI[ÓO]N)?[._\-\s]*)?([A-Z])(?:$|[_\-\s.(])', re.I),
    re.compile(r'(?:^|[_\-\s])R(?:EV)?[._\-\s]*([0-9]{1,2})(?:$|[_\-\s.(])', re.I),
]
code_re = re.compile(r'^([A-Z]{1,8}(?:-[A-Z0-9]{1,8})?(?:[.-][0-9]{1,3})?)', re.I)

rows=[]
for p in sorted(SRC.rglob('*')):
    if not p.is_file() or p.name == '.DS_Store':
        continue
    rel=p.relative_to(SRC)
    stat=p.stat()
    h=hashlib.sha256()
    with p.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024), b''):
            h.update(chunk)
    stem=p.stem
    cm=code_re.search(stem)
    rev=''
    for pat in rev_patterns:
        m=pat.search(stem)
        if m:
            rev=m.group(1).upper(); break
    low=str(rel).lower()
    status='Obsoleto' if any(x in low for x in ['/obsoleto','/obsoletos']) else 'Vigente/por validar'
    rows.append({
        'ruta_relativa':str(rel),'carpeta_principal':rel.parts[0] if len(rel.parts)>1 else '(raíz)',
        'nombre':p.name,'extension':p.suffix.lower().lstrip('.'),'codigo_inferido':cm.group(1).upper() if cm else '',
        'revision_inferida':rev,'estado_inferido':status,'tamano_bytes':stat.st_size,
        'fecha_modificacion':__import__('datetime').datetime.fromtimestamp(stat.st_mtime).isoformat(timespec='seconds'),
        'sha256':h.hexdigest(),
    })

with (OUT/'inventario_archivos.csv').open('w',newline='',encoding='utf-8-sig') as f:
    w=csv.DictWriter(f,fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)

byhash={}
for r in rows: byhash.setdefault(r['sha256'],[]).append(r)
dups=[g for g in byhash.values() if len(g)>1]
with (OUT/'duplicados_exactos.csv').open('w',newline='',encoding='utf-8-sig') as f:
    fields=['grupo','cantidad','ruta_relativa','nombre','sha256']
    w=csv.DictWriter(f,fieldnames=fields); w.writeheader()
    for i,g in enumerate(dups,1):
        for r in g: w.writerow({'grupo':i,'cantidad':len(g),'ruta_relativa':r['ruta_relativa'],'nombre':r['nombre'],'sha256':r['sha256']})

print(f'archivos={len(rows)} duplicados_grupos={len(dups)} duplicados_archivos={sum(len(g) for g in dups)}')
