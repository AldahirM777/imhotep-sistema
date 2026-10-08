import {redirect} from 'next/navigation';
import {auth} from '@/auth';
import {homeFor} from '@/lib/permissions';
export default async function Page(){const session=await auth();redirect(session?.user?`/${homeFor((session.user as any)?.role??'')}`:'/login');}
