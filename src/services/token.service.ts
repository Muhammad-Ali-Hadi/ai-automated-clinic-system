import jwt from 'jsonwebtoken'; import { env } from '../config/env.js'; import type { Role } from '@prisma/client';
export type TokenClaims={sub:string; hospitalId:string|null; role:Role; sessionId:string};
export const signAccessToken=(claims:TokenClaims)=>jwt.sign(claims,env.JWT_ACCESS_SECRET,{expiresIn:env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn']});
export const signRefreshToken=(claims:TokenClaims)=>jwt.sign(claims,env.JWT_REFRESH_SECRET,{expiresIn:env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn']});
export const verifyAccessToken=(token:string)=>jwt.verify(token,env.JWT_ACCESS_SECRET) as jwt.JwtPayload & TokenClaims;
export const verifyRefreshToken=(token:string)=>jwt.verify(token,env.JWT_REFRESH_SECRET) as jwt.JwtPayload & TokenClaims;
