export function isMenuConfirm(code: string): boolean {
  return code === 'KeyJ' || code === 'Enter' || code === 'Space'
}

export function isMenuCancel(code: string): boolean {
  return code === 'KeyK' || code === 'Escape'
}
