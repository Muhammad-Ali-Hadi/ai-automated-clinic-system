import crypto from 'node:crypto';
export const hashToken=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
