import { describe, expect, it } from 'vitest';
import { BriefSchema } from '../src/domain/schemas';
import { createRepository } from '../src/server/db/repository';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const brief = { id:'brief-1', title:'Launch packaging', specification:'Kraft mailer, 9 × 6 × 3 in', quantity:500, destination:'Portland, OR, US', budgetCents:75000, neededBy:'2026-12-01', purpose:'launch' };
describe('validated briefs',()=>{
  it.each([{quantity:0},{quantity:1.5},{budgetCents:-1},{neededBy:'2026-02-30'},{destination:''}])('rejects invalid inputs %j', edits=>expect(BriefSchema.safeParse({...brief,...edits}).success).toBe(false));
  it('persists across connections without exposing another store',async()=>{
    const dir=await mkdtemp(path.join(tmpdir(),'recall-'));
    const repo=await createRepository({url:`file:${path.join(dir,'test.db').replaceAll('\\','/')}`});
    const ctx={storeId:'store-a',now:'2026-11-08T12:00:00Z'};
    await repo.saveBrief(ctx,BriefSchema.parse(brief));
    repo.close();
    const reopened=await createRepository({url:`file:${path.join(dir,'test.db').replaceAll('\\','/')}`});
    expect((await reopened.getBrief(ctx,'brief-1'))?.title).toBe('Launch packaging');
    expect(await reopened.getBrief({...ctx,storeId:'store-b'},'brief-1')).toBeNull();
    reopened.close();
  });
});
