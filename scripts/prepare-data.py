from pathlib import Path
import re,json,openpyxl
root=Path(__file__).resolve().parents[1]
spec=(root/'data/references/MegaPrompt_IMHOTEP.md').read_text()
block=spec.split('### 4.1')[1].split('```prisma')[1].split('```')[0]
block=re.sub(r'generator client[^\n]+\n','',block)
block=re.sub(r'datasource db[^\n]+\n','',block)
block=re.sub(r'enum (\w+) \{([^}]+)\}',lambda m:'enum '+m[1]+' {\n'+'\n'.join(m[2].split())+'\n}',block)
original=(root/'prisma/schema.prisma').read_text()
additions={
'Usuario':'  solicitudesCreadas SolicitudRegistroUsuario[] @relation("RegistroCreado")\n  solicitudesAprobadas SolicitudRegistroUsuario[] @relation("RegistroAprobado")\n  oculto Boolean @default(false)\n',
'Almacen':'  eliminadoEn DateTime?\n  kits KitAlmacen[]\n',
'Articulo':'  iconoLucide String @default("Box")\n  eliminadoEn DateTime?\n  kits KitAlmacenArticulo[]\n',
'Existencia':'  varianteClave String @default("")\n  cantidadNoDisponible Decimal @default(0) @db.Decimal(12,3)\n  pasillo String?\n  estante String?\n  nivel String?\n  @@unique([almacenId, articuloId, varianteClave])\n',
'Pieza':'  pasillo String?\n  estante String?\n  nivel String?\n  ubicacionNota String?\n',
'Empleado':'  activo Boolean @default(true)\n  eliminadoEn DateTime?\n  riesgo String @default("VERDE")\n  motivosRiesgo String[]\n',
'Movimiento':'  evidenciaFirmaPdf String?\n  evidenciaFirmaTipo String?\n  fotoArticuloId String?\n  firmaArchivoId String?\n  comprobanteArchivoId String?\n  borradorId String? @unique\n  tiempoEntregaSegundos Int?\n  autorizadoPorNombre String?\n',
'Asignacion':'  fotoEntregaId String?\n  fotoRetornoId String?\n',
'Documento':'  cloud_storage_path String?\n  isPublic Boolean @default(false)\n'}
for model,extra in additions.items():
 block=re.sub(r'(model '+model+r' \{[^\n]*\n)',lambda m:m[1]+extra,block)
# Index all scalar foreign keys and common filters; only add nonredundant field indexes.
for match in list(re.finditer(r'model (\w+) \{(.*?)\n\}',block,re.S))[::-1]:
 name,body=match[1],match[2]
 indices=[]
 for line in body.splitlines():
  words=line.strip().split()
  if len(words)>1:
   field,typ=words[:2]
   if (field.endswith('Id') or field in ['fecha','estado','activo','estatus','creadoEn','nombre','riesgo']) and not any(x in line for x in ['@unique','@id','@relation']):
    if typ.rstrip('?') in ['String','DateTime','Boolean','EstadoSolicitud','EstadoTraspaso','EstadoRequisicion','EstadoBaja','EstatusEmpleado','EstadoPieza'] and f'@@index([{field}' not in body and f'@@unique([{field}' not in body: indices.append('  @@index(['+field+'])')
 block=block[:match.start()]+f'model {name} {{'+body+'\n'+'\n'.join(indices)+'\n}'+block[match.end():]
(root/'prisma/schema.prisma').write_text(original+'\n'+block)
w=openpyxl.load_workbook(root/'data/references/comprasejer2026.xlsx',data_only=True)
rows=[]
for i,r in enumerate(list(w.active.values)[1:],1):
 if not r[1] or not isinstance(r[2],(int,float)):continue
 rows.append({'id':f'excel-{i:04d}','sku':f'ART-{i:05d}','claveCompras':str(r[0] or ''),'nombre':str(r[1]),'cantidad':r[2],'costo':(r[4] or 0)/r[2] if r[2] else 0,'importe':r[4] or 0})
(root/'data/catalogo.json').write_text(json.dumps(rows,ensure_ascii=False))
print('Artículos del Excel:',len(rows),'Importe:',round(sum(r['importe'] for r in rows),2))
