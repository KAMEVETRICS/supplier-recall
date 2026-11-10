import { cp,mkdir } from 'node:fs/promises';
import path from 'node:path';
if(process.platform==='win32'){
  const destination=path.resolve('node_modules/next/wasm/@next/swc-wasm-nodejs');
  await mkdir(destination,{recursive:true});
  await cp(path.resolve('node_modules/@next/swc-wasm-nodejs'),destination,{recursive:true});
  console.log('Official Next.js WASM fallback is available.');
}
