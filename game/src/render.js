// EMBER KEYS — render.js : true-perspective projector and scene drawing (Round 3)
// Camera model: cam = {x, y, heading, h, horizon?, sky?: "day"|"dusk", flare?}
// projectPoint() maps world (wx, wy, wz) through the camera heading into screen
// space with scale FOCAL/fwd — real perspective: parallel world edges converge
// on the vanishing point, near geometry occludes far geometry via painter sort.
const RENDER_W=1280,RENDER_H=720,FOCAL=520;
let CUR_HORIZON=318;
function projectPoint(cam,wx,wy,wz){const dx=wx-cam.x,dy=wy-cam.y;const s=Math.sin(cam.heading),c=Math.cos(cam.heading);const fwd=dx*s+dy*c;const side=dx*c-dy*s;if(fwd<4)return null;const sc=FOCAL/fwd;return{x:RENDER_W/2+side*sc,y:CUR_HORIZON+(cam.h-(wz||0))*sc,s:sc,depth:fwd};}
function shadeColor(hex,amt){const n=parseInt(hex.slice(1),16);let r=(n>>16)+amt,g=((n>>8)&255)+amt,b=(n&255)+amt;r=Math.max(0,Math.min(255,r));g=Math.max(0,Math.min(255,g));b=Math.max(0,Math.min(255,b));return "rgb("+r+","+g+","+b+")";}
function roundRectPath(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function polyPath(ctx,pts){ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.closePath();}
function drawStarBadge(ctx,x,y,r,col){ctx.fillStyle=col;ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5;const rr=i%2?r*0.45:r;ctx[i?"lineTo":"moveTo"](x+Math.cos(a)*rr,y+Math.sin(a)*rr);}ctx.closePath();ctx.fill();}
// ---------- sky ----------
const CLOUDS=[{x:120,y:64,s:1.2},{x:430,y:110,s:0.8},{x:760,y:52,s:1.4},{x:1050,y:96,s:0.9},{x:250,y:150,s:0.6},{x:930,y:150,s:0.7},{x:580,y:84,s:0.65}];
function drawSky(ctx,cam){const day=cam.sky!=="dusk";const hz=CUR_HORIZON;
 const g=ctx.createLinearGradient(0,0,0,hz+30);
 if(day){g.addColorStop(0,"#2b6fd6");g.addColorStop(0.55,"#6db3ec");g.addColorStop(0.85,"#bfe6f7");g.addColorStop(1,"#eafaff");}
 else{g.addColorStop(0,"#241a4d");g.addColorStop(0.42,"#7a2d5e");g.addColorStop(0.72,"#d95d33");g.addColorStop(1,"#ffb35c");}
 ctx.fillStyle=g;ctx.fillRect(0,0,RENDER_W,hz+30);
 // sun: high glare by day, low disc at dusk
 const sunX=day?RENDER_W*0.68:RENDER_W*0.60,sunY=day?66:hz-58;
 const rg=ctx.createRadialGradient(sunX,sunY,6,sunX,sunY,day?170:190);rg.addColorStop(0,day?"rgba(255,252,220,0.95)":"rgba(255,220,150,0.95)");rg.addColorStop(1,"rgba(255,180,80,0)");ctx.fillStyle=rg;ctx.fillRect(0,0,RENDER_W,hz+30);
 ctx.fillStyle=day?"#fffbe8":"#ffe9b0";ctx.beginPath();ctx.arc(sunX,sunY,day?24:30,0,7);ctx.fill();
 // soft deterministic clouds, parallax-shifted by heading only
 ctx.fillStyle=day?"rgba(255,255,255,0.85)":"rgba(255,190,170,0.35)";
 for(const cl of CLOUDS){const cx=((cl.x-cam.heading*140)%1500+1500)%1500-110,cy=cl.y,s=cl.s;ctx.beginPath();ctx.ellipse(cx,cy,64*s,15*s,0,0,7);ctx.ellipse(cx+38*s,cy+4*s,44*s,12*s,0,0,7);ctx.ellipse(cx-42*s,cy+5*s,40*s,11*s,0,0,7);ctx.fill();}
 // distant sea glint band right at the horizon
 ctx.fillStyle=day?"rgba(140,220,235,0.55)":"rgba(255,150,90,0.4)";ctx.fillRect(0,hz-3,RENDER_W,5);}
