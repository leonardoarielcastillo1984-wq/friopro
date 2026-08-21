from pathlib import Path
from PIL import Image, ImageDraw

root = Path('/Users/leonardocastillo/Desktop/APP/SGI respaldo 360/outputs/toyota-documentos-render')
out = root / '_contact_sheets'
out.mkdir(parents=True, exist_ok=True)
pages = sorted(root.rglob('page-*.png'), key=lambda p: str(p))
batch_size = 30
tw, th = 210, 275
for start in range(0, len(pages), batch_size):
    batch = pages[start:start+batch_size]
    canvas = Image.new('RGB', (tw*6, th*5), 'white')
    draw = ImageDraw.Draw(canvas)
    for idx, path in enumerate(batch):
        img = Image.open(path).convert('RGB')
        img.thumbnail((tw-8, th-24))
        x = (idx % 6)*tw + (tw-img.width)//2
        y = (idx // 6)*th + 18
        canvas.paste(img, (x, y))
        label = f'{path.parent.name[:17]} p{path.stem.split("-")[-1]}'
        draw.text(((idx%6)*tw+4, (idx//6)*th+3), label, fill='black')
    canvas.save(out / f'contact-{start//batch_size+1:02d}.png')
print(f'PAGES={len(pages)} SHEETS={(len(pages)+batch_size-1)//batch_size}')
