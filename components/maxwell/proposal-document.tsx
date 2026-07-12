import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { parseProposalBlocks, type ProposalBlock } from "@/lib/maxwell/proposal-content";

function renderInline(text: string): ReactNode[] {
  const normalized = text.replace(/\\n/g, "\n");
  const parts = normalized.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={`strong-${index}`} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    const lines = part.split("\n");
    return (
      <Fragment key={`text-${index}`}>
        {lines.map((line, lineIndex) => (
          <Fragment key={`line-${index}-${lineIndex}`}>
            {line}
            {lineIndex < lines.length - 1 ? <br /> : null}
          </Fragment>
        ))}
      </Fragment>
    );
  });
}

function renderBlock(block: ProposalBlock, index: number): ReactNode {
  switch (block.type) {
    case "heading":
      if (index === 0) {
        return (
          <h1 key={index} className="text-2xl font-display tracking-tight text-foreground">
            {block.text}
          </h1>
        );
      }

      if (block.level === 1) {
        return (
          <h1 key={index} className="text-2xl font-display tracking-tight text-foreground">
            {block.text}
          </h1>
        );
      }

      if (block.level === 2) {
        return (
          <h2 key={index} className="text-xl font-display tracking-tight text-foreground">
            {block.text}
          </h2>
        );
      }

      return (
        <h3
          key={index}
          className="pt-1 text-[11px] uppercase tracking-[0.24em] text-muted-foreground"
        >
          {block.text}
        </h3>
      );

    case "paragraph":
      return (
        <p key={index} className="text-sm leading-7 text-foreground/85">
          {renderInline(block.text)}
        </p>
      );

    case "ordered_list":
      return (
        <ol key={index} className="space-y-2.5 pl-5 text-sm leading-7 text-foreground/85">
          {block.items.map((item, itemIndex) => (
            <li key={`${index}-${itemIndex}`} className="pl-1 marker:font-medium marker:text-foreground/65">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );

    case "unordered_list":
      return (
        <ul key={index} className="space-y-2 pl-5 text-sm leading-7 text-foreground/80">
          {block.items.map((item, itemIndex) => (
            <li key={`${index}-${itemIndex}`} className="pl-1 marker:text-foreground/50">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );

    case "divider":
      return <hr key={index} className="border-border/80" />;

    default:
      return null;
  }
}

type ProposalDocumentProps = {
  content: string | null | undefined;
  className?: string;
  emptyMessage?: string;
};

export function ProposalDocument({
  content,
  className,
  emptyMessage = "No proposal content available.",
}: ProposalDocumentProps) {
  const blocks = parseProposalBlocks(content);

  if (blocks.length === 0) {
    return <p className="text-sm italic text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className={cn("space-y-5", className)}>
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}
