import {randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {hashPassword} from '../src/server/auth/session';
let env=await readFile('.env.local','utf8').catch(()=>readFile('.env.example','utf8'));
if(/^OPERATOR_PASSWORD_HASH=.+$/m.test(env)&&/^SESSION_SECRET=.+$/m.test(env)){console.log('Operator credentials already configured. Existing values were preserved.');}
else{
 const password=randomBytes(24).toString('base64url');
 for(const [key,value] of Object.entries({OPERATOR_PASSWORD_HASH:hashPassword(password),SESSION_SECRET:randomBytes(48).toString('hex')})){
  const line=new RegExp(`^${key}=.*$`,'m');env=line.test(env)?env.replace(line,`${key}=${value}`):`${env}\n${key}=${value}\n`;
 }
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/operator-password.txt',password+'\n',{mode:0o600});await writeFile('.env.local',env,{mode:0o600});
 console.log('Operator hash and session secret saved in .env.local. Read the generated password locally in artifacts/operator-password.txt; it was not printed.');
}
