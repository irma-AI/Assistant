import { expect, test } from 'vitest'
import { permissionText, swedishError } from '#/api/permissions'
import { permission } from '#/api/schemas'
import { permissions } from './access.server'

test('every permission in the code list has a Swedish label and help text', () => {
  expect([...permission.options].sort()).toEqual([...permissions].sort())
  for (const p of permissions) {
    expect(permissionText[p].label).not.toBe('')
    expect(permissionText[p].help).not.toBe('')
  }
})

test('the server refusals are shown in Swedish', () => {
  expect(swedishError('last_owner')).toBe(
    'Organisationen måste ha minst en Ägare.',
  )
  expect(swedishError('role_in_use')).toMatch(/Byt medlemmens roll/)
  expect(swedishError('something_new')).toBe('Något gick fel. Försök igen.')
})
