import csv,re
from pathlib import Path
src=Path('outputs/sg-kimi-work/inventario_archivos.csv'); out=Path('outputs/sg-kimi-work/maestro_base.csv')
def clauses(path,name):
    s=(path+' '+name).lower()
    pairs=[
      (['rrhh','capac','puesto','compet'], '7.1.2; 7.2; 7.3 / IATF 7.2.1–7.3.2'),
      (['compras','proveedor','contrat'], '8.4 / IATF 8.4.1–8.4.3'),
      (['mantenimiento','calibra','equipo','herram'], '7.1.3; 7.1.5 / IATF 7.1.5; 8.5.1.5–8.5.1.6'),
      (['auditor','auditoria'], '9.2 / IATF 9.2.2.1–9.2.2.4'),
      (['riesgo','conting'], '6.1 / IATF 6.1.2.1; 6.1.2.3'),
      (['cliente','comercial','satisf'], '8.2; 9.1.2 / IATF 9.1.2.1'),
      (['no conform','reclamo','problema','accion'], '8.7; 10.2 / IATF 10.2.3–10.2.6'),
      (['tráfico','trafico','logistic','despacho','transporte'], '8.5.4; 8.6 / IATF 8.5.4.1'),
      (['sistema','backup','software','inform'], '7.1.3; 7.5 / IATF 7.1.3.1; 7.5.3.2.1'),
      (['direcci','objetivo','politica','política'], '5; 6.2; 9.3 / IATF 5.1.1.1–5.1.1.3; 9.3.2.1'),
      (['proceso','instruct','operaci','ruedas','ckd','paragolpes'], '4.4; 8.1; 8.5 / IATF 8.5.1.1–8.5.1.7'),
    ]
    return next((v for ks,v in pairs if any(k in s for k in ks)),'7.5 — Información documentada')
rows=list(csv.DictReader(open(src,encoding='utf-8-sig')))
fields=['ID','Código','Título / archivo','Tipo','Departamento / proceso','Ruta relativa','Revisión actual','Revisión objetivo','Estado documental','Aplicabilidad','Cláusulas relacionadas','Responsable','Aprobador','Fecha última revisión','Próxima revisión','Retención','Medio','Observaciones','SHA-256']
with open(out,'w',newline='',encoding='utf-8-sig') as f:
 w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
 for i,r in enumerate(rows,1):
  rev=r['revision_inferida']; ext=r['extension']; obsolete=r['estado_inferido']=='Obsoleto'
  editable=ext in ('doc','docx','xls','xlsx','xlsm','pptx','vsd','vsdx')
  obj=chr(ord(rev)+1) if len(rev)==1 and rev.isalpha() and rev<'Z' and not obsolete else (rev or 'A')
  st='Obsoleto — conservar, no usar' if obsolete else ('Vigente — validar contenido y aprobar' if editable else 'Registro/evidencia — conservar')
  typ={'doc':'Documento Word legado','docx':'Documento Word','xls':'Planilla Excel legado','xlsx':'Planilla Excel','xlsm':'Planilla Excel con macros','pdf':'PDF / evidencia','pptx':'Presentación'}.get(ext,ext.upper())
  w.writerow({'ID':i,'Código':r['codigo_inferido'],'Título / archivo':r['nombre'],'Tipo':typ,'Departamento / proceso':r['carpeta_principal'],'Ruta relativa':r['ruta_relativa'],'Revisión actual':rev,'Revisión objetivo':obj,'Estado documental':st,'Aplicabilidad':'Sistema KIMI','Cláusulas relacionadas':clauses(r['ruta_relativa'],r['nombre']),'Responsable':'A definir por dueño de proceso','Aprobador':'Dirección / autoridad designada','Fecha última revisión':r['fecha_modificacion'][:10],'Próxima revisión':'2027-08-19' if not obsolete else 'No aplica','Retención':'Según requisito legal/cliente; mínimo 3 años si no se define otro plazo','Medio':'Digital','Observaciones':'Pendiente de aprobación organizacional' if not obsolete else 'Bloqueado para uso operativo','SHA-256':r['sha256']})
print(len(rows))
