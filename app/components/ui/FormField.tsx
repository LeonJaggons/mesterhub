'use client'

export const FIELD_CLASSES = 'w-full border border-gray-200 rounded-md px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100'

export function Field({ label, htmlFor, required, optional, hint, children }: {
  label: string
  htmlFor: string
  required?: boolean
  optional?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-bold text-gray-700">
        {label} {required && <span className="text-sky-500">*</span>}
        {optional && <span className="text-gray-400 font-normal"> ({optional})</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${FIELD_CLASSES} ${props.className ?? ''}`} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${FIELD_CLASSES} resize-none ${props.className ?? ''}`} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${FIELD_CLASSES} bg-white ${props.className ?? ''}`} />
}

export function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-red-500">{children}</p>
}
