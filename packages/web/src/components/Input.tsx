import clsx from "clsx"
import React from "react"

type Props = React.ComponentProps<"input"> & {
  variant?: "sm" | "md"
}

const Input = ({
  className,
  type = "text",
  variant = "md",
  ...otherProps
}: Props) => (
  <input
    type={type}
    className={clsx(
      // A field marked invalid has a red border, green again while focused
      // so the focus stays visible.
      "focus:border-primary border-accent text-foreground aria-invalid:border-danger aria-invalid:focus:border-primary rounded-lg border-2 font-semibold focus:outline-none",
      variant === "md" && "p-2 text-lg",
      variant === "sm" && "px-3 py-2 text-sm",
      className,
    )}
    {...otherProps}
  />
)

export default Input
