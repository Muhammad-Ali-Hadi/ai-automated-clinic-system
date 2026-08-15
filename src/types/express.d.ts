import type { Role } from '@prisma/client';
declare global { namespace Express { interface Request { auth?: { userId:string; hospitalId:string|null; role:Role; sessionId:string }; } } }
export {};
