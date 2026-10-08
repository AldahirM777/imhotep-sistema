# IMHOTEP — Sistema de Control de Herramientas y EPP

Sistema web para el control de entregas, devoluciones y gestión de inventario de herramientas y equipo de protección personal (EPP).

## Stack Tecnológico
- Next.js + TypeScript
- Prisma ORM + PostgreSQL
- Tailwind CSS + shadcn/ui
- Lucide React (íconos)

## Características
- Gestión de almacenes múltiples
- Control de entregas y devoluciones con comprobante PDF
- Captura de evidencia fotográfica
- Dashboard con KPIs
- Sistema de roles y permisos (Admin, Supervisor, Almacenista, RH, Compras)
- Responsive para celular, tablet y PC

## Configuración
1. Copia `.env.example` a `.env` y configura las variables
2. `yarn install`
3. `yarn prisma generate && yarn prisma db push`
4. `yarn prisma db seed`
5. `yarn dev`
