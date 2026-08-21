from pathlib import Path
import subprocess, json, re, zipfile
from xml.etree import ElementTree as ET

ROOT=Path('/Users/leonardocastillo/Desktop/SG chat')
OUT=Path('outputs/sg-chat-work'); OUT.mkdir(parents=True,exist_ok=True)
items=[]

def office_text(p):
    try:
        r=subprocess.run(['textutil','-convert','txt','-stdout',str(p)],capture_output=True,timeout=60)
        if r.returncode==0: return r.stdout.decode('utf-8','ignore')
    except Exception: pass
    return ''

def xlsx_text(p):
    vals=[]
    try:
        with zipfile.ZipFile(p) as z:
            shared=[]
            if 'xl/sharedStrings.xml' in z.namelist():
                root=ET.fromstring(z.read('xl/sharedStrings.xml'))
                shared=[''.join(x.text or '' for x in si.iter() if x.tag.endswith('}t')) for si in root]
            for n in z.namelist():
                if not n.startswith('xl/worksheets/sheet') or not n.endswith('.xml'): continue
                root=ET.fromstring(z.read(n))
                for c in root.iter():
                    if not c.tag.endswith('}c'): continue
                    typ=c.attrib.get('t'); v=next((x for x in c if x.tag.endswith('}v')),None)
                    if v is not None and v.text:
                        if typ=='s' and v.text.isdigit() and int(v.text)<len(shared): vals.append(shared[int(v.text)])
                        else: vals.append(v.text)
    except Exception: pass
    return '\n'.join(vals)

for p in sorted(ROOT.rglob('*')):
    if not p.is_file(): continue
    ext=p.suffix.lower(); text=''
    if ext in ('.doc','.docx'): text=office_text(p)
    elif ext in ('.xlsx','.xlsm'): text=xlsx_text(p)
    elif ext=='.xls': text=office_text(p)
    elif ext=='.pptx': text=office_text(p)
    low=(str(p.relative_to(ROOT))+' '+text[:20000]).lower()
    kinds=[]
    rules=[
      ('control_documental',['documento','revisión','revision','aprobó','aprobo']),
      ('recursos_humanos',['competencia','capacitación','capacitacion','puesto','personal']),
      ('proveedores',['proveedor','compras','contratación','contratacion']),
      ('operacion',['operación','operacion','producción','produccion','instructivo','proceso']),
      ('calidad',['calidad','no conform','auditor','inspección','inspeccion']),
      ('riesgos',['riesgo','contingencia','emergencia']),
      ('cliente',['cliente','reclamo','satisfacción','satisfaccion']),
      ('metrologia',['calibración','calibracion','medición','medicion','msa']),
      ('mantenimiento',['mantenimiento','equipo','máquina','maquina']),
      ('logistica',['tráfico','trafico','transporte','despacho','entrega']),
    ]
    for k,ws in rules:
        if any(w in low for w in ws): kinds.append(k)
    items.append({'ruta':str(p.relative_to(ROOT)),'extension':ext,'caracteres_extraidos':len(text),'clasificacion':kinds,'muestra':re.sub(r'\s+',' ',text[:1000]).strip()})

(OUT/'contenido_extraido.json').write_text(json.dumps(items,ensure_ascii=False,indent=2),encoding='utf-8')
print('archivos',len(items),'con_texto',sum(bool(x['caracteres_extraidos']) for x in items),'sin_texto',sum(not x['caracteres_extraidos'] for x in items))
