import { useCallback, useRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";

// Stream-following scroll: keep the view pinned to the bottom while new content lands,
// but the moment the reader scrolls up past `threshold`, stop following — they're reading
// something older and the stream must not yank the page away. Scrolling back to the
// bottom re-arms the follow.
//
// Two hard rules learned on-device:
// - Never auto-scroll during a touch or fling. A scrollToEnd issued mid-gesture starts a
//   competing animation and the list stutters under the finger.
// - Follow with `animated: false`. Content appends on a fixed beat; queueing an animated
//   scroll per beat piles animations on top of each other.
//
// Attach ALL returned handlers, plus a moderate `scrollEventThrottle` (48) — 16 floods
// the JS thread with events exactly while it's busiest rendering the stream.
export function useStickyScroll(threshold = 80) {
  const ref = useRef<ScrollView>(null);
  const stick = useRef(true);
  const interacting = useRef(false); // finger down, or fling still travelling

  const compute = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    stick.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < threshold;
  }, [threshold]);

  const onScroll = compute;
  const onScrollBeginDrag = useCallback(() => { interacting.current = true; }, []);
  const onScrollEndDrag = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    interacting.current = false; // a fling re-raises it via onMomentumScrollBegin
    compute(e);
  }, [compute]);
  const onMomentumScrollBegin = useCallback(() => { interacting.current = true; }, []);
  const onMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    interacting.current = false;
    compute(e);
  }, [compute]);

  const onContentSizeChange = useCallback(() => {
    if (stick.current && !interacting.current) ref.current?.scrollToEnd({ animated: false });
  }, []);

  // Force-follow again (e.g. the user just sent a message): jump to the end and re-arm.
  const jumpToEnd = useCallback(() => {
    stick.current = true;
    requestAnimationFrame(() => ref.current?.scrollToEnd({ animated: true }));
  }, []);

  return {
    ref, onScroll, onScrollBeginDrag, onScrollEndDrag,
    onMomentumScrollBegin, onMomentumScrollEnd, onContentSizeChange, jumpToEnd,
  };
}
