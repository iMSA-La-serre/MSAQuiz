import { ESTIMATE_TOLERANCE } from "@razzia/common/constants"
import type { EstimateTolerance } from "@razzia/common/types/game"
import {
  boundedWindow,
  checkEstimate,
  decimalsOf,
  formatEstimate,
  fromScaled,
  isWithinTolerance,
  toleranceModeOf,
  unitOf,
} from "@razzia/common/utils/estimate"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@razzia/web/components/Select"
import { Chip } from "@razzia/web/features/game/components/AnswerChip"
import {
  draftNote,
  useNumberDraft,
} from "@razzia/web/features/questions/estimate/utils/draft"
import { checkMessage } from "@razzia/web/features/questions/estimate/utils/format"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Check, Diff, FlaskConical } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

const FIELD =
  "border-muted-foreground/80 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary aria-invalid:border-danger w-full rounded-lg border bg-white px-3 py-2.5 text-base font-semibold tabular-nums outline-none focus:ring-2"

// The side panel's select, drawn as the field next to it: same border, text
// and height. A long unit is cut short.
const MODE_TRIGGER =
  "border-muted-foreground/80 focus:ring-primary min-h-11 min-w-0 gap-1 border bg-white py-2.5 text-base focus:ring-2 [&>span:first-child]:truncate"

// The column headers' type.
const HEADING =
  "text-muted-foreground text-xs font-semibold tracking-[0.15em] uppercase"

// The columns of a true/false editor: chip, field, the « Bonne réponse »
// column, here the unit.
const COLUMNS =
  "grid-cols-[2rem_minmax(0,1fr)_6rem] sm:grid-cols-[2rem_minmax(0,1fr)_8rem]"

// The note goes on a second line, under the field.
const ROW = clsx("grid items-center gap-x-3 gap-y-1 py-2.5", COLUMNS)

const MODES: EstimateTolerance[] = [
  ESTIMATE_TOLERANCE.ABSOLUTE,
  ESTIMATE_TOLERANCE.PERCENT,
]

const MAX_LENGTH = 30

