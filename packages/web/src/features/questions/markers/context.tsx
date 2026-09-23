import type { AnswerPayload, QuestionOptions } from "@razzia/common/types/game"
import { markersMultiple } from "@razzia/common/utils/markers"
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useState,
} from "react"

interface MarkersPicking {
  // Markers tapped so far, and whether the answer is gone.
  selected: number[]
  submitted: boolean
  // Several markers are right: they are ticked, then « Valider » sends them.
  multiple: boolean
  // A marker tapped, on the image or in the list under it.
  pick: (_index: number) => void
  submit: () => void
}

// Screens that only show the markers (the projector, the distribution): they
// are outside the provider, and nothing can be tapped.
const SHOWN_ONLY: MarkersPicking = {
  selected: [],
  submitted: true,
  multiple: false,
  pick: () => undefined,
  submit: () => undefined,
}

const MarkersContext = createContext<MarkersPicking | null>(null)

/**
 * The markers this player has tapped. The image and the list under it are two
 * ways to answer the same question, in two blocks of the stage: the state
 * lives above both.
 */
export const useMarkersPicking = (): MarkersPicking =>
  useContext(MarkersContext) ?? SHOWN_ONLY

interface Props {
  options?: QuestionOptions
  onSubmit: (_answer: AnswerPayload) => void
}

const MarkersProvider = ({
  options,
  onSubmit,
  children,
}: PropsWithChildren<Props>) => {
  const [selected, setSelected] = useState<number[]>([])
  const [submitted, setSubmitted] = useState(false)
  const multiple = markersMultiple({ solutions: [], options })

  const send = (answerKeys: number[]) => {
    setSubmitted(true)
    onSubmit({ answerKeys })
  }

  const pick = (index: number) => {
    if (submitted) {
      return
    }

    // A single right marker: one tap is the answer, as on a single choice.
    if (!multiple) {
      setSelected([index])
      send([index])

      return
    }

    setSelected((prev) =>
      prev.includes(index)
        ? prev.filter((key) => key !== index)
        : [...prev, index],
    )
  }

  const submit = () => {
    if (submitted || selected.length === 0) {
      return
    }

    send([...selected].sort((a, b) => a - b))
  }

  return (
    <MarkersContext.Provider
      value={{ selected, submitted, multiple, pick, submit }}
    >
      {children}
    </MarkersContext.Provider>
  )
}

export default MarkersProvider
