"""Build deterministic, collision-checked layouts and shared gem body outlines.
Requires Pillow only; performs geometry extraction, never rewrites the source atlas.
"""
from pathlib import Path
import json, math, random
from collections import defaultdict
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
FRONT=ROOT/'frontend'
ATLAS=Image.open(FRONT/'assets/gemstones.png')
CROPS=json.loads((FRONT/'assets/atlas.json').read_text())
LIB={}

def hull(points):
    points=sorted(set(points))
    def cross(o,a,b):return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lower=[];upper=[]
    for p in points:
        while len(lower)>=2 and cross(lower[-2],lower[-1],p)<=0:lower.pop()
        lower.append(p)
    for p in reversed(points):
        while len(upper)>=2 and cross(upper[-2],upper[-1],p)<=0:upper.pop()
        upper.append(p)
    return lower[:-1]+upper[:-1]

def simplify(points,tolerance):
    if len(points)<3:return points
    a,b=points[0],points[-1];dx=b[0]-a[0];dy=b[1]-a[1];den=math.hypot(dx,dy)
    distances=[abs(dx*(p[1]-a[1])-dy*(p[0]-a[0]))/den if den else math.dist(p,a) for p in points]
    k=max(range(len(points)),key=lambda i:distances[i])
    if distances[k]<=tolerance:return [a,b]
    return simplify(points[:k+1],tolerance)[:-1]+simplify(points[k:],tolerance)

for shape,rects in CROPS.items():
    for c,rect in enumerate(rects):
        x,y,w,h=rect;x0=round(x/500*ATLAS.width);y0=round(y/400*ATLAS.height)
        x1=round((x+w)/500*ATLAS.width);y1=round((y+h)/400*ATLAS.height)
        # Exclude translucent contact shadows from the body geometry.
        pixels={(xx,yy) for yy in range(y0,y1) for xx in range(x0,x1) if ATLAS.getpixel((xx,yy))[3]>=210}
        components=[]
        while pixels:
            p=pixels.pop();stack=[p];component={p}
            while stack:
                xx,yy=stack.pop()
                for q in [(xx+1,yy),(xx-1,yy),(xx,yy+1),(xx,yy-1)]:
                    if q in pixels:pixels.remove(q);component.add(q);stack.append(q)
            components.append(component)
        body=max(components,key=len);edges=defaultdict(list)
        for xx,yy in body:
            for neighbor,a,b in [((xx,yy-1),(xx,yy),(xx+1,yy)),((xx+1,yy),(xx+1,yy),(xx+1,yy+1)),((xx,yy+1),(xx+1,yy+1),(xx,yy+1)),((xx-1,yy),(xx,yy+1),(xx,yy))]:
                if neighbor not in body:edges[a].append(b)
        loops=[]
        while edges:
            start=next(iter(edges));point=start;loop=[]
            while point in edges:
                loop.append(point);nextpoint=edges[point].pop()
                if not edges[point]:del edges[point]
                point=nextpoint
                if point==start:break
            if len(loop)>4:loops.append(loop)
        outline=max(loops,key=lambda ps:abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(ps,ps[1:]+ps[:1]))))
        split=max(range(len(outline)),key=lambda i:math.dist(outline[0],outline[i]))
        outline=simplify(outline[:split+1],1.1)[:-1]+simplify(outline[split:]+outline[:1],1.1)[:-1]
        bx=min(p[0] for p in body);by=min(p[1] for p in body);bw=max(p[0] for p in body)+1-bx;bh=max(p[1] for p in body)+1-by
        poly=[[round((xx-bx)/bw-.5,5),round((yy-by)/bh-.5,5)] for xx,yy in outline]
        LIB[f'{shape}-{c}']={'crop':[bx,by,bw,bh],'aspect':round(bw/bh,6),'outline':poly,'hull':hull([tuple(p) for p in poly])}

GAP=1.3

