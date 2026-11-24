// EMBER KEYS — missions.js : missions, stages, dialogue, police units, crew, weapons
const MISSIONS=[
 {id:"shrimp",title:"SHRIMP ON THE RUN",stages:[
  {objective:"Load crates of frozen shrimp",next:"Load the shrimp crates",marker:{x:606,y:545},dialogue:{who:"Pearl Castellanos",text:"Listen close, Jude. Those crates at Sunken Gardens Marina?"}},
  {objective:"Drive the shrimp to Cinder Key",next:"Reach the Cinder Key drop",marker:{x:1000,y:250},dialogue:{who:"Pearl Castellanos",text:"Wheels up, Jude. Cinder Key buyer pays cash, no questions."}},
  {objective:"Escape the roadblock",next:"Vanish past the roadblock",marker:{x:600,y:120},dialogue:{who:"Pearl Castellanos",text:"Roadblock's set past the marina turn, Jude. Thread the gap or ditch them in Cinder Key — your call."}},
  {objective:"Deliver to the buyer",next:"Park at the lighthouse buyer",marker:{x:1020,y:700},dialogue:{who:"Deckhand",text:"Buyer is waiting at Lighthouse Point. Almost home, Jude."}}]},
 {id:"firstwater",title:"FIRST WATER",stages:[
  {objective:"Meet Pearl at the marina",next:"Talk to Pearl",marker:{x:620,y:580},dialogue:{who:"Pearl Castellanos",text:"First water, first money. You ready, Jude?"}},
  {objective:"Collect the harbour pickup",next:"Grab the pickup",marker:{x:700,y:640},dialogue:{who:"Deckhand",text:"Pickup is on the second boat. Watch the EKPD patrol."}}]},
 {id:"neon",title:"NEON MILE RUN",stages:[
  {objective:"Race the Neon Mile",next:"Hit every checkpoint",marker:{x:175,y:250},dialogue:{who:"Pearl Castellanos",text:"Neon Mile at dusk — everybody will see you. Good."}},
  {objective:"Lose the EKPD",next:"Break line of sight",marker:{x:300,y:900},dialogue:{who:"Deckhand",text:"Cut through Gator Hammock, they hate the mud."}}]}
];
const POLICE_UNITS=[
 {call:"SIREN-4",role:"RAMMING",dist:"8 m"},{call:"SIREN-9",role:"PURSUIT",dist:"12 m"},
 {call:"MARLIN-2",role:"FLANKING",dist:"16 m"},{call:"BLOCK-1",role:"ROADBLOCK",dist:"30 m"},{call:"BLOCK-2",role:"ROADBLOCK",dist:"30 m"}];
const CREW=[
 {key:"Z",initial:"P",name:"PEARL CASTELLANOS",role:"Wheelman",status:"ready"},
 {key:"C",initial:"D",name:"DECKHAND",role:"Lookout",status:"watching"}];
const WEAPONS=[
 {slot:1,name:"FISTS",ammo:"∞"},{slot:2,name:"PISTOL",ammo:"48"},
 {slot:3,name:"SMG",ammo:"30/90"},{slot:4,name:"SAWN-OFF",ammo:"—"}];
const SAVE_SLOTS=[
 {slot:1,label:"SLOT 1 · ACT I — SHRIMP RUN",detail:"32% complete · 1/5 missions · Sunken Gardens · $1,250 · 18:52"},
 {slot:2,label:"SLOT 2 · ACT I — FIRST WATER",detail:"9% complete · 0/5 missions · Downtown · $300 · 09:14"},
 {slot:3,label:"SLOT 3 · EMPTY",detail:"Start a new smuggling run"}];
const ACTIVITY_ROWS=[["Street races",1,4],["Pickups",3,4],["Stunt ramps",2,5]];
const ACTIVITY_NAMES="Neon Mile Sprint · Lighthouse Loop GP · Harbour Leap · +10 more";
const ACTIVITIES=[
 {name:"Neon Mile Sprint",type:"street race",district:"Neon Mile"},
 {name:"Lighthouse Loop GP",type:"street race",district:"Lighthouse Point"},
 {name:"Airstrip Drag — Cay Straight",type:"street race",district:"Airstrip Cay"},
 {name:"Downtown Circuit Dash",type:"street race",district:"Ember Key Downtown"},
 {name:"Shrimp crate pickup — Sunken Gardens Marina",type:"pickup",district:"Sunken Gardens Marina"},
 {name:"Fuel drum pickup — Cinder Key depot",type:"pickup",district:"Cinder Key"},
 {name:"Medicine run — Gator Hammock dock",type:"pickup",district:"Gator Hammock"},
 {name:"Document pickup — Ember Key Downtown",type:"pickup",district:"Ember Key Downtown"},
 {name:"Harbour Leap — Marina north pier",type:"stunt ramp",district:"Sunken Gardens Marina"},
 {name:"Cinder Quarry Ramp",type:"stunt ramp",district:"Cinder Key"},
 {name:"Airstrip Tabletop",type:"stunt ramp",district:"Airstrip Cay"},
 {name:"Neon Rooftop Ramp",type:"stunt ramp",district:"Neon Mile"},
 {name:"Lighthouse Cliff Ramp",type:"stunt ramp",district:"Lighthouse Point"}];
const CAREER_STATS=[["12","DELIVERIES"],["48.2 km","DISTANCE DRIVEN"],["4 STARS","HIGHEST WANTED"],["9","POLICE ESCAPES"],["23","PICKUPS LOADED"],["3","DISTRICTS FRIENDLY"]];
const PROGRESS_ROWS=[["Story missions",1,5],["Free runs",3,8],["Districts visited",4,6],["Pickups delivered",2,6],["Police escapes",5,10],["Crew recruited",2,3]];
