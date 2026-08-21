from pathlib import Path
import json,subprocess
ROOT=Path('/Users/leonardocastillo/Desktop/SG chat')
items={x['ruta']:x for x in json.loads(Path('outputs/sg-chat-work/contenido_extraido.json').read_text(encoding='utf-8'))}
mods={
'recursos_humanos':'Se incorporan requisitos de competencia, toma de conciencia, evaluación de eficacia y conservación de evidencias conforme ISO 9001:2015 7.2–7.3 e IATF 16949 7.2.1–7.3.2. El responsable deberá asegurar criterios objetivos, acciones ante brechas y trazabilidad de aprobación.',
'proveedores':'Se incorporan selección, evaluación basada en riesgo, seguimiento del desempeño, control de cambios y requisitos específicos del cliente conforme ISO 9001:2015 8.4 e IATF 16949 8.4.1–8.4.3.',
'operacion':'Se incorporan condiciones controladas, criterios de aceptación, trazabilidad, reacción ante desvíos y control de cambios conforme ISO 9001:2015 8.1 y 8.5 e IATF 16949 8.5.1.1–8.5.1.7.',
'calidad':'Se incorporan liberación autorizada, control de no conformidades, auditoría, solución de problemas y verificación de eficacia conforme ISO 9001:2015 8.6–10.2 e IATF 16949 9.2.2 y 10.2.3.',
'riesgos':'Se incorporan evaluación y tratamiento de riesgos, oportunidades y contingencias, incluyendo responsables, pruebas y revisión de eficacia, conforme ISO 9001:2015 6.1 e IATF 16949 6.1.2.1 y 6.1.2.3.',
'cliente':'Se incorporan revisión de requisitos, requisitos específicos, satisfacción, reclamos y comunicación conforme ISO 9001:2015 8.2 y 9.1.2 e IATF 16949 9.1.2.1.',
'metrologia':'Se incorporan trazabilidad metrológica, calibración, verificación, MSA y reacción ante equipos fuera de condición conforme ISO 9001:2015 7.1.5 e IATF 16949 7.1.5.1.',
'mantenimiento':'Se incorporan mantenimiento preventivo/predictivo, equipos críticos, repuestos y planes de reacción conforme ISO 9001:2015 7.1.3 e IATF 16949 8.5.1.5–8.5.1.6.',
'logistica':'Se incorporan preservación, identificación, embalaje, transporte, entrega y reacción ante desvíos conforme ISO 9001:2015 8.5.4 y 8.6 e IATF 16949 8.5.4.1.',
'control_documental':'Se incorporan identificación, aprobación, acceso, protección, retención y trazabilidad de cambios conforme ISO 9001:2015 7.5 e IATF 16949 7.5.3.2.1.'}
skip=('registro','acta','certific','evidencia','encuesta','asistencia','cv ','curriculum','factura','recibo','foto','resultado','informe','auditoria','auditoría','~$')
include=('proced','manual','instruct','polit','reglamento','lineamiento','proceso','ico-','irh-','psg-','pg-','po-','mc-')
done=[]; fail=[]; script='.codex-tmp/sg-chat/update_word_native.applescript'
for p in sorted(ROOT.rglob('*.doc')):
 rel=str(p.relative_to(ROOT)); low=rel.lower()
 if any(x in low for x in skip): continue
 if not any(x in low for x in include): continue
 check=subprocess.run(['textutil','-convert','txt','-stdout',str(p)],capture_output=True,timeout=60)
 if b'ACTUALIZACI' in check.stdout.upper(): continue
 kinds=items.get(rel,{}).get('clasificacion') or ['control_documental']
 text=' '.join(mods[k] for k in kinds if k in mods)
 if not text: text=mods['control_documental']
 r=subprocess.run(['osascript',script,str(p),text],capture_output=True,text=True,timeout=120)
 (done if r.returncode==0 else fail).append(rel if r.returncode==0 else [rel,r.stderr[-300:]])
 print(len(done),len(fail),rel,flush=True)
Path('outputs/sg-chat-work/legacy_word_done.json').write_text(json.dumps(done,ensure_ascii=False,indent=2))
Path('outputs/sg-chat-work/legacy_word_fail.json').write_text(json.dumps(fail,ensure_ascii=False,indent=2))
print('DONE',len(done),'FAILED',len(fail))
