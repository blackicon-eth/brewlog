import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { motion } from "../../design/tokens";

// A full-screen, immersive viewer for a single coffee photo. Tap anywhere (or the ✕) to
// dismiss. The image is contained (never cropped) on a near-black backdrop so the whole
// shot reads clearly. `uri === null` keeps it closed.
//
// The fade is driven by our own Animated value (motion.quick in, motion.fast out) rather
// than Modal's built-in animationType="fade", whose fixed ~300ms open feels sluggish for a
// tap-to-zoom. The last uri is held while closing so the image doesn't vanish mid-fade.
export function PhotoViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const open = uri !== null;
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);
  const shownUri = useRef<string | null>(uri);
  if (uri !== null) shownUri.current = uri;

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: motion.quick, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(anim, { toValue: 0, duration: motion.fast, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [open, mounted, anim]);

  return (
    <Modal visible={mounted} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={styles.fill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close photo">
          {shownUri.current !== null ? (
            <Image source={{ uri: shownUri.current }} style={styles.image} resizeMode="contain" />
          ) : null}
          <View style={styles.closeBtn}>
            <CloseGlyph />
          </View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// Hand-drawn ✕ — two crossed bars, zero-dependency (same glyph family as the app's icons).
function CloseGlyph({ size = 18, color = "#fff", thickness = 2 }: { size?: number; color?: string; thickness?: number }) {
  const bar = {
    position: "absolute" as const,
    width: size,
    height: thickness,
    backgroundColor: color,
    borderRadius: thickness,
    top: (size - thickness) / 2,
    left: 0,
  };
  return (
    <View style={{ width: size, height: size }}>
      <View style={[bar, { transform: [{ rotate: "45deg" }] }]} />
      <View style={[bar, { transform: [{ rotate: "-45deg" }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.94)",
  },
  fill: { flex: 1, alignItems: "center", justifyContent: "center" },
  image: { width: "92%", height: "82%" },
  closeBtn: {
    position: "absolute",
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
});
