import { describe, expect, it } from 'vitest';
import { openapi } from '../docs/openapi.js';
import { routeOperations } from '../docs/route-manifest.js';

describe('OpenAPI completeness', () => {
  it('documents every mutation body or explicitly documents a bodyless action', () => {
    const bodyless = new Set([
      'POST /api/v1/patients/{patientId}/archive',
      'POST /api/v1/appointments/{appointmentId}/check-in',
      'POST /api/v1/appointments/{appointmentId}/check-out',
      'POST /api/v1/lab-tests/{id}/approve',
      'POST /api/v1/auth/logout', 'POST /api/v1/auth/logout-all', 'POST /api/v1/auth/verify-email/request',
      'POST /api/v1/employees/{employeeId}/attendance/check-in', 'POST /api/v1/employees/{employeeId}/attendance/check-out',
      'POST /api/v1/employees/{employeeId}/leave/{leaveId}/approve', 'POST /api/v1/employees/{employeeId}/leave/{leaveId}/reject',
      'POST /api/v1/insurance-claims/{id}/approve', 'POST /api/v1/lab-tests/{id}/collect', 'POST /api/v1/lab-tests/{id}/process', 'POST /api/v1/lab-tests/{id}/cancel',
      'POST /api/v1/medicines/dispense/{prescriptionId}', 'POST /api/v1/medicines/purchase-orders/{poId}/receive',
      'POST /api/v1/notifications/{id}/read', 'POST /api/v1/notifications/{id}/unread',
    ]);
    const missing: string[] = [];
    const generic: string[] = [];
    const document = openapi as typeof openapi & { paths?: Record<string, Record<string, any>> };
    for (const [path, item] of Object.entries(document.paths ?? {})) {
      for (const method of ['post', 'put', 'patch']) {
        const operation = (item as Record<string, any>)[method];
        if (!operation) continue;
        const key = `${method.toUpperCase()} ${path}`;
        if (!operation.requestBody && !bodyless.has(key)) missing.push(key);
        if (operation.requestBody?.content?.['application/json']?.schema?.additionalProperties === true) generic.push(key);
      }
    }
    expect(missing).toEqual([]);
    expect(generic).toEqual([]);
  });

  it('documents public registration and authentication operations', () => {
    const document = openapi as typeof openapi & { paths: Record<string, Record<string, any>> };
    expect(document.paths['/api/v1/auth/register']?.post?.security).toEqual([]);
    expect(document.paths['/api/v1/auth/register']?.post?.requestBody).toBeDefined();
    expect(document.paths['/api/v1/auth/login']?.post?.requestBody).toBeDefined();
  });

  it('documents every route operation from the mounted route manifest', () => {
    const document = openapi as typeof openapi & { paths: Record<string, Record<string, any>> };
    const missing = routeOperations.filter((route) => {
      const path = route.path;
      return !document.paths[path]?.[route.method.toLowerCase()];
    });
    expect(missing).toEqual([]);
  });
});
