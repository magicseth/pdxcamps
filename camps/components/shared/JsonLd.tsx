/**
 * Reusable JSON-LD structured data component.
 * Renders a <script type="application/ld+json"> tag with the provided data.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
