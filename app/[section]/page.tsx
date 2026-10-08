import {redirect,notFound} from 'next/navigation';
import {getActor,jsonSafe} from '@/lib/access';
import {pagePermissions,homeFor} from '@/lib/permissions';
import AppClient from '@/components/imhotep/app-client';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;let actor;try{actor=await getActor();}catch{redirect('/login');}if(!pagePermissions[section])notFound();if(section!=='configuracion'&&!actor.permissions.includes(pagePermissions[section]))redirect(`/${homeFor(actor.role)}`);if(actor.mustChange&&section!=='configuracion')redirect('/configuracion');return <AppClient actor={jsonSafe(actor)} section={section}/>;}
