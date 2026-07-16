import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { PillButton } from "./PillButton";
import { colors, motion, radii, spacing } from "../../design/tokens";

// A themed replacement for the stark native Alert dialog. Exposed as an imperative
// context API (alert / confirm) so call sites read like the Alert.alert they replace,
// including deep inside async flows. One slot at a time (Alert semantics).

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export type ChooseOption = { key: string; label: string; destructive?: boolean };
export type ChooseOptions = { title: string; message?: string; options: ChooseOption[] };

export type AppModalApi = {
  alert: (title: string, message?: string) => Promise<void>;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  // A titled action sheet — resolves to the chosen option's key, or null if dismissed.
  choose: (options: ChooseOptions) => Promise<string | null>;
};

const AppModalContext = createContext<AppModalApi | null>(null);

export function useAppModal(): AppModalApi {
  const ctx = useContext(AppModalContext);
  if (!ctx) throw new Error("useAppModal must be used within <AppModalProvider>");
  return ctx;
}

type Slot =
  | { kind: "alert"; title: string; message?: string; resolve: () => void }
  | {
      kind: "confirm";
      title: string;
      message?: string;
      confirmLabel: string;
      cancelLabel: string;
      destructive: boolean;
      resolve: (value: boolean) => void;
    }
  | { kind: "choose"; title: string; message?: string; options: ChooseOption[]; resolve: (value: string | null) => void };

// The safe "dismissed" outcome for a slot (backdrop tap / hardware back / superseded).
function resolveDismissed(slot: Slot): void {
  if (slot.kind === "confirm") slot.resolve(false);
  else if (slot.kind === "choose") slot.resolve(null);
  else slot.resolve();
}

export function AppModalProvider({ children }: { children: React.ReactNode }) {
  const [slot, setSlot] = useState<Slot | null>(null);
  const [visible, setVisible] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const slotRef = useRef<Slot | null>(null);
  const closing = useRef(false);
  slotRef.current = slot;

  const open = useCallback((next: Slot) => {
    // Resolve anything already on screen as a dismissal before showing the next.
    const prev = slotRef.current;
    if (prev && !closing.current) resolveDismissed(prev);
    closing.current = false;
    anim.setValue(0);
    setSlot(next);
    setVisible(true);
  }, [anim]);

  // Spring the card in whenever a fresh slot appears.
  useEffect(() => {
    if (!slot) return;
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, ...motion.springPop }).start();
  }, [slot, anim]);

  // Animate out, then clear and run the caller's resolve exactly once.
  const dismiss = useCallback((finish: () => void) => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(anim, { toValue: 0, duration: motion.fast, useNativeDriver: true }).start(() => {
      setVisible(false);
      setSlot(null);
      finish();
    });
  }, [anim]);

  const alert = useCallback(
    (title: string, message?: string) =>
      new Promise<void>((resolve) => open({ kind: "alert", title, message, resolve })),
    [open],
  );

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) =>
        open({
          kind: "confirm",
          title: options.title,
          message: options.message,
          confirmLabel: options.confirmLabel ?? "Confirm",
          cancelLabel: options.cancelLabel ?? "Cancel",
          destructive: options.destructive ?? false,
          resolve,
        }),
      ),
    [open],
  );

  const choose = useCallback(
    (options: ChooseOptions) =>
      new Promise<string | null>((resolve) =>
        open({ kind: "choose", title: options.title, message: options.message, options: options.options, resolve }),
      ),
    [open],
  );

  const api = useMemo<AppModalApi>(() => ({ alert, confirm, choose }), [alert, confirm, choose]);

  // Backdrop tap / hardware back = the safe choice (dismiss alert, cancel confirm/choose).
  const onDismissRequest = useCallback(() => {
    const cur = slotRef.current;
    if (!cur) return;
    dismiss(() => resolveDismissed(cur));
  }, [dismiss]);

  const tone = slot?.kind === "confirm" && slot.destructive ? colors.tertiary : colors.primary;
  const kicker = slot?.kind === "confirm" ? "Please confirm" : slot?.kind === "choose" ? "Choose" : "Notice";

  const cardStyle = {
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
    ],
  };

  return (
    <AppModalContext.Provider value={api}>
      {children}
      <Modal
        visible={visible}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={onDismissRequest}
      >
        <View style={styles.root}>
          <Animated.View style={[styles.backdrop, { opacity: anim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onDismissRequest} />
          </Animated.View>

          {slot ? (
            <Animated.View style={[styles.card, cardStyle]} accessibilityViewIsModal>
              <View style={[styles.accent, { backgroundColor: tone }]} />
              <AppText variant="labelSm" style={[styles.kicker, { color: tone }]}>{kicker}</AppText>
              <AppText variant="headlineMd" style={styles.title}>{slot.title}</AppText>
              {slot.message ? (
                <AppText variant="bodyMd" style={styles.message}>{slot.message}</AppText>
              ) : null}

              {slot.kind === "confirm" ? (
                <View style={styles.actionRow}>
                  <PillButton
                    label={slot.cancelLabel}
                    variant="neutral"
                    style={styles.flex1}
                    onPress={() => dismiss(() => slot.resolve(false))}
                  />
                  <PillButton
                    label={slot.confirmLabel}
                    variant={slot.destructive ? "dangerSolid" : "primary"}
                    style={styles.flex1}
                    onPress={() => dismiss(() => slot.resolve(true))}
                  />
                </View>
              ) : slot.kind === "choose" ? (
                <View style={styles.actionsStack}>
                  {slot.options.map((o) => (
                    <PillButton
                      key={o.key}
                      label={o.label}
                      variant={o.destructive ? "dangerSolid" : "primary"}
                      onPress={() => dismiss(() => slot.resolve(o.key))}
                    />
                  ))}
                  <PillButton label="Cancel" variant="neutral" onPress={() => dismiss(() => slot.resolve(null))} />
                </View>
              ) : (
                <View style={styles.actionsSingle}>
                  <PillButton label="Got it" onPress={() => dismiss(() => slot.resolve())} />
                </View>
              )}
            </Animated.View>
          ) : null}
        </View>
      </Modal>
    </AppModalContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.container },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(44,22,14,0.45)" },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.background,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 22,
    shadowColor: "#2c160e",
    shadowOpacity: 0.28,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  accent: { width: 30, height: 4, borderRadius: 999, marginBottom: 16 },
  kicker: {},
  // Extra line height gives EB Garamond's descenders (the "g" tail) room so Android
  // doesn't clip them; headlineMd's default 29 is a hair too tight for the serif.
  title: { marginTop: 8, lineHeight: 34 },
  message: { marginTop: 10, lineHeight: 22 },
  actionRow: { flexDirection: "row", gap: spacing.gutter, marginTop: 24 },
  actionsSingle: { marginTop: 24 },
  actionsStack: { marginTop: 24, gap: spacing.gutter },
  flex1: { flex: 1 },
});