// The right value and how far from it an answer is still right, in the rows
// of the answers block. The note under the tolerance says which numbers
// score; the test field tells how a given input would be read.
const EstimateEditor = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const idPrefix = useId()
  const [sample, setSample] = useState("")
  const { expected, options } = currentQuestion
  const decimals = decimalsOf(options)
  const unit = unitOf(options)
  const mode = toleranceModeOf(options)

  const expectedDraft = useNumberDraft(expected, (value) => {
    updateQuestion(currentIndex, { expected: value })
  })
  const toleranceDraft = useNumberDraft(options?.tolerance, (value) => {
    updateQuestion(currentIndex, {
      options: { ...options, tolerance: value },
    })
  })

  const expectedNote = draftNote(t, {
    refusal: expectedDraft.refusal,
    value: expected,
    decimals,
  })
  const toleranceNote = draftNote(t, {
    refusal: toleranceDraft.refusal,
    value: options?.tolerance,
    decimals: mode === ESTIMATE_TOLERANCE.PERCENT ? 1 : decimals,
  })

  const handleModeChange = (next: EstimateTolerance) => {
    updateQuestion(currentIndex, {
      options: { ...options, toleranceMode: next },
    })
  }

  // Which numbers score, once the right value reads as one: the tolerance
  // cut to the bounds, as the server scores and the projector shows it.
  const renderWindow = () => {
    const window = expectedNote === null ? boundedWindow(currentQuestion) : null

    if (window === null) {
      return null
    }

    const format = (scaled: number) =>
      formatEstimate(fromScaled(scaled, decimals), options)

    return window.low === window.high
      ? t("quizz:estimate.windowExact", { value: format(window.low) })
      : t("quizz:estimate.window", {
          from: formatEstimate(fromScaled(window.low, decimals), options, {
            withUnit: false,
          }),
          to: format(window.high),
        })
  }

  const renderTestResult = () => {
    if (sample.trim() === "") {
      return (
        <span className="text-muted-foreground">
          {t("quizz:estimate.testHint")}
        </span>
      )
    }

    const check = checkEstimate(sample, options)

    if (!check.ok) {
      return (
        <span className="text-danger font-semibold">
          {t("quizz:estimate.testRefused", {
            reason: checkMessage(t, check, options).text,
          })}
        </span>
      )
    }

    return isWithinTolerance(currentQuestion, check.value) ? (
      <span className="text-success-strong font-semibold">
        {t("quizz:estimate.testRight")}
      </span>
    ) : (
      <span className="text-danger font-semibold">
        {t("quizz:estimate.testWrong")}
      </span>
    )
  }

  const note = (id: string, text: string | null, invalid: boolean) =>
    text !== null && (
      <p
        id={id}
        className={clsx(
          "col-start-2 col-end-4 text-xs break-words",
          invalid ? "text-danger font-semibold" : "text-muted-foreground",
        )}
      >
        {text}
      </p>
    )

  const windowText = renderWindow()
  const toleranceText = toleranceNote ?? windowText
  // The tolerance counts in the unit of the right value, or in percent.
  const modeLabel = (value: EstimateTolerance) =>
    value === ESTIMATE_TOLERANCE.PERCENT || unit === ""
      ? t(`quizz:estimate.mode.${value}`)
      : unit

  return (
    <section
      aria-labelledby={`${idPrefix}-title`}
      className="bg-background text-foreground z-10 rounded-2xl p-4 shadow-sm md:p-6"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={`${idPrefix}-title`} className="text-lg font-bold">
          {t("quizz:estimate.title")}
        </h3>
        <p className="text-muted-foreground text-sm">
          {t("quizz:answers.hint.estimate")}
        </p>
      </header>

      <div
        aria-hidden
        className={clsx("hidden gap-x-3 px-1 pb-2 sm:grid", HEADING, COLUMNS)}
      >
        <span />
        <span>{t("quizz:estimate.columnValue")}</span>
        <span className="text-center">{t("quizz:estimate.columnUnit")}</span>
      </div>

      <ul className="divide-muted flex flex-col divide-y">
        <li className={ROW}>
          {/* The letter chip's box, as the right answer of a short answer. */}
          <Chip aria-hidden size="sm" className="bg-muted text-success-strong">
            <Check className="size-4 stroke-3" />
          </Chip>
          <input
            className={FIELD}
            inputMode="decimal"
            placeholder={t("quizz:estimate.expected")}
            aria-label={t("quizz:estimate.expected")}
            aria-invalid={expectedNote !== null}
            aria-describedby={
              expectedNote === null ? undefined : `${idPrefix}-expected-note`
            }
            maxLength={MAX_LENGTH}
            autoComplete="off"
            value={expectedDraft.draft}
            onChange={(event) => expectedDraft.update(event.target.value)}
          />
          <span className="text-muted-foreground truncate text-center text-sm font-semibold">
            {unit}
          </span>
          {note(`${idPrefix}-expected-note`, expectedNote, true)}
        </li>
        <li className={ROW}>
          {/* Its own column header, as the right value's row has one: the
          field stays named on every width. */}
          <label
            htmlFor={`${idPrefix}-tolerance`}
            className={clsx("col-start-2 col-end-4 px-1", HEADING)}
          >
            {t("quizz:estimate.tolerance")}
          </label>
          <Chip
            aria-hidden
            size="sm"
            className="bg-muted text-secondary col-start-1"
          >
            <Diff className="size-4" />
          </Chip>
          <input
            id={`${idPrefix}-tolerance`}
            className={FIELD}
            inputMode="decimal"
            placeholder="0"
            aria-invalid={toleranceNote !== null}
            aria-describedby={
              toleranceText === null ? undefined : `${idPrefix}-tolerance-note`
            }
            maxLength={MAX_LENGTH}
            autoComplete="off"
            value={toleranceDraft.draft}
            onChange={(event) => toleranceDraft.update(event.target.value)}
          />
          <Select value={mode} onValueChange={handleModeChange}>
            <SelectTrigger
              aria-label={t("quizz:estimate.modeLabel")}
              className={MODE_TRIGGER}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map((value) => (
                <SelectItem key={value} value={value}>
                  {modeLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {note(
            `${idPrefix}-tolerance-note`,
            toleranceText,
            toleranceNote !== null,
          )}
        </li>
      </ul>

      {/* Stacked as a setting of the side panel: label, field, verdict, as in
      the short answer's block. */}
      <div className="bg-muted mt-4 flex flex-col gap-1.5 rounded-xl p-3">
        <label
          htmlFor={`${idPrefix}-test`}
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <FlaskConical className="size-4" aria-hidden />
          {t("quizz:estimate.test")}
        </label>
        <input
          id={`${idPrefix}-test`}
          className={FIELD}
          placeholder={t("quizz:estimate.testPlaceholder")}
          aria-describedby={`${idPrefix}-test-result`}
          maxLength={MAX_LENGTH}
          autoComplete="off"
          spellCheck={false}
          value={sample}
          onChange={(event) => setSample(event.target.value)}
        />
        <p
          id={`${idPrefix}-test-result`}
          aria-live="polite"
          className="text-sm break-words"
        >
          {renderTestResult()}
        </p>
      </div>
    </section>
  )
}

export default EstimateEditor