def ellipse(x,y,cx,cy,rx,ry):return ((x-cx)/rx)**2+((y-cy)/ry)**2<=1

def world(stone):
    a=math.radians(stone['angle']);co=math.cos(a);si=math.sin(a)
    return [(stone['x']+px*stone['w']*co-py*stone['h']*si,stone['y']+px*stone['w']*si+py*stone['h']*co) for px,py in LIB[f"{stone['shape']}-{stone['c']}"]['hull']]

def separated(a,b,gap=GAP):
    # Convex hulls give a conservative guarantee for concave heart outlines too.
    for poly in [a,b]:
        for p,q in zip(poly,poly[1:]+poly[:1]):
            dx=q[0]-p[0];dy=q[1]-p[1];length=math.hypot(dx,dy)
            if not length:continue
            axis=(-dy/length,dx/length)
            pa=[x*axis[0]+y*axis[1] for x,y in a];pb=[x*axis[0]+y*axis[1] for x,y in b]
            if min(pb)-max(pa)>=gap or min(pa)-max(pb)>=gap:return True
    return False

class Board:
    def __init__(self):self.items=[];self.polys=[];self.index=defaultdict(set)
    def add(self,x,y,size,c,shape='round',angle=0,region=None):
        stone={'x':round(x,3),'y':round(y,3),'h':round(size,3),'w':round(size*LIB[f'{shape}-{c}']['aspect'],3),'c':c,'shape':shape,'angle':round(angle,3)}
        poly=world(stone)
        if region:
            for p,q in zip(poly,poly[1:]+poly[:1]):
                steps=max(1,math.ceil(math.dist(p,q)/3))
                if any(not region(p[0]+(q[0]-p[0])*i/steps,p[1]+(q[1]-p[1])*i/steps) for i in range(steps+1)):return False
        xmin=min(p[0] for p in poly)-GAP;xmax=max(p[0] for p in poly)+GAP;ymin=min(p[1] for p in poly)-GAP;ymax=max(p[1] for p in poly)+GAP
        cells=[(xx,yy) for xx in range(math.floor(xmin/60),math.floor(xmax/60)+1) for yy in range(math.floor(ymin/60),math.floor(ymax/60)+1)]
        neighbors=set().union(*(self.index[cell] for cell in cells))
        if any(not separated(poly,self.polys[i]) for i in neighbors):return False
        i=len(self.items);stone['id']=f'g{i}';self.items.append(stone);self.polys.append(poly)
        for cell in cells:self.index[cell].add(i)
        return True
    def fill(self,region,bounds,sizes,limit,color,seed,shape='round'):
        rng=random.Random(seed);xmin,ymin,xmax,ymax=bounds
        for size in sizes:
            # Deterministic candidate search, performed at authoring time only.
            points=[(x,y) for y in range(ymin,ymax,5) for x in range(xmin,xmax,5) if region(x,y)]
            rng.shuffle(points)
            points.sort(key=lambda p:math.hypot(p[0]-400,p[1]-400))
            for x,y in points:
                if len(self.items)>=limit:return
                self.add(x,y,size,color(x,y),shape,region=region)
    def ring(self,n,r,size,c,shape='round',offset=0):
        for i in range(n):
            a=2*math.pi*i/n+offset;self.add(400+math.sin(a)*r,400-math.cos(a)*r,size,c(i) if callable(c) else c,shape,a*180/math.pi)

# Every layout has authored structural anchors followed by collision-checked fill.
flower=Board();flower.ring(18,220,92,0,'drop');flower.ring(16,149,46,1,'round',math.pi/16);flower.ring(12,84,67,2,'leaf');flower.add(400,400,56,3)
flower.fill(lambda x,y:ellipse(x,y,400,400,259,259),(140,140,661,661),[19,13,8],140,lambda x,y:0 if math.hypot(x-400,y-400)>185 else 3,10)

