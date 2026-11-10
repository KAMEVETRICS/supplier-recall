import {beforeEach,afterEach,describe,it,expect} from 'vitest';
import {createRepository,type Repository} from '../src/server/db/repository';
import {AuthService,hashPassword} from '../src/server/auth/session';
import {authorizeRequest} from '../src/server/auth/guard';
import {loadConfig} from '../src/server/config';
import {loginSource} from '../src/server/auth/source';
let repo:Repository;
beforeEach(async()=>{repo=await createRepository({url:'file::memory:'});});afterEach(()=>repo.close());
function service(now=Date.parse('2026-11-08T12:00:00Z')){return new AuthService(repo,{...loadConfig({}),mode:'live',passwordHash:hashPassword('correct horse battery'),sessionSecret:'a'.repeat(64)},()=>now);}
describe('operator access',()=>{
  it('requires a proxy-owned source header for public login',()=>{const request=new Request('https://recall.example/api/session',{headers:{'x-real-ip':'198.51.100.2'}});const config=loadConfig({APP_ORIGIN:'https://recall.example'});expect(()=>loginSource(request,config)).toThrow();expect(loginSource(request,{...config,trustedSourceHeader:'x-real-ip'})).toBe('198.51.100.2');expect(()=>loginSource(new Request(request.url,{headers:{'x-real-ip':'bad, forwarded'}}),{...config,trustedSourceHeader:'x-real-ip'})).toThrow();});
  it('does not let one source lock out a different legitimate source',async()=>{const auth=service();for(let i=0;i<5;i++)await expect(auth.authenticate('wrong','198.51.100.1')).rejects.toMatchObject({code:'unauthorized'});await expect(auth.authenticate('correct horse battery','198.51.100.2')).resolves.toHaveProperty('token');});
  it('reserves concurrent login attempts atomically',async()=>{const auth=service();const results=await Promise.allSettled(Array.from({length:12},()=>auth.authenticate('wrong')));expect(results.filter(r=>r.status==='rejected'&&r.reason.code==='unauthorized')).toHaveLength(5);});
  it('requires a valid session and expires it after eight hours',async()=>{const auth=service();await expect(auth.verify('forged')).rejects.toMatchObject({code:'unauthorized'});const session=await auth.authenticate('correct horse battery');expect((await auth.verify(session.token)).storeId).toBe('operator');await expect(service(Date.parse('2026-11-09T12:00:00Z')).verify(session.token)).rejects.toMatchObject({code:'unauthorized'});});
  it('rejects a foreign-origin mutation even with a session',async()=>{const auth=service();const s=await auth.authenticate('correct horse battery');const request=new Request('http://127.0.0.1:3000/api/briefs',{method:'POST',headers:{Origin:'https://attacker.example',Cookie:`recall_session=${s.token}`}});await expect(authorizeRequest(request,auth,'http://127.0.0.1:3000')).rejects.toMatchObject({code:'forbidden'});});
  it('limits incorrect login attempts and invalidates logout',async()=>{const auth=service();const s=await auth.authenticate('correct horse battery');await auth.logout(s.token);await expect(auth.verify(s.token)).rejects.toMatchObject({code:'unauthorized'});for(let i=0;i<5;i++)await expect(auth.authenticate('wrong')).rejects.toMatchObject({code:'unauthorized'});await expect(auth.authenticate('wrong')).rejects.toMatchObject({code:'rate_limited'});});
  it('uses atomic budgets rather than per-process counters',async()=>{const auth=service();const outcomes=await Promise.allSettled(Array.from({length:11},()=>auth.reserve('operator','research',10)));expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(10);});
});
