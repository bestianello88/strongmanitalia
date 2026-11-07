import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function createServer(root = fileURLToPath(new URL('./dist/', import.meta.url))) {
  const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
  return http.createServer(async (req,res)=>{
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405, {Allow:'GET, HEAD'}); res.end(); return;}
    let pathname;
    try { pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch {res.writeHead(400);res.end('Bad request');return;}
    const filename=path.resolve(root, '.'+(pathname==='/'?'/index.html':pathname));
    if (!filename.startsWith(path.resolve(root)+path.sep)) {res.writeHead(403);res.end('Forbidden');return;}
    try {const bytes=await readFile(filename);res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer'});res.end(req.method==='HEAD'?undefined:bytes);}
    catch {res.writeHead(404);res.end('Not found');}
  });
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const server=createServer();
  const port=Number(process.env.PORT)||4173;
  server.listen(port,'127.0.0.1',()=>console.log(`strongmanitalia: http://127.0.0.1:${port}`));
}
