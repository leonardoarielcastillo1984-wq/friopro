from pathlib import Path
import hashlib,subprocess,sys
SRC=Path('/Users/leonardocastillo/Desktop/SG Calidad'); DST=Path('/Users/leonardocastillo/Desktop/SG chat'); OUT=Path('outputs/sg-chat-work/render_changed');OUT.mkdir(parents=True,exist_ok=True)
renderer='/Users/leonardocastillo/.codex/plugins/cache/openai-primary-runtime/documents/26.818.11542/skills/documents/render_docx.py'
def h(p):return hashlib.sha256(p.read_bytes()).digest()
docs=[]
for p in DST.rglob('*.docx'):
 q=SRC/p.relative_to(DST)
 if q.exists() and h(p)!=h(q): docs.append(p)
failed=[];pages=0
for i,p in enumerate(sorted(docs),1):
 od=OUT/f'{i:03d}_{p.stem[:45]}';r=subprocess.run([sys.executable,renderer,str(p),'--output_dir',str(od)],capture_output=True,text=True)
 if r.returncode:failed.append([str(p.relative_to(DST)),r.stderr[-400:]])
 else:pages+=len(list(od.glob('page-*.png')))
 print(i,len(docs),p.name,flush=True)
print('DOCS',len(docs),'PAGES',pages,'FAILED',len(failed));print(failed)
