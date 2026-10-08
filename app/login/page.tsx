import {auth} from '@/auth';
import {redirect} from 'next/navigation';
import LoginForm from '@/components/imhotep/login-form';
export default async function Login(){const session=await auth();if(session?.user)redirect('/');return <LoginForm/>;}
