import {loginSource} from '@/server/auth/source';
import {z} from 'zod';
import {getRuntime} from '@/server/runtime';
import {checkOrigin,sessionToken} from '@/server/auth/guard';
import {json,readJson,respondError} from '@/server/http';
export const runtime='nodejs';
export async function POST(request:Request){try{const {auth,config}=await getRuntime();checkOrigin(request,config.origin);const {password}=z.object({password:z.string().min(1).max(1024)}).parse(await readJson(request));const s=await auth.authenticate(password,loginSource(request,config));const response=json({signedIn:true});response.headers.set('Set-Cookie',`recall_session=${s.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV==='production'?'; Secure':''}`);return response;}catch(e){return respondError(e);}}
export async function DELETE(request:Request){try{const {auth,config}=await getRuntime();checkOrigin(request,config.origin);await auth.logout(sessionToken(request));const response=json({signedIn:false});response.headers.set('Set-Cookie','recall_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return response;}catch(e){return respondError(e);}}
