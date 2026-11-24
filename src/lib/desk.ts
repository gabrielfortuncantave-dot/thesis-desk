import { useQuery } from 'deepspace'
import { DEFAULT_DESK, playbookOf, type Desk, type Playbook } from '../desk/types'

/** The shared thesis, live. Falls back to the default until an admin saves one. */
export function useDesk(): Desk {
  const { records } = useQuery<Desk>('desk')
  const saved = records[0]?.data
  return saved?.criteria?.length ? saved : DEFAULT_DESK
}

/** The vocabulary of the desk's playbook ("Pursue / Skip" or "Invest / Pass", stage names, section titles). */
export function usePlaybook(): Playbook {
  return playbookOf(useDesk())
}
