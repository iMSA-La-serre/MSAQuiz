// The phone answer row, as a field: same card, height and text. 18 px text:
// from 16 px up, iOS does not zoom into the field. Focused, it takes the
// green ring of a picked row: a text field matches :focus-visible on every
// tap, so the yellow keyboard outline would show to everyone typing. A field
// reached with Tab or raised by the keyboard scrolls into view with
// « Valider » below it. Shared by the short answer and the word cloud.
export const ANSWER_FIELD =
  "text-secondary placeholder:text-secondary/70 focus:ring-primary ease-out-quart min-h-16 w-full scroll-mb-28 rounded-2xl bg-white px-4 py-2.5 text-lg leading-snug font-semibold shadow-lg shadow-black/15 transition-[background-color,box-shadow] duration-300 focus:ring-4 focus:outline-none disabled:bg-white/70 disabled:opacity-100 disabled:shadow-none motion-reduce:transition-none"
