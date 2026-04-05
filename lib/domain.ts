const DOMAIN_PATTERN = /^(?=.{1,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z0-9-]{2,63}$/i;

export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^\.+/, "").replace(/\.+$/, "");
}

export function isValidDomain(domain: string): boolean {
  return DOMAIN_PATTERN.test(domain) && !domain.includes("..") && !domain.endsWith("-");
}

export function isValidSuffix(suffix: string): boolean {
  if (!suffix || suffix.includes(".") || suffix.length < 2 || suffix.length > 63) {
    return false;
  }
  if (!/^[a-z0-9-]+$/i.test(suffix)) {
    return false;
  }
  return !suffix.startsWith("-") && !suffix.endsWith("-");
}
