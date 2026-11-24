// capture.mjs — serve game/ locally, screenshot each staged shot, convert to JPG under cap
import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
import { tmpdir } from 'node:os';
const root = resolve(new URL('../game/', import.meta.url).pathname);
const shots = [['cover','1-cover.jpg'],['chase','2-chase.jpg'],['mission','3-mission.jpg'],['menu','4-menu.jpg']];
const MIME = {'.html':'text/html','.css':'text/css','.js':'text/javascript'};
const server = createServer((req,res)=>{ const u=new URL(req.url,'http://x'); let p=u.pathname; if(p.endsWith('/'))p+='index.html'; const f=join(root,p); try{ const data=readFileSync(f); res.writeHead(200,{'content-type':MIME[extname(f)]||'application/octet-stream'}); res.end(data);}catch(e){res.writeHead(404).end('nf');} });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port = server.address().port; console.log('port',port);
mkdirSync(new URL('../screenshots/', import.meta.url).pathname,{recursive:true});
for (const [shot,name] of shots){
  const png = join(tmpdir(), name.replace('.jpg','.png'));
  const shellBin = process.env.HOME+'/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';
  const chromeBin = existsSync(shellBin) ? shellBin : '/opt/meta-chromium/chrome';
  await execFileAsync(chromeBin,['--no-sandbox','--no-proxy-server','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--disable-component-update','--disable-background-networking','--disable-sync','--mute-audio','--hide-scrollbars','--force-device-scale-factor=1','--window-size=1280,720','--virtual-time-budget=9000','--screenshot='+png,`http://127.0.0.1:${port}/index.html?shot=${shot}`],{stdio:'pipe',timeout:60000});
  const out = join(new URL('../screenshots/', import.meta.url).pathname, name);
  const py = `from PIL import Image\nimport os\nim=Image.open(r'${png}').convert('RGB')\nfor q in (82,76,70,62):\n im.save(r'${out}',quality=q)\n if os.path.getsize(r'${out}')<=262144: break\nprint('${name}', os.path.getsize(r'${out}'))`;
  execFileSync('python3',['-c',py],{stdio:'inherit'});
}
server.close();
