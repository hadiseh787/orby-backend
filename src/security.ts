import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import helmet from '@fastify/helmet';
import {type FastifyInstance} from 'fastify';

export async function registerSecurity(app:FastifyInstance) {
  const nonces=new WeakMap<object,string>();
  app.addHook('onRequest',async req=>{nonces.set(req.raw,randomBytes(24).toString('base64'));});
  await app.register(helmet,{
    crossOriginOpenerPolicy:{policy:'same-origin-allow-popups'},
    contentSecurityPolicy:{useDefaults:false,directives:{
      defaultSrc:["'self'"],
      scriptSrc:["'self'",(req:any)=>"'nonce-"+nonces.get(req)+"'"],
      scriptSrcAttr:["'none'"],styleSrc:["'self'","'unsafe-inline'"],
      imgSrc:["'self'",'data:','blob:','https:'],fontSrc:["'self'",'data:'],
      connectSrc:["'self'",'https:','wss:'],frameSrc:["'self'",'https:'],
      workerSrc:["'self'",'blob:'],objectSrc:["'none'"],baseUri:["'self'"],
      formAction:["'self'",'https:'],frameAncestors:["'none'"],
    }},
  });
  return async function spa(req:any,reply:any,directory:string,status=200) {
    const nonce=nonces.get(req.raw)!;
    const html=(await readFile(join(directory,'index.html'),'utf8'))
      .replace(/<script\b/g,'<script nonce="'+nonce+'"')
      .replace('<app-root','<app-root ngCspNonce="'+nonce+'"')
      .replace('</head>','<meta name="csp-nonce" content="'+nonce+'"></head>');
    return reply.code(status).header('Cache-Control','no-store').type('text/html').send(html);
  };
}
