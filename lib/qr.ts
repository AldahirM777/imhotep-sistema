import { createHmac,timingSafeEqual } from 'crypto';
import { AppError } from './access';
export function qr(type:string,id:string){const sig=createHmac('sha256',process.env.AUTH_SECRET ?? '').update(`${type}:${id}`).digest('hex').slice(0,16);return `IMH1:${type}:${id}:${sig}`;}
export function readQr(value:string){const parts=value?.split(':') ?? [];if(parts[0]!=='IMH1')return null;if(parts.length!==4)throw new AppError(400,'El código QR no es válido.');const expected=qr(parts[1],parts[2]);if(expected.length!==value.length || !timingSafeEqual(Buffer.from(expected),Buffer.from(value)))throw new AppError(400,'El código QR no es válido.');return {type:parts[1],id:parts[2]};}
