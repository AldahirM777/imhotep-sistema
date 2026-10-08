import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { Actor,AppError,requirePermission,scope } from './access';
import { Delivery } from './schemas';
export type Tx=Prisma.TransactionClient;
export async function transaction<T>(fn:(tx:Tx)=>Promise<T>):Promise<T>{for(let attempt=0;attempt<3;attempt++){try{return await prisma.$transaction(fn,{isolationLevel:'Serializable',timeout:25000,maxWait:10000});}catch(e:any){if(e?.code!=='P2034'||attempt===2)throw e;}}throw new AppError(409,'Hubo otro movimiento al mismo tiempo. Intenta de nuevo.');}
export async function nextFolio(tx:Tx,serie:string,almacenClave:string){const anio=new Date().getFullYear();const row=await tx.contadorFolio.upsert({where:{serie_almacenClave_anio:{serie,almacenClave,anio}},create:{serie,almacenClave,anio,ultimo:1},update:{ultimo:{increment:1}}});return serie==='VAL'?`VAL-${anio}-${String(row.ultimo).padStart(4,'0')}`:`${serie}-${almacenClave}-${anio}-${String(row.ultimo).padStart(6,'0')}`;}
export async function stock(tx:Tx,warehouse:string,article:string,variant?:string){return tx.existencia.upsert({where:{almacenId_articuloId_varianteClave:{almacenId:warehouse,articuloId:article,varianteClave:variant??''}},create:{almacenId:warehouse,articuloId:article,varianteId:variant??null,varianteClave:variant??'',cantidad:0},update:{}});}
export async function metrics(tx:Tx,warehouse:string,type:'entregas'|'devoluciones'|'traspasos',value:number,assigned=0,at=new Date()) {const dia=at.toISOString().slice(0,10);await tx.metricaDiaria.upsert({where:{almacenId_dia:{almacenId:warehouse,dia}},create:{almacenId:warehouse,dia,[type]:1},update:{[type]:{increment:1}}});await tx.resumenAlmacen.upsert({where:{almacenId:warehouse},create:{almacenId:warehouse,valor:value,piezasPrestadas:assigned},update:{valor:{increment:value},piezasPrestadas:{increment:assigned}}});}
export async function updateStockAlert(tx:Tx,s:any,articleName:string){const key=`STOCK:${s?.id}`;if(Number(s?.cantidad)<Number(s?.stockMinimo)){await tx.alerta.upsert({where:{claveDeduplicacion:key},create:{claveDeduplicacion:key,tipo:'STOCK_MINIMO',severidad:'ADVERTENCIA',almacenId:s.almacenId,articuloId:s.articuloId,mensaje:`${articleName}: quedan ${s.cantidad} (mínimo ${s.stockMinimo}).`},update:{resuelta:false,mensaje:`${articleName}: quedan ${s.cantidad} (mínimo ${s.stockMinimo}).`}});}else await tx.alerta.updateMany({where:{claveDeduplicacion:key,resuelta:false},data:{resuelta:true,resueltaEn:new Date()}});}
export async function evaluate(tx:Tx,data:Delivery){
 const avisos:{codigo:string;mensaje:string}[]=[],bloqueos:{codigo:string;mensaje:string}[]=[];
 const employee=await tx.empleado.findUnique({where:{id:data.empleadoId},include:{capacitaciones:{include:{curso:true}}}});
 if(!employee?.activo||employee.estatus==='BAJA')throw new AppError(422,'El trabajador no está activo. Revisa su ficha con RH.');
 const warehouse=await tx.almacen.findUnique({where:{id:data.almacenId}});if(!warehouse?.activo)throw new AppError(422,'Selecciona un almacén activo.');
 const seen=new Set<string>();let requiresPhoto=false;const rows:any[]=[];
 for(const l of data.renglones){
  const key=`${l.articuloId}:${l.piezaId??''}:${l.varianteId??''}`;if(seen.has(key))throw new AppError(422,'Hay artículos repetidos. Agrupa sus cantidades.');seen.add(key);
  const article=await tx.articulo.findUnique({where:{id:l.articuloId}});if(!article?.activo)throw new AppError(422,'Uno de los artículos ya no está disponible.');
  if(Number(article.costoPromedio)>=Number(process.env.FOTO_OBLIGATORIA_UMBRAL_MXN??5000))requiresPhoto=true;
  if(l.varianteId){const v=await tx.varianteArticulo.findUnique({where:{id:l.varianteId}});if(!v?.activo||v?.articuloId!==article.id)throw new AppError(422,'La talla o variante no corresponde al artículo.');}
  const exist=await tx.existencia.findUnique({where:{almacenId_articuloId_varianteClave:{almacenId:data.almacenId,articuloId:article.id,varianteClave:l.varianteId??''}}});
  if(!exist||Number(exist.cantidad)<l.cantidad)bloqueos.push({codigo:'STOCK_INSUFICIENTE',mensaje:`${article.nombre}: no hay existencia suficiente. Disponible: ${exist?.cantidad??0}.`});
  let piece:any=null;
  if(article.modoControl==='SERIE'){
   if(!l.piezaId||l.cantidad!==1)throw new AppError(422,'Selecciona una pieza con serie y cantidad 1.');
   piece=await tx.pieza.findUnique({where:{id:l.piezaId}});
   if(!piece?.activo||piece.articuloId!==article.id||piece.almacenId!==data.almacenId||piece.ubicacion!=='EN_ALMACEN')bloqueos.push({codigo:'PIEZA_NO_DISPONIBLE',mensaje:'La pieza no está disponible en este almacén.'});
   if(article.esAlturas){
    if(piece?.estado!=='APTA')bloqueos.push({codigo:'PIEZA_NO_APTA',mensaje:`${piece?.codigoInterno??'Equipo'} no apto. Sepáralo y envíalo a inspección.`});
    if(!piece?.proximaInspeccion||piece.proximaInspeccion<new Date())bloqueos.push({codigo:'INSPECCION_VENCIDA',mensaje:'Inspección vencida o inexistente. Registra una inspección antes de entregar.'});
    if(piece?.fechaCaducidad&&piece.fechaCaducidad<new Date())bloqueos.push({codigo:'PIEZA_CADUCADA',mensaje:'El equipo de alturas está caducado.'});
    if(process.env.ALTURAS_BLOQUEA_POR_CAPACITACION!=='false')for(const course of ['CBS-EXT','ALTURAS']){if(!employee.capacitaciones.some((c:any)=>c?.curso?.clave===course&&c.vigenciaHasta>new Date()))bloqueos.push({codigo:'CAPACITACION_ALTURAS',mensaje:`El trabajador no tiene vigente el curso ${course==='ALTURAS'?'de alturas':'básico de seguridad'}.`});}
   }
  }
  if(exist&&Number(exist.cantidad)-l.cantidad<Number(exist.stockMinimo))avisos.push({codigo:'STOCK_BAJO',mensaje:`${article.nombre}: quedarán ${Number(exist.cantidad)-l.cantidad}; mínimo ${exist.stockMinimo}.`});
  if(article.limiteCantidad&&article.limitePeriodoDias){
   const past=await tx.movimientoDetalle.aggregate({where:{articuloId:article.id,movimiento:{empleadoId:employee.id,tipo:'ENTREGA',estado:'VIGENTE',fecha:{gte:new Date(Date.now()-article.limitePeriodoDias*86400000)}}},_sum:{cantidad:true}});
   if(Number(past?._sum?.cantidad??0)+l.cantidad>Number(article.limiteCantidad))avisos.push({codigo:'LIMITE_PERIODO',mensaje:`${article.nombre}: recibió ${past?._sum?.cantidad??0}; con esta entrega supera ${article.limiteCantidad} en ${article.limitePeriodoDias} días.`});
  }
  if(article.requiereAutorizacion){const approved=data.solicitudId?await tx.solicitud.findFirst({where:{id:data.solicitudId,estado:'APROBADA',empleadoId:employee.id,almacenId:warehouse.id,actualizadoEn:{gte:new Date(Date.now()-7*86400000)},renglones:{some:{articuloId:article.id,cantidadAprobada:{gte:l.cantidad}}}}}):null;if(!approved)avisos.push({codigo:'SIN_AUTORIZACION',mensaje:`${article.nombre}: no tiene una autorización vigente. Puedes continuar con justificación.`});}
  if(article.esRetornable&&await tx.asignacion.findFirst({where:{empleadoId:employee.id,articuloId:article.id,cerrada:false,saldo:{gt:0}}}))avisos.push({codigo:'SALDO_PENDIENTE',mensaje:`Ya tiene ${article.nombre} pendiente de devolver.`});
  if(l.estadoSalida==='REGULAR')avisos.push({codigo:'ESTADO_SALIDA_REGULAR',mensaje:`${article.nombre} sale en estado regular.`});
  rows.push({line:l,article,exist,piece});
 }
 if(employee.fechaTerminacion&&employee.fechaTerminacion<new Date(Date.now()+7*86400000))avisos.push({codigo:'CONTRATO_POR_VENCER',mensaje:'El contrato del trabajador está por terminar.'});
 return {avisos,bloqueos,requiresPhoto,rows,employee,warehouse};
}
export async function confirmDelivery(a:Actor,draftId:string,evidence:any){requirePermission(a,'entregas.crear');return transaction(async(tx:Tx)=>{
 const draft=await tx.borradorEntrega.findUnique({where:{id:draftId}});if(!draft||draft.usuarioId!==a.id)throw new AppError(404,'No encontramos este borrador.');scope(a,draft.almacenId);
 if(draft.confirmado){return tx.movimiento.findUnique({where:{borradorId:draft.id}});}
 const data=draft.datos as unknown as Delivery;const evaluated=await evaluate(tx,data);
 if(evaluated.bloqueos.length)throw new AppError(422,'Revisa los bloqueos antes de continuar.',evaluated.bloqueos);
 if(evaluated.avisos.length){requirePermission(a,'avisos.continuar');if(!data.continuarConAvisos)throw new AppError(409,'Confirma los avisos.',evaluated.avisos);if(evaluated.avisos.some((w:any)=>['LIMITE_PERIODO','SIN_AUTORIZACION'].includes(w.codigo))&&!data.justificacionAvisos.trim())throw new AppError(422,'Escribe una justificación para continuar.');}
 for(const id of [data.firmaArchivoId,evidence?.fotoFirmadaId,...(evaluated.requiresPhoto?[data.fotoArticuloId]:[])]){if(!id)throw new AppError(422,'Falta la firma o una fotografía obligatoria.');const f=await tx.archivo.findFirst({where:{id,usuarioId:a.id,contentType:{in:['image/jpeg','image/png','image/webp']}}});if(!f)throw new AppError(422,'Vuelve a subir la evidencia desde tu cuenta.');}
 const evidencePdf=await tx.archivo.findFirst({where:{id:evidence?.evidenciaPdfId,usuarioId:a.id,contentType:'application/pdf'}});if(!evidencePdf)throw new AppError(422,'Falta convertir la evidencia firmada a PDF.');
 const movement=await tx.movimiento.create({data:{folio:draft.folio,tipo:'ENTREGA',almacenId:data.almacenId,empleadoId:data.empleadoId,usuarioId:a.id,borradorId:draft.id,observaciones:data.observaciones,motivo:data.justificacionAvisos,avisoExcedido:!!evaluated.avisos.length,avisos:evaluated.avisos,fechaCompromisoDevolucion:data.fechaCompromisoDevolucion?new Date(data.fechaCompromisoDevolucion):null,evidenciaFirmaPdf:evidencePdf.cloud_storage_path,evidenciaFirmaTipo:evidence.tipo,fotoArticuloId:data.fotoArticuloId,firmaArchivoId:data.firmaArchivoId,comprobanteArchivoId:evidence.comprobanteArchivoId,tiempoEntregaSegundos:Math.round((Date.now()-draft.creadoEn.getTime())/1000)}});
 let value=0,assigned=0;
 for(const row of evaluated.rows){const {article,line,exist,piece}=row;
  const updated=await tx.existencia.update({where:{id:exist.id},data:{cantidad:{decrement:line.cantidad}}});
  await tx.movimientoDetalle.create({data:{movimientoId:movement.id,articuloId:article.id,piezaId:piece?.id,varianteId:line.varianteId,cantidad:line.cantidad,costoUnitario:article.costoPromedio,estadoSalida:line.estadoSalida,saldoAlmacenDespues:updated.cantidad}});
  if(piece)await tx.pieza.update({where:{id:piece.id},data:{ubicacion:'ASIGNADA',empleadoAsignadoId:data.empleadoId}});
  if(article.esRetornable){await tx.asignacion.create({data:{empleadoId:data.empleadoId,articuloId:article.id,piezaId:piece?.id,varianteId:line.varianteId,almacenOrigenId:data.almacenId,movimientoEntregaId:movement.id,cantidadEntregada:line.cantidad,saldo:line.cantidad,esRetornable:true,fechaEntrega:movement.fecha,fechaCompromiso:movement.fechaCompromisoDevolucion,fotoEntregaId:data.fotoArticuloId}});assigned+=line.cantidad;}
  value-=Number(article.costoPromedio)*line.cantidad;await updateStockAlert(tx,updated,article.nombre);
 }
 await metrics(tx,data.almacenId,'entregas',value,assigned);
 await tx.borradorEntrega.update({where:{id:draft.id},data:{confirmado:true}});
 await tx.auditoria.create({data:{usuarioId:a.id,accion:evaluated.avisos.length?'AVISO_IGNORADO':'ENTREGA',entidad:'Movimiento',entidadId:movement.id,despues:{folio:movement.folio,justificacion:data.justificacionAvisos,avisos:evaluated.avisos}}});
 return movement;
 });}
