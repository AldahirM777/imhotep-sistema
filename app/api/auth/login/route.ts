import { signIn } from '@/auth';
import { NextResponse } from 'next/server';
export async function POST(request:Request){try{const body=await request.json();await signIn('credentials',{email:body?.email,password:body?.password,redirect:false});return NextResponse.json({ok:true});}catch(error){console.error('Inicio de sesión rechazado');return NextResponse.json({error:{mensaje:'Correo o contraseña incorrectos.'}},{status:401});}}
