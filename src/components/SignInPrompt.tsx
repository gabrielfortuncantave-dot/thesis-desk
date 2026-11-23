import { useState } from 'react'
import { AuthOverlay } from 'deepspace'
import { Button } from '@/components/ui'

/** Shown in place of a form to signed-out visitors: the board is public, acting on it is not. */
export function SignInPrompt({ what }: { what: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="text-sm text-muted-foreground">
      <p>Sign in to {what}.</p>
      <Button className="mt-3" onClick={() => setOpen(true)} data-testid="inline-sign-in">
        Sign in
      </Button>
      {open && <AuthOverlay onClose={() => setOpen(false)} />}
    </div>
  )
}
