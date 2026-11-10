import {isIP} from 'node:net';
import type {AppConfig} from '../config';
import {ProviderError} from '../providers/http';
export function loginSource(request:Request,config:AppConfig):string{
 if(config.trustedSourceHeader){const value=request.headers.get(config.trustedSourceHeader)?.trim()??'';if(!isIP(value))throw new ProviderError('forbidden');return value.toLowerCase();}
 // Local development is one trusted source. Public deployments must configure
 // a proxy-owned header that the proxy overwrites, never an arbitrary client header.
 if(['127.0.0.1','localhost','[::1]'].includes(new URL(config.origin).hostname))return 'local';
 throw new ProviderError('not_configured');
}
