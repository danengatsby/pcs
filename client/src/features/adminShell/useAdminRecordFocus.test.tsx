import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useAdminRecordFocus } from './useAdminRecordFocus'

it('focuses a selected record once, without jumping back on a data refresh', () => {
  const scroll = vi.fn()
  function Records({ selected }: { selected: string | null }) {
    useAdminRecordFocus(selected)
    return <>{['first', 'second'].map((id) => <article id={id} key={id} aria-label={id} tabIndex={-1}
      ref={(element) => { if (element) element.scrollIntoView = scroll }} />)}</>
  }
  const { rerender } = render(<Records selected={null} />)
  expect(scroll).not.toHaveBeenCalled()
  rerender(<Records selected="first" />)
  expect(screen.getByRole('article', { name: 'first' })).toHaveFocus()
  expect(scroll).toHaveBeenCalledTimes(1)
  rerender(<Records selected="first" />)
  expect(scroll).toHaveBeenCalledTimes(1)
  rerender(<Records selected="second" />)
  expect(screen.getByRole('article', { name: 'second' })).toHaveFocus()
  expect(scroll).toHaveBeenCalledTimes(2)
})
