import type { ComponentProps } from 'react'

// A label that is always visible, and the error right under the field.
export function Field({
  label,
  error,
  ...input
}: { label: string; error?: string } & ComponentProps<'input'>) {
  return (
    <label>
      {label}
      <input aria-invalid={error ? true : undefined} {...input} />
      {error && (
        <span role="alert" className="error">
          {error}
        </span>
      )}
    </label>
  )
}
