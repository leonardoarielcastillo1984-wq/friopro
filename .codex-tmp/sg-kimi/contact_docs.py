from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
files=sorted(Path('outputs/sg-kimi-work/render_docs').glob('*/page-*.png'))
thumbs=[]
for p in files:
 im=Image.open(p).convert('RGB'); im.thumbnail((220,285)); canvas=Image.new('RGB',(230,315),'white'); canvas.paste(im,((230-im.width)//2,20)); ImageDraw.Draw(canvas).text((5,3),p.parent.name[:28]+' '+p.stem,fill='black'); thumbs.append(canvas)
for n in range(0,len(thumbs),20):
 batch=thumbs[n:n+20]; sheet=Image.new('RGB',(230*5,315*4),'white')
 for i,im in enumerate(batch): sheet.paste(im,((i%5)*230,(i//5)*315))
 sheet.save(f'outputs/sg-kimi-work/contact-{n//20+1}.png')
print(len(files))