// ---------- ground / roads ----------
function clipPolygonFwdMin(poly,minFwd){const out=[];for(let i=0;i<poly.length;i++){const cur=poly[i],prev=poly[(i+poly.length-1)%poly.length];const curIn=cur.fwd>=minFwd,prevIn=prev.fwd>=minFwd;if(curIn!==prevIn){const t=(minFwd-prev.fwd)/(cur.fwd-prev.fwd);out.push({side:prev.side+(cur.side-prev.side)*t,fwd:minFwd});}if(curIn)out.push(cur);}return out;}
function fillGroundQuad(ctx,cam,x0,y0,x1,y1,fill){const s=Math.sin(cam.heading),c=Math.cos(cam.heading);const corners=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];let poly=corners.map(function(p){const dx=p[0]-cam.x,dy=p[1]-cam.y;return{side:dx*c-dy*s,fwd:dx*s+dy*c};});poly=clipPolygonFwdMin(poly,6);if(poly.length<3)return;const pts=poly.map(function(v){const sc=FOCAL/v.fwd;return{x:RENDER_W/2+v.side*sc,y:CUR_HORIZON+cam.h*sc};});ctx.fillStyle=fill;polyPath(ctx,pts);ctx.fill();}
function drawRoadCenterLine(ctx,cam,coord,isVertical){ctx.strokeStyle="#f7d774";ctx.lineCap="round";
 for(let d=16;d<1196;d+=46){const a=projectPoint(cam,isVertical?coord:d,isVertical?d:coord,0),b=projectPoint(cam,isVertical?coord:d+22,isVertical?d+22:coord,0);if(!a||!b||a.depth<58)continue;ctx.lineWidth=Math.max(1,Math.min(6,a.s*2.4));ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}
function drawGroundAndRoads(ctx,cam){
 // open sea first (huge quad around the island), then the island sand rim,
 // then district ground, then road slabs with sidewalks — all projected.
 fillGroundQuad(ctx,cam,-700,-700,1900,1900,cam.sky==="dusk"?"#155e6e":"#1b7f96");
 fillGroundQuad(ctx,cam,-44,-44,1244,1244,"#ecd096");
 for(const d of DISTRICTS)fillGroundQuad(ctx,cam,d.x0,d.y0,d.x1,d.y1,d.ground);
 for(const rc of ROAD_COORDS){fillGroundQuad(ctx,cam,rc-30,-30,rc+30,1230,"#9aa0a3");fillGroundQuad(ctx,cam,-30,rc-30,1230,rc+30,"#9aa0a3");}
 for(const rc of ROAD_COORDS){fillGroundQuad(ctx,cam,rc-24,-30,rc+24,1230,"#26292f");fillGroundQuad(ctx,cam,-30,rc-24,1230,rc+24,"#26292f");}
 for(const rc of ROAD_COORDS){fillGroundQuad(ctx,cam,rc-21,-30,rc+21,1230,"#33363d");fillGroundQuad(ctx,cam,-30,rc-21,1230,rc+21,"#33363d");}
 for(const rc of ROAD_COORDS){drawRoadCenterLine(ctx,cam,rc,true);drawRoadCenterLine(ctx,cam,rc,false);}}
function drawSeaSparkle(ctx,cam){ // deterministic wave texture on the open sea ring around the island
 const rng=createSeededRng(777);ctx.strokeStyle=cam.sky==="dusk"?"rgba(255,190,140,0.4)":"rgba(210,245,250,0.5)";ctx.lineCap="round";
 for(let i=0;i<110;i++){const side=i%4;let wx,wy;if(side===0){wx=-360+rng()*1920;wy=1252+rng()*148;}else if(side===1){wx=-360+rng()*1920;wy=-320+rng()*260;}else if(side===2){wx=-340+rng()*260;wy=-200+rng()*1500;}else{wx=1280+rng()*260;wy=-200+rng()*1500;}
  const a=projectPoint(cam,wx,wy,0),b=projectPoint(cam,wx+16+rng()*14,wy,0);if(!a||!b||a.depth>900)continue;ctx.lineWidth=Math.max(1,Math.min(3,a.s*1.6));ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}
// ---------- buildings : extruded boxes, visible faces, window grids, signs ----------
function bilerp(a,b,c,d,t,u){ // a=base-left b=base-right c=top-right d=top-left
 const bx=d.x+(c.x-d.x)*t,by=d.y+(c.y-d.y)*t,ax=a.x+(b.x-a.x)*t,ay=a.y+(b.y-a.y)*t;return{x:bx+(ax-bx)*u,y:by+(ay-by)*u};}
function drawBuildingWindows(ctx,face,b,rng){ // face = {a,b,c,d} screen quad (base L/R, top R/L)
 const edgeWorld=face.edgeWorld,cols=Math.max(2,Math.min(15,Math.floor(edgeWorld/8))),rows=Math.max(2,Math.min(17,Math.floor(b.h/10)));
 const dens=0.52+rng()*0.3;
 for(let r=0;r<rows;r++)for(let col=0;col<cols;col++){const roll=rng();const t0=(col+0.18)/cols,t1=(col+0.82)/cols,u0=(r+0.16)/rows,u1=(r+0.84)/rows;
  const p1=bilerp(face.a,face.b,face.c,face.d,t0,u0),p2=bilerp(face.a,face.b,face.c,face.d,t1,u0),p3=bilerp(face.a,face.b,face.c,face.d,t1,u1),p4=bilerp(face.a,face.b,face.c,face.d,t0,u1);
  if(roll<dens)ctx.fillStyle=roll<dens*0.72?"rgba(255,214,120,0.95)":"rgba(190,232,242,0.95)";else ctx.fillStyle="rgba(24,32,44,0.9)";
  polyPath(ctx,[p1,p2,p3,p4]);ctx.fill();}}
function drawBuildingSign(ctx,face,b){if(!b.sign)return;const wTop=Math.hypot(face.c.x-face.d.x,face.c.y-face.d.y);if(wTop<54)return;
 const p1=bilerp(face.a,face.b,face.c,face.d,0.06,0.045),p2=bilerp(face.a,face.b,face.c,face.d,0.94,0.045),p3=bilerp(face.a,face.b,face.c,face.d,0.94,0.20),p4=bilerp(face.a,face.b,face.c,face.d,0.06,0.20);
 ctx.fillStyle="rgba(10,16,30,0.92)";polyPath(ctx,[p1,p2,p3,p4]);ctx.fill();
 const ctr=bilerp(face.a,face.b,face.c,face.d,0.5,0.12);let fs=Math.max(9,Math.min(21,wTop*0.085));
 ctx.font="900 "+fs+"px system-ui,sans-serif";const tw=ctx.measureText(b.sign).width;if(tw>wTop*0.84){fs=Math.max(7,fs*wTop*0.84/tw);ctx.font="900 "+fs+"px system-ui,sans-serif";}
 ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle=b.signColor||"#ffd23e";ctx.fillText(b.sign,ctr.x,ctr.y);}
function drawBuilding(ctx,cam,b){const cw=[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.d],[b.x,b.y+b.d]];
 const base=cw.map(p=>projectPoint(cam,p[0],p[1],0));const top=cw.map(p=>projectPoint(cam,p[0],p[1],b.h));
 if(base.some(p=>!p)||top.some(p=>!p))return;const depth=Math.min(base[0].depth,base[1].depth,base[2].depth,base[3].depth);if(depth>640||depth<15)return;
 // visible side faces depend on which side of the box the camera stands
 const faces=[];
 if(cam.y<b.y)faces.push({a:base[0],b:base[1],c:top[1],d:top[0],edgeWorld:b.w,shade:-16});
 if(cam.y>b.y+b.d)faces.push({a:base[2],b:base[3],c:top[3],d:top[2],edgeWorld:b.w,shade:-16});
 if(cam.x<b.x)faces.push({a:base[3],b:base[0],c:top[0],d:top[3],edgeWorld:b.d,shade:-46});
 if(cam.x>b.x+b.w)faces.push({a:base[1],b:base[2],c:top[2],d:top[1],edgeWorld:b.d,shade:-46});
 faces.sort((f1,f2)=>((f2.a.depth+f2.b.depth)-(f1.a.depth+f1.b.depth)));
 const rng=createSeededRng(b.seed);const fogA=depth>360?Math.min(0.34,(depth-360)/700):0;
 for(const f of faces){ctx.fillStyle=shadeColor(b.color,f.shade);polyPath(ctx,[f.a,f.b,f.c,f.d]);ctx.fill();
  ctx.strokeStyle="rgba(12,14,20,0.35)";ctx.lineWidth=1;polyPath(ctx,[f.a,f.b,f.c,f.d]);ctx.stroke();
  drawBuildingWindows(ctx,f,b,rng);drawBuildingSign(ctx,f,b);
  if(fogA>0){ctx.fillStyle="rgba(190,215,235,"+fogA+")";polyPath(ctx,[f.a,f.b,f.c,f.d]);ctx.fill();}}
 // roof: lightest face + parapet + deterministic rooftop props
 ctx.fillStyle=shadeColor(b.color,30);polyPath(ctx,top);ctx.fill();ctx.strokeStyle="rgba(12,14,20,0.4)";polyPath(ctx,top);ctx.stroke();
 if(base[0].s>0.9){const topW=Math.hypot(top[1].x-top[0].x,top[1].y-top[0].y);const nP=1+Math.floor(rng()*3);
  for(let pi=0;pi<nP;pi++){const pt=0.18+rng()*0.6,pu=0.18+rng()*0.6;const pc=bilerp(base[0],base[1],base[2],base[3],pt,pu);const tc=bilerp(top[0],top[1],top[2],top[3],pt,pu);const pw=Math.max(3,topW*(0.09+rng()*0.07));ctx.fillStyle=pi%2?"#878d94":"#646a71";ctx.fillRect(tc.x-pw/2,tc.y-pw*0.5,pw,pw*0.55);ctx.strokeStyle="rgba(15,18,22,0.6)";ctx.strokeRect(tc.x-pw/2,tc.y-pw*0.5,pw,pw*0.55);}}}
// ---------- palms : segmented trunks, frond stars, depth scaled ----------
function drawPalmTree(ctx,cam,palm){const p=projectPoint(cam,palm.x,palm.y,0);if(!p||p.depth>560||p.depth<26||p.x<-90||p.x>RENDER_W+90)return;const sEff=Math.min(p.s,4.2);const h=34*sEff*palm.s;const cx=p.x+palm.lean*h*1.7,cy=p.y-h;
 // segmented trunk: stacked bands along a lean curve
 const segs=6;let px=p.x,py=p.y;ctx.lineCap="round";
 for(let i=1;i<=segs;i++){const t=i/segs;const nx=p.x+(cx-p.x)*t,ny=p.y-h*t+Math.sin(t*Math.PI)*h*0.05;ctx.strokeStyle=i%2?"#6b4e33":"#7d5c3c";ctx.lineWidth=Math.max(1.4,sEff*2.6*(1-t*0.45));ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(nx,ny);ctx.stroke();px=nx;py=ny;}
 // frond star: filled tapered leaves, two greens
 for(let i=0;i<8;i++){const a=-Math.PI*0.96+(i/7)*Math.PI*1.12+palm.lean;const len=h*(0.46+((i*37)%10)/38);const ex=cx+Math.cos(a)*len,ey=cy+Math.abs(Math.cos(a))*h*0.13+len*0.16;const mx=cx+Math.cos(a)*len*0.5,my=cy-h*0.15;
  ctx.fillStyle=i%2?"#2e9e57":"#37b866";ctx.beginPath();ctx.moveTo(cx,cy);ctx.quadraticCurveTo(mx,my,ex,ey);ctx.quadraticCurveTo(mx,my+h*0.07,cx,cy);ctx.fill();}
 ctx.fillStyle="#5a4632";ctx.beginPath();ctx.arc(cx-3,cy+3,Math.max(1.6,sEff*1.3),0,7);ctx.arc(cx+3,cy+3,Math.max(1.6,sEff*1.3),0,7);ctx.fill();}
// ---------- vehicles : volumetric rear three-quarter + aerial ----------
function drawWheelRear(ctx,wx,wy,w){ // dark tire, dark-steel hub, tiny spoke cross — never light
 ctx.fillStyle="#101216";ctx.beginPath();ctx.ellipse(wx,wy,w*0.105,w*0.09,0,0,7);ctx.fill();
 ctx.fillStyle="#4a5058";ctx.beginPath();ctx.ellipse(wx,wy,w*0.105*0.38,w*0.09*0.38,0,0,7);ctx.fill();
 ctx.strokeStyle="#2c3138";ctx.lineWidth=Math.max(1,w*0.012);ctx.beginPath();ctx.moveTo(wx-w*0.04,wy);ctx.lineTo(wx+w*0.04,wy);ctx.moveTo(wx,wy-w*0.034);ctx.lineTo(wx,wy+w*0.034);ctx.stroke();}
function drawCarAerial(ctx,cam,car){ // top-down car for aerial cameras (cover / menu)
 const dir=(car.dir!==undefined?car.dir:(car.heading||0));const fw={x:Math.sin(dir),y:Math.cos(dir)};const rt={x:Math.cos(dir),y:-Math.sin(dir)};
 const hw=12,hl=23,roofH=9; // footprint ~24 wide, ~46 long (world units)
 function corner(r,f,wz){return projectPoint(cam,car.x+rt.x*r+fw.x*f,car.y+rt.y*r+fw.y*f,wz);}
 function quad(r0,f0,r1,f1,wz,fill){const pts=[corner(r0,f0,wz),corner(r1,f0,wz),corner(r1,f1,wz),corner(r0,f1,wz)];if(pts.some(p=>!p))return null;ctx.fillStyle=fill;polyPath(ctx,pts);ctx.fill();return pts;}
 const col=car.color||"#e07a1e";const hexCol=col.startsWith("#")?col:"#888888";
 // ground shadow quad in car-local axes
 const sh2=[corner(-hw-1,-hl-1,0),corner(hw+1,-hl-1,0),corner(hw+1,hl+1,0),corner(-hw-1,hl+1,0)];
 if(sh2.every(p=>p)){ctx.fillStyle="rgba(0,0,0,0.38)";polyPath(ctx,sh2);ctx.fill();}
 // body side skirt (slightly larger footprint, low)
 quad(-hw,-hl,hw,hl,2,shadeColor(hexCol,-55));
 // top face bands, front (+f) to rear (-f): hood / DARK glass / lighter roof / trunk
 quad(-hw*0.92,hl*0.42,hw*0.92,hl,roofH,shadeColor(hexCol,6)); // hood
 quad(-hw*0.92,hl*0.02,hw*0.92,hl*0.42,roofH,"#0d141d"); // dark glass band
 quad(-hw*0.92,-hl*0.38,hw*0.92,hl*0.02,roofH,shadeColor(hexCol,26)); // roof
 quad(-hw*0.92,-hl,hw*0.92,-hl*0.38,roofH,shadeColor(hexCol,-12)); // trunk
 // hero stripes: two dark bands along roof + trunk only (never glass / hood)
 if(car.hero){for(const sr of [[-0.30,-0.05],[0.05,0.30]]){quad(hw*sr[0],-hl,hw*sr[1],-hl*0.38,roofH+0.3,"rgba(16,18,22,0.85)");quad(hw*sr[0],-hl*0.38,hw*sr[1],hl*0.02,roofH+0.3,"rgba(16,18,22,0.85)");}}
 if(car.police){quad(-hw*0.92,-hl*0.38,hw*0.92,hl*0.02,roofH+0.3,"#eef1f4");quad(-hw*0.5,hl*0.44,hw*0.02,hl*0.60,roofH+0.6,"#ff2d2d");quad(hw*0.02,hl*0.44,hw*0.5,hl*0.60,roofH+0.6,"#2d7bff");}
 // 4 small dark wheel quads at the corners
 for(const sgn of [[-1,-1],[1,-1],[-1,1],[1,1]]){const cr=sgn[0]*(hw-1),cf=sgn[1]*(hl-6);quad(cr-sgn[0]*2.2,cf-3.6,cr+sgn[0]*2.2,cf+3.6,3,"#101216");}
 // one highlight edge along the right side of the top face
 const e1=corner(hw*0.92,-hl,roofH),e2=corner(hw*0.92,hl,roofH);if(e1&&e2){ctx.strokeStyle="rgba(255,255,255,0.45)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(e1.x,e1.y);ctx.lineTo(e2.x,e2.y);ctx.stroke();}}
function drawCarBody(ctx,cam,car){if(cam.h>80){drawCarAerial(ctx,cam,car);return;}
 const p=projectPoint(cam,car.x,car.y,0);if(!p||p.depth>580)return;const w=Math.max(11,Math.min(270,p.s*30)),h=w*0.62;const x=p.x,y=p.y;const col=car.color||"#e07a1e";const hexCol=col.startsWith("#")?col:"#888888";
 // ground shadow
 ctx.fillStyle="rgba(0,0,0,0.40)";ctx.beginPath();ctx.ellipse(x,y+3,w*0.68,w*0.17,0,0,7);ctx.fill();
 // --- side face (screen-right): slants forward (front lower + narrower) ---
 ctx.fillStyle=shadeColor(hexCol,-55);ctx.beginPath();ctx.moveTo(x+w*0.5,y-h*0.80);ctx.lineTo(x+w*0.74,y-h*0.58);ctx.lineTo(x+w*0.74,y-h*0.14);ctx.lineTo(x+w*0.5,y-h*0.12);ctx.closePath();ctx.fill();
 // side: dark tinted glass band inset along the top
 ctx.fillStyle="#0d141d";ctx.beginPath();ctx.moveTo(x+w*0.52,y-h*0.72);ctx.lineTo(x+w*0.70,y-h*0.56);ctx.lineTo(x+w*0.70,y-h*0.45);ctx.lineTo(x+w*0.52,y-h*0.59);ctx.closePath();ctx.fill();
 // side: shoulder highlight streak
 ctx.strokeStyle="rgba(255,255,255,0.35)";ctx.lineWidth=Math.max(1,w*0.014);ctx.beginPath();ctx.moveTo(x+w*0.51,y-h*0.76);ctx.lineTo(x+w*0.73,y-h*0.55);ctx.stroke();
 // side: door cut line + dark side skirt
 ctx.strokeStyle="rgba(10,12,16,0.55)";ctx.lineWidth=Math.max(1,w*0.012);ctx.beginPath();ctx.moveTo(x+w*0.60,y-h*0.58);ctx.lineTo(x+w*0.60,y-h*0.20);ctx.stroke();
 ctx.fillStyle="#14171c";ctx.beginPath();ctx.moveTo(x+w*0.5,y-h*0.22);ctx.lineTo(x+w*0.74,y-h*0.20);ctx.lineTo(x+w*0.74,y-h*0.14);ctx.lineTo(x+w*0.5,y-h*0.12);ctx.closePath();ctx.fill();
 // --- rear face (the WIDE face): vertical gradient ---
 const rg2=ctx.createLinearGradient(0,y-h*0.82,0,y-h*0.12);rg2.addColorStop(0,shadeColor(hexCol,16));rg2.addColorStop(1,shadeColor(hexCol,-12));ctx.fillStyle=rg2;roundRectPath(ctx,x-w/2,y-h*0.82,w,h*0.70,Math.max(2,w*0.05));ctx.fill();
 // decklid seam
 ctx.strokeStyle="rgba(10,12,16,0.45)";ctx.lineWidth=Math.max(1,w*0.012);ctx.beginPath();ctx.moveTo(x-w*0.44,y-h*0.58);ctx.lineTo(x+w*0.44,y-h*0.58);ctx.stroke();
 // hero stripes ONLY on decklid (roof stripes drawn with the roof below)
 if(car.hero){ctx.fillStyle="rgba(16,18,22,0.85)";ctx.fillRect(x-w*0.13,y-h*0.82,w*0.09,h*0.24);ctx.fillRect(x+w*0.04,y-h*0.82,w*0.09,h*0.24);}
 // full-width taillight bar: glow, dark housing, red LED strip
 ctx.fillStyle="rgba(255,45,32,0.22)";ctx.fillRect(x-w*0.48,y-h*0.50,w*0.96,Math.max(4,h*0.15));
 ctx.fillStyle="#20090a";roundRectPath(ctx,x-w*0.46,y-h*0.48,w*0.92,Math.max(3,h*0.11),2);ctx.fill();
 ctx.fillStyle="#ff2d20";ctx.fillRect(x-w*0.44,y-h*0.455,w*0.88,Math.max(2,h*0.055));
 // centre plate (white, dark dashes)
 ctx.fillStyle="#e8ecf0";ctx.fillRect(x-w*0.11,y-h*0.34,w*0.22,Math.max(3,h*0.11));ctx.fillStyle="#30343a";for(let di=0;di<3;di++)ctx.fillRect(x-w*0.07+di*w*0.055,y-h*0.295,w*0.032,Math.max(1.5,h*0.03));
 // lower diffuser panel: 3 fin strokes + 2 exhausts
 ctx.fillStyle="#14171c";ctx.fillRect(x-w/2+2,y-h*0.22,w-4,h*0.10);
 ctx.strokeStyle="#3a4048";ctx.lineWidth=Math.max(1,w*0.014);for(const fx of [-0.16,0,0.16]){ctx.beginPath();ctx.moveTo(x+w*fx,y-h*0.215);ctx.lineTo(x+w*fx,y-h*0.13);ctx.stroke();}
 for(const ex of [-0.32,0.32]){ctx.fillStyle="#0a0b0d";ctx.beginPath();ctx.arc(x+w*ex,y-h*0.17,Math.max(2,w*0.034),0,7);ctx.fill();ctx.strokeStyle="#8a9199";ctx.lineWidth=Math.max(1,w*0.01);ctx.beginPath();ctx.arc(x+w*ex,y-h*0.17,Math.max(2,w*0.034),0,7);ctx.stroke();}
 // hero deck badge
 if(car.hero&&w>=70){ctx.font="900 "+Math.max(8,w*0.068)+"px system-ui,sans-serif";ctx.textAlign="right";ctx.textBaseline="middle";ctx.fillStyle="rgba(20,22,26,0.85)";ctx.fillText("RUNNER GT",x+w*0.44,y-h*0.53);}
 // police identity on the new structure: white rear panel + badge + EKPD (above the light bar)
 if(car.police){ctx.fillStyle="#eef1f4";ctx.fillRect(x-w*0.30,y-h*0.76,w*0.60,h*0.16);drawStarBadge(ctx,x-w*0.20,y-h*0.68,Math.max(3.5,w*0.055),"#14457e");
  if(w>52){ctx.font="900 "+Math.max(9,w*0.085)+"px system-ui,sans-serif";ctx.textAlign="left";ctx.textBaseline="middle";ctx.fillStyle="#14457e";ctx.fillText("EKPD",x-w*0.11,y-h*0.68);}}
 // --- cabin / greenhouse: rear window is a big DARK sloped panel, body-colour C-pillars ---
 ctx.fillStyle=shadeColor(hexCol,-6);ctx.beginPath();ctx.moveTo(x-w*0.38,y-h*0.80);ctx.lineTo(x+w*0.38,y-h*0.80);ctx.lineTo(x+w*0.28,y-h*1.22);ctx.lineTo(x-w*0.28,y-h*1.22);ctx.closePath();ctx.fill();
 const gg=ctx.createLinearGradient(0,y-h*1.16,0,y-h*0.84);gg.addColorStop(0,"#1b2a38");gg.addColorStop(1,"#0a0f16");ctx.fillStyle=gg;ctx.beginPath();ctx.moveTo(x-w*0.30,y-h*0.85);ctx.lineTo(x+w*0.30,y-h*0.85);ctx.lineTo(x+w*0.205,y-h*1.15);ctx.lineTo(x-w*0.205,y-h*1.15);ctx.closePath();ctx.fill();
 ctx.strokeStyle="rgba(190,230,245,0.30)";ctx.lineWidth=Math.max(1,w*0.016);ctx.beginPath();ctx.moveTo(x-w*0.17,y-h*1.13);ctx.lineTo(x+w*0.04,y-h*0.87);ctx.stroke(); // faint glare, glass stays dark
 // roof slab (body colour, lighter)
 ctx.fillStyle=shadeColor(hexCol,26);ctx.beginPath();ctx.moveTo(x-w*0.30,y-h*1.22);ctx.lineTo(x+w*0.30,y-h*1.22);ctx.lineTo(x+w*0.27,y-h*1.29);ctx.lineTo(x-w*0.27,y-h*1.29);ctx.closePath();ctx.fill();
 if(car.hero){ctx.fillStyle="rgba(16,18,22,0.85)";ctx.fillRect(x-w*0.13,y-h*1.29,w*0.09,h*0.07);ctx.fillRect(x+w*0.04,y-h*1.29,w*0.09,h*0.07);} // stripes on roof slab only
 // hero spoiler AFTER the cabin so it reads: dark wing across the deck on 2 struts down to the decklid
 if(car.hero){ctx.fillStyle="#14171c";ctx.fillRect(x-w*0.20,y-h*0.90,w*0.05,h*0.08);ctx.fillRect(x+w*0.15,y-h*0.90,w*0.05,h*0.08);roundRectPath(ctx,x-w*0.54,y-h*0.95,w*1.08,Math.max(3,h*0.06),2);ctx.fill();}
 if(car.police){ // lightbar on the roof with glow
  ctx.fillStyle="rgba(255,45,45,0.35)";ctx.beginPath();ctx.ellipse(x-w*0.17,y-h*1.36,w*0.20,w*0.07,0,0,7);ctx.fill();ctx.fillStyle="rgba(45,123,255,0.35)";ctx.beginPath();ctx.ellipse(x+w*0.17,y-h*1.36,w*0.20,w*0.07,0,0,7);ctx.fill();
  ctx.fillStyle="#ff2d2d";roundRectPath(ctx,x-w*0.36,y-h*1.40,w*0.34,Math.max(3,h*0.09),2);ctx.fill();ctx.fillStyle="#2d7bff";roundRectPath(ctx,x+w*0.02,y-h*1.40,w*0.34,Math.max(3,h*0.09),2);ctx.fill();}
 // wheels: both rear corners + one on the side face — all dark
 drawWheelRear(ctx,x-w*0.36,y-1,w);drawWheelRear(ctx,x+w*0.34,y-1,w);drawWheelRear(ctx,x+w*0.64,y-2,w);}
// ---------- people ----------
function drawCharacterFigure(ctx,cam,ch){const p=projectPoint(cam,ch.x,ch.y,0);if(!p||p.depth>500)return null;const h=Math.max(13,p.s*26);const x=p.x,y=p.y;
 ctx.fillStyle="rgba(0,0,0,0.28)";ctx.beginPath();ctx.ellipse(x,y+2,h*0.22,h*0.07,0,0,7);ctx.fill();
 ctx.strokeStyle=ch.pants||"#26324a";ctx.lineWidth=Math.max(2,h*0.11);ctx.beginPath();ctx.moveTo(x,y-h*0.42);ctx.lineTo(x-h*0.15,y);ctx.moveTo(x,y-h*0.42);ctx.lineTo(x+h*0.15,y);ctx.stroke();
 ctx.fillStyle=ch.shirt||"#e07a1e";roundRectPath(ctx,x-h*0.21,y-h*0.80,h*0.42,h*0.42,3);ctx.fill();
 ctx.strokeStyle=ch.shirt||"#e07a1e";ctx.lineWidth=Math.max(2,h*0.09);ctx.beginPath();ctx.moveTo(x-h*0.2,y-h*0.72);ctx.lineTo(x-h*0.34,y-h*0.44);ctx.moveTo(x+h*0.2,y-h*0.72);ctx.lineTo(x+h*0.34,y-h*0.44);ctx.stroke();
 ctx.fillStyle=ch.skin||"#c98a5a";ctx.beginPath();ctx.arc(x,y-h*0.92,h*0.135,0,7);ctx.fill();ctx.fillStyle=ch.hair||"#1c1410";ctx.beginPath();ctx.arc(x,y-h*0.97,h*0.135,Math.PI,0);ctx.fill();
 if(ch.name)drawNameplate(ctx,x,y-h*1.30,ch.name);return p;}
function drawNameplate(ctx,x,y,text){ctx.font="700 15px system-ui,sans-serif";const w=ctx.measureText(text).width+18;ctx.fillStyle="rgba(8,12,18,0.82)";roundRectPath(ctx,x-w/2,y-11,w,22,11);ctx.fill();ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,x,y+1);}
// officer leaning out of a cruiser, firing: figure + muzzle flash + tracer
function drawOfficerFiring(ctx,cam,e){const p=projectPoint(cam,e.x,e.y,0);if(!p||p.depth>520)return;const h=Math.max(16,p.s*27);const x=p.x,y=p.y;
 ctx.fillStyle="rgba(0,0,0,0.3)";ctx.beginPath();ctx.ellipse(x,y+2,h*0.24,h*0.07,0,0,7);ctx.fill();
 ctx.strokeStyle="#1d2735";ctx.lineWidth=Math.max(2,h*0.11);ctx.beginPath();ctx.moveTo(x,y-h*0.42);ctx.lineTo(x-h*0.13,y);ctx.moveTo(x,y-h*0.42);ctx.lineTo(x+h*0.13,y);ctx.stroke();
 ctx.fillStyle="#274b73";roundRectPath(ctx,x-h*0.21,y-h*0.82,h*0.42,h*0.44,3);ctx.fill();
 ctx.fillStyle="#f2b705";ctx.fillRect(x-h*0.05,y-h*0.68,h*0.10,h*0.10); // badge glint
 ctx.fillStyle="#c98a5a";ctx.beginPath();ctx.arc(x,y-h*0.94,h*0.135,0,7);ctx.fill();ctx.fillStyle="#14202f";ctx.beginPath();ctx.arc(x,y-h*0.99,h*0.14,Math.PI,0);ctx.fill();ctx.fillRect(x-h*0.14,y-h*1.0,h*0.28,h*0.05); // cap brim
 // raised arm toward the hero car (screen-left/down), gun, flash, tracer
 const gx=x-h*0.55,gy=y-h*0.62;ctx.strokeStyle="#274b73";ctx.lineWidth=Math.max(2,h*0.10);ctx.beginPath();ctx.moveTo(x-h*0.16,y-h*0.74);ctx.lineTo(gx,gy);ctx.stroke();
 ctx.fillStyle="#14181d";ctx.fillRect(gx-h*0.16,gy-h*0.045,h*0.17,h*0.07);
 const fx=gx-h*0.20,fy=gy-h*0.01;const tx2=fx-h*2.6,ty2=fy+h*0.9;const tg=ctx.createLinearGradient(fx,fy,tx2,ty2);tg.addColorStop(0,"rgba(255,240,170,0.95)");tg.addColorStop(1,"rgba(255,180,60,0)");ctx.lineCap="round";ctx.strokeStyle=tg;ctx.lineWidth=Math.max(3,h*0.11);ctx.beginPath();ctx.moveTo(fx,fy);ctx.lineTo(tx2,ty2);ctx.stroke();
 ctx.strokeStyle="rgba(255,255,255,0.95)";ctx.lineWidth=Math.max(1.5,h*0.04);ctx.beginPath();ctx.moveTo(fx,fy);ctx.lineTo(tx2,ty2);ctx.stroke();
 const fg2=ctx.createRadialGradient(fx,fy,2,fx,fy,h*0.42);fg2.addColorStop(0,"rgba(255,230,150,0.55)");fg2.addColorStop(1,"rgba(255,180,60,0)");ctx.fillStyle=fg2;ctx.beginPath();ctx.arc(fx,fy,h*0.42,0,7);ctx.fill();
 ctx.fillStyle="#ffb340";ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4;const rr=i%2?h*0.12:h*0.38;ctx[i?"lineTo":"moveTo"](fx+Math.cos(a)*rr,fy+Math.sin(a)*rr);}ctx.closePath();ctx.fill();
 ctx.fillStyle="#fff3b0";ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4+0.4;const rr=i%2?h*0.06:h*0.18;ctx[i?"lineTo":"moveTo"](fx+Math.cos(a)*rr,fy+Math.sin(a)*rr);}ctx.closePath();ctx.fill();
 ctx.fillStyle="#ffffff";ctx.beginPath();ctx.arc(fx,fy,h*0.08,0,7);ctx.fill();}
