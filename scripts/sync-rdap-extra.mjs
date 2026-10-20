#!/usr/bin/env node
/**
 * 同步 RDAP 额外服务器列表
 * 从多个数据源获取最新的 ccTLD 和 gTLD RDAP 服务器信息
 * 并合并到 rdap-servers-extra.json
 *
 * 数据源：
 * 1. GitHub Gist - GrapeApple0 的 ccTLD RDAP 列表
 * 2. rdapapi.io - 完整的 TLD RDAP 目录
 */

import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data");
const EXTRA_FILE = path.join(DATA_DIR, "rdap-servers-extra.json");

// 数据源配置
const SOURCES = {
  gist: {
    url: "https://gist.githubusercontent.com/GrapeApple0/f006fc4fecd82b02ab683f49252f976a/raw/rdap-cctld.txt",
    name: "GitHub Gist (GrapeApple0)"
  }
};

// 已知的固定映射（手动维护的关键 TLD）
const MANUAL_MAPPINGS = {
  // 欧洲
  "de": "https://rdap.denic.de/",
  "ch": "https://rdap.nic.ch/",
  "li": "https://rdap.nic.ch/",
  "fr": "https://rdap.nic.fr/",
  "pm": "https://rdap.nic.fr/",
  "re": "https://rdap.nic.fr/",
  "tf": "https://rdap.nic.fr/",
  "wf": "https://rdap.nic.fr/",
  "yt": "https://rdap.nic.fr/",
  "nl": "https://rdap.sidn.nl/",
  "cz": "https://rdap.nic.cz/",
  "fi": "https://rdap.fi/rdap/rdap/",
  "si": "https://rdap.register.si/",
  "no": "https://rdap.norid.no/",
  "is": "https://rdap.isnic.is/",
  "ad": "https://rdap.nic.ad/",
  "dk": "https://rdap.nic.dk/",
  "es": "https://rdap.nic.es/",
  "ee": "https://rdap.nic.ee/",
  "hr": "https://rdap.nic.hr/",
  "hu": "https://rdap.nic.hu/",
  "it": "https://rdap.nic.it/",
  "lt": "https://rdap.domreg.lt/",
  "lu": "https://rdap.nic.lu/",
  "lv": "https://rdap.nic.lv/",
  "pl": "https://rdap.nic.pl/",
  "pt": "https://rdap.nic.pt/",
  "ro": "https://rdap.nic.ro/",
  "se": "https://rdap.nic.se/",
  "sk": "https://rdap.nic.sk/",
  "gr": "https://rdap.nic.gr/",

  // 英国/英联邦
  "uk": "https://rdap.nominet.uk/uk/",
  "ac": "https://rdap.nic.ac/",
  "je": "https://rdap.nic.je/",
  "im": "https://rdap.nic.im/",
  "gg": "https://rdap.nic.gg/",

  // 美洲
  "br": "https://rdap.registro.br/",
  "ca": "https://rdap.ca.fury.ca/",
  "ar": "https://rdap.nic.ar/",
  "ec": "https://rdap.registry.ec/",
  "ve": "https://rdap.nic.ve/rdap/",
  "ai": "https://rdap.whois.ai/",
  "aw": "https://rdap.nic.aw/",
  "ax": "https://rdap.nic.ax/",
  "cr": "https://rdap.nic.cr/",
  "cv": "https://rdap.nic.cv/",
  "ky": "https://whois.kyregistry.ky/rdap/",
  "pr": "https://rdap.identitydigital.services/rdap/",
  "vg": "https://rdap.centralnic.com/vg/",
  "gs": "https://rdap.nic.gs/",
  "ms": "https://rdap.coccaregistry.org/",
  "tc": "https://rdap.nic.tc/",
  "gd": "https://rdap.centralnic.com/gd/",
  "gp": "https://rdap.nic.gp/",
  "gf": "https://rdap.nic.gf/",
  "mq": "https://rdap.nic.mq/",
  "re": "https://rdap.nic.fr/",
  "uy": "https://rdap.nic.uy/",
  "cl": "https://rdap.nic.cl/",
  "gt": "https://rdap.nic.gt/",
  "hn": "https://rdap.coccaregistry.org/",
  "ht": "https://rdap.coccaregistry.org/",
  "gy": "https://rdap.coccaregistry.org/",
  "pa": "https://rdap.nic.pa/",
  "pe": "https://rdap.nic.pe/",
  "py": "https://rdap.nic.py/",
  "sr": "https://rdap.nic.sr/",

  // 大洋洲
  "au": "https://rdap.identitydigital.services/rdap/",
  "ki": "https://rdap.coccaregistry.org/",
  "sb": "https://rdap.coccaregistry.org/",
  "tl": "https://rdap.nic.tl/",
  "nf": "https://rdap.nic.nf/",
  "cx": "https://rdap.nic.cx/",
  "vu": "https://rdap.dnrs.vu/",
  "fm": "https://rdap.centralnic.com/fm/",
  "tv": "https://rdap.nic.tv/",
  "ws": "https://rdap.nic.ws/",
  "to": "https://rdap.nic.to/",
  "nu": "https://rdap.identitydigital.services/rdap/",
  "tk": "https://rdap.nic.tk/",
  "mh": "https://rdap.nic.mh/",

  // 非洲
  "za": "https://rdap.coccaregistry.org/",
  "sn": "https://rdap.nic.sn/",
  "ga": "https://rdap.nic.ga/",
  "mr": "https://rdap.nic.mr/",
  "td": "https://rdap.nic.td/",
  "ke": "https://rdap.kenic.or.ke/",
  "so": "https://rdap.nic.so/",
  "bw": "https://rdap.nic.net.bw/",
  "gn": "https://rdap.ande.gov.gn/",
  "sd": "https://rdap.nic.sd/",
  "ss": "https://rdap.nic.ss/",
  "tz": "https://whois.tznic.or.tz/rdap/",
  "zm": "https://rdap.nic.zm/",
  "zw": "https://rdap.nic.zw/",
  "et": "https://rdap.ethiotelecom.et/rdap/",
  "cm": "https://rdap.nic.cm/",
  "mg": "https://rdap.nic.mg/",
  "ml": "https://rdap.nic.ml/",
  "mu": "https://rdap.nic.mu/",
  "mw": "https://rdap.nic.mw/",
  "mz": "https://rdap.nic.mz/",
  "ng": "https://whois.nic.net.ng/",
  "tg": "https://rdap.nic.tg/",
  "ug": "https://rdap.nic.ug/",

  // 亚洲
  "id": "https://rdap.pandi.id/rdap/",
  "my": "https://rdap.mynic.my/rdap/",
  "lb": "https://rdap.lbdr.org.lb/",
  "vn": "https://rdap.vnnic.vn/",
  "hk": "https://rdap.hkirc.hk/",
  "tw": "https://rdap.twnic.tw/rdap/",
  "jp": "https://rdap.jprs.jp/",
  "kr": "https://rdap.kr/",
  "af": "https://rdap.nic.af/",
  "bh": "https://rdap.centralnic.com/bh/",
  "om": "https://rdap.registry.om/",
  "qa": "https://rdap.registry.qa/",
  "ae": "https://rdap.aeda.net.ae/",
  "kw": "https://rdap.kw/",
  "il": "https://rdap.isoc.org.il/",
  "in": "https://rdap.nixiregistry.in/rdap/",
  "us": "https://rdap.nic.us/",
  "pk": "https://rdap.nic.pk/",
  "lk": "https://rdap.nic.lk/",
  "bd": "https://rdap.nic.bd/",
  "np": "https://rdap.nic.np/",
  "mm": "https://rdap.nic.mm/",
  "th": "https://rdap.nic.th/",
  "la": "https://rdap.nic.la/",
  "ph": "https://rdap.nic.ph/",
  "sg": "https://rdap.nic.sg/",
  "bn": "https://rdap.nic.bn/",
  "mo": "https://rdap.nic.mo/",
  "mn": "https://rdap.identitydigital.services/rdap/",
  "kz": "https://rdap.nic.kz/",
  "kg": "http://rdap.cctld.kg/",
  "tj": "https://rdap.nic.tj/",
  "tm": "https://rdap.nic.tm/",
  "uz": "https://rdap.cctld.uz/",
  "cn": "https://rdap.cnnic.cn/",

  // 中东/中亚
  "az": "https://rdap.nic.az/",
  "am": "https://rdap.nic.am/",
  "ge": "https://rdap.nic.ge/",
  "tr": "https://rdap.nic.tr/",
  "sa": "https://rdap.nic.sa/",
  "jo": "https://rdap.nic.jo/",
  "iq": "https://rdap.nic.iq/",
  "ir": "https://rdap.nic.ir/",
  "sy": "https://rdap.nic.sy/",
  "ye": "https://rdap.nic.ye/",

  // 其他重要 ccTLD
  "ru": "https://rdap.nic.ru/",
  "su": "https://rdap.nic.ru/",
  "by": "https://rdap.nic.by/",
  "ua": "https://rdap.hostmaster.ua/",
  "md": "https://rdap.nic.md/",
  "rs": "https://rdap.nic.rs/",
  "mk": "https://rdap.nic.mk/",
  "me": "https://rdap.identitydigital.services/rdap/",
  "ba": "https://rdap.nic.ba/",
  "al": "https://rdap.nic.al/",
  "bg": "https://rdap.nic.bg/",
  "cy": "https://rdap.nic.cy/",
  "mt": "https://rdap.nic.mt/",
  "li": "https://rdap.nic.ch/",

  // 二级域名
  "br.com": "https://rdap.centralnic.com/br.com/",
  "cn.com": "https://rdap.centralnic.com/cn.com/",
  "de.com": "https://rdap.centralnic.com/de.com/",
  "eu.com": "https://rdap.centralnic.com/eu.com/",
  "gr.com": "https://rdap.centralnic.com/gr.com/",
  "jpn.com": "https://rdap.centralnic.com/jpn.com/",
  "ru.com": "https://rdap.centralnic.com/ru.com/",
  "sa.com": "https://rdap.centralnic.com/sa.com/",
  "uk.com": "https://rdap.centralnic.com/uk.com/",
  "us.com": "https://rdap.centralnic.com/us.com/",
  "za.com": "https://rdap.centralnic.com/za.com/",
  "gb.net": "https://rdap.centralnic.com/gb.net/",
  "in.net": "https://rdap.centralnic.com/in.net/",
  "se.net": "https://rdap.centralnic.com/se.net/",
  "uk.net": "https://rdap.centralnic.com/uk.net/",
  "v.ua": "https://rdap.v.ua/",
  "co.no": "https://rdap.norid.no/",

  // IDN ccTLD (中文/阿拉伯语等)
  "xn--fiqs8s": "https://rdap.cnnic.cn/",
  "xn--fiqz9s": "https://rdap.cnnic.cn/",
  "xn--j6w193g": "https://rdap.hkirc.hk/",
  "xn--kprw13d": "https://rdap.twnic.tw/rdap/",
  "xn--kpry57d": "https://rdap.twnic.tw/rdap/",
  "xn--p1ai": "https://rdap.nic.ru/",
  "xn--mgbaam7a8h": "https://rdap.nic.sa/",
  "xn--mgberp4a5d4ar": "https://rdap.nic.ae/",
  "xn--mxtq1m": "https://rdap.nic.xn--mxtq1m/",
  "xn--qxam": "https://rdap.nic.xn--qxam/",

  // IDN ccTLD 同运营方 RDAP(2026-10-20 逐条 curl 实测验证)
  "xn--80ao21a": "https://rdap.nic.kz/",           // қаз,google.қаз 返回 200
  "xn--ogbpf8fl": "https://rdap.nic.sy/",          // سورية,سورية.سورية 返回 200
  "xn--mgb9awbf": "https://rdap.registry.om/",     // عمان,权威 .om 服务器,RDAP 404 JSON
  "xn--mgbx4cd0ab": "https://rdap.mynic.my/rdap/", // مليسيا,权威 .my 服务器,RDAP 404 JSON

  // 印度 IDN(NIXI 官方 RDAP,IANA 中 .in 同源;乱码域名均返回标准 RDAP 404 JSON)
  "xn--2scrj9c": "https://rdap.nixiregistry.in/rdap/",
  "xn--3hcrj9c": "https://rdap.nixiregistry.in/rdap/",
  "xn--45br5cyl": "https://rdap.nixiregistry.in/rdap/",
  "xn--45brj9c": "https://rdap.nixiregistry.in/rdap/",
  "xn--fpcrj9c3d": "https://rdap.nixiregistry.in/rdap/",
  "xn--gecrj9c": "https://rdap.nixiregistry.in/rdap/",
  "xn--h2breg3eve": "https://rdap.nixiregistry.in/rdap/",
  "xn--h2brj9c": "https://rdap.nixiregistry.in/rdap/",
  "xn--h2brj9c8c": "https://rdap.nixiregistry.in/rdap/",
  "xn--mgbbh1a": "https://rdap.nixiregistry.in/rdap/",
  "xn--mgbbh1a71e": "https://rdap.nixiregistry.in/rdap/",
  "xn--mgbgu82a": "https://rdap.nixiregistry.in/rdap/",
  "xn--rvc1e0am3e": "https://rdap.nixiregistry.in/rdap/",
  "xn--s9brj9c": "https://rdap.nixiregistry.in/rdap/",
  "xn--xkc2dl3a5ee0h": "https://rdap.nixiregistry.in/rdap/",
};

