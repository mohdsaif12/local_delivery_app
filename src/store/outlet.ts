import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OutletStore {
  /** The outlet the customer picked, or null to let the app choose the nearest. */
  outletId: string | null
  /** True once the customer has chosen for themselves — stops auto-selection
   *  from overriding them on the next load. */
  chosenByCustomer: boolean
  setOutlet: (id: string, byCustomer?: boolean) => void
  clearOutlet: () => void
}

export const useOutletStore = create<OutletStore>()(
  persist(
    (set) => ({
      outletId: null,
      chosenByCustomer: false,

      setOutlet: (id, byCustomer = true) => set({ outletId: id, chosenByCustomer: byCustomer }),
      clearOutlet: () => set({ outletId: null, chosenByCustomer: false }),
    }),
    { name: 'outlet-storage' }
  )
)