// ---------- helicopter with spotlight cone ----------
function drawHelicopter(ctx,x,y,scale,opts){opts=opts||{};
 if(opts.coneTo){const g=ctx.createLinearGradient(0,y,0,opts.coneTo.y);g.addColorStop(0,"rgba(255,246,200,0.30)");g.addColorStop(1,"rgba(255,246,200,0.10)");ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-10*scale,y+12*scale);ctx.lineTo(x+14*scale,y+12*scale);ctx.lineTo(opts.coneTo.x+100,opts.coneTo.y);ctx.lineTo(opts.coneTo.x-100,opts.coneTo.y);ctx.closePath();ctx.fill();
  ctx.strokeStyle="rgba(255,250,215,0.28)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-10*scale,y+12*scale);ctx.lineTo(opts.coneTo.x-100,opts.coneTo.y);ctx.moveTo(x+14*scale,y+12*scale);ctx.lineTo(opts.coneTo.x+100,opts.coneTo.y);ctx.stroke();
  ctx.fillStyle="rgba(255,248,205,0.20)";ctx.beginPath();ctx.ellipse(opts.coneTo.x,opts.coneTo.y,100,20,0,0,7);ctx.fill();}
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 ctx.fillStyle="rgba(20,24,32,0.18)";ctx.beginPath();ctx.ellipse(0,-30,86,10,0,0,7);ctx.fill(); // rotor blur disc
 const bg=ctx.createLinearGradient(0,-16,0,16);bg.addColorStop(0,"#3a4250");bg.addColorStop(0.5,"#22262e");bg.addColorStop(1,"#12151b");ctx.fillStyle=bg;ctx.beginPath();ctx.ellipse(0,0,54,17,0,0,7);ctx.fill();
 ctx.fillStyle="#0d2733";ctx.beginPath();ctx.ellipse(24,-4,17,10,0,0,7);ctx.fill();ctx.strokeStyle="rgba(190,230,245,0.65)";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(14,-11);ctx.lineTo(34,-9);ctx.stroke();
 ctx.fillStyle="#22262e";ctx.fillRect(-88,-3,40,6);ctx.fillRect(-90,-17,6,27);ctx.fillStyle="#ff2d2d";ctx.beginPath();ctx.arc(-87,-15,4,0,7);ctx.fill();
 ctx.fillStyle="rgba(15,18,22,0.85)";ctx.fillRect(-64,-27,128,4);ctx.fillRect(-3,-27,6,12);
 ctx.strokeStyle="#22262e";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-14,14);ctx.lineTo(-24,24);ctx.moveTo(20,14);ctx.lineTo(28,24);ctx.moveTo(-26,24);ctx.lineTo(32,24);ctx.stroke();
 ctx.fillStyle="#ffeeb0";ctx.beginPath();ctx.arc(6,12,4,0,7);ctx.fill();ctx.restore();}
