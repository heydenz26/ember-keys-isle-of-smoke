// EMBER KEYS — game.js : state machine, input, traffic, police AI, staged states, save system
const canvas=document.getElementById("game");const ctx=canvas.getContext("2d");
const keysDown={};let gameMode="title";let phoneOpen=false;
const playerState={player:{x:600,y:540},heading:0,speed:0,inCar:true,health:95,armour:40,cash:1250,wanted:0,clock:"18:52",mission:MISSIONS[0],stageIndex:0,policeCars:[],trafficCars:[]};
const playerCar={type:"car",x:612,y:520,color:"#e8730c",heading:0};
let trafficFleet=[];let policeFleet=[];
function spawnTrafficFleet(){const rng=createSeededRng(42);const cols=["#d9d9d9","#3f8f7a","#b85c5c","#f2e6c9","#5a7fa6"];trafficFleet=[];for(let i=0;i<14;i++){const vertical=rng()>0.5;const road=ROAD_COORDS[Math.floor(rng()*6)];trafficFleet.push({type:"car",x:vertical?road:80+rng()*1040,y:vertical?80+rng()*1040:road,color:cols[i%cols.length],heading:0,speed:18+rng()*20,vertical:vertical,road:road});}}
function spawnPoliceFleet(count){policeFleet=[];for(let i=0;i<count;i++)policeFleet.push({type:"car",x:playerState.player.x+(i-2)*36,y:playerState.player.y-70-i*22,color:"#1c2333",police:true,heading:0});playerState.policeCars=policeFleet;}
function updateTraffic(dt){for(const c of trafficFleet){if(c.vertical)c.y+=c.speed*dt*(c.road%400<200?1:-1);else c.x+=c.speed*dt;if(c.x>1180)c.x=20;if(c.y>1180)c.y=20;if(c.y<20)c.y=1180;}}
function updatePolicePursuit(dt){if(playerState.wanted===0)return;for(const p of policeFleet){const dx=playerState.player.x-p.x,dy=playerState.player.y-p.y;const d=Math.hypot(dx,dy)||1;const sp=playerState.wanted>=4?52:38;p.x+=dx/d*sp*dt;p.y+=dy/d*sp*dt;}}
function checkMissionProgress(){const st=playerState.mission.stages[playerState.stageIndex];const d=Math.hypot(playerState.player.x-st.marker.x,playerState.player.y-st.marker.y);const md=document.getElementById("missionDist");if(md)md.textContent=Math.round(d)+" m";if(d<26&&playerState.stageIndex<playerState.mission.stages.length-1){playerState.stageIndex++;playerState.cash+=250;}}
function saveGameToSlot(slot){try{localStorage.setItem("emberkeys-slot"+slot,JSON.stringify({cash:playerState.cash,stage:playerState.stageIndex,x:playerState.player.x,y:playerState.player.y}));}catch(e){}}
function loadGameFromSlot(slot){try{const raw=localStorage.getItem("emberkeys-slot"+slot);if(!raw)return null;return JSON.parse(raw);}catch(e){return null;}}
function handleKeyboardInput(dt){const p=playerState.player;let fwd=0,turn=0;if(keysDown["w"]||keysDown["arrowup"])fwd=1;if(keysDown["s"]||keysDown["arrowdown"])fwd=-1;if(keysDown["a"]||keysDown["arrowleft"])turn=-1;if(keysDown["d"]||keysDown["arrowright"])turn=1;
 if(playerState.inCar){playerState.heading+=turn*dt*1.9;playerState.speed+= (fwd*90 - playerState.speed*0.6)*dt;const nx=p.x+Math.sin(playerState.heading)*playerState.speed*dt;const ny=p.y+Math.cos(playerState.heading)*playerState.speed*dt;if(!isBlockedByBuilding(nx,ny)){p.x=Math.max(16,Math.min(1184,nx));p.y=Math.max(16,Math.min(1184,ny));}playerCar.x=p.x;playerCar.y=p.y;
  if(Math.abs(playerState.speed)>70)playerState.wanted=Math.max(playerState.wanted,1);}
 else{const sp=52;const nx=p.x+turn*sp*dt;const ny=p.y-fwd*sp*dt;if(!isBlockedByBuilding(nx,ny)){p.x=Math.max(16,Math.min(1184,nx));p.y=Math.max(16,Math.min(1184,ny));}playerState.speed=0;}}
