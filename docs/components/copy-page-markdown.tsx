'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { cn } from '@/lib/cn';

export function CopyPageAsMarkdown() {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const pathname = usePathname();
  const [markdownContent, setMarkdownContent] = useState<string>('');

  useEffect(() => {
    const extractMarkdownFromPage = () => {
      const article = document.querySelector('article');
      if (!article) return '';

      const title = document.querySelector('h1')?.textContent || '';
      const description =
        document.querySelector('[data-description]')?.textContent || '';

      let markdown = '';

      if (title) {
        markdown += `# ${title}\n\n`;
      }

      if (description) {
        markdown += `${description}\n\n`;
      }

      const processNode = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
          return node.textContent || '';
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          const tagName = element.tagName.toLowerCase();

          switch (tagName) {
            case 'h1':
              return `# ${element.textContent}\n`;
            case 'h2':
              return `## ${element.textContent}\n`;
            case 'h3':
              return `### ${element.textContent}\n`;
            case 'h4':
              return `#### ${element.textContent}\n`;
            case 'h5':
              return `##### ${element.textContent}\n`;
            case 'h6':
              return `###### ${element.textContent}\n`;
            case 'p':
              return `${element.textContent}\n`;
            case 'pre': {
              const codeContent = element.textContent || '';
              const language =
                element.className.match(/language-(\w+)/)?.[1] || '';
              return `\`\`\`${language}\n${codeContent}\n\`\`\`\n`;
            }
            case 'code': {
              if (element.parentElement?.tagName.toLowerCase() === 'pre') {
                return element.textContent || '';
              }
              return `\`${element.textContent}\``;
            }
            case 'ul': {
              let ulContent = '';
              Array.from(element.children).forEach((li) => {
                ulContent += `- ${li.textContent}\n`;
              });
              return ulContent;
            }
            case 'ol': {
              let olContent = '';
              Array.from(element.children).forEach((li, index) => {
                olContent += `${index + 1}. ${li.textContent}\n`;
              });
              return olContent;
            }
            case 'li': {
              return element.textContent || '';
            }
            case 'blockquote': {
              const lines = (element.textContent || '').split('\n');
              return lines.map((line) => `> ${line}`).join('\n') + '\n';
            }
            case 'strong': {
              return `**${element.textContent}**`;
            }
            case 'b': {
              return `**${element.textContent}**`;
            }
            case 'em': {
              return `*${element.textContent}*`;
            }
            case 'i': {
              return `*${element.textContent}*`;
            }
            case 'a': {
              const href = element.getAttribute('href') || '';
              return `[${element.textContent}](${href})`;
            }
            default: {
              let content = '';
              for (const child of Array.from(element.childNodes)) {
                content += processNode(child);
              }
              return content;
            }
          }
        }

        return '';
      };

      const docsBody = article.querySelector("[class*='prose']");
      if (docsBody) {
        for (const child of Array.from(docsBody.childNodes)) {
          markdown += processNode(child);
        }
      }

      return markdown.trim();
    };

    setMarkdownContent(extractMarkdownFromPage() || '');
  }, [pathname]);

  const handleCopy = () => {
    if (markdownContent) {
      copyToClipboard(markdownContent);
    }
  };

  return (
    <button
      onClick={handleCopy}
      aria-label={
        isCopied ? 'Page copied as markdown!' : 'Copy page as markdown'
      }
      type="button"
      disabled={isCopied}
      className={cn(
        isCopied && '[&_svg]:text-primary-blue',
        'shrink-0 items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted/50 transition-colors hidden sm:flex'
      )}
    >
      {isCopied ? (
        <svg
          height="16"
          width="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M15.5607 3.99999L15.0303 4.53032L6.23744 13.3232C5.55403 14.0066 4.44599 14.0066 3.76257 13.3232L4.2929 12.7929L3.76257 13.3232L0.969676 10.5303L0.439346 9.99999L1.50001 8.93933L2.03034 9.46966L4.82323 12.2626C4.92086 12.3602 5.07915 12.3602 5.17678 12.2626L13.9697 3.46966L14.5 2.93933L15.5607 3.99999Z"
            fill="currentColor"
          />
        </svg>
      ) : (
        <svg
          height="16"
          width="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M2.75 0.5C1.7835 0.5 1 1.2835 1 2.25V9.75C1 10.7165 1.7835 11.5 2.75 11.5H3.75H4.5V10H3.75H2.75C2.61193 10 2.5 9.88807 2.5 9.75V2.25C2.5 2.11193 2.61193 2 2.75 2H8.25C8.38807 2 8.5 2.11193 8.5 2.25V3H10V2.25C10 1.2835 9.2165 0.5 8.25 0.5H2.75ZM7.75 4.5C6.7835 4.5 6 5.2835 6 6.25V13.75C6 14.7165 6.7835 15.5 7.75 15.5H13.25C14.2165 15.5 15 14.7165 15 13.75V6.25C15 5.2835 14.2165 4.5 13.25 4.5H7.75ZM7.5 6.25C7.5 6.11193 7.61193 6 7.75 6H13.25C13.3881 6 13.5 6.11193 13.5 6.25V13.75C13.5 13.8881 13.3881 14 13.25 14H7.75C7.61193 14 7.5 13.8881 7.5 13.75V6.25Z"
            fill="currentColor"
          />
        </svg>
      )}
      Copy Markdown
    </button>
  );
}
