import {RequestError,type ClientTransport} from '@stars/client-core';

export async function readJson(url:string,init?:RequestInit):Promise<unknown>{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15_000);
  try{
    const response=await fetch(url,{...init,signal:controller.signal});
    const body:unknown=await response.json().catch(()=>null);
    if(!response.ok){
      const code=(body as {error?:{code?:unknown}}|null)?.error?.code;
      throw new RequestError(typeof code==='string'?code:`HTTP ${response.status}`,response.status);
    }
    return body;
  }finally{clearTimeout(timeout);}
}
export const webTransport:ClientTransport={
  request:(path,request)=>readJson(path,{
    method:request.method,
    headers:{Authorization:`Bearer ${request.token}`,...(request.body?{'Content-Type':'application/json'}:{})},
    ...(request.body?{body:request.body}:{}),
  }),
};
export function uuidv7():string{
  const bytes=crypto.getRandomValues(new Uint8Array(16));let timestamp=BigInt(Date.now());
  for(let i=5;i>=0;i--){bytes[i]=Number(timestamp&255n);timestamp>>=8n;}
  bytes[6]=(bytes[6]!&15)|112;bytes[8]=(bytes[8]!&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
