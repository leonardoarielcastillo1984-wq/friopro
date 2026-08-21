from pathlib import Path
import zipfile,tempfile,shutil,re,json
from xml.etree import ElementTree as ET
ROOT=Path('/Users/leonardocastillo/Desktop/SG chat')
CP='http://schemas.openxmlformats.org/package/2006/metadata/core-properties'; DC='http://purl.org/dc/elements/1.1/'; DCT='http://purl.org/dc/terms/'
ET.register_namespace('cp',CP); ET.register_namespace('dc',DC); ET.register_namespace('dcterms',DCT); ET.register_namespace('xsi','http://www.w3.org/2001/XMLSchema-instance')
done=[];fail=[]
skip=('registro','acta','certific','evidencia','asistencia','factura','recibo','foto','resultado','informe','auditoria','auditoría','2022','2023','2024','2025','2026','~$','obsolet')
for p in sorted(ROOT.rglob('*')):
 if p.suffix.lower() not in ('.xlsx','.xlsm','.pptx'): continue
 rel=str(p.relative_to(ROOT)); low=rel.lower()
 if any(x in low for x in skip): continue
 try:
  fd,tmp=tempfile.mkstemp(suffix=p.suffix); Path(tmp).unlink(missing_ok=True)
  with zipfile.ZipFile(p,'r') as zin, zipfile.ZipFile(tmp,'w') as zout:
   for item in zin.infolist():
    data=zin.read(item.filename)
    if item.filename=='docProps/core.xml':
     root=ET.fromstring(data)
     desc=root.find(f'{{{DC}}}description')
     if desc is None: desc=ET.SubElement(root,f'{{{DC}}}description')
     desc.text='SG chat — actualización normativa 19/08/2026. Aplicación ISO 9001:2015 e IATF 16949; revisión y aprobación requeridas antes de liberación.'
     rev=root.find(f'{{{CP}}}revision')
     if rev is None: rev=ET.SubElement(root,f'{{{CP}}}revision')
     try: rev.text=str(int(rev.text or '0')+1)
     except: rev.text='1'
     data=ET.tostring(root,encoding='utf-8',xml_declaration=True)
    zout.writestr(item,data)
  shutil.copystat(p,tmp); shutil.move(tmp,p); done.append(rel)
 except Exception as e: fail.append([rel,str(e)])
Path('outputs/sg-chat-work/ooxml_done.json').write_text(json.dumps(done,ensure_ascii=False,indent=2))
Path('outputs/sg-chat-work/ooxml_fail.json').write_text(json.dumps(fail,ensure_ascii=False,indent=2))
print('updated',len(done),'failed',len(fail))