window.addEventListener("keydown",function(e){const k=e.key.toLowerCase();keysDown[k]=true;
 if(k==="e"){if(playerState.inCar){playerState.inCar=false;playerState.player.x+=14;}else if(Math.hypot(playerState.player.x-playerCar.x,playerState.player.y-playerCar.y)<30)playerState.inCar=true;checkMissionProgress();}
 if(k==="tab"){e.preventDefault();phoneOpen=!phoneOpen;document.getElementById("phoneBar").classList.toggle("hidden",!phoneOpen);}
 if(k==="escape"||k==="m"){togglePauseMenu();}
 if(k==="z"||k==="c"){/* crew ability keys: Pearl swap plates (Z), Deckhand lookout ping (C) */}});
window.addEventListener("keyup",function(e){keysDown[e.key.toLowerCase()]=false;});
function togglePauseMenu(){if(gameMode==="menu"){gameMode="drive";showOnlyHudSections(true,false,false);}else{gameMode="menu";buildPauseMenuContent();showOnlyHudSections(false,false,true);}}
function buildPauseMenuContent(){fillSaveSlotCards("menuSlots");const pl=document.getElementById("progressList");if(pl&&!pl.children.length){for(const r of PROGRESS_ROWS){const d=document.createElement("div");d.className="prow";d.textContent=r[0]+"  "+r[1]+"/"+r[2];const bar=document.createElement("div");bar.className="bar";const fill=document.createElement("i");fill.style.background="#2dd4bf";fill.style.width=Math.round(r[1]/r[2]*100)+"%";bar.appendChild(fill);d.appendChild(bar);pl.appendChild(d);}}
 const cg=document.getElementById("careerGrid");if(cg&&!cg.children.length){for(const s of CAREER_STATS){const d=document.createElement("div");const b=document.createElement("b");b.textContent=s[0];const sp=document.createElement("span");sp.textContent=s[1];d.appendChild(b);d.appendChild(sp);cg.appendChild(d);}}
 const al=document.getElementById("activityList");if(al&&!al.children.length){for(const r of ACTIVITY_ROWS){const d=document.createElement("div");d.className="prow";d.textContent=r[0]+"  "+r[1]+"/"+r[2];const bar=document.createElement("div");bar.className="bar";const fill=document.createElement("i");fill.style.background="#ff9ff3";fill.style.width=Math.round(r[1]/r[2]*100)+"%";bar.appendChild(fill);d.appendChild(bar);al.appendChild(d);}}
 const bm=document.getElementById("bigMap");if(bm)drawStreetGridOnCanvas(bm,{labels:true,big:true,route:true,player:playerState.player,police:policeFleet});}
