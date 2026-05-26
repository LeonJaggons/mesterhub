type Primitive = string | number | boolean | null | undefined
type Messages = Record<string, unknown>
type Params = Record<string, Primitive>

function resolveMessage(messages: Messages, key: string): unknown {
  return key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Messages)[part]
  }, messages)
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template

  return template.replace(/\{(\w+)\}/g, (match, paramName: string) => {
    const value = params[paramName]
    return value === undefined || value === null ? match : String(value)
  })
}

export function createTranslator(messages: Messages) {
  return function t(key: string, params?: Params): string {
    const message = resolveMessage(messages, key)

    if (typeof message !== 'string') {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`Missing translation for "${key}"`)
      }
      return key
    }

    return interpolate(message, params)
  }
}
