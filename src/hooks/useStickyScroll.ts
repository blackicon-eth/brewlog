import { useCallback, useRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";

// Stream-following scroll: keep the view pinned to the bottom while new content lands,
// but the moment the reader scrolls up past `threshold`, stop following — they're reading
// something older and the stream must not yank the page away. Scrolling back to the
// bottom re-arms the follow. Attach all three handlers plus `scrollEventThrottle={16}`.
export function useStickyScroll(threshold = 80) {
  const ref = useRef<ScrollView>(null);
  const stick = useRef(true);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    stick.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < threshold;
  }, [threshold]);

  const onContentSizeChange = useCallback(() => {
    if (stick.current) ref.current?.scrollToEnd({ animated: true });
  }, []);

  // Force-follow again (e.g. the user just sent a message): jump to the end and re-arm.
  const jumpToEnd = useCallback(() => {
    stick.current = true;
    requestAnimationFrame(() => ref.current?.scrollToEnd({ animated: true }));
  }, []);

  return { ref, onScroll, onContentSizeChange, jumpToEnd };
}
