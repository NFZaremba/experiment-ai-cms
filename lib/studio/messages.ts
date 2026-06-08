/**
 * Typed postMessage protocol between the Studio shell (parent window) and the
 * edit-mode bridge running inside the previewed page (iframe).
 *
 * Both sides validate `event.origin === window.location.origin` (same-origin)
 * before trusting a message. Every message carries a `source` discriminator so
 * a window never reacts to its own echoes or to unrelated postMessage traffic.
 */

import type { FieldType, FieldValue } from "./field-types";

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
  /** The click point in the iframe's viewport coords — the panel anchors here. */
  point: { x: number; y: number };
  currentValue: FieldValue;
  fieldType: FieldType;
};

/** iframe → shell: the bridge has mounted and is listening. */
export type BridgeReadyMessage = {
  source: "studio-bridge";
  type: "ready";
};

/** iframe → shell: a click landed on a non-editable area (close the panel). */
export type BridgeDeselectMessage = {
  source: "studio-bridge";
  type: "deselect";
};

/** iframe → shell: the bridge produced an edit directly (e.g. a drag reorder),
 *  so the shell records it for publish. Mirrors ApplyEditMessage in reverse. */
export type BridgeEditMessage = {
  source: "studio-bridge";
  type: "edit";
  path: string;
  value: FieldValue;
  fieldType: FieldType;
};

/** shell → iframe: apply a new value to a field (live preview). */
export type ApplyEditMessage = {
  source: "studio-shell";
  type: "apply";
  path: string;
  newValue: FieldValue;
  fieldType: FieldType;
};

export type StudioMessage =
  | SelectFieldMessage
  | BridgeReadyMessage
  | BridgeDeselectMessage
  | BridgeEditMessage
  | ApplyEditMessage;

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

export function isDeselectMessage(m: StudioMessage): m is BridgeDeselectMessage {
  return m.source === "studio-bridge" && m.type === "deselect";
}

export function isApplyMessage(m: StudioMessage): m is ApplyEditMessage {
  return m.source === "studio-shell" && m.type === "apply";
}

export function isBridgeEditMessage(m: StudioMessage): m is BridgeEditMessage {
  return m.source === "studio-bridge" && m.type === "edit";
}
