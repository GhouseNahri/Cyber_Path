"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Markdown renderer for assistant messages. Code blocks are plain,
 *  token-styled <pre>/<code> (syntax highlighting arrives in the polish
 *  pass). Links open safely in a new tab. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="ai-markdown text-[13.5px] leading-relaxed text-ink-high">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          pre: (props) => <pre {...props} className="overflow-x-auto rounded-xl border border-hairline bg-canvas p-3 text-xs" />,
          code: (props) => {
            const isBlock = "className" in props && typeof props.className === "string" && props.className.includes("language-");
            return isBlock ? (
              <code {...props} className={`font-mono ${props.className ?? ""}`} />
            ) : (
              <code className="rounded border border-hairline bg-surface-2 px-1 py-0.5 font-mono text-[12px] text-accent" {...props} />
            );
          },
          table: (props) => (
            <div className="overflow-x-auto">
              <table {...props} className="w-full border-collapse text-xs" />
            </div>
          ),
          th: (props) => <th {...props} className="border border-hairline bg-surface-2 px-2 py-1 text-left font-medium" />,
          td: (props) => <td {...props} className="border border-hairline px-2 py-1 align-top" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
