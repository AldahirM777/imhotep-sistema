import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
export const { handlers, auth, signIn, signOut } = NextAuth({
 trustHost:true, session:{strategy:'jwt',maxAge:60*60*8}, pages:{signIn:'/login'},
 providers:[Credentials({credentials:{email:{label:'Correo',type:'email'},password:{label:'Contraseña',type:'password'}},async authorize(credentials){
  const parsed=z.object({email:z.string().email(),password:z.string().min(1)}).safeParse(credentials);
  if(!parsed?.success)return null;
  const user=await prisma.usuario.findUnique({where:{email:parsed.data.email.toLowerCase()},include:{rol:true}});
  if(!user?.activo || (user?.bloqueadoHasta && user.bloqueadoHasta>new Date()))return null;
  const valid=await bcrypt.compare(parsed.data.password,user.passwordHash);
  if(!valid){await prisma.usuario.update({where:{id:user.id},data:{intentosFallidos:{increment:1},bloqueadoHasta:user.intentosFallidos>=4?new Date(Date.now()+900000):null}});await prisma.auditoria.create({data:{usuarioId:user.id,accion:'LOGIN_FALLIDO',entidad:'Usuario',entidadId:user.id}});return null;}
  await prisma.usuario.update({where:{id:user.id},data:{intentosFallidos:0,bloqueadoHasta:null,ultimoAcceso:new Date()}});
  await prisma.auditoria.create({data:{usuarioId:user.id,accion:'LOGIN',entidad:'Usuario',entidadId:user.id}});
  return {id:user.id,email:user.email,name:user.nombre,role:user.rol.codigo};
 }} )],
 callbacks:{async jwt({token,user}) {if(user){token.id=user.id;token.role=(user as any)?.role;}return token;},async session({session,token}){if(session?.user){(session.user as any).id=token?.id;(session.user as any).role=token?.role;}return session;}}
});
