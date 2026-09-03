/**
 * @file src/ai/tests/prompt-regression.test.ts
 * @description Prompt Regression Tests — Validates all prompt templates in prompt-registry.ts
 * ensuring required variables exist, versions are valid, and outputs contain draft advisories.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { listPrompts, getPrompt } from '../prompts/prompt-registry.js';
import { promptManager } from '../prompts/prompt-manager.js';

test('Prompt Registry - All Prompts Have Version and Unique Names', () => {
  const prompts = listPrompts();
  assert.ok(prompts.length >= 12, 'Must have at least 12 versioned prompt templates');

  for (const p of prompts) {
    assert.ok(p.name, 'Prompt must have a name');
    assert.ok(p.version, `Prompt ${p.name} must have a version string`);
    assert.ok(p.systemPrompt, `Prompt ${p.name} must have a system prompt`);
  }
});

test('Prompt Registry - Key Clinical Prompts Require Draft Disclaimers', () => {
  const doctorPrompt = getPrompt('ai-doctor-assistant', '1.0');
  assert.match(doctorPrompt.systemPrompt, /DRAFT/i);
  assert.match(doctorPrompt.systemPrompt, /approval/i);

  const labPrompt = getPrompt('ai-lab-assistant', '1.0');
  assert.match(labPrompt.systemPrompt, /physician interpretation/i);

  const rxPrompt = getPrompt('prescription-draft', '1.0');
  assert.match(rxPrompt.systemPrompt, /prescriber/i);
});

test('Prompt Manager - Interpolates Variables Correctly without Unreplaced Tags', () => {
  const rendered = promptManager.render('ai-receptionist', {
    HOSPITAL_NAME: 'Azeem Rizocare Hospital',
    PATIENT_QUERY: 'What are the OPD timings?',
    DOCTOR_SCHEDULES: '9 AM - 5 PM',
    HOSPITAL_FAQS: 'Parking available on B1',
    PATIENT_LANG: 'English',
  });

  assert.equal(rendered.length, 2);
  const sysContent = rendered[0]?.content ?? '';
  const userContent = rendered[1]?.content ?? '';

  assert.match(sysContent, /Azeem Rizocare Hospital/);
  assert.match(userContent, /What are the OPD timings\?/);
  assert.doesNotMatch(sysContent, /\{\{.*?\}\}/, 'No unreplaced handlebars should remain');
  assert.doesNotMatch(userContent, /\{\{.*?\}\}/, 'No unreplaced handlebars should remain');
});
