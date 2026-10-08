import { PutObjectCommand,GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash,randomUUID } from 'crypto';
import {createS3Client,getBucketConfig} from './aws-config';
import {prisma} from './db';
const client=createS3Client();
export async function storeFile(userId:string,name:string,contentType:string,buffer:Buffer){const {bucketName,folderPrefix}=getBucketConfig();const cloud_storage_path=`${folderPrefix}uploads/${Date.now()}-${randomUUID()}-${name.replace(/[^a-zA-Z0-9.-]/g,'_')}`;await client.send(new PutObjectCommand({Bucket:bucketName,Key:cloud_storage_path,Body:buffer,ContentType:contentType}));return prisma.archivo.create({data:{usuarioId:userId,nombre:name,contentType,cloud_storage_path,isPublic:false,hash:createHash('sha256').update(buffer).digest('hex'),bytes:buffer.length}});}
export async function fileUrl(file:any,download=false){return getSignedUrl(client,new GetObjectCommand({Bucket:getBucketConfig().bucketName,Key:file?.cloud_storage_path,ResponseContentDisposition:download?`attachment; filename="${String(file?.nombre ?? 'archivo').replace(/[^a-zA-Z0-9.-]/g,'_')}"`:'inline'}),{expiresIn:300});}
export async function fileBuffer(id:string){const file=await prisma.archivo.findUniqueOrThrow({where:{id}});const result=await client.send(new GetObjectCommand({Bucket:getBucketConfig().bucketName,Key:file.cloud_storage_path}));return {file,buffer:Buffer.from(await result.Body!.transformToByteArray())};}
