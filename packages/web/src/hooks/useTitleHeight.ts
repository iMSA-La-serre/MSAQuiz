import { useLayoutEffect, useRef } from "react"

/**
 * Keeps --title-h, the height of a stage's title, on the stage: a slide's
 * media takes the height its title leaves on the projector (see StageMedia),
 * so a title on two or three lines never pushes the dock off a 1280×650
 * screen. Set before the first paint, then as the title wraps anew; only
 * while `active` (a stage that is a slide).
 */
const useTitleHeight = <
  Stage extends HTMLElement = HTMLDivElement,
  Title extends HTMLElement = HTMLHeadingElement,
>(
  active: boolean,
) => {
  const stageRef = useRef<Stage>(null)
  const titleRef = useRef<Title>(null)

  useLayoutEffect(() => {
    const stage = stageRef.current
    const title = titleRef.current

    if (!active || !stage || !title) {
      return
    }

    const update = () => {
      stage.style.setProperty("--title-h", `${title.offsetHeight}px`)
    }

    update()

    const observer = new ResizeObserver(update)

    observer.observe(title)

    return () => {
      observer.disconnect()
    }
  }, [active])

  return { stageRef, titleRef }
}

export default useTitleHeight
