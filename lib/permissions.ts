export const roles = ['ADMIN_PRINCIPAL','ADMIN','SUPERVISOR_GENERAL','SUPERVISOR','ALMACENISTA','RH','COMPRAS','TRABAJADOR'] as const;
export type Role = typeof roles[number];
export const roleNames: Record<string,string> = { ADMIN_PRINCIPAL:'Administrador principal',ADMIN:'Administrador',SUPERVISOR_GENERAL:'Supervisor general',SUPERVISOR:'Supervisor',ALMACENISTA:'Almacenista',RH:'Recursos Humanos',COMPRAS:'Compras',TRABAJADOR:'Trabajador' };
export const levels: Record<string,number> = {ADMIN_PRINCIPAL:100,ADMIN:90,SUPERVISOR_GENERAL:70,SUPERVISOR:50,ALMACENISTA:30,RH:30,COMPRAS:30,TRABAJADOR:10};
const read = ['inventario.ver','empleados.ver','movimientos.ver','documentos.ver','solicitudes.ver','almacenes.ver','piezas.ver'];
export const basePermissions: Record<string,string[]> = {
 ADMIN_PRINCIPAL: [...read,'dashboard.ver','visor.ver','usuarios.ver','usuarios.aprobar','usuarios.eliminar','usuarios.reactivar','permisos.delegar','almacenes.gestionar','articulos.gestionar','empleados.gestionar','entregas.crear','devoluciones.crear','traspasos.crear','traspasos.recibir','solicitudes.crear','solicitudes.aprobar','inspecciones.registrar','reportes.ver','auditoria.ver','bajas.iniciar','bajas.cerrar','bajas.forzar','compras.ver','compras.gestionar','capacitaciones.registrar','kits.gestionar','avisos.continuar','movimientos.cancelar','entradas.registrar','entradas.autorizar','etiquetas.imprimir'],
 ADMIN: [], SUPERVISOR_GENERAL: [...read,'dashboard.ver','visor.ver','usuarios.ver','usuarios.aprobar','permisos.delegar','solicitudes.crear','solicitudes.aprobar','reportes.ver','bajas.iniciar','entradas.autorizar','kits.gestionar'],
 SUPERVISOR: [...read,'dashboard.ver','visor.ver','usuarios.ver','permisos.delegar','solicitudes.crear','solicitudes.aprobar','reportes.ver','bajas.iniciar','entradas.autorizar'],
 ALMACENISTA: [...read,'articulos.gestionar','entregas.crear','devoluciones.crear','traspasos.crear','traspasos.recibir','solicitudes.crear','inspecciones.registrar','kits.gestionar','avisos.continuar','entradas.registrar','etiquetas.imprimir','bajas.cerrar'],
 RH: ['empleados.ver','empleados.gestionar','capacitaciones.registrar','usuarios.ver','usuarios.crear','bajas.iniciar','documentos.ver','reportes.ver','visor.ver','almacenes.ver','inventario.ver','movimientos.ver','solicitudes.ver'],
 COMPRAS: ['compras.ver','compras.gestionar','inventario.ver','almacenes.ver','reportes.ver','visor.ver','empleados.ver','movimientos.ver','documentos.ver','solicitudes.ver'],
 TRABAJADOR: ['resguardo.ver','documentos.ver','solicitudes.crear','solicitudes.ver']
};
basePermissions.ADMIN = (basePermissions?.ADMIN_PRINCIPAL ?? []).filter((p:string)=>!['usuarios.reactivar','bajas.forzar'].includes(p));
export const nonDelegable = ['usuarios.crear','usuarios.aprobar','usuarios.eliminar','usuarios.reactivar','bajas.forzar','dashboard.ver','visor.ver','permisos.delegar'];
export const allPermissions = Array.from(new Set(Object.values(basePermissions).flat()));
export const globalRoles = ['ADMIN_PRINCIPAL','ADMIN','SUPERVISOR_GENERAL','RH','COMPRAS'];
export function homeFor(role:string) { return role==='RH'?'empleados':role==='COMPRAS'?'compras':role==='TRABAJADOR'?'mi-equipo':role==='ALMACENISTA'?'operacion':'dashboard'; }
export function canApprove(role:string,target:string) { const table:Record<string,string[]> = {SUPERVISOR:['ADMIN','SUPERVISOR_GENERAL','ADMIN_PRINCIPAL'],SUPERVISOR_GENERAL:['ADMIN','ADMIN_PRINCIPAL'],ADMIN:['ADMIN_PRINCIPAL'],RH:['ADMIN','ADMIN_PRINCIPAL']};return (table?.[target] ?? []).includes(role); }
export const pagePermissions:Record<string,string>={dashboard:'dashboard.ver',operacion:'inventario.ver',inventario:'inventario.ver',almacenes:'almacenes.ver',empleados:'empleados.ver',entregas:'entregas.crear',devoluciones:'devoluciones.crear',movimientos:'movimientos.ver',traspasos:'traspasos.crear',solicitudes:'solicitudes.ver',usuarios:'usuarios.ver',visor:'visor.ver',reportes:'reportes.ver',documentos:'documentos.ver',piezas:'piezas.ver',bajas:'bajas.iniciar',compras:'compras.ver',auditoria:'auditoria.ver','mi-equipo':'resguardo.ver',etiquetas:'etiquetas.imprimir',configuracion:'usuarios.ver',entradas:'inventario.ver'};