// 上游数据源中的错误/失效映射,强制排除(2026-10-20 实测)
const EXCLUDE_TLDS = new Set([
  // Gist 将埃及 IDN 映射到印度注册局 rdap.inregistry.net,该主机已停止解析;
  // 埃及无公开 RDAP(rdap.nic.eg / rdap.egregistry.eg 均不存在)
  "xn--wgbh1c",
  // 卡塔尔:rdap.nic.qa / rdap.registry.qa / rdap.qa 均无法解析,
  // whois.registry.qa:43 可用,移除 RDAP 映射以免浪费回退时间
  "xn--wgbl6a",
  // 巴勒斯坦:无公开 RDAP(rdap.pnina.ps 不存在);上游映射到阿曼注册局
  // (rdap.registry.om / rdap.nic.om)属错误来源,活的错误服务器会返回
  // 掩盖性 404,阻断后续 whois 回退,故移除
  "xn--ygbi2ammx",
]);

/**
 * 解析 Gist 数据
 * Gist 格式是类似 JSON 的文本，但包含注释
 */
function parseGistData(text) {
  const result = {};
  const lines = text.split("\n");

  for (const line of lines) {
    // 跳过注释行
    if (line.trim().startsWith("#") || !line.trim()) continue;

    // 匹配 "tld": "url" 格式
    const match = line.match(/"([^"]+)"\s*:\s*"([^"]+)"/);
    if (match) {
      const [, tld, url] = match;
      // 确保 URL 以 / 结尾
      let normalizedUrl = url.trim();
      if (!normalizedUrl.endsWith("/")) {
        normalizedUrl += "/";
      }
      // 移除 /domain/ 路径，保留 base URL
      normalizedUrl = normalizedUrl.replace(/\/domain\/$/, "/");
      result[tld.trim().toLowerCase()] = normalizedUrl;
    }
  }

  return result;
}

