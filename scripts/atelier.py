"""Build two authored fine-cut artworks without changing existing slot indices.
The original four layouts and their saves stay intact. Requires Pillow.
"""
from pathlib import Path
import ast,json,math
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
FRONT=ROOT/'frontend'
data=json.loads((FRONT/'assets/geometry.json').read_text())
image=Image.open(FRONT/'assets/polished-gems.png')
alpha=image.getchannel('A');row_bounds=[0,263,535,840,image.height];crops={}
for row,shape in enumerate(['round','drop','leaf','heart']):
    for c in range(5):
        left=round(c*image.width/5);right=round((c+1)*image.width/5)
        box=alpha.crop((left,row_bounds[row],right,row_bounds[row+1])).point(lambda a:255 if a>=218 else 0).getbbox()
        if not box:raise ValueError('Missing gemstone body')
        crops[f'{shape}-{c}']=[left+box[0],row_bounds[row]+box[1],box[2]-box[0],box[3]-box[1]]
(FRONT/'assets/polished-atlas.json').write_text(json.dumps({'crops':crops,'image':'polished-gems.png'},indent=2)+'\n')
# Reuse the geometry checker, without running the original generator.
parsed=ast.parse((ROOT/'scripts/layouts.py').read_text())
needed={'hull','ellipse','world','separated','Board'}
module=ast.Module(body=[n for n in parsed.body if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name in needed],type_ignores=[])
from collections import defaultdict
GAP=1.8
exec(compile(module,'layout-geometry','exec'))

def cubic(p,a,b,q,t):
    return tuple((1-t)**3*p[i]+3*(1-t)**2*t*a[i]+3*(1-t)*t*t*b[i]+t**3*q[i] for i in [0,1])

def cut(shape):
    if shape=='round':
        outline=[(math.cos(i*math.tau/48)*.5,math.sin(i*math.tau/48)*.5) for i in range(48)]
        return outline,'M .5 0 A .5 .5 0 1 1 -.5 0 A .5 .5 0 1 1 .5 0 Z'
    if shape=='drop':segments=[((0,-.5),(-.12,-.36),(-.5,-.08),(-.5,.15)),((-.5,.15),(-.5,.6166667),(.5,.6166667),(.5,.15)),((.5,.15),(.5,-.08),(.12,-.36),(0,-.5))]
    elif shape=='leaf':segments=[((0,-.5),(-.6666667,-.2),(-.6666667,.2),(0,.5)),((0,.5),(.6666667,.2),(.6666667,-.2),(0,-.5))]
    else:segments=[((0,-.29),(-.18,-.57),(-.5,-.53),(-.5,-.16)),((-.5,-.16),(-.5,.05),(-.16,.32),(0,.5)),((0,.5),(.16,.32),(.5,.05),(.5,-.16)),((.5,-.16),(.5,-.53),(.18,-.57),(0,-.29))]
    sampled=[cubic(*seg,i/32) for seg in segments for i in range(32)]
    xs=[p[0] for p in sampled];ys=[p[1] for p in sampled];xmin,xmax=min(xs),max(xs);ymin,ymax=min(ys),max(ys)
    def norm(p):return (round((p[0]-xmin)/(xmax-xmin)-.5,7),round((p[1]-ymin)/(ymax-ymin)-.5,7))
    path='M '+' '.join(map(str,norm(segments[0][0])))
    for seg in segments:path+=' C '+' '.join(str(v) for p in seg[1:] for v in norm(p))
    return [norm(p) for p in sampled],path+' Z'

LIB={}
for shape in ['round','drop','leaf','heart']:
    outline,path=cut(shape)
    for c in range(5):
        k=f'{shape}-{c}';crop=crops[k]
        LIB[k]={'crop':crop,'aspect':crop[2]/crop[3],'outline':outline,'path':path,'material':k,'hull':hull([(x*1.009,y*1.009) for x,y in outline])}

crown=Board();crown.add(400,400,48,3)
crown.ring(16,220,88,0,'drop');crown.ring(16,149,41,1,'round',math.pi/16);crown.ring(12,86,59,2,'leaf')
crown.ring(32,273,8,0,'round',math.pi/32)
crown.ring(48,125,5.5,3)
crown.ring(24,43,5.5,3)
# Mirrored tiny gold grains follow both sides of every outer petal.
for i in range(16):
    a=i*math.tau/16
    for side in [-1,1]:
        for radius,size,offset in [(195,7,.145),(218,6,.16),(241,5,.14)]:
            t=a+side*offset;crown.add(400+math.sin(t)*radius,400-math.cos(t)*radius,size,3)
# Pairwise beads bridge the middle ring with a regular, repeated rhythm.
crown.ring(32,178,7,3,'round',math.pi/32)

