/**
 * Scraper Code Validation
 *
 * Validates TypeScript/JavaScript code before storing in the database.
 * Catches syntax errors and corrupted template literals.
 */

/**
 * Validates that scraper code is syntactically valid JavaScript/TypeScript.
 * This prevents storing corrupted code that will fail at runtime.
 *
 * @throws Error if the code has syntax errors
 */
export function validateScraperCode(code: string): void {
  // Check for common corrupted template literal patterns
  // These happen when code is truncated or corrupted during transmission
  const corruptedPatterns = [
    // Unclosed template literal expressions
    /\$\{[^}]*$/m, // ${expr at end of line without closing }
    /\$\{[^}]*\n[^}]*$/s, // ${expr spanning multiple lines without }
    // Orphaned template literal parts
    /`[^`]*\$\{[^}]*`/g, // Check each backtick string has balanced ${}
  ];

  // Count template literal delimiters - should be balanced
  const backtickCount = (code.match(/(?<!\\)`/g) || []).length;
  if (backtickCount % 2 !== 0) {
    throw new Error(
      "Syntax validation failed: Unbalanced template literal backticks - code may be truncated"
    );
  }

  // Check for unclosed ${} in template literals
  // This regex finds template literals and checks their expressions
  const templateLiteralRegex = /`([^`]*)`/gs;
  let match;
  while ((match = templateLiteralRegex.exec(code)) !== null) {
    const content = match[1];
    // Count ${ and } - should be balanced
    const openBraces = (content.match(/\$\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
      throw new Error(
        `Syntax validation failed: Unclosed template expression \${} in template literal - found ${openBraces} opens but only ${closeBraces} closes`
      );
    }
  }

  // Try to parse as JavaScript using Function constructor
  // This catches basic syntax errors without executing the code
  try {
    // Wrap in async function to allow await/async syntax
    // We don't execute it, just check if it parses
    new Function(`return async function() { ${code} }`);
  } catch (e) {
    const error = e as SyntaxError;
    throw new Error(
      `Syntax validation failed: ${error.message}. The scraper code contains JavaScript syntax errors.`
    );
  }

  // Additional check for common scraper issues
  const dangerPatterns = [
    // Incomplete function definitions
    { pattern: /function\s+\w+\s*\([^)]*\)\s*\{[^}]*$/, msg: "Incomplete function definition" },
    // Incomplete arrow functions
    { pattern: /=>\s*\{[^}]*$/, msg: "Incomplete arrow function" },
    // Incomplete object literals
    { pattern: /\{\s*\w+\s*:[^}]*$/, msg: "Incomplete object literal" },
  ];

  for (const { pattern, msg } of dangerPatterns) {
    if (pattern.test(code)) {
      throw new Error(`Syntax validation failed: ${msg} - code may be truncated`);
    }
  }
}

/**
 * Domains mapped to their built-in scraper modules.
 * When a source URL matches a domain, the corresponding
 * scraperModule is auto-assigned.
 */
export const BUILTIN_SCRAPER_DOMAINS: Record<string, string[]> = {
  omsi: ["omsi.edu", "secure.omsi.edu"],
  // Add more as built-in scrapers are created:
  // "portland-parks": ["portlandoregon.gov/parks"],
};

/**
 * Given a URL, return the matching built-in scraper module name if any.
 * Returns undefined if no built-in scraper matches.
 */
export function getBuiltInScraperForUrl(url: string): string | undefined {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    for (const [moduleName, domains] of Object.entries(BUILTIN_SCRAPER_DOMAINS)) {
      for (const domain of domains) {
        // Check if hostname matches or ends with the domain
        if (hostname === domain || hostname.endsWith(`.${domain}`)) {
          return moduleName;
        }
      }
    }
    return undefined;
  } catch {
    // Invalid URL
    return undefined;
  }
}
