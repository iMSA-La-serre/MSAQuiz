import { useSyncExternalStore } from "react"

const failed = new Set<string>()

const listeners = new Set<() => void>()

const notify = () => {
  listeners.forEach((listener) => {
    listener()
  })
}

/**
 * Images that did not load on this page: a screen that mounts again (the
 * answering stage after the reading one) shows its neutral block at once,
 * never a broken image for a frame. Behind the block, the address is tried
 * again (see MediaUnavailable): once it loads, it leaves this list and every
 * screen that shows it gets the picture back.
 */
export const imageFailures = {
  has: (url: string) => failed.has(url),
  fail: (url: string) => {
    if (!failed.has(url)) {
      failed.add(url)
      notify()
    }
  },
  recover: (url: string) => {
    if (failed.delete(url)) {
      notify()
    }
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  },
}

export interface ImageRetry {
  url: string
  onLoad: () => void
}

/**
 * Whether the image at `url` failed to load, what its onError calls, and,
 * while it has failed, the address to try again with what its load calls:
 * each screen that mounts tries once more, so a network hiccup or a file put
 * in place since never leaves the block for good.
 */
const useImageFailure = (url: string | undefined) => {
  const hasFailed = useSyncExternalStore(
    imageFailures.subscribe,
    () => url !== undefined && imageFailures.has(url),
  )

  const fail = () => {
    if (url !== undefined) {
      imageFailures.fail(url)
    }
  }

  const retry: ImageRetry | undefined =
    hasFailed && url !== undefined
      ? {
          url,
          onLoad: () => {
            imageFailures.recover(url)
          },
        }
      : undefined

  return { failed: hasFailed, fail, retry }
}

export default useImageFailure
