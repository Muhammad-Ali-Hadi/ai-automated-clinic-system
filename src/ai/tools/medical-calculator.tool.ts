/**
 * @module ai/tools/medical-calculator.tool
 * @description Deterministic medical calculation tools for agent use.
 * These tools are called by agents for precise numeric tasks — not by LLMs directly.
 *
 * Examples: BMI, eGFR, dosage adjustment, BSA (Mosteller formula).
 */

export interface BMIResult {
  bmi: number;
  category: 'underweight' | 'normal' | 'overweight' | 'obese';
}

export interface EGFRResult {
  egfr: number;
  ckdStage: 'G1' | 'G2' | 'G3a' | 'G3b' | 'G4' | 'G5';
  description: string;
}

export interface BSAResult {
  bsaM2: number;
}

/**
 * Body Mass Index calculation.
 * @param weightKg  Weight in kilograms
 * @param heightM   Height in meters
 */
export function calculateBMI(weightKg: number, heightM: number): BMIResult {
  if (heightM <= 0 || weightKg <= 0) throw new RangeError('Weight and height must be positive.');
  const bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;

  let category: BMIResult['category'];
  if (bmi < 18.5) category = 'underweight';
  else if (bmi < 25) category = 'normal';
  else if (bmi < 30) category = 'overweight';
  else category = 'obese';

  return { bmi, category };
}

/**
 * CKD-EPI eGFR (2021 race-free equation).
 * @param creatinine  Serum creatinine in mg/dL
 * @param age         Age in years
 * @param isFemale    Biological sex (affects creatinine kappa/alpha)
 */
export function calculateEGFR(creatinine: number, age: number, isFemale: boolean): EGFRResult {
  const kappa = isFemale ? 0.7 : 0.9;
  const alpha = isFemale ? -0.241 : -0.302;
  const ratio = creatinine / kappa;

  const egfrRaw =
    142 *
    Math.pow(Math.min(ratio, 1), alpha) *
    Math.pow(Math.max(ratio, 1), -1.2) *
    Math.pow(0.9938, age);

  const egfr = Math.round(egfrRaw);

  let ckdStage: EGFRResult['ckdStage'];
  let description: string;

  if (egfr >= 90)      { ckdStage = 'G1'; description = 'Normal or high (≥90 mL/min/1.73m²)'; }
  else if (egfr >= 60) { ckdStage = 'G2'; description = 'Mildly decreased (60–89)'; }
  else if (egfr >= 45) { ckdStage = 'G3a'; description = 'Mildly to moderately decreased (45–59)'; }
  else if (egfr >= 30) { ckdStage = 'G3b'; description = 'Moderately to severely decreased (30–44)'; }
  else if (egfr >= 15) { ckdStage = 'G4'; description = 'Severely decreased (15–29)'; }
  else                 { ckdStage = 'G5'; description = 'Kidney failure (<15)'; }

  return { egfr, ckdStage, description };
}

/**
 * Body Surface Area — Mosteller formula.
 * @param weightKg  Weight in kilograms
 * @param heightCm  Height in centimetres
 */
export function calculateBSA(weightKg: number, heightCm: number): BSAResult {
  if (weightKg <= 0 || heightCm <= 0) throw new RangeError('Weight and height must be positive.');
  const bsaM2 = Math.sqrt((heightCm * weightKg) / 3_600);
  return { bsaM2: Math.round(bsaM2 * 100) / 100 };
}

/** Tool manifest for agent registration. */
export const MEDICAL_CALCULATOR_TOOLS = [
  {
    name: 'calculate_bmi',
    description: 'Calculates BMI and returns weight category.',
    parameters: { weightKg: 'number', heightM: 'number' },
    fn: (args: { weightKg: number; heightM: number }) => calculateBMI(args.weightKg, args.heightM),
  },
  {
    name: 'calculate_egfr',
    description: 'Estimates eGFR using CKD-EPI 2021 equation and returns CKD stage.',
    parameters: { creatinine: 'number', age: 'number', isFemale: 'boolean' },
    fn: (args: { creatinine: number; age: number; isFemale: boolean }) =>
      calculateEGFR(args.creatinine, args.age, args.isFemale),
  },
  {
    name: 'calculate_bsa',
    description: 'Calculates body surface area (Mosteller) in m².',
    parameters: { weightKg: 'number', heightCm: 'number' },
    fn: (args: { weightKg: number; heightCm: number }) => calculateBSA(args.weightKg, args.heightCm),
  },
];