export async function returnItems(a:Actor,data:any){requirePermission(a,'devoluciones.crear');return transaction(async(tx:Tx)=>{
 const done=await tx.operacionUnica.findUnique({where:{id:`${a.id}:${data.operacionId}`}});if(done)return tx.movimiento.findUnique({where:{id:done.movimientoId}});
 const asg=await tx.asignacion.findUnique({where:{id:data.asignacionId}});if(!asg||asg.cerrada||Number(asg.saldo)<data.cantidad)throw new AppError(422,'La cantidad es mayor que el saldo pendiente.');scope(a,asg.almacenOrigenId);
 const art=await tx.articulo.findUniqueOrThrow({where:{id:asg.articuloId}});const wh=await tx.almacen.findUniqueOrThrow({where:{id:asg.almacenOrigenId}});const good=['NUEVO','BUENO','REGULAR'].includes(data.estado),lost=data.estado==='PERDIDO';
 const available=good&&!art.esAlturas;const ex=await stock(tx,wh.id,art.id,asg.varianteId??undefined);
 const updated=await tx.existencia.update({where:{id:ex.id},data:{cantidad:{increment:available?data.cantidad:0},cantidadNoDisponible:{increment:!available&&!lost?data.cantidad:0}}});
 const movement=await tx.movimiento.create({data:{folio:await nextFolio(tx,'DV',wh.clave),tipo:'DEVOLUCION',almacenId:wh.id,empleadoId:asg.empleadoId,usuarioId:a.id,observaciones:data.observaciones,detalles:{create:{articuloId:art.id,piezaId:asg.piezaId,varianteId:asg.varianteId,cantidad:data.cantidad,costoUnitario:art.costoPromedio,estadoRetorno:data.estado,saldoAlmacenDespues:updated.cantidad,asignacionId:asg.id}}}});
 await tx.asignacion.update({where:{id:asg.id},data:{saldo:{decrement:data.cantidad},cantidadDevuelta:{increment:lost?0:data.cantidad},cantidadPerdida:{increment:lost?data.cantidad:0},cerrada:Number(asg.saldo)===data.cantidad,fotoRetornoId:data.fotoRetornoId}});
 if(asg.piezaId){await tx.pieza.update({where:{id:asg.piezaId},data:{empleadoAsignadoId:null,ubicacion:lost?'FUERA_DE_SERVICIO':good?'EN_ALMACEN':'EN_REPARACION',estado:lost?'PERDIDA':art.esAlturas&&good?'EN_INSPECCION':good?'APTA':'EN_REPARACION'}});if(!good&&!lost)await tx.mantenimiento.create({data:{piezaId:asg.piezaId,tipo:'CORRECTIVO',fechaEnvio:new Date(),registradoPorId:a.id}});}
 await metrics(tx,wh.id,'devoluciones',available?data.cantidad*Number(art.costoPromedio):0,-data.cantidad);await updateStockAlert(tx,updated,art.nombre);
 await tx.operacionUnica.create({data:{id:`${a.id}:${data.operacionId}`,movimientoId:movement.id}});
 await tx.auditoria.create({data:{usuarioId:a.id,accion:'DEVOLUCION',entidad:'Movimiento',entidadId:movement.id}});return movement;
 });}
