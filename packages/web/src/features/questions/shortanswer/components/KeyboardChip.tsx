import { Chip } from "@razzia/web/features/game/components/AnswerChip"
import { Keyboard } from "lucide-react"

// The keyboard in a host row's chip box, neutral: where the players answer
// (answering screen), and the texts no accepted answer recognized
// (distribution). Decorative: the row's text says it.
const KeyboardChip = () => (
  <Chip aria-hidden size="lg" className="bg-muted text-secondary">
    <Keyboard className="size-6 xl:size-7" />
  </Chip>
)

export default KeyboardChip
