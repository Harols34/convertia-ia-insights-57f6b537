import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RichMarkdownTable } from "./RichMarkdownTable";
import type { Components } from "react-markdown";

interface Props {
  content: string;
  className?: string;
}

/**
 * Renders markdown with GFM table support.
 * Tables are replaced with interactive RichMarkdownTable components.
 */
export function MarkdownWithRichTables({ content, className }: Props) {
  const components: Components = {
    table: ({ children }) => {
      // Extract headers and rows from the table AST rendered by react-markdown
      const headers: string[] = [];
      const rows: string[][] = [];

      // children = [thead, tbody]
      const childArr = Array.isArray(children) ? children : [children];
      childArr.forEach((section: any) => {
        if (!section?.props?.children) return;
        const sectionRows = Array.isArray(section.props.children)
          ? section.props.children
          : [section.props.children];

        sectionRows.forEach((tr: any) => {
          if (!tr?.props?.children) return;
          const cells = Array.isArray(tr.props.children)
            ? tr.props.children
            : [tr.props.children];
          const texts = cells.map((cell: any) => extractText(cell));

          // If the section is thead (first section and headers empty), treat as headers
          if (headers.length === 0 && section === childArr[0]) {
            headers.push(...texts);
          } else {
            rows.push(texts);
          }
        });
      });

      if (headers.length === 0) return null;
      return <RichMarkdownTable headers={headers} rows={rows} />;
    },
  };

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

/** Recursively extract text content from React elements */
function extractText(node: any): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node?.props?.children) return extractText(node.props.children);
  return "";
}