export async function sendTransfer(a:Actor,data:any){requirePermission(a,'traspasos.crear');scope(a,data.almacenId);if(data.almacenId===data.destinoId)throw new AppError(422,'Elige un almacén de destino diferente.');return transaction(async(tx:Tx)=>{
 const wh=await tx.almacen.findUniqueOrThrow({where:{id:data.almacenId}});const dest=await tx.almacen.findFirst({where:{id:data.destinoId,activo:true}});if(!dest)throw new AppError(422,'El almacén de destino no está activo.');
 const tr=await tx.traspaso.create({data:{folio:await nextFolio(tx,'TR',wh.clave),almacenOrigenId:wh.id,almacenDestinoId:dest.id,enviadoPorId:a.id}});
 const m=await tx.movimiento.create({data:{folio:tr.folio,tipo:'TRASPASO_SALIDA',almacenId:wh.id,almacenDestinoId:dest.id,usuarioId:a.id,traspasoId:tr.id}});let value=0;const seen=new Set<string>();
 for(const row of data.renglones){if(seen.has(row.articuloId))throw new AppError(422,'No repitas el artículo en el traspaso.');seen.add(row.articuloId);const art=await tx.articulo.findUniqueOrThrow({where:{id:row.articuloId}});if(art.modoControl==='SERIE')throw new AppError(422,'El traspaso de piezas por serie no está habilitado en esta versión.');const ex=await stock(tx,wh.id,art.id);if(Number(ex.cantidad)<row.cantidad)throw new AppError(422,'No hay existencia suficiente para el traspaso.');const to=await stock(tx,dest.id,art.id);const updated=await tx.existencia.update({where:{id:ex.id},data:{cantidad:{decrement:row.cantidad}}});await tx.existencia.update({where:{id:to.id},data:{cantidadTransito:{increment:row.cantidad}}});await tx.movimientoDetalle.create({data:{movimientoId:m.id,articuloId:art.id,cantidad:row.cantidad,costoUnitario:art.costoPromedio,saldoAlmacenDespues:updated.cantidad}});value-=Number(art.costoPromedio)*row.cantidad;await updateStockAlert(tx,updated,art.nombre);}
 await tx.traspaso.update({where:{id:tr.id},data:{movimientoSalidaId:m.id}});await metrics(tx,wh.id,'traspasos',value);return tr;
 });}
