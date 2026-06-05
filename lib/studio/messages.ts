/**
 * Typed postMessage protocol between the Studio shell (parent window) and the
 * edit-mode bridge running inside the previewed page (iframe).
 *
 * Both sides validate `event.origin === window.location.origin` (same-origin)
 * before trusting a message. Every message carries a `source` discriminator so
 * a window never reacts to its own echoes or to unrelated postMessage traffic.
 */

export type FieldRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

/** iframe → shell: a field was clicked in edit mode. */
export type SelectFieldMessage = {
  source: "studio-bridge";
  type: "select";
  path: string;
  rect: FieldRect;
  currentValue: string;
  fieldType: "text";
};

/** iframe → shell: the bridge has mounted and is listening. */
export type BridgeReadyMessage = {
  source: "studio-bridge";
  type: "ready";
};

/** shell → iframe: apply a new value to a field (live preview). */
export type ApplyEditMessage = {
  source: "studio-shell";
  type: "apply";
  path: string;
  newValue: string;
};

export type StudioMessage = SelectFieldMessage | BridgeReadyMessage | ApplyEditMessage;

export function isStudioMessage(data: unknown): data is StudioMessage {
  if (typeof data !== "object" || data === null) return false;
  const src = (data as { source?: unknown }).source;
  return src === "studio-bridge" || src === "studio-shell";
}

export function isSelectMessage(m: StudioMessage): m is SelectFieldMessage {
  return m.source === "studio-bridge" && m.type === "select";
}

export function isReadyMessage(m: StudioMessage): m is BridgeReadyMessage {
  return m.source === "studio-bridge" && m.type === "ready";
}

export function isApplyMessage(m: StudioMessage): m is ApplyEditMessage {
  return m.source === "studio-shell" && m.type === "apply";
}
