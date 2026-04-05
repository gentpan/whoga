export type DnsServiceEntry = [string[], string[]];

export interface DnsRegistry {
  version?: string;
  publication?: string;
  description?: string;
  services: DnsServiceEntry[];
}

export interface DnsRegistryMeta {
  updatedAt: string;
  sourceUrl: string;
  publication?: string;
}
