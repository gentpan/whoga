# 数据 · 种子目录 Seed Data

仓库内的 RDAP/WHOIS 引导数据，**git 跟踪**。应用运行时优先读取 `runtime/data/`，缺失时回退到此目录。

| 类型 | 示例文件 |
|------|----------|
| IANA 引导 | `dns.json`, `asn.json`, `ipv4.json`, `ipv6.json` |
| 合并索引 | `whois-merged.json` |
| 手工维护 | `rdap-servers-extra.json`, `missing-tld-lookup.json`, `whois-extra-hosts.json` |
| 元数据 | `data-manifest.json`, `update-meta.json` |

维护脚本见 `scripts/`；运行时写入目录见 `runtime/data/`（gitignore）。
