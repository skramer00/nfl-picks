// Explicitly isolate experiments from every published-pick consumer. Historical
// production versions remain selectable; experimental suffixes never are.
export function isPublishedForecast(version: string) {
  return !version.endsWith("-baseline") && !version.endsWith("-shadow");
}
