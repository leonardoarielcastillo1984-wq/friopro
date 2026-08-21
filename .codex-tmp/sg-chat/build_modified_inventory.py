from pathlib import Path
import hashlib,csv,re,datetime,json
SRC=Path('/Users/leonardocastillo/Desktop/SG Calidad'); DST=Path('/Users/leonardocastillo/Desktop/SG chat'); OUT=Path('outputs/sg-chat-work')
def h(p):
 x=hashlib.sha256();
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''): x.update(b)
 return x.hexdigest()
rows=[]
for p in sorted(DST.rglob('*')):
 if not p.is_file() or p.name.startswith('~$') or p.name=='.DS_Store': continue
 rel=p.relative_to(DST); src=SRC/rel
 hd=h(p); hs=h(src) if src.exists() else ''
 if hd==hs: continue
 stem=p.stem; code=(re.match(r'([A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})?(?:[.-][0-9]+)?)',stem) or [None,''])[1]
 revs=re.findall(r'(?<![A-Za-z])([A-Z])(?=[_ .()\-]|$)',stem)
 old=revs[-1] if revs else ''; new=chr(ord(old)+1) if old and old<'Z' else (old or 'A')
 rows.append({'ID':len(rows)+1,'Código':code.upper(),'Documento':p.name,'Departamento':rel.parts[0] if len(rel.parts)>1 else '(raíz)','Ruta SG chat':str(rel),'Formato':p.suffix.lower()[1:],'Revisión anterior':old,'Revisión nueva propuesta':new,'Fecha actualización':'2026-08-19','Estado':'Actualizado — pendiente de aprobación','Cambio realizado':'Adecuación de información aplicable a ISO 9001:2015 / IATF 16949, preservando formato original','Responsable':'Dueño de proceso a confirmar','Aprobador':'Dirección / Calidad','SHA-256':hd})
with (OUT/'maestro_modificados.csv').open('w',newline='',encoding='utf-8-sig') as f:
 w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
print('modificados',len(rows))
