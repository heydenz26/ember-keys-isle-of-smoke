// EMBER KEYS — hud.js : HUD DOM updates and minimap / island map drawing
function el(id){return document.getElementById(id);}
function setText(id,t){const e=el(id);if(e)e.textContent=t;}
const DISTRICT_TINTS=["#8a7f5f","#3f7a6a","#8a5f4a","#5f5a8a","#4a7a3f","#9a8a5f","#5f8a7a"];
function drawStreetGridOnCanvas(cv,opts){const ctx=cv.getContext("2d");const W=cv.width,H=cv.height;ctx.fillStyle="#1d4e5e";ctx.fillRect(0,0,W,H);
 const sx=W/WORLD_SIZE,sy=H/WORLD_SIZE;const pad=W*0.03;const ix0=pad,iy0=pad,iw=W-pad*2,ih=H-pad*2;const mx=function(x){return ix0+x/WORLD_SIZE*iw;},my=function(y){return iy0+y/WORLD_SIZE*ih;};
 ctx.fillStyle="#c9b98a";ctx.fillRect(ix0-3,iy0-3,iw+6,ih+6);
 DISTRICTS.forEach(function(d,i){ctx.fillStyle=DISTRICT_TINTS[i];ctx.fillRect(mx(d.x0),my(d.y0),(d.x1-d.x0)/WORLD_SIZE*iw,(d.y1-d.y0)/WORLD_SIZE*ih);});
 // city blocks between roads
 ctx.fillStyle="rgba(0,0,0,0.18)";for(let bx=0;bx<5;bx++)for(let by=0;by<5;by++){ctx.fillRect(mx(ROAD_COORDS[bx]+30),my(ROAD_COORDS[by]+30),(ROAD_COORDS[bx+1]-ROAD_COORDS[bx]-60)/WORLD_SIZE*iw,(ROAD_COORDS[by+1]-ROAD_COORDS[by]-60)/WORLD_SIZE*ih);}
 ctx.strokeStyle="#e8e4da";ctx.lineWidth=Math.max(3,W*0.011);for(const c of ROAD_COORDS){ctx.beginPath();ctx.moveTo(mx(c),iy0);ctx.lineTo(mx(c),iy0+ih);ctx.stroke();ctx.beginPath();ctx.moveTo(ix0,my(c));ctx.lineTo(ix0+iw,my(c));ctx.stroke();}
 // remap helpers for overlays below via closure values stored on ctx
 ctx._mx=mx;ctx._my=my;
 if(opts&&opts.labels){ctx.font="800 "+Math.max(12,W*0.026)+"px system-ui";ctx.textAlign="center";const names=[["EMBER KEY",600,160],["DOWNTOWN",600,200],["SUNKEN GARDENS",600,525],["MARINA",600,565],["CINDER KEY",1025,230],["NEON MILE",175,240],["GATOR HAMMOCK",250,960],["AIRSTRIP CAY",850,1045],["LIGHTHOUSE",1025,635],["POINT",1025,675]];for(const n of names){const tx=mx(n[1]),ty=my(n[2]);ctx.fillStyle="rgba(0,0,0,0.45)";const tw=ctx.measureText(n[0]).width+10;ctx.fillRect(tx-tw/2,ty-13,tw,17);ctx.fillStyle="#fff";ctx.fillText(n[0],tx,ty);}}
 if(opts&&opts.big){ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillStyle="rgba(16,22,30,0.88)";ctx.font="700 "+Math.max(11,W*0.016)+"px system-ui";
  const vNames=["GULL ST","NEON AVE","EMBER BLVD","MARINA ROW","CINDER RD","BREAKWATER RD"];
  ROAD_COORDS.forEach(function(c,i){ctx.save();ctx.translate(mx(c)+W*0.017,my(640));ctx.rotate(-Math.PI/2);ctx.fillText(vNames[i],0,0);ctx.restore();});
  const hNames=["OLD MILL ST","CORAL ST","HARBOUR ST","TIDEWATER ST","PALM ST","AIRSTRIP RD"];
  ROAD_COORDS.forEach(function(c,i){ctx.fillText(hNames[i],mx(338),my(c)-W*0.009);});
  ctx.fillStyle="#ffd98a";ctx.font="800 "+Math.max(11,W*0.017)+"px system-ui";
  const stats=[["NEUTRAL · 58",600,238],["FRIENDLY · 74",600,602],["HOSTILE · 22",1025,268],["NEUTRAL · 51",175,278],["NEUTRAL · 44",250,998],["FRIENDLY · 68",850,1082],["FRIENDLY · 71",1025,712]];
  for(const st2 of stats)ctx.fillText(st2[0],mx(st2[1]),my(st2[2]));
  const icons=[["R",120,330,"#ffb340"],["R",1105,765,"#ffb340"],["R",850,1050,"#ffb340"],["P",765,600,"#7fe7d2"],["P",1000,300,"#7fe7d2"],["S",810,520,"#ff9ff3"],["S",1150,645,"#ff9ff3"],["H",430,260,"#a8e6a1"]];
  for(const ic of icons){const ix=mx(ic[1]),iy=my(ic[2]);ctx.fillStyle=ic[3];ctx.beginPath();ctx.arc(ix,iy,Math.max(9,W*0.015),0,7);ctx.fill();ctx.strokeStyle="#10131a";ctx.lineWidth=2;ctx.stroke();ctx.fillStyle="#10131a";ctx.font="900 "+Math.max(11,W*0.017)+"px system-ui";ctx.fillText(ic[0],ix,iy+1);}}
 if(opts&&opts.route){ctx.strokeStyle="#ffb340";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(mx(620),my(580));ctx.lineTo(mx(600),my(300));ctx.lineTo(mx(700),my(300));ctx.lineTo(mx(1000),my(250));ctx.stroke();ctx.fillStyle="#ffb340";ctx.beginPath();ctx.arc(mx(606),my(545),6,0,7);ctx.fill();}
 if(opts&&opts.police){ctx.fillStyle="#4da3ff";for(const p of opts.police){ctx.beginPath();ctx.arc(mx(p.x),my(p.y),4,0,7);ctx.fill();}}
 if(opts&&opts.player){const px=mx(opts.player.x),py=my(opts.player.y);ctx.fillStyle="#ff8c1a";ctx.beginPath();ctx.moveTo(px,py-9);ctx.lineTo(px-6,py+7);ctx.lineTo(px+6,py+7);ctx.closePath();ctx.fill();ctx.strokeStyle="#fff";ctx.stroke();}
 return ctx;}
