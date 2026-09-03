import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/cn';

export function FieldShell({
  label,
  error,
  hint,
  required,
  children,
  className,
}: {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <span className="label">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapClassName?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, required, wrapClassName, className, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={wrapClassName}>
      <input
        ref={ref}
        required={required}
        className={cn('input', error && 'border-rose-400 focus:border-rose-400 focus:ring-rose-200', className)}
        {...rest}
      />
    </FieldShell>
  );
});

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapClassName?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, required, wrapClassName, className, options, placeholder, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={wrapClassName}>
      <select
        ref={ref}
        required={required}
        className={cn('input', error && 'border-rose-400', className)}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
});

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapClassName?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, error, hint, required, wrapClassName, className, rows = 3, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={wrapClassName}>
      <textarea
        ref={ref}
        rows={rows}
        required={required}
        className={cn('input resize-y', error && 'border-rose-400', className)}
        {...rest}
      />
    </FieldShell>
  );
});
