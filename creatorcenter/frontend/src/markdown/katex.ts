import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export const remarkMathPlugin = [remarkMath, { singleDollarTextMath: true }] as any;
export const rehypeKatexPlugin = [rehypeKatex] as any;