function updateMinimap(state){const cv=el("minimap");if(!cv)return;drawStreetGridOnCanvas(cv,{player:state.player,police:state.policeCars||[],route:true});}
function updateHudForState(state){setText("clockText",state.clock);setText("cashText","$"+state.cash.toLocaleString("en-US"));
 const stars=el("wantedStars");if(stars){stars.innerHTML="";for(let i=0;i<5;i++){const s=document.createElement("span");s.textContent="★";if(i>=state.wanted)s.className="off";stars.appendChild(s);}}
 const airLine=el("airUnitLine");if(airLine)airLine.classList.toggle("hidden",state.wanted<4);
 setText("missionTitle",state.mission.title);setText("missionStage","STAGE "+(state.stageIndex+1)+"/"+state.mission.stages.length);
 const st=state.mission.stages[state.stageIndex];setText("missionObjective",st.objective);setText("missionNext","NEXT  "+st.next);
 const ek=el("ekpdList");if(ek){ek.innerHTML="";if(state.wanted>0){for(const u of POLICE_UNITS){const d=document.createElement("div");d.className="ekrow";const call=document.createElement("span");call.className="ekcall";call.textContent=u.call;const chip=document.createElement("span");chip.className="chip chip-"+u.role.toLowerCase();chip.textContent=u.role;const dist=document.createElement("span");dist.className="ekdist";dist.textContent=u.dist;d.appendChild(call);d.appendChild(chip);d.appendChild(dist);ek.appendChild(d);}}}
 const segs=el("stageSegs");if(segs){for(let i=0;i<segs.children.length;i++)segs.children[i].className=i<=state.stageIndex?"on":"";}
 setText("timerChip","⏱ "+["3:12","2:58","2:47","2:05"][Math.min(3,state.stageIndex)]);
 el("ekpdPanel").classList.toggle("hidden",state.wanted===0);
 const wl=el("weaponList");if(wl&&!wl.children.length){WEAPONS.forEach((w,i)=>{const d=document.createElement("div");d.textContent=w.slot+"  "+w.name+"  "+w.ammo;if(i===2)d.className="sel";wl.appendChild(d);});}
 const cc=el("crewList");if(cc&&!cc.children.length){const AV_BG=["linear-gradient(160deg,#f2a03d,#c94f2e)","linear-gradient(160deg,#3fa7a0,#1d5e6e)"];CREW.forEach(function(c,ci){const card=document.createElement("div");card.className="crewcard";card.innerHTML="";const av=document.createElement("div");av.className="avatar";av.style.background=AV_BG[ci%AV_BG.length];av.textContent=c.initial;const tx=document.createElement("div");const b=document.createElement("b");b.textContent=c.initial+"  "+c.name;const sp=document.createElement("span");sp.textContent=c.role+" · "+c.status+" (key "+c.key+")";tx.appendChild(b);tx.appendChild(sp);card.appendChild(av);card.appendChild(tx);cc.appendChild(card);});}
 setText("districtName",districtAt(state.player.x,state.player.y).short);const dd=districtAt(state.player.x,state.player.y);setText("districtFriend",dd.friend+" · "+dd.score);
 setText("healthText","Health "+state.health);setText("armourText","Armour "+state.armour);el("healthFill").style.width=state.health+"%";el("armourFill").style.width=state.armour+"%";
 setText("speedText",Math.round(state.speed)+" km/h");setText("vehicleName",state.inCar?"RUNNER GT":"ON FOOT");setText("vehicleCond",state.inCar?"CONDITION 84%":"WASD walk · E enter car");
 if(st.dialogue){setText("dialogueWho",st.dialogue.who);setText("dialogueText",st.dialogue.text);el("dialogue").classList.remove("hidden");}else el("dialogue").classList.add("hidden");
 updateMinimap(state);}
function fillSaveSlotCards(containerId){const c=el(containerId);if(!c)return;c.innerHTML="";for(const s of SAVE_SLOTS){const d=document.createElement("div");d.className="slotcard";const b=document.createElement("b");b.textContent=s.label;const p=document.createElement("p");p.textContent=s.detail;d.appendChild(b);d.appendChild(p);if(containerId==="menuSlots"){const btn=document.createElement("button");btn.className="saveBtn";btn.textContent="SAVE";d.appendChild(btn);}c.appendChild(d);}}
function showOnlyHudSections(showHud,showTitle,showMenu){el("hud").classList.toggle("hidden",!showHud);el("titleScreen").classList.toggle("hidden",!showTitle);el("pauseMenu").classList.toggle("hidden",!showMenu);}
