"use client";

import { createContext, useContext } from "react";
import { Text } from "@syscore/ui-library";
import { cssVarFor } from "@/lib/content/colors";
import { useTextStyle } from "@/lib/studio/use-edit-mode";
import type { TextStyleValue } from "@/lib/studio/field-types";

/**
 * The universal editable text block. Wraps the design-system `<Text>`, owns the
 * `data-content-path` (so the text is editable in place, unchanged), and applies
 * its per-block style (color / background / alignment) from the draft store or
 * published content. Add a styling capability here once and every block on every
 * page inherits it — no per-page rebuild.
 *
 * Style is applied via inline CSS variables (`var(--color-<token>)`), never a
 * Tailwind class (Tailwind v4 wouldn't generate an editor-chosen class). The
 * `data-styleable` + `data-style-*` attributes let the editor read the block's
 * current style to seed the picker.
 *
 * Page-level context supplies the page slug + the published `styles` map, so each
 * page wires it ONCE via <TextStylesProvider> and blocks just declare `path`.
 */

type StylesContext = { page: string; styles: Record<string, TextStyleValue> };
const TextStylesContext = createContext<StylesContext | null>(null);

export function TextStylesProvider({
  page,
  styles,
  children,
}: {
  page: string;
  styles?: Record<string, TextStyleValue>;
  children: React.ReactNode;
}) {
  return (
    <TextStylesContext.Provider value={{ page, styles: styles ?? {} }}>
      {children}
    </TextStylesContext.Provider>
  );
}

type EditableTextProps = React.ComponentProps<typeof Text> & { path: string };

export function EditableText({ path, style, children, ...textProps }: EditableTextProps) {
  const ctx = useContext(TextStylesContext);
  const applied = useTextStyle(ctx?.page ?? "", path, ctx?.styles?.[path]);

  // Caller `style` first as a base; the editor-applied color/bg/align win over it
  // (an explicit edit should override a static inline style, not be defeated by it).
  const appliedStyle: React.CSSProperties = {
    ...style,
    ...(applied.color ? { color: cssVarFor(applied.color) } : {}),
    ...(applied.background ? { backgroundColor: cssVarFor(applied.background) } : {}),
    ...(applied.align ? { textAlign: applied.align } : {}),
  };

  return (
    <Text
      {...textProps}
      data-content-path={path}
      data-styleable=""
      data-style-color={applied.color}
      data-style-bg={applied.background}
      data-style-align={applied.align}
      style={appliedStyle}
    >
      {children}
    </Text>
  );
}
