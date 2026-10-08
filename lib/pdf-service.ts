import pdfMake from 'pdfmake/build/pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import QRCode from 'qrcode';
import { prisma } from './db';
import { fileBuffer } from './storage';
// pdfmake embeds its original Roboto font files, so no system fonts are required.
import fontData from 'pdfmake/build/vfs_fonts';
const vfs=fontData as unknown as Record<string,string>;
export function pdfBuffer(def:TDocumentDefinitions):Promise<Buffer>{return new Promise((resolve,reject)=>{try{(pdfMake as any).createPdf(def,undefined,undefined,vfs).getBuffer((buffer:Uint8Array)=>resolve(Buffer.from(buffer)));}catch(e){reject(e);}});}
export const legalText='El trabajador manifiesta haber recibido el EPP y/o herramientas en óptimas condiciones físicas y operativas, comprometiéndose a su uso obligatorio conforme a la NOM-017-STPS y el reglamento interior de trabajo. En caso de baja laboral, las herramientas y equipos únicos deberán ser devueltos en su totalidad a Almacén.';
export async function receiptPdf(folio:string,data:any,created:Date){
 const [employee,wh]=await Promise.all([prisma.empleado.findUnique({where:{id:data?.empleadoId??''}}),prisma.almacen.findUnique({where:{id:data?.almacenId??''}})]);
 const lines=data?.renglones??[];const articles=await prisma.articulo.findMany({where:{id:{in:lines.map((l:any)=>l?.articuloId)}}});
 const name=`${employee?.nombre??''} ${employee?.apellidoPaterno??''} ${employee?.apellidoMaterno??''}`.trim();let signature:any={text:' ',margin:[0,20,0,20]};
 if(data?.firmaArchivoId){const f=await fileBuffer(data.firmaArchivoId);signature={image:`data:${f.file.contentType};base64,${f.buffer.toString('base64')}`,fit:[150,55]};}
 const head=(t:string)=>({text:t,bold:true,color:'#6b7280',fontSize:9,margin:[0,0,0,8]});
 return pdfBuffer({pageSize:'LETTER',pageMargins:[35,35,35,35],defaultStyle:{font:'Roboto',fontSize:10,color:'#374151'},content:[
 {columns:[{width:65,text:'IMHOTEP',fontSize:11,bold:true,color:'#6b7280'},{width:'*',stack:[{text:'SISTEMA DE CONTROL DE EPP',fontSize:16,bold:true,color:'#111827'},{text:'Vale Oficial de Resguardo, Entrega y Asignación de Equipo',fontSize:8,margin:[0,6,0,0]}]},{width:115,stack:[{text:`FOLIO: ${folio}`,bold:true,fontSize:10,alignment:'right'},{text:created.toLocaleString('es-MX',{timeZone:'America/Monterrey',dateStyle:'short',timeStyle:'short'}),alignment:'right',fontSize:8,margin:[0,6,0,0]}]}]},
 {canvas:[{type:'line',x1:0,y1:14,x2:540,y2:14,lineWidth:1,lineColor:'#d7d7d7'}],margin:[0,0,0,35]},
 {table:{widths:['*','*'],body:[[{stack:[head('TRABAJADOR RECEPTOR'),{text:name,bold:true,fontSize:14},`Gafete / Nómina: #${employee?.numeroEmpleado??''}`,{text:employee?.puesto??'',fontSize:9,margin:[0,5,0,0]}],margin:[12,12,12,12]},{stack:[head('ALMACÉN DESPACHADOR'),{text:wh?.nombre??'',bold:true,fontSize:14},{text:employee?.areaTrabajo??'Área operativa',margin:[0,5,0,0]},{text:'Resguardo asignado',color:'#16834a',fontSize:9,margin:[0,8,0,0]}],margin:[12,12,12,12]}]]},layout:{hLineColor:()=>'#e0e0e0',vLineColor:()=>'#e0e0e0'}},
 {text:'DESGLOSE DE ARTÍCULOS ENTREGADOS',fontSize:9,color:'#6b7280',bold:true,margin:[0,25,0,12]},
 {table:{headerRows:1,widths:[70,'*',100,35],body:[['Código','Descripción','Tipo / Clasificación','Cant.'].map((t:string)=>({text:t,bold:true,fontSize:9,fillColor:'#f3f4f6'})),...lines.map((l:any)=>{const art=articles.find((a:any)=>a?.id===l?.articuloId);return [{text:art?.sku??'',color:'#2A6FB5'},art?.nombre??'',art?.tipo??'',String(l?.cantidad??0)];})]},layout:'lightHorizontalLines'},
 {text:legalText,fontSize:10,lineHeight:1.25,margin:[0,28,0,25]},
 ...(data?.autorizadoPorNombre?[{text:`Autorizado por: ${data.autorizadoPorNombre}`,margin:[0,0,0,10]}]:[]),
 {columns:[{width:'*',stack:[{text:'Firma digital registrada',italics:true,fontSize:9,color:'#6b7280'},signature,{text:'________________________________'},{text:name,bold:true,margin:[0,8,0,3]},{text:'Firma del trabajador receptor',fontSize:9,color:'#6b7280'}]},{width:'*',stack:[{text:'Despachado por almacén',fontSize:10,color:'#16834a'}, {text:' ',margin:[0,20,0,20]},{text:'________________________________'},{text:wh?.nombre??'',bold:true,margin:[0,8,0,3]},{text:'Sello de despacho y registro',fontSize:9,color:'#6b7280'}]}],margin:[0,15,0,0]}
 ] as any});
}
export async function evidencePdf(fileId:string,folio:string){const {file,buffer}=await fileBuffer(fileId);return pdfBuffer({pageSize:'LETTER',content:[{text:`IMHOTEP · Evidencia firmada · ${folio}`,bold:true,margin:[0,0,0,20]},{image:`data:${file.contentType};base64,${buffer.toString('base64')}`,fit:[515,650]}]});}
export async function tablePdf(title:string,headers:string[],rows:any[][]){return pdfBuffer({pageSize:'LETTER',pageOrientation:headers.length>6?'landscape':'portrait',defaultStyle:{font:'Roboto',fontSize:9},content:[{text:'IMHOTEP · '+title,fontSize:17,bold:true,margin:[0,0,0,20]},{table:{headerRows:1,widths:headers.map(()=>'*'),body:[headers.map((h:string)=>({text:h,bold:true,fillColor:'#E1E4E8'})),...rows.map((r:any[])=>r.map((v:any)=>String(v??'')))]},layout:'lightHorizontalLines'}]});}
export async function labelsPdf(items:{name:string;code:string;payload:string}[]){const content:any[]=[];for(let i=0;i<items.length;i+=3){const cells=await Promise.all(items.slice(i,i+3).map(async(item:any)=>({width:170,stack:[{text:'IMHOTEP',bold:true,fontSize:9},{columns:[{image:await QRCode.toDataURL(item.payload),width:62},{stack:[{text:item.code,bold:true,fontSize:9},{text:item.name,fontSize:8}],width:90}]}],margin:[5,7,5,7]})));content.push({columns:cells,pageBreak:i>0&&i%30===0?'before':undefined});}return pdfBuffer({pageSize:'LETTER',pageMargins:[25,20,25,20],content});}
