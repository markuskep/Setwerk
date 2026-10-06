import { createHmac } from 'node:crypto';
import core from '../../Setwerk-Webapp-1.2.0-Projektdateien/dist/cloud-core.js';
const LIMIT=1024*1024;
const reply=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
export function createHandler({getUser,fetcher=fetch,env=process.env}){
  return async request=>{
    if(!['GET','POST'].includes(request.method))return reply(405,{error:'method'});
    const origin=new URL(request.url).origin;
    if(request.method==='POST'&&request.headers.get('origin')!==origin)return reply(403,{error:'origin'});
    let user;try{user=await getUser();}catch{return reply(401,{error:'unauthorized'});}
    if(!user?.id||typeof user.id!=='string'||! /^[A-Za-z0-9_-]{1,100}$/.test(user.id))return reply(401,{error:'unauthorized'});
    const endpoint=env.SETWERK_SHEETS_URL,secret=env.SETWERK_SHEETS_SECRET;
    if(!endpoint||!secret||secret.length<32)return reply(503,{error:'not-configured'});
    let url;try{url=new URL(endpoint);}catch{return reply(503,{error:'not-configured'});}
    if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname))return reply(503,{error:'not-configured'});
    const payload={version:1,operation:request.method==='GET'?'read':'write',userId:user.id,timestamp:Date.now()};
    if(request.method==='POST'){
      if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'json-required'});
      if(Number(request.headers.get('content-length'))>LIMIT)return reply(413,{error:'too-large'});
      let body;try{const raw=await request.text();if(Buffer.byteLength(raw,'utf8')>LIMIT)return reply(413,{error:'too-large'});body=JSON.parse(raw);core.validate(body.data);}catch{return reply(400,{error:'invalid-state'});}
      if(!Number.isSafeInteger(body.revision)||body.revision<0)return reply(400,{error:'invalid-revision'});
      payload.revision=body.revision;payload.data=body.data;
      // The owner comes exclusively from verified Netlify Identity, never the client body.
    }
    const serialized=JSON.stringify(payload),signature=createHmac('sha256',secret).update(serialized).digest('base64url');
    try{
      const response=await fetcher(url.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload:serialized,signature}),redirect:'follow',signal:AbortSignal.timeout(20000)});
      if(!response.ok)return reply(502,{error:'upstream'});
      const result=await response.json();
      if(result.status===409)return reply(409,{error:'conflict'});
      if(result.status!==200||!Number.isSafeInteger(result.revision)||result.revision<0)return reply(502,{error:'upstream'});
      if(result.data)core.validate(result.data);
      return reply(200,{revision:result.revision,data:result.data||null});
    }catch{return reply(502,{error:'unavailable'});}
  };
}
