import { Fragment, type ReactNode } from "react";

/**
 * Fills `{name}` tokens of a translated sentence with React nodes (links, emphasis), so a sentence is
 * translated as a whole instead of being glued together from pieces. Unknown tokens stay as text.
 */
export function rich(template: string, parts: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((segment, i) => {
    const name = /^\{(\w+)\}$/.exec(segment)?.[1];
    return name !== undefined && name in parts ? <Fragment key={i}>{parts[name]}</Fragment> : segment;
  });
}
