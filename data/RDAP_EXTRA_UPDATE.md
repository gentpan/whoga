# RDAP 额外数据源更新报告

## 更新日期
2025年4月5日

## 更新内容

### 1. 更新的文件
- `data/rdap-servers-extra.json` - 从 258 个条目优化为 **190 个官方 RDAP 服务器**

### 2. 关键改进

#### 替换第三方服务
**移除**: 205 个指向 `https://rdap.org/` 的第三方服务条目  
**替换为**: 190 个直接指向各国官方注册局的 RDAP 服务器

#### 新增支持的 ccTLD (国家代码域名)

| 地区 | 新增国家 | 示例 |
|------|---------|------|
| **欧洲** | 德国、法国、瑞士、荷兰、捷克、芬兰、挪威... | `de`, `fr`, `ch`, `nl`, `cz`... |
| **亚洲** | 日本、韩国、中国、香港、台湾、新加坡、印度... | `jp`, `kr`, `cn`, `hk`, `tw`... |
| **美洲** | 巴西、加拿大、阿根廷、智利... | `br`, `ca`, `ar`, `cl`... |
| **大洋洲** | 澳大利亚、新西兰、汤加... | `au`, `nu`, `to`... |
| **非洲** | 南非、尼日利亚、肯尼亚... | `za`, `ng`, `ke`... |

#### 支持的国际化域名 (IDN)
- `.中国` (xn--fiqs8s) → CNNIC
- `.中國` (xn--fiqz9s) → CNNIC
- `.香港` (xn--j6w193g) → HKIRC
- `.台湾` (xn--kprw13d) → TWNIC
- `.台灣` (xn--kpry57d) → TWNIC
- `.рф` (xn--p1ai) → Russian RDAP
- `.السعودية` (xn--mgberp4a5d4ar) → Saudi Arabia
- `.قطر` (xn--wgbl6a) → Qatar

## 统计数据

```
总计 TLD: 190
├── 国家代码域名 (ccTLD): 161
├── 国际化域名 (IDN): 12
├── 二级域名 (如 co.uk): 17
└── 其他: 0
```

## 新增脚本

### 自动同步脚本
**文件**: `scripts/sync-rdap-extra.mjs`

**功能**:
- 从 GitHub Gist 自动获取最新 ccTLD RDAP 列表
- 合并手动维护的官方服务器映射
- 自动过滤第三方服务 (rdap.org)
- 生成标准化的 JSON 输出

**使用方法**:
```bash
npm run sync:rdap-extra
```

## 测试新服务器

### 1. 检查 TLD 可查询状态
```bash
npm run check:tlds-queryability
```
这会生成报告显示哪些 TLD 现在可以查询了。

### 2. 全量 RDAP 测试
```bash
npm run test:rdap-all
```
这会逐个测试所有 TLD 的 RDAP 响应可用性。

### 3. 手动测试示例

测试德国域名:
```bash
curl "http://localhost:3000/api/whois?domain=example.de"
```

测试日本域名:
```bash
curl "http://localhost:3000/api/whois?domain=example.jp"
```

测试巴西域名:
```bash
curl "http://localhost:3000/api/whois?domain=example.br"
```

## 架构说明

查询优先级:
```
1. IANA dns.json (官方主源)
   ↓ 未命中
2. rdap-servers-extra.json (补充源 - 已更新 190 个服务器)
   ↓ 未命中
3. IANA Fallback (https://rdap.iana.org/)
```

## 已知限制

以下国家仍可能无法通过 RDAP 查询（无官方 RDAP 支持或只支持 WHOIS）:
- 美国 (`us`) - 使用传统 WHOIS
- 部分非洲国家
- 部分小型岛国

对于这些域名，系统会回退到 IANA 基础查询，可能返回不完整信息。

## 未来改进

1. **传统 WHOIS Fallback**: 为无 RDAP 支持的 ccTLD 添加 WHOIS 协议支持
2. **定期自动同步**: 在 CI/CD 或定时任务中运行 `npm run sync:rdap-extra`
3. **服务器健康检查**: 自动检测并标记不可用的 RDAP 服务器

## 参考资源

- [GitHub Gist - ccTLD RDAP 列表](https://gist.github.com/GrapeApple0/f006fc4fecd82b02ab683f49252f976a)
- [RDAP API - TLD 目录](https://rdapapi.io/tlds)
- [IANA RDAP Bootstrap](https://data.iana.org/rdap/dns.json)