/**
 * 从 Gist 获取数据
 */
async function fetchFromGist() {
  console.log(`📡 从 ${SOURCES.gist.name} 获取数据...`);
  try {
    const response = await fetch(SOURCES.gist.url, {
      headers: { "User-Agent": "whoga-rdap-sync/1.0" }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const data = parseGistData(text);
    console.log(`✅ 从 Gist 获取了 ${Object.keys(data).length} 个 TLD`);
    return data;
  } catch (error) {
    console.error(`❌ 从 Gist 获取失败: ${error.message}`);
    return {};
  }
}

/**
 * 读取现有的 rdap-servers-extra.json(作为最低优先级数据源,
 * 保证重新生成不会丢失历史条目,如 rdapapi.io 来源的映射)
 */
async function readExistingData() {
  try {
    const raw = await readFile(EXTRA_FILE, "utf-8");
    const data = JSON.parse(raw);
    const result = {};
    for (const [tld, url] of Object.entries(data)) {
      if (tld.startsWith("_")) continue; // 跳过 _comment/_version 等元数据
      if (typeof url === "string") result[tld] = url;
    }
    console.log(`📂 现有文件读取了 ${Object.keys(result).length} 个 TLD`);
    return result;
  } catch (error) {
    console.log(`⚠️  无法读取现有文件: ${error.message}`);
    return {};
  }
}

/**
 * 合并所有数据源
 */
function mergeData(existingData, gistData, manualData) {
  // 优先级：手动维护 > Gist > 现有数据
  const merged = { ...existingData, ...gistData, ...manualData };

  // 去重和标准化
  const normalized = {};
  for (const [tld, url] of Object.entries(merged)) {
    const normalizedTld = tld.toLowerCase().trim();

    // 排除已知的错误/失效映射
    if (EXCLUDE_TLDS.has(normalizedTld)) {
      console.log(`🚫 排除失效映射: ${normalizedTld} -> ${url}`);
      continue;
    }

    let normalizedUrl = url.trim();

    // 确保 URL 以 / 结尾
    if (!normalizedUrl.endsWith("/")) {
      normalizedUrl += "/";
    }

    // 过滤掉 rdap.org 的条目（第三方服务，非官方）
    if (normalizedUrl.includes("rdap.org")) {
      console.log(`⚠️  跳过第三方服务: ${normalizedTld} -> ${normalizedUrl}`);
      continue;
    }

    normalized[normalizedTld] = normalizedUrl;
  }

  return normalized;
}

/**
 * 生成最终 JSON 文件
 */
async function generateJson(data) {
  const version = new Date().toISOString().split("T")[0].replace(/-/g, ".");
  const timestamp = new Date().toISOString();

  const output = {
    _comment: `Official RDAP servers for TLDs. Auto-synced from multiple sources. Last updated: ${timestamp}.`,
    _version: version,
    _sources: ["GitHub Gist (GrapeApple0)", "Manual curation"],
    _stats: {
      totalTlds: Object.keys(data).length,
      ccTlds: Object.keys(data).filter(k => k.length === 2).length,
      idnTlds: Object.keys(data).filter(k => k.startsWith("xn--")).length,
      secondLevel: Object.keys(data).filter(k => k.includes(".")).length
    }
  };

  // 按字母顺序排序并添加数据
  const sortedKeys = Object.keys(data).sort((a, b) => {
    // 先按类型排序：ccTLD > IDN > 其他
    const getPriority = (k) => {
      if (k.length === 2) return 0;
      if (k.startsWith("xn--")) return 1;
      if (k.includes(".")) return 2;
      return 3;
    };

    const pa = getPriority(a);
    const pb = getPriority(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });

  for (const key of sortedKeys) {
    output[key] = data[key];
  }

  return JSON.stringify(output, null, 2);
}

/**
 * 主函数
 */
async function main() {
  console.log("🚀 开始同步 RDAP 额外服务器列表...\n");

  // 获取各数据源
  const gistData = await fetchFromGist();
  const existingData = await readExistingData();

  // 合并数据
  console.log("\n🔀 合并数据源...");
  const merged = mergeData(existingData, gistData, MANUAL_MAPPINGS);
  console.log(`📊 合并后共 ${Object.keys(merged).length} 个 TLD`);

  // 统计分类
  const stats = {
    ccTld: Object.keys(merged).filter(k => k.length === 2).length,
    idn: Object.keys(merged).filter(k => k.startsWith("xn--")).length,
    secondLevel: Object.keys(merged).filter(k => k.includes(".")).length,
    newGtld: Object.keys(merged).filter(k => k.length > 2 && !k.includes(".") && !k.startsWith("xn--")).length
  };
  console.log("📈 统计:");
  console.log(`   - 国家代码域名 (ccTLD): ${stats.ccTld}`);
  console.log(`   - 国际化域名 (IDN): ${stats.idn}`);
  console.log(`   - 二级域名: ${stats.secondLevel}`);
  console.log(`   - 新 gTLD: ${stats.newGtld}`);

  // 生成输出
  const json = await generateJson(merged);

  // 写入文件
  await writeFile(EXTRA_FILE, json, "utf-8");
  console.log(`\n✅ 已写入: ${EXTRA_FILE}`);

  console.log("\n🎉 同步完成！");
  console.log("\n提示: 要测试新的 RDAP 服务器，请运行:");
  console.log("  npm run check:tlds-queryability");
  console.log("  npm run test:rdap-all");
}

// 错误处理
main().catch(error => {
  console.error("\n❌ 同步失败:", error.message);
  process.exit(1);
});
