from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import subprocess
import shutil
import os

root = Path('/Users/leonardocastillo/Desktop/APP/SGI respaldo 360/outputs/toyota-documentos-individuales')
render_root = Path('/Users/leonardocastillo/Desktop/APP/SGI respaldo 360/outputs/toyota-documentos-render')
python = '/Users/leonardocastillo/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3'
renderer = '/Users/leonardocastillo/.codex/plugins/cache/openai-primary-runtime/documents/26.818.11542/skills/documents/render_docx.py'

if render_root.exists():
    shutil.rmtree(render_root)
render_root.mkdir(parents=True)

docs = sorted([p for p in root.rglob('*.docx') if p.name != '00_Carpeta_Maestra_Cumplimiento_DADA_2026.docx'])

def render(path):
    rel = path.relative_to(root)
    out = render_root / rel.parent / path.stem
    out.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env['TMPDIR'] = '/private/tmp'
    proc = subprocess.run([python, renderer, str(path), '--output_dir', str(out)], capture_output=True, text=True, env=env)
    pages = len(list(out.glob('page-*.png')))
    return str(rel), proc.returncode, pages, proc.stderr[-500:]

results = []
with ThreadPoolExecutor(max_workers=4) as pool:
    futures = [pool.submit(render, p) for p in docs]
    for future in as_completed(futures):
        results.append(future.result())

failed = [x for x in results if x[1] != 0 or x[2] == 0]
print(f'DOCS={len(docs)} PAGES={sum(x[2] for x in results)} FAILED={len(failed)}')
for item in failed:
    print(item)
