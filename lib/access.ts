import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { basePermissions,globalRoles } from '@/lib/permissions';
export class AppError extends Error {constructor(public status:number,message:string,public details:unknown=null){super(message);}}
export type Actor={id:string;name:string;email:string;role:string;permissions:string[];warehouseIds:string[];employeeId:string|null;mustChange:boolean};
export async function getActor():Promise<Actor>{const s=await auth();const id=(s?.user as any)?.id;if(!id)throw new AppError(401,'Inicia sesión para continuar.');return actorById(id);}
export async function actorById(id:string):Promise<Actor>{
 const u=await prisma.usuario.findUnique({where:{id},include:{rol:true,almacenes:true,permisos:{include:{permiso:true}}}});
 if(!u?.activo)throw new AppError(401,'Tu cuenta está inactiva. Contacta a Recursos Humanos.');
 const perms=new Set(basePermissions?.[u?.rol?.codigo] ?? []);
 for(const p of u?.permisos ?? []){if(!p?.vigenteHasta || p.vigenteHasta>new Date()){if(p?.concedido)perms.add(p.permiso.codigo);else perms.delete(p.permiso.codigo);}}
 return {id:u.id,name:u.nombre,email:u.email ?? '',role:u.rol.codigo,permissions:[...perms],warehouseIds:u.almacenes.map((x:any)=>x?.almacenId),employeeId:u.empleadoId,mustChange:u.debeCambiarPassword};
}
export function requirePermission(a:Actor,p:string){if(!a?.permissions?.includes(p))throw new AppError(403,'No tienes permiso para hacer esto. Pide ayuda a tu jefe.');}
export function scope(a:Actor,id:string){if(!globalRoles.includes(a?.role) && !a?.warehouseIds?.includes(id))throw new AppError(403,'Este almacén no está asignado a tu cuenta.');}
export function warehouseWhere(a:Actor,id?:string|null){if(id && id!=='all'){scope(a,id);return {almacenId:id};}return globalRoles.includes(a?.role)?{}:{almacenId:{in:a?.warehouseIds ?? []}};}
export async function audit(a:Actor,accion:string,entidad:string,entidadId?:string,despues?:any){await prisma.auditoria.create({data:{usuarioId:a.id,accion,entidad,entidadId,despues}});}
export function jsonSafe(data:unknown):any {try{return JSON.parse(JSON.stringify(data,(_key:string,value:any)=>typeof value==='bigint'?String(value):value));}catch{return null;}}
