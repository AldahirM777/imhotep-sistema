import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import {Toaster} from '@/components/ui/sonner';
import {ChunkLoadErrorHandler} from '@/components/chunk-load-error-handler';
const inter=Inter({subsets:['latin'],variable:'--font-sans'});
export const dynamic='force-dynamic';
export const metadata:Metadata={metadataBase:new URL(process.env.NEXTAUTH_URL??'http://localhost:3000'),title:'IMHOTEP | Control de Herramientas y EPP',description:'Control de almacenes, herramientas y equipo de protección personal.',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'},openGraph:{title:'IMHOTEP Control',images:['/og-image.png']}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es" suppressHydrationWarning><head><script src="https://apps.abacus.ai/chatllm/appllm-lib.js" async /></head><body className={`${inter.variable} font-sans`}>{children}<Toaster richColors duration={5000}/><ChunkLoadErrorHandler/></body></html>;}