// ---------- marina props ----------
function drawCrateStack(ctx,cam,cx,cy){const p=projectPoint(cam,cx,cy,0);if(!p)return;const s=p.s*8;const cols=["#8a6a42","#7a5c38","#9a7a4e"];for(let i=0;i<3;i++){ctx.fillStyle=cols[i];ctx.fillRect(p.x-s+i*s*0.2,p.y-s*(i+1),s,s);ctx.strokeStyle="#4a3822";ctx.strokeRect(p.x-s+i*s*0.2,p.y-s*(i+1),s,s);}ctx.fillStyle="#bfe8f2";ctx.fillRect(p.x-s,p.y-s*3-6,s*1.4,6);}
function drawBoatShape(ctx,cam,boat){const p=projectPoint(cam,boat.x,boat.y,0);if(!p||p.depth>560)return;const w=Math.max(18,p.s*(boat.big?80:54));const hexCol=boat.color&&boat.color.startsWith("#")?boat.color:"#888888";
 ctx.fillStyle=boat.color;ctx.beginPath();ctx.moveTo(p.x-w/2,p.y-w*0.06);ctx.lineTo(p.x+w/2,p.y-w*0.06);ctx.lineTo(p.x+w*0.34,p.y+w*0.20);ctx.lineTo(p.x-w*0.34,p.y+w*0.20);ctx.closePath();ctx.fill();
 ctx.fillStyle=shadeColor(hexCol,-48);ctx.beginPath();ctx.moveTo(p.x-w/2,p.y+w*0.04);ctx.lineTo(p.x+w/2,p.y+w*0.04);ctx.lineTo(p.x+w*0.34,p.y+w*0.20);ctx.lineTo(p.x-w*0.34,p.y+w*0.20);ctx.closePath();ctx.fill();
 ctx.fillStyle="rgba(255,255,255,0.85)";ctx.fillRect(p.x-w/2,p.y-w*0.08,w,w*0.03);
 ctx.fillStyle="#ffffff";ctx.fillRect(p.x-w*0.14,p.y-w*0.34,w*0.28,w*0.26);ctx.fillStyle="#7fc4d8";ctx.fillRect(p.x-w*0.10,p.y-w*0.30,w*0.20,w*0.10);ctx.strokeStyle="rgba(20,30,40,0.55)";ctx.lineWidth=1;ctx.strokeRect(p.x-w*0.14,p.y-w*0.34,w*0.28,w*0.26);
 ctx.strokeStyle="#3a3f46";ctx.lineWidth=Math.max(1,w*0.02);ctx.beginPath();ctx.moveTo(p.x+w*0.22,p.y-w*0.08);ctx.lineTo(p.x+w*0.22,p.y-w*0.52);ctx.stroke();}
