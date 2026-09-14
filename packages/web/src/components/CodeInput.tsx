import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
} from "@razzia/common/constants"
import clsx from "clsx"
import {
  useRef,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react"

interface Props {
  value: string
  onChange: (_value: string) => void
  length?: number
  className?: string
  ariaLabel?: string
}

// A whole code standing on its own, not glued to other letters or digits.
const codePattern = (length: number) =>
  new RegExp(
    `(?<![A-Z0-9])[${INVITE_CODE_ALPHABET}]{${length}}(?![A-Z0-9])`,
    "gu",
  )

// Keeps only the characters a game code can contain, in upper case.
const sanitize = (text: string) =>
  text
    .toUpperCase()
    .split("")
    .filter((char) => INVITE_CODE_ALPHABET.includes(char))
    .join("")

const CodeInput = ({
  value,
  onChange,
  length = INVITE_CODE_LENGTH,
  className,
  ariaLabel,
}: Props) => {
  const refs = useRef<Array<HTMLInputElement | null>>([])

  const padded = value.padEnd(length, " ").slice(0, length)
  const characters = Array.from({ length }, (_, i) => padded[i].trim())

  const focus = (index: number) => {
    refs.current[Math.max(0, Math.min(length - 1, index))]?.focus()
  }

  const update = (index: number, char: string) => {
    const next = padded.split("")
    next[index] = char || " "
    onChange(next.join("").trimEnd())
  }

  const handleKeyDown =
    (index: number) => (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault()

        if (characters[index]) {
          update(index, "")
        } else {
          focus(index - 1)
        }

        return
      }

      if (e.key === "ArrowLeft") {
        focus(index - 1)

        return
      }

      if (e.key === "ArrowRight") {
        focus(index + 1)
      }
    }

  const handleChange =
    (index: number) => (e: ChangeEvent<HTMLInputElement>) => {
      const char = sanitize(e.target.value).slice(-1)

      if (!char) {
        return
      }

      update(index, char)
      focus(index + 1)
    }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData("text").toUpperCase()
    // A pasted message or join link ("Code : 7K2PX", ".../?code=7K2PX") holds
    // more than the code: take the last standalone code in it, if there is one.
    const code = text.match(codePattern(length))?.at(-1)
    const pasted = (code ?? sanitize(text)).slice(0, length)
    onChange(pasted)
    focus(pasted.length < length ? pasted.length : length - 1)
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={clsx("flex gap-2", className)}
    >
      {characters.map((char, i) => (
        <input
          key={i}
          aria-label={
            ariaLabel ? `${ariaLabel} (${i + 1}/${length})` : undefined
          }
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={1}
          value={char}
          onChange={handleChange(i)}
          onKeyDown={handleKeyDown(i)}
          onPaste={handlePaste}
          className="focus:border-primary border-accent w-10 flex-1 rounded-lg border-2 p-2 text-center text-lg font-semibold uppercase outline-none"
        />
      ))}
    </div>
  )
}

export default CodeInput
