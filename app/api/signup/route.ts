import {NextResponse} from 'next/server';
import {getActor} from '@/lib/access';
import {requestUser} from '@/lib/user-service';
import {registerSchema} from '@/lib/schemas';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{const a=await getActor();return NextResponse.json(await requestUser(a,registerSchema.parse(await request.json())));}catch(e:any){return NextResponse.json({error:{mensaje:e?.message??'Solo Recursos Humanos puede crear cuentas.'}},{status:e?.status??403});}}
