from pathlib import Path
import json,subprocess
ROOT=Path('/Users/leonardocastillo/Desktop/SG chat')
items={x['ruta']:x for x in json.loads(Path('outputs/sg-chat-work/contenido_extraido.json').read_text(encoding='utf-8'))}
refs={'recursos_humanos':'ISO 9001:2015 7.2–7.3 / IATF 16949 7.2.1–7.3.2','proveedores':'ISO 9001:2015 8.4 / IATF 16949 8.4.1–8.4.3','operacion':'ISO 9001:2015 8.1 y 8.5 / IATF 16949 8.5.1.1–8.5.1.7','calidad':'ISO 9001:2015 8.6–10.2 / IATF 16949 9.2.2 y 10.2.3','riesgos':'ISO 9001:2015 6.1 / IATF 16949 6.1.2.1 y 6.1.2.3','cliente':'ISO 9001:2015 8.2 y 9.1.2 / IATF 16949 9.1.2.1','metrologia':'ISO 9001:2015 7.1.5 / IATF 16949 7.1.5.1','mantenimiento':'ISO 9001:2015 7.1.3 / IATF 16949 8.5.1.5–8.5.1.6','logistica':'ISO 9001:2015 8.5.4 y 8.6 / IATF 16949 8.5.4.1','control_documental':'ISO 9001:2015 7.5 / IATF 16949 7.5.3.2.1'}
skip=('registro','acta','certific','evidencia','asistencia','factura','recibo','foto','resultado','informe','auditoria','auditoría','2022','2023','2024','2025','2026','~$','obsolet')
done_path=Path('outputs/sg-chat-work/excel_done.json'); fail_path=Path('outputs/sg-chat-work/excel_fail.json')
done=json.loads(done_path.read_text()) if done_path.exists() else []
fail=[];script='.codex-tmp/sg-chat/update_excel_native.applescript'
for p in sorted(ROOT.rglob('*')):
 if p.suffix.lower() not in ('.xls','.xlsx','.xlsm'): continue
 rel=str(p.relative_to(ROOT)); low=rel.lower()
 if rel in done: continue
 if any(x in low for x in skip): continue
 kinds=items.get(rel,{}).get('clasificacion') or ['control_documental']
 applicable='; '.join(list(dict.fromkeys(refs[k] for k in kinds if k in refs))[:2]) or refs['control_documental']
 text=f'SG chat 19/08/2026. Aplicable: {applicable}. Diseño, fórmulas y macros preservados. Revisión y aprobación requeridas antes de liberación.'[:240]
 r=None
 for attempt in range(3):
  try: r=subprocess.run(['osascript',script,str(p),text],capture_output=True,text=True,timeout=45)
  except subprocess.TimeoutExpired:
   r=subprocess.CompletedProcess([],124,'','Tiempo de espera agotado')
  if r.returncode==0: break
  try: subprocess.run(['osascript','-e','tell application "Microsoft Excel" to quit'],capture_output=True,timeout=15)
  except subprocess.TimeoutExpired: pass
 (done if r.returncode==0 else fail).append(rel if r.returncode==0 else [rel,r.stderr[-300:]])
 print(len(done),len(fail),rel,flush=True)
 Path('outputs/sg-chat-work/excel_done.json').write_text(json.dumps(done,ensure_ascii=False,indent=2))
 Path('outputs/sg-chat-work/excel_fail.json').write_text(json.dumps(fail,ensure_ascii=False,indent=2))
Path('outputs/sg-chat-work/excel_done.json').write_text(json.dumps(done,ensure_ascii=False,indent=2))
Path('outputs/sg-chat-work/excel_fail.json').write_text(json.dumps(fail,ensure_ascii=False,indent=2))
print('DONE',len(done),'FAILED',len(fail))