birds=Board()
left=lambda x,y:ellipse(x,y,286,430,102,139)
right=lambda x,y:ellipse(x,y,502,452,102,137)
lhead=lambda x,y:ellipse(x,y,314,302,65,66)
rhead=lambda x,y:ellipse(x,y,468,329,62,62)
birds.add(347,289,10,2);birds.add(440,320,10,2)
birds.add(383,311,23,3,'leaf',87);birds.add(403,338,22,3,'leaf',92)
# Feather rows bow gently with the body; no random packing or large round bubbles.
for side,cx,cy,region in [(-1,286,430,left),(1,502,452,right)]:
    for row in range(13):
        base_y=cy-119+row*20.5
        for col in range(-7,8):
            x=cx+col*18+(row%2)*9;y=base_y+8*(col/6)**2
            if (side<0 and lhead(x,y)) or (side>0 and rhead(x,y)):continue
            angle=side*(8+9*abs(col)/7)
            wing=ellipse(x,y,cx+side*31,cy+8,43,84)
            color=(0 if wing else 4) if side<0 else (1 if wing else 0)
            if side<0 and y>485 and x>cx-13:color=1
            birds.add(x,y,19.5,color,'drop',angle,region)
# Small brilliant cuts make gently curved head rows and clean silhouette boundaries.
for cx,cy,region,c in [(314,302,lhead,4),(468,329,rhead,0)]:
    for row in range(-6,7):
        for col in range(-6,7):
            x=cx+col*11.8+(row%2)*5.9;y=cy+row*10.6+1.8*(col/6)**2
            birds.add(x,y,9,c,'round',0,region)
# A coherent thin branch and paired leaves replace disconnected horizontal dots.
for i in range(43):
    x=141+i*12.5;y=615+18*((x-400)/270)**2
    birds.add(x,y,9,3)
for x,y,a in [(156,607,-55),(644,610,58)]:birds.add(x,y,34,0,'leaf',a)
# Slender gold feet connect each silhouette to the continuous branch.
for x,y,h in [(269,596,35),(291,596,35),(490,603,17),(510,603,17)]:birds.add(x,y,h,3,'leaf')
for i,(x,y,h) in enumerate([(250,190,16),(325,154,12),(402,169,37),(489,183,15),(550,225,23)]):birds.add(x,y,h,1,'heart',i*4-8)
for x,y in [(216,245),(461,150),(581,283)]:birds.add(x,y,6.5,3)

# Append refinements: keep every released slot and its save index unchanged.
base_birds=len(birds.items)
# Continue the head lattice through the neck instead of leaving a white seam.
for cx,cy,body,head,c in [(314,302,left,lhead,4),(468,329,right,rhead,0)]:
    union=lambda x,y,body=body,head=head:body(x,y) or head(x,y)
    for row in range(4,10):
        for col in range(-5,6):
            x=cx+col*11.8+(row%2)*5.9;y=cy+row*10.6+1.8*(col/6)**2
            birds.add(x,y,6.2,c,'round',0,union)
# A regular fine-bead outline rounds the silhouette without random gap filling.
for cx,cy,rx,ry,other,c in [(314,302,65,66,left,4),(286,430,102,139,lhead,4),(468,329,62,62,right,0),(502,452,102,137,rhead,0)]:
    n=round(math.tau*math.sqrt((rx*rx+ry*ry)/2)/9.5)
    region=lambda x,y,cx=cx,cy=cy,rx=rx,ry=ry:ellipse(x,y,cx,cy,rx,ry)
    for i in range(n):
        a=i*math.tau/n;x=cx+(rx-3)*math.cos(a);y=cy+(ry-3)*math.sin(a)
        if not other(x,y):birds.add(x,y,4.4,c,'round',0,region)
# Complete the paired feet, allowing room for the branch's own stones.
birds.add(291,594,26,3,'leaf');birds.add(490,598,17,3,'leaf')
for x,y,c in [(269,574,4),(291,574,4),(490,585,0),(510,588,0)]:birds.add(x,y,6,c)
# New versions must preserve the prefix of every already released artwork.
for board,ident in [(crown,'atelier-crown'),(birds,'atelier-birds')]:
    previous=next((l for l in data['layouts'] if l['id']==ident),None)
    if previous:
        assert len(board.items)>=len(previous['items'])
        for current,old in zip(board.items,previous['items']):
            assert current=={k:v for k,v in old.items() if k!='gem'},f'Changed saved slot {ident}: {old["id"]}'

for board in [crown,birds]:
    boxes=[(min(x for x,y in p),min(y for x,y in p),max(x for x,y in p),max(y for x,y in p)) for p in board.polys]
    for i,a in enumerate(board.polys):
        for j,b in enumerate(board.polys[i+1:],i+1):
            x,y=boxes[i],boxes[j]
            if x[2]+GAP<=y[0] or y[2]+GAP<=x[0] or x[3]+GAP<=y[1] or y[3]+GAP<=x[1]:continue
            assert separated(a,b),f'Overlapping fine-cut gemstones: {i}, {j}'
for k,g in LIB.items():data['gems']['atelier-'+k]=g
legacy=[l for l in data['layouts'] if l.get('edition')!='atelier']
for id,name,tag,board in [('atelier-crown','翡翠花冕','珠宝花冠 · 对称花瓣与细金珠',crown),('atelier-birds','双鸟花枝','羽毛排布 · 细密水滴与心形',birds)]:
    for s in board.items:s['gem']='atelier-'+s['shape']+'-'+str(s['c'])
    legacy.append({'id':id,'name':name,'tag':tag,'edition':'atelier','gap':GAP,'items':board.items})
    print(id,len(board.items),'slots, validated minimum gap',GAP)
data['layouts']=legacy
(FRONT/'assets/geometry.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
