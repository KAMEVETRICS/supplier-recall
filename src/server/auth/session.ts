import type {Repository} from '../db/repository';
import type {AppConfig} from '../config';
import {scryptSync,randomBytes,timingSafeEqual,createHmac} from 'node:crypto';
import {ProviderError} from '../providers/http';
export function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
export class AuthService{
 constructor(private repo:Repository,private config:AppConfig,private now:()=>number=Date.now){}
 private digest(token:string){return createHmac('sha256',this.config.sessionSecret).update(token).digest('hex');}
 async authenticate(password:string,source='local'):Promise<{token:string;expiresAt:number}>{
   if(this.config.mode!=='live'||!this.config.passwordHash||this.config.sessionSecret.length<32)throw new ProviderError('not_configured');
   const window=Math.floor(this.now()/900000);const failureKey=`login-failures:${this.digest(source)}`;
   const attempts=await this.repo.execute('INSERT INTO budgets(key,window,used) VALUES(?,?,1) ON CONFLICT(key,window) DO UPDATE SET used=used+1 RETURNING used',[failureKey,window]);
   if(Number(attempts.rows[0]?.used??0)>5)throw new ProviderError('rate_limited',900);
   const [salt,hash]=this.config.passwordHash.split(':');
   const stored=Buffer.from(hash??'','hex');const candidate=scryptSync(password.slice(0,1024),salt??'',64);
   if(stored.length!==64||!timingSafeEqual(stored,candidate)){
     throw new ProviderError('unauthorized');
   }
   await this.repo.execute('UPDATE budgets SET used=MAX(0,used-1) WHERE key=? AND window=?',[failureKey,window]);
   const token=randomBytes(32).toString('hex');const expiresAt=this.now()+8*3600000;
   await this.repo.execute('INSERT INTO sessions(token_hash,store_id,expires_at) VALUES(?,?,?)',[this.digest(token),'operator',expiresAt]);return {token,expiresAt};
 }
 async verify(token:string):Promise<{storeId:string;now:string}>{
   if(this.config.mode!=='live'||!/^[a-f0-9]{64}$/.test(token))throw new ProviderError('unauthorized');
   const r=await this.repo.execute('SELECT store_id FROM sessions WHERE token_hash=? AND expires_at>?',[this.digest(token),this.now()]);if(!r.rows.length)throw new ProviderError('unauthorized');return {storeId:String(r.rows[0].store_id),now:new Date(this.now()).toISOString()};
 }
 async logout(token:string){await this.repo.execute('DELETE FROM sessions WHERE token_hash=?',[this.digest(token)]);}
 async reserve(store:string,operation:string,limit:number){
   const window=Math.floor(this.now()/3600000);const r=await this.repo.execute('INSERT INTO budgets(key,window,used) VALUES(?,?,1) ON CONFLICT(key,window) DO UPDATE SET used=used+1 RETURNING used',[`${store}:${operation}`,window]);if(Number(r.rows[0].used)>limit)throw new ProviderError('rate_limited',3600);
 }
}