// MISSION MARINA DRESSING (Round 3, mission shot only): repaint the inlet as
// real water — vertical gradient + deterministic wave sparkle — then redraw
// the fleet larger (city boats + two staged near-edge boats) so the marina
// reads instantly at small size. Dock, crates and figures stay untouched.
function drawMissionMarinaDressing(cam){
 const pts=projectRectCorners(cam,MARINA_INLET.x0,MARINA_INLET.y0,MARINA_INLET.x1,MARINA_INLET.y1);if(!pts)return;
 const ys=pts.map(p=>p.y);const g=ctx.createLinearGradient(0,Math.min.apply(null,ys),0,Math.max.apply(null,ys));
 g.addColorStop(0,"#3ec6dd");g.addColorStop(0.45,"#1b87a8");g.addColorStop(1,"#0d5470");
 ctx.fillStyle=g;polyPath(ctx,pts);ctx.fill();
 ctx.strokeStyle="rgba(255,255,255,0.28)";ctx.lineWidth=1.5;polyPath(ctx,pts);ctx.stroke();
 const rng=createSeededRng(99);ctx.strokeStyle="rgba(235,252,255,0.75)";ctx.lineCap="round";
 for(let i=0;i<52;i++){const wx=MARINA_INLET.x0+14+rng()*(MARINA_INLET.x1-MARINA_INLET.x0-40),wy=MARINA_INLET.y0+12+rng()*(MARINA_INLET.y1-MARINA_INLET.y0-24);
  const a=projectPoint(cam,wx,wy,0),b=projectPoint(cam,wx+13+rng()*12,wy,0);if(!a||!b)continue;ctx.lineWidth=Math.max(1,Math.min(3,a.s*1.5));ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
 for(const bt of CITY_DATA.marina.boats)drawBoatShape(ctx,cam,bt);
 drawBoatShape(ctx,cam,{x:700,y:545,color:"#e8e8e8",big:true});drawBoatShape(ctx,cam,{x:560,y:520,color:"#d96a8a",big:true});}
function pedestrianFigure(x,y,shirt,name){return{type:"person",x:x,y:y,shirt:shirt,pants:"#26324a",skin:"#c98a5a",hair:"#1c1410",name:name||null};}
// STAGING HOOKS (Round 3): each ?shot= state sets gameMode + playerState, picks a
// camera {x,y,heading,h,horizon,sky,flare}, builds an entity list, calls
// renderScene(), then any screen-space overlays (helicopter), then the HUD.
// Builder 2 restages "mission" + "menu" on this same renderer API — keep the
// camera fields and entity types ("car" | "person" | "officer") stable.
function buildStagedScene(shot){
 if(shot==="cover"){gameMode="title";playerCar.hero=false;
  // Aerial coastal composition: camera offshore south of the island looking
  // north — sea foreground, beach band with palms, dense signed towers behind.
  // Title/subtitle sit over sky (DOM overlay + top gradient), never on geometry.
  const cam={x:660,y:1420,heading:Math.PI+0.13,h:128,horizon:212,sky:"dusk"};
  // Hero Runner GT sits ON the vertical coast road (x=500) close to camera so
  // it reads in the same rear three-quarter perspective as every other car.
  const coverCars=[{type:"car",x:500,y:1150,color:"#e8730c",hero:true,dir:Math.PI},{type:"car",x:498,y:986,color:"#f2f2f2",dir:Math.PI},{type:"car",x:706,y:884,color:"#b85c5c",dir:0},{type:"car",x:388,y:1052,color:"#3f8f7a",dir:Math.PI/2}];
  renderScene(ctx,cam,coverCars);fillSaveSlotCards("titleSlots");showOnlyHudSections(false,true,false);document.title="READY";return;}
 if(shot==="chase"){gameMode="drive";playerState.player={x:500,y:415};playerState.heading=Math.PI;playerState.speed=88;playerState.inCar=true;playerState.wanted=4;playerState.clock="18:45";playerState.stageIndex=2;playerCar.x=500;playerCar.y=415;playerCar.hero=true;
  spawnTrafficFleet();spawnPoliceFleet(5);
  // EKPD flanking the hero (left + right, slightly ahead), two roadblock units
  // ahead at the vanishing point, one rammer behind.
  policeFleet[0].x=456;policeFleet[0].y=378;policeFleet[1].x=544;policeFleet[1].y=378;policeFleet[2].x=472;policeFleet[2].y=262;policeFleet[3].x=528;policeFleet[3].y=262;policeFleet[4].x=500;policeFleet[4].y=212;
  trafficFleet[0].x=503;trafficFleet[0].y=218;trafficFleet[1].x=428;trafficFleet[1].y=312;trafficFleet[2].x=585;trafficFleet[2].y=192;
  const cam={x:500,y:552,heading:Math.PI,h:32,horizon:292,sky:"day",hideIds:[39]};
  // Officer on the hero's right flank, firing left across the frame at the
  // Runner GT — flash + tracer land at the car's edge, never over it.
  const officer={type:"officer",x:432,y:366};
  const ents=[playerCar].concat(policeFleet).concat(trafficFleet.slice(0,3)).concat([officer,pedestrianFigure(466,312,"#f2c14e"),pedestrianFigure(536,272,"#7fb3b0"),pedestrianFigure(468,218,"#e8e8e8")]);
  // Helicopter fully inside the frame, clear of the location banner, with its
  // spotlight cone raking down to the hero car on the road.
  renderScene(ctx,cam,ents);drawHelicopter(ctx,908,118,0.9,{coneTo:{x:640,y:414}});
  updateHudForState(playerState);document.getElementById("missionDist").textContent="270 m";showOnlyHudSections(true,false,false);document.title="READY";return;}
 if(shot==="mission"){gameMode="foot";playerState.player={x:640,y:650};playerState.speed=0;playerState.inCar=false;playerState.wanted=1;playerState.clock="18:52";playerState.stageIndex=0;playerState.health=95;playerState.armour=40;
  // Over-shoulder marina staging (Karimbu language, our renderer): camera low
  // on the dock apron south of the inlet, looking north across real water.
  // Jude (player) LARGE centre foreground, Pearl + Deckhand large either side
  // with clean nameplates, crowd mid-ground, an EKPD officer as the action
  // target of Pearl's aim line, Runner GT parked dockside with its steal chip.
  const cam={x:640,y:760,heading:Math.PI,h:34,horizon:286,sky:"day"};
  const jude=pedestrianFigure(642,684,"#e8730c","Jude");const pearl=pedestrianFigure(665,688,"#0f766e","Pearl Castellanos");
  const deck=pedestrianFigure(600,665,"#f2c14e","Deckhand");
  const officer={type:"officer",x:545,y:590};
  const runner={type:"car",x:615,y:655,color:"#e8730c",hero:true};
  const crowd=[pedestrianFigure(610,625,"#7fb3b0"),pedestrianFigure(660,618,"#b85c5c"),pedestrianFigure(700,628,"#e8e8e8"),pedestrianFigure(575,632,"#5a7fa6")];
  renderScene(ctx,cam,[jude,pearl,deck,officer,runner].concat(crowd));
  drawMissionMarinaDressing(cam);
  // Foreground sits on the apron SOUTH of the water: repaint it over the
  // dressing so boats never occlude faces, nameplates or the hero car.
  drawCarBody(ctx,cam,runner);drawOfficerFiring(ctx,cam,officer);
  drawCharacterFigure(ctx,cam,deck);drawCharacterFigure(ctx,cam,jude);drawCharacterFigure(ctx,cam,pearl);
  // Pearl's aim line to the EKPD officer + reticle — the instant action read.
  const pp=projectPoint(cam,665,688,0),op=projectPoint(cam,545,590,0);
  if(pp&&op){const ph=pp.s*26,oh=op.s*26;const hx=pp.x+ph*0.34,hy=pp.y-ph*0.46,tx=op.x,ty=op.y-oh*0.62;
   ctx.lineCap="round";ctx.strokeStyle="rgba(255,196,40,0.9)";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(tx,ty);ctx.stroke();
   ctx.strokeStyle="rgba(255,255,255,0.95)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(tx,ty);ctx.stroke();
   ctx.strokeStyle="#ffd23e";ctx.lineWidth=3.5;ctx.beginPath();ctx.arc(tx,ty,17,0,7);ctx.stroke();
   ctx.beginPath();ctx.moveTo(tx-26,ty);ctx.lineTo(tx-9,ty);ctx.moveTo(tx+9,ty);ctx.lineTo(tx+26,ty);ctx.moveTo(tx,ty-26);ctx.lineTo(tx,ty-9);ctx.moveTo(tx,ty+9);ctx.lineTo(tx,ty+26);ctx.stroke();
   ctx.fillStyle="#ffd23e";ctx.beginPath();ctx.arc(tx,ty,3.5,0,7);ctx.fill();}
  updateHudForState(playerState);
  document.getElementById("missionDist").textContent="0 m";document.getElementById("interactChip").classList.remove("hidden");showOnlyHudSections(true,false,false);document.title="READY";return;}
 if(shot==="menu"){gameMode="menu";const cam={x:600,y:760,heading:Math.PI,h:150};renderScene(ctx,cam,[playerCar]);buildPauseMenuContent();showOnlyHudSections(false,false,true);document.title="READY";return;}
 // normal play
 spawnTrafficFleet();gameMode="drive";showOnlyHudSections(true,false,false);requestAnimationFrame(gameLoop);}
let lastTime=0;function gameLoop(ts){if(gameMode==="menu")return;const dt=Math.min(0.05,(ts-lastTime)/1000||0.016);lastTime=ts;handleKeyboardInput(dt);updateTraffic(dt);updatePolicePursuit(dt);checkMissionProgress();
 const p=playerState.player;const cam={x:p.x-Math.sin(playerState.heading)*46,y:p.y-Math.cos(playerState.heading)*46,heading:playerState.heading+Math.PI,h:24};
 // camera looks toward player heading: render with heading flipped for behind view
 const cam2={x:p.x,y:p.y+52,heading:Math.PI,h:24};if(playerState.inCar){cam2.x=p.x-Math.sin(playerState.heading)*-52;cam2.y=p.y-Math.cos(playerState.heading)*-52;cam2.heading=playerState.heading+Math.PI;}
 const ents=[playerCar].concat(trafficFleet).concat(policeFleet);renderScene(ctx,cam2,ents);updateHudForState(playerState);requestAnimationFrame(gameLoop);}
const shotParam=new URLSearchParams(location.search).get("shot");buildStagedScene(shotParam);
