import type { Response } from 'express';
export const ok = <T>(res:Response, data:T, message='Operation completed successfully.', status=200, meta?:Record<string, unknown>) => res.status(status).json({success:true,message,data,...(meta ? {meta}: {})});
export const fail = (res:Response, message:string, statusCode=400, errors:unknown[]=[])=>(res.status(statusCode).json({success:false,message,errors,statusCode}));
