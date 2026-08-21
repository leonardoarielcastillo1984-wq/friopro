from pathlib import Path
import shutil,hashlib,json
SRC=Path('/Users/leonardocastillo/Desktop/SG Calidad');DST=Path('/Users/leonardocastillo/Desktop/SG chat')
terms=('informe auditor','encuesta de clima','revision por la dirección 2025','revision_por_la_dirección_ruedas_2020','revision_por_la_dirección_ruedas_2023','revision por la dirección ruedas 2024','revision_por_la_direccion_ruedas_2025','transition checklist')
restored=[]
for p in DST.rglob('*.docx'):
 rel=p.relative_to(DST);low=str(rel).lower();src=SRC/rel
 if src.exists() and any(t in low for t in terms):
  shutil.copy2(src,p);restored.append(str(rel))
Path('outputs/sg-chat-work/restored_historical.json').write_text(json.dumps(restored,ensure_ascii=False,indent=2))
print('restored',len(restored))
