// The parts of the hairline kernel the site's host calls (see hairline.ts);
// figures use the rest themselves.
export declare const HL: {
  inject(root: Document): void;
  mk(tag: string, attrs: Record<string, string>, parent: Element): SVGElement;
};
