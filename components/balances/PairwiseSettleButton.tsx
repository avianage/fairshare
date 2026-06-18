"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { GlobalSettleModal } from "@/components/balances/GlobalSettleModal"

interface PairwiseSettleButtonProps {
  counterpartyId: string
  counterpartyName: string
}

export function PairwiseSettleButton({
  counterpartyId,
  counterpartyName,
}: PairwiseSettleButtonProps) {
  const [settleOpen, setSettleOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setSettleOpen(true)}>
        Settle up
      </Button>

      {settleOpen && (
        <GlobalSettleModal
          counterpartyId={counterpartyId}
          counterpartyName={counterpartyName}
          onClose={() => setSettleOpen(false)}
        />
      )}
    </>
  )
}