export async function receiveTransfer(a:Actor,id:string,rows:any[]){requirePermission(a,'traspasos.recibir');return transaction(async(tx:Tx)=>{
 const tr=await tx.traspaso.findUnique({where:{id}});if(!tr||tr.estado!=='EN_TRANSITO')throw new AppError(422,'Este traspaso ya fue recibido o no existe.');scope(a,tr.almacenDestinoId);
 const wh=await tx.almacen.findUniqueOrThrow({where:{id:tr.almacenDestinoId}});const sent=await tx.movimientoDetalle.findMany({where:{movimientoId:tr.movimientoSalidaId??''}});let value=0;const differences:any[]=[];
 const m=await tx.movimiento.create({data:{folio:await nextFolio(tx,'RE',wh.clave),tipo:'TRASPASO_ENTRADA',almacenId:wh.id,usuarioId:a.id,traspasoId:id}});
 for(const d of sent){const row=rows.find((r:any)=>r?.articuloId===d.articuloId);const qty=Number(row?.cantidad??d.cantidad);if(qty<0||qty>Number(d.cantidad))throw new AppError(422,'Revisa las cantidades recibidas.');const ex=await stock(tx,wh.id,d.articuloId);const updated=await tx.existencia.update({where:{id:ex.id},data:{cantidadTransito:{decrement:d.cantidad},cantidad:{increment:qty}}});if(qty>0)await tx.movimientoDetalle.create({data:{movimientoId:m.id,articuloId:d.articuloId,cantidad:qty,costoUnitario:d.costoUnitario,saldoAlmacenDespues:updated.cantidad}});value+=qty*Number(d.costoUnitario);if(qty!==Number(d.cantidad))differences.push({articuloId:d.articuloId,enviado:Number(d.cantidad),recibido:qty,motivo:row?.motivo??'Diferencia reportada al recibir'});}
 const result=await tx.traspaso.update({where:{id},data:{estado:differences.length?'RECIBIDO_CON_DIFERENCIA':'RECIBIDO',recibidoPorId:a.id,fechaRecepcion:new Date(),movimientoEntradaId:m.id,diferencias:differences}});
 if(differences.length)await tx.alerta.create({data:{claveDeduplicacion:`TR:${id}`,tipo:'TRASPASO_SIN_RECIBIR',severidad:'ADVERTENCIA',almacenId:wh.id,mensaje:`${tr.folio}: recibido con diferencias.`,datos:differences}});await metrics(tx,wh.id,'traspasos',value);return result;
 });}