branch=Board();anchors=[]
for i in range(9):
    y=211+i*47;x=389+math.sin(i*.35)*32
    for side in [-1,1]:
        xx=x+side*61;yy=y-14;angle=side*(45+i*.8);c=4 if i in [2,6] else 0
        branch.add(xx,yy,72,c,'leaf',angle);anchors.append((xx,yy,angle))
    branch.add(x,y,15,3)
    for side in [-1,1]:
        branch.add(x+side*110,y-41,18,1);branch.add(x+side*112,y-20,11,1)
# Follow the stem rather than filling an enclosing rectangle with arbitrary dots.
for i in range(65):
    y=200+i*6.7;x=389+math.sin((y-211)/47*.35)*32
    branch.add(x,y,8,3)
for x,y,a in anchors:
    rad=math.radians(a)
    for offset in [-24,0,24]:
        branch.add(x+math.cos(rad)*22-math.sin(rad)*offset,y+math.sin(rad)*22+math.cos(rad)*offset,8,3)

field=Board();field.add(400,400,78,3);field.ring(6,104,68,lambda i:1 if i%2 else 4);field.ring(12,206,65,lambda i:0 if i%2 else 1)
field.fill(lambda x,y:ellipse(x,y,400,400,258,258),(140,140,661,661),[46,31,20,12,8],175,lambda x,y:[0,1,4,3,1][int((math.atan2(y-400,x-400)+math.pi)*5/(2*math.pi))%5],33)

birds=Board()
left=lambda x,y:ellipse(x,y,293,430,103,140) or ellipse(x,y,323,303,79,76)
right=lambda x,y:ellipse(x,y,500,448,95,134) or ellipse(x,y,470,335,73,72)
# Eye and beak anchors precede the surrounding feathers.
birds.add(353,291,13,2);birds.add(442,324,13,2);birds.add(405,308,24,3,'leaf',90);birds.add(408,343,23,3,'leaf',90)
for cx,cy,side in [(276,405,-1),(510,431,1)]:
    for row in range(4):
        for col in range(3):
            x=cx+(col-1)*28+side*row*5;y=cy+(row-1)*37
            region=left if side<0 else right
            birds.add(x,y,39,0 if side<0 else 1,'drop',side*(12+row*4),region)
# Round stones of decreasing sizes complete heads, bodies and contour margins.
def bird_color(x,y):
    if left(x,y):return 1 if y>467 and x>281 else 4
    return 4 if x<475 and y>403 else 0
birds.fill(lambda x,y:left(x,y) or right(x,y),(180,225,611,586),[40,29,20,13,8],250,bird_color,54)
for cx,cy,side,c in [(282,603,-1,4),(508,610,1,0)]:
    for j in range(4):birds.add(cx+side*j*3,cy+j*18,19, c,'drop',side*12)
for x in range(152,660,16):birds.add(x,585+(x-400)*.025,13,3)
for i,(x,y,size) in enumerate([(235,184,20),(314,158,29),(400,177,47),(479,194,24),(551,221,36),(207,253,12)]):birds.add(x,y,size,1 if i%2 else 3,'heart',(i%3-1)*10)

result=[]
for id,name,tag,board in [('flower','翡翠花冠','花卉 · 水滴与细小填隙',flower),('branch','春日枝语','植物 · 沿叶脉排列',branch),('field','繁星花海','花纹 · 大小宝石紧密排布',field),('birds','相依的鸟儿','动物 · 羽毛方向与心形',birds)]:
    # Independent all-pairs verification of final hull spacing.
    for i,a in enumerate(board.polys):
        for b in board.polys[i+1:]:
            assert separated(a,b),f'Collision in {id}'
    result.append({'id':id,'name':name,'tag':tag,'items':board.items,'gap':GAP})
    print(id,len(board.items),'gems, all pairs separated by at least',GAP)
(FRONT/'assets/geometry.json').write_text(json.dumps({'version':3,'gems':LIB,'layouts':result},ensure_ascii=False,separators=(',',':'))+'\n')
