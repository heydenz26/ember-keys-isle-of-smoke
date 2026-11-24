// EMBER KEYS — city.js : island data, districts, seeded generation
function createSeededRng(seed){let s=seed>>>0;return function nextRandom(){s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
const WORLD_SIZE=1200;
const MARINA_INLET={x0:520,y0:440,x1:860,y1:605};
const ROAD_COORDS=[100,300,500,700,900,1100];
const DISTRICTS=[
 {name:"Ember Key Downtown",short:"EMBER KEY DOWNTOWN",x0:350,y0:0,x1:850,y1:420,ground:"#5a5f6b",friend:"NEUTRAL",score:58},
 {name:"Sunken Gardens Marina",short:"SUNKEN GARDENS MARINA",x0:350,y0:420,x1:850,y1:760,ground:"#7a6a52",friend:"FRIENDLY",score:74},
 {name:"Cinder Key",short:"CINDER KEY",x0:850,y0:0,x1:1200,y1:500,ground:"#6b5548",friend:"HOSTILE",score:22},
 {name:"Neon Mile",short:"NEON MILE",x0:0,y0:0,x1:350,y1:500,ground:"#4f4a63",friend:"NEUTRAL",score:51},
 {name:"Gator Hammock",short:"GATOR HAMMOCK",x0:0,y0:760,x1:500,y1:1200,ground:"#3f5a3a",friend:"NEUTRAL",score:44},
 {name:"Airstrip Cay",short:"AIRSTRIP CAY",x0:500,y0:900,x1:1200,y1:1200,ground:"#8a7f5f",friend:"FRIENDLY",score:68},
 {name:"Lighthouse Point",short:"LIGHTHOUSE POINT",x0:850,y0:500,x1:1200,y1:900,ground:"#6a7a72",friend:"FRIENDLY",score:71}
];
function districtAt(x,y){for(const d of DISTRICTS){if(x>=d.x0&&x<d.x1&&y>=d.y0&&y<d.y1)return d;}return DISTRICTS[0];}
const BUILDING_PALETTE=["#c96f3a","#d9a05a","#7fb3b0","#e8dcc3","#b85c5c","#5a7fa6","#e07a3f","#f2e6c9","#3f8f7a","#d96a8a"];
const BUILDING_SIGNS=[{t:"HOTEL EMBER",c:"#ffd23e"},{t:"MARLIN SUITES",c:"#7fe7d2"},{t:"PALM COURT",c:"#ffb3c8"},{t:"EKPD PRECINCT",c:"#9fc2ff"},{t:"CAFE SOL",c:"#ffd98a"},{t:"BANCO ISLE",c:"#a8e6a1"},{t:"NEON ARCADE",c:"#ff9ff3"},{t:"PEARL HOTEL",c:"#ffe9b0"},{t:"MARINA INN",c:"#7fe7d2"},{t:"CINDER DEPOT",c:"#ffb340"}];
function generateBuildings(seed){const rng=createSeededRng(seed);const out=[];let id=0;
 const inletEx={x0:MARINA_INLET.x0-6,y0:MARINA_INLET.y0-6,x1:MARINA_INLET.x1+6,y1:MARINA_INLET.y1+6};
 const apronEx={x0:514-6,y0:605-6,x1:866+6,y1:706+6};
 function rectsIntersect(ax0,ay0,ax1,ay1,b){return ax0<b.x1&&ax1>b.x0&&ay0<b.y1&&ay1>b.y0;}
 for(let bx=0;bx<5;bx++)for(let by=0;by<5;by++){const ox=ROAD_COORDS[bx]+28,oy=ROAD_COORDS[by]+28;const n=2+Math.floor(rng()*3);
  for(let k=0;k<n;k++){const w=34+rng()*44,d=34+rng()*44;const bx2=ox+(k%2)*78+rng()*10,by2=oy+Math.floor(k/2)*82+rng()*8;const bh=36+rng()*130;const bcol=BUILDING_PALETTE[Math.floor(rng()*BUILDING_PALETTE.length)];const bseed=Math.floor(rng()*99999);
   if(rectsIntersect(bx2,by2,bx2+w,by2+d,inletEx))continue;
   if(rectsIntersect(bx2,by2,bx2+w,by2+d,apronEx))continue;
   const nb={id:id++,x:bx2,y:by2,w:w,d:d,h:bh,color:bcol,seed:bseed,district:districtAt(ox,oy).name};
   if(rng()<0.46){const sg=BUILDING_SIGNS[Math.floor(rng()*BUILDING_SIGNS.length)];nb.sign=sg.t;nb.signColor=sg.c;}
   out.push(nb);}}
 return out;}
function generatePalms(seed){const rng=createSeededRng(seed+7);const out=[];
 // boulevard rows flanking the x=500 road (west sidewalk, then east sidewalk)
 for(let i=0;i<26;i++)out.push({x:466+rng()*8,y:36+i*44+rng()*10,s:0.85+rng()*0.5,lean:rng()*0.24-0.12});
 for(let i=0;i<26;i++)out.push({x:528+rng()*8,y:58+i*44+rng()*10,s:0.85+rng()*0.5,lean:rng()*0.24-0.12});
 // south beach band (cover foreground silhouettes)
 for(let i=0;i<22;i++)out.push({x:36+i*54+rng()*18,y:1152+rng()*30,s:0.8+rng()*0.55,lean:rng()*0.3-0.15});
 // scattered island palms
 for(let i=0;i<26;i++)out.push({x:60+rng()*1080,y:60+rng()*1040,s:0.8+rng()*0.6,lean:rng()*0.3-0.15});
 return out;}
function generateMarinaProps(){return{dock:{x:540,y:608,w:300,h:30},crates:[{x:566,y:652},{x:596,y:658},{x:806,y:650},{x:780,y:664},{x:836,y:668}],boats:[{x:612,y:520,rot:0.2,color:"#f2f2f2"},{x:706,y:478,rot:-0.15,color:"#e07a3f"},{x:792,y:548,rot:0.1,color:"#7fb3b0"}]};}
const POIS=[{name:"Sunken Gardens Marina",x:620,y:580},{name:"Ember Key Downtown",x:600,y:220},{name:"Lighthouse Point",x:1020,y:700},{name:"Airstrip Cay",x:850,y:1050},{name:"Neon Mile",x:175,y:250}];
const SPAWNS={player:{x:600,y:540,heading:0},car:{x:612,y:520,heading:0},marina:{x:620,y:580},downtown:{x:600,y:300}};
const CITY_DATA={buildings:generateBuildings(1337),palms:generatePalms(1337),marina:generateMarinaProps()};
function isBlockedByBuilding(x,y){for(const b of CITY_DATA.buildings){if(x>b.x-4&&x<b.x+b.w+4&&y>b.y-4&&y<b.y+b.d+4)return true;}return false;}
function isOnRoad(x,y){for(const c of ROAD_COORDS){if(Math.abs(x-c)<26||Math.abs(y-c)<26)return true;}return false;}
