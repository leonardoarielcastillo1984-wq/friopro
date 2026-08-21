from pathlib import Path
import subprocess,sys
src=Path('outputs/sg-kimi-work/documentos_nuevos'); out=Path('outputs/sg-kimi-work/render_docs'); out.mkdir(parents=True,exist_ok=True)
renderer='/Users/leonardocastillo/.codex/plugins/cache/openai-primary-runtime/documents/26.818.11542/skills/documents/render_docx.py'
failed=[]; pages=0
for p in sorted(src.glob('*.docx')):
 d=out/p.stem; r=subprocess.run([sys.executable,renderer,str(p),'--output_dir',str(d)],capture_output=True,text=True)
 if r.returncode: failed.append((p.name,r.stderr[-500:]))
 else: pages += len(list(d.glob('page-*.png')))
print('docs',len(list(src.glob('*.docx'))),'pages',pages,'failed',len(failed)); print(failed)
