/**
 * Sign-in lands on /home (see oauth-complete in src/server/http-routes.ts).
 * The app has one working surface, so send people straight to it.
 */

import { Navigate } from 'react-router-dom'

export default function HomePage() {
  return <Navigate to="/desk" replace />
}
