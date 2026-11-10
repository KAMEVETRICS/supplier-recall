import {ZodError} from 'zod';
import {ProviderError} from './providers/http';
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store'}});}
export function respondError(error:unknown){
  const code=error instanceof ProviderError?error.code:error instanceof ZodError?'invalid_input':'unavailable';
  const status=code==='unauthorized'?401:code==='forbidden'?403:code==='rate_limited'?429:code==='not_found'?404:code==='invalid_input'?400:code==='conflict'?409:503;
  return Response.json({error:code,message:error instanceof ZodError?error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join(';'):code.replaceAll('_',' ')},{status,headers:{'Cache-Control':'no-store',...(error instanceof ProviderError&&error.retryAfterSeconds?{'Retry-After':String(error.retryAfterSeconds)}:{})}});
}
export async function readJson(request:Request):Promise<unknown>{
  if(!request.headers.get('content-type')?.includes('application/json'))throw new ProviderError('invalid_input');
  const reader=request.body?.getReader();if(!reader)throw new ProviderError('invalid_input');let size=0;const chunks:Uint8Array[]=[];
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>110000){await reader.cancel();throw new ProviderError('invalid_input');}chunks.push(value);}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{throw new ProviderError('invalid_input');}
}