function projectRectCorners(cam,x0,y0,x1,y1){const pts=[projectPoint(cam,x0,y0,0),projectPoint(cam,x1,y0,0),projectPoint(cam,x1,y1,0),projectPoint(cam,x0,y1,0)];if(pts.some(p=>!p))return null;return pts;}
function fillProjectedRect(ctx,cam,x0,y0,x1,y1,fill){const pts=projectRectCorners(cam,x0,y0,x1,y1);if(!pts)return;ctx.fillStyle=fill;polyPath(ctx,pts);ctx.fill();}
function drawMarinaInletAndDock(ctx,cam){
 fillProjectedRect(ctx,cam,MARINA_INLET.x0-14,MARINA_INLET.y0-14,MARINA_INLET.x1+14,MARINA_INLET.y1+14,"#e8c98a");
 fillProjectedRect(ctx,cam,MARINA_INLET.x0,MARINA_INLET.y0,MARINA_INLET.x1,MARINA_INLET.y1,"#14607a");
 ctx.strokeStyle="rgba(190,232,242,0.5)";ctx.lineWidth=2;
 for(let i=0;i<5;i++){const wy=MARINA_INLET.y0+22+i*((MARINA_INLET.y1-MARINA_INLET.y0-44)/4);const a=projectPoint(cam,MARINA_INLET.x0+12,wy,0),b=projectPoint(cam,MARINA_INLET.x1-12,wy,0);if(!a||!b)continue;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
 const dock=CITY_DATA.marina.dock;fillProjectedRect(ctx,cam,dock.x,dock.y,dock.x+dock.w,dock.y+dock.h,"#8a6a42");
 ctx.strokeStyle="#5f4630";ctx.lineWidth=2;for(let i=1;i<=4;i++){const wx=dock.x+(dock.w/4)*i;const a=projectPoint(cam,wx,dock.y,0),b=projectPoint(cam,wx,dock.y+dock.h,0);if(!a||!b)continue;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}
// ---------- scene ----------
function renderScene(ctx,cam,entities){CUR_HORIZON=cam.horizon||318;drawSky(ctx,cam);drawGroundAndRoads(ctx,cam);drawSeaSparkle(ctx,cam);drawMarinaInletAndDock(ctx,cam);
 const items=[];for(const b of CITY_DATA.buildings){if(cam.hideIds&&cam.hideIds.indexOf(b.id)>=0)continue;items.push({d:Math.hypot(b.x-cam.x,b.y-cam.y),k:"b",o:b});}for(const pl of CITY_DATA.palms)items.push({d:Math.hypot(pl.x-cam.x,pl.y-cam.y),k:"p",o:pl});for(const bt of CITY_DATA.marina.boats)items.push({d:Math.hypot(bt.x-cam.x,bt.y-cam.y),k:"boat",o:bt});for(const cr of CITY_DATA.marina.crates)items.push({d:Math.hypot(cr.x-cam.x,cr.y-cam.y),k:"crate",o:cr});items.sort((a,b2)=>b2.d-a.d);
 for(const it of items){if(it.k==="b")drawBuilding(ctx,cam,it.o);else if(it.k==="boat")drawBoatShape(ctx,cam,it.o);else if(it.k==="crate")drawCrateStack(ctx,cam,it.o.x,it.o.y);else drawPalmTree(ctx,cam,it.o);}
 const sorted=(entities||[]).slice().sort((a,b2)=>Math.hypot(b2.x-cam.x,b2.y-cam.y)-Math.hypot(a.x-cam.x,a.y-cam.y));
 for(const e of sorted){if(e.type==="car")drawCarBody(ctx,cam,e);else if(e.type==="officer")drawOfficerFiring(ctx,cam,e);else drawCharacterFigure(ctx,cam,e);}
 if(cam.flare){const fg=ctx.createRadialGradient(RENDER_W/2,CUR_HORIZON-4,4,RENDER_W/2,CUR_HORIZON-4,210);fg.addColorStop(0,"rgba(255,250,215,0.55)");fg.addColorStop(1,"rgba(255,250,215,0)");ctx.fillStyle=fg;ctx.fillRect(0,0,RENDER_W,RENDER_H);ctx.fillStyle="rgba(255,255,255,0.20)";ctx.fillRect(RENDER_W/2-190,CUR_HORIZON-6,380,3);}}
