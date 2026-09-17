# 文献元数据 → 生成 src/lib/literature.ts
# 数据源：三包文献（RIS 解析 32 篇去重后 + 人工校订 PDF 39 篇 = 71 条）
# bahloul2021 ×3 为同一篇误下载的哲学论文（Cacciari, Nomes de Lugar），与高血压无关，排除
# 用法：python scripts/build_literature.py
import re
from pathlib import Path

ROOT = Path(r"F:\KimiData\kimi\Workspaces\市创\参考文献")
OUT = Path(r"F:\KimiData\kimi\Workspaces\市创\intellipress-twin\src\lib\literature.ts")

CAT_LLM = "大模型×高血压"
CAT_TWIN = "数字孪生"
CAT_REAL = "真实数据"
CAT_STAT = "数据统计"
CAT_LIFE = "生活方式与综合管理"

RIS_SOURCES = [
    (ROOT / "文献分类汇总/文献分类汇总/大模型  智能体 × 高血压   文献/大模型  智能体 × 高血压   文献.ris", CAT_LLM),
    (ROOT / "文献分类汇总/文献分类汇总/数字孪生推演（李生推演模块） 文献/数字孪生推演（李生推演模块） 文献.ris", CAT_TWIN),
    (ROOT / "文献分类汇总/文献分类汇总/真实数据（论文数据来源）  文献/真实数据（论文数据来源）  文献.ris", CAT_REAL),
]

# ── PDF 人工校订表（逐篇读过 PDF 首页后登记；key = 文件名）──
PDF_CURATED = [
    # 王冯誉豪包（数据统计）
    {"file": "1-s2.0-S1746809421004109-main.pdf", "category": CAT_STAT,
     "title": "A review of machine learning in hypertension detection and blood pressure estimation based on clinical and physiological data",
     "author": "Martinez-Ríos 等", "year": "2021"},
    {"file": "fcvm-09-839379.pdf", "category": CAT_STAT,
     "title": "Machine Learning Approaches for Predicting Hypertension and Its Associated Factors Using Population-Level Data From Three South Asian Countries",
     "author": "Islam 等", "year": "2022"},
    {"file": "fpubh-09-619429.pdf", "category": CAT_STAT,
     "title": "Predicting the Risk of Hypertension Based on Several Easy-to-Collect Risk Factors: A Machine Learning Method",
     "author": "Zhao 等", "year": "2021"},
    {"file": "jaeger-et-al-2023-hypertension-statistics-for-us-adults-an-open-source-web-application-for-analysis-and-visualization.pdf", "category": CAT_STAT,
     "title": "Hypertension Statistics for US Adults: An Open-Source Web Application for Analysis and Visualization of NHANES Data",
     "author": "Jaeger 等", "year": "2023"},
    # 高雨晴包（生活方式与综合管理）
    {"file": "10.1038@sj.jhh.1001076.pdf", "category": CAT_LIFE,
     "title": "Ambulatory blood pressure monitoring and 24-h blood pressure control as predictors of outcome in treated hypertensive patients (ASCOT sub-study)",
     "author": "O'Brien 等", "year": "2001"},
    {"file": "A-Hypertensive-Conundrum.pdf", "category": CAT_LIFE,
     "title": "A Hypertensive Conundrum (Editorial)", "author": "Welch", "year": "2025"},
    {"file": "altiner2012.pdf", "category": CAT_LIFE,
     "title": "Patients' concepts of hypertension: new insights support the need for more shared decision making",
     "author": "Altiner", "year": "2012"},
    {"file": "Associations-and-attributable-burden-between-risk-factors-and-all-cause-and-cause-specific.pdf", "category": CAT_LIFE,
     "title": "Associations and attributable burden between risk factors and all-cause and cause-specific mortality at different ages in patients with hypertension",
     "author": "Jin 等", "year": "2024"},
    {"file": "Behavior-of-albuminuria-in-patients-with-a-more-intense-control-of-their-blood-pressure.pdf", "category": CAT_LIFE,
     "title": "Behavior of albuminuria in patients with a more intense control of their blood pressure",
     "author": "Maria-Tablado", "year": "2023"},
    {"file": "Behavioural-approach-avoidance-tendencies-among-individuals-with-elevated-blood-pressure.pdf", "category": CAT_LIFE,
     "title": "Behavioural approach-avoidance tendencies among individuals with elevated blood pressure",
     "author": "Shukla 等", "year": "2024"},
    {"file": "carlsson2008.pdf", "category": CAT_LIFE,
     "title": "Risk Factors Associated With Newly Diagnosed High Blood Pressure in Men and Women",
     "author": "Carlsson 等", "year": "2008"},
    {"file": "Comparison-of-data-driven-identified-hypertension-protective-dietary-patterns-among-Chinese.pdf", "category": CAT_LIFE,
     "title": "Comparison of data-driven identified hypertension-protective dietary patterns among Chinese adults: based on a nationwide study",
     "author": "Yang 等", "year": "2023"},
    {"file": "consoli1989.pdf", "category": CAT_LIFE,
     "title": "A behavioral typology of hypertensive out-patients followed up in general practice",
     "author": "Consoli 等", "year": "1989"},
    {"file": "Constipation-and-high-blood-pressure-variability.pdf", "category": CAT_LIFE,
     "title": "Constipation and high blood pressure variability", "author": "Mishima", "year": "2024"},
    {"file": "Effect-of-antihypertensive-medications-on-sleep-status-in-hypertensive-patients.pdf", "category": CAT_LIFE,
     "title": "Effect of antihypertensive medications on sleep status in hypertensive patients",
     "author": "Zeng 等", "year": "2022"},
    {"file": "Effects-of-probiotics-on-hypertension.pdf", "category": CAT_LIFE,
     "title": "Effects of probiotics on hypertension", "author": "Yuan 等", "year": "2023"},
    {"file": "erden2014.pdf", "category": CAT_LIFE,
     "title": "Epidemiology of cardiovascular diseases and hypertension (EAS 2014 abstract)",
     "author": "Erden", "year": "2014"},
    {"file": "Exploration-of-patients-practices-related-to-home-blood-pressure-monitoring.pdf", "category": CAT_LIFE,
     "title": "Exploration of patients' practices related to home blood pressure monitoring",
     "author": "Litvin 等", "year": "2024"},
    {"file": "fang2021.pdf", "category": CAT_LIFE,
     "title": "A hybrid machine learning approach for hypertension risk prediction",
     "author": "Fang 等", "year": "2021"},
    {"file": "Global-guidelines-recommendations-for-lifestyle-modifications-in-patients-with-hypertension.pdf", "category": CAT_LIFE,
     "title": "Global guidelines recommendations for lifestyle modifications in patients with hypertension",
     "author": "Arakawa 等", "year": "2026"},
    {"file": "guiling2015.pdf", "category": CAT_LIFE,
     "title": "Modeling of hypertensive patient's behavior based on the health information",
     "author": "Li 等", "year": "2015"},
    {"file": "How-to-deal-with-a-hypertensive-patient-who-has-documented-non-adherence-to-the-prescribed.pdf", "category": CAT_LIFE,
     "title": "How to deal with a hypertensive patient who has documented non-adherence to the prescribed antihypertensive therapy?",
     "author": "Georgianos 等", "year": "2024"},
    {"file": "Hypertension (1).pdf", "category": CAT_LIFE,
     "title": "Hypertension (clinical review chapter: diagnosis, evaluation and treatment)",
     "author": "Landefeld 等", "year": ""},
    {"file": "Hypertension.pdf", "category": CAT_LIFE,
     "title": "Hypertension (Chapter 20: ABPM/ASCVD review)",
     "author": "Agrawal 等", "year": "2020"},
    {"file": "Hypertensive-Management.pdf", "category": CAT_LIFE,
     "title": "Hypertensive Management", "author": "Thomas", "year": "2023"},
    {"file": "jesus2008.pdf", "category": CAT_LIFE,
     "title": "Profile of hypertensive patients: biosocial characteristics, knowledge, and treatment compliance",
     "author": "Jesus 等", "year": "2008"},
    {"file": "kidson1971.pdf", "category": CAT_LIFE,
     "title": "Personality Factors in Hypertension", "author": "Kidson", "year": "1971"},
    {"file": "kjellgren1997.pdf", "category": CAT_LIFE,
     "title": "Hypertensive patients' knowledge of high blood pressure",
     "author": "Kjellgren 等", "year": "1997"},
    {"file": "Knowledge-Attitude-and-Practice-Toward-Hypertension-Among-Hypertensive-Patients-Residing.pdf", "category": CAT_LIFE,
     "title": "Knowledge, Attitude, and Practice Toward Hypertension Among Hypertensive Patients Residing in Lebanon",
     "author": "Machaalani 等", "year": "2022"},
    {"file": "li2018.pdf", "category": CAT_LIFE,
     "title": "Research on Information Required in Health Behavior Changes of Hypertensive Patients",
     "author": "Li 等", "year": "2018"},
    {"file": "linden1981.pdf", "category": CAT_LIFE,
     "title": "Essential Hypertension and Social Coping Behavior",
     "author": "Linden 等", "year": "1981"},
    {"file": "macdonald1988.pdf", "category": CAT_LIFE,
     "title": "Lifestyle Behaviors in Treated Hypertensives as Prediction of Blood Pressure Control",
     "author": "MacDonald 等", "year": "1988"},
    {"file": "Phenotypic-variations-of-hypertension-at-high-altitude.pdf", "category": CAT_LIFE,
     "title": "Phenotypic variations of hypertension at high altitude",
     "author": "Narvaez-Guerra 等", "year": "2023"},
    {"file": "Profiles-of-echocardiographic-features-associated-with-blood-pressure-in-patients-with-hypertension.pdf", "category": CAT_LIFE,
     "title": "Profiles of echocardiographic features associated with blood pressure in patients with hypertension",
     "author": "Zhao 等", "year": "2025"},
    {"file": "Selten-besprochene-Fragen-zum-Bluthochdruck.pdf", "category": CAT_LIFE,
     "title": "Selten besprochene Fragen zum Bluthochdruck (Editorial, German)",
     "author": "van der Giet 等", "year": "2018"},
    {"file": "shapiro1978.pdf", "category": CAT_LIFE,
     "title": "Behavioral and Environmental Aspects of Hypertension",
     "author": "Shapiro", "year": "1978"},
    {"file": "The-gut-microbiome-and-hypertension.pdf", "category": CAT_LIFE,
     "title": "The gut microbiome and hypertension",
     "author": "O'Donnell 等", "year": "2023"},
    {"file": "Therapeutic-intervention-exploring-hypertensive-patients-who-respond-to-health-coaching-behavior.pdf", "category": CAT_LIFE,
     "title": "Therapeutic intervention exploring hypertensive patients who respond to health coaching behavior modification therapy",
     "author": "Narita", "year": "2024"},
    {"file": "Understanding-clinical-inertia-in-hypertension-management-clues-from-real-world-data.pdf", "category": CAT_LIFE,
     "title": "Understanding clinical inertia in hypertension management: clues from real-world data",
     "author": "Satoh", "year": "2025"},
]

# ── 主题标签规则（标题关键词 → [主题标签, 图谱节点 id 或 None]）──
TOPIC_RULES = [
    (r"digital ?twin", "数字孪生", None),
    (r"large language|llm|chatgpt|chathtn|chatbot|rag\b|language model", "大模型推理", None),
    (r"artificial intelligence|machine learning|deep learning|neural|lstm|\bAI\b", "机器学习建模", None),
    (r"salt|sodium|dash|diet|dietary|nutrition|probiotic|gut microbiome", "膳食与限盐", "saltLimit"),
    (r"exercise|physical activity|aerobic|accelerometer", "运动干预", "briskWalk"),
    (r"obesity|weight loss|overweight", "减重", "weightLoss"),
    (r"smoking|tobacco", "戒烟", "quitSmoking"),
    (r"alcohol", "限酒", None),
    (r"sleep|bedtime|evening|morning versus evening|chronotherapy|night.?time dosing", "睡眠与作息", "sleepReg"),
    (r"adherence|compliance|non-?adherence|persistence|inertia|medication data|hydralazine|coaching", "服药依从性", "amlodipine"),
    (r"home blood pressure|hbpm|self.?monitor|ambulatory|abpm|telemonitor|mobile|mhealth|24-h blood pressure|cloud-based|logbook|electronic medical record", "家庭血压监测", "homeBP"),
    (r"morning surge", "晨峰血压", "morningSurge"),
    (r"non.?dipper|nocturnal|circadian|dipping", "夜间节律", "nonDipper"),
    (r"white.?coat|clinic to home", "白大衣高血压", "whiteCoat"),
    (r"masked", "隐匿性高血压", "maskedHtn"),
    (r"egfr|albuminuria|renal|kidney|ckd", "肾损害指标", "microalb"),
    (r"diabet", "糖尿病合并", "t2dm"),
    (r"stroke|cerebrovascular|ambulance", "脑卒中风险", "stroke"),
    (r"combination therap|monotherap|antihypertensive|losartan|hydralazine", "药物治疗", "amlodipine"),
    (r"echocardiograph|cardiac|heart|ventricular", "心脏靶器官", "hf"),
    (r"nhanes|prevalence|statistics|epidemiol|population|cohort|registry|burden|survey|risk factors associated", "流行病学数据", "elderly"),
    (r"knowledge|attitude|practice|concept|health behavior|information required|shared decision", "患者教育", "homeBP"),
    (r"lifestyle|behavioral|behavioural|environmental aspects|coping", "生活方式干预", "briskWalk"),
]

def topics_for(title: str):
    tags, nodes = [], []
    for pat, tag, node in TOPIC_RULES:
        if re.search(pat, title, re.I):
            if tag not in tags:
                tags.append(tag)
            if node and node not in nodes:
                nodes.append(node)
    if not tags:
        tags = ["综合证据"]
    return tags, nodes

def parse_ris(path: Path):
    entries, cur = [], {}
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        m = re.match(r"^([A-Z][A-Z0-9])  - (.*)$", raw)
        if not m:
            continue
        tag, val = m.group(1), m.group(2).strip()
        if tag == "TY":
            cur = {}
        elif tag == "TI":
            cur["title"] = val
        elif tag == "AU":
            cur.setdefault("authors", []).append(val)
        elif tag == "PY":
            cur["year"] = val[:4]
        elif tag == "ER":
            entries.append(cur)
    return entries

def ris_first_author(authors):
    if not authors:
        return "佚名"
    last = authors[0].split(",")[0].strip()
    return f"{last} 等" if len(authors) > 1 else last

def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')

def main():
    items = []
    for path, cat in RIS_SOURCES:
        for e in parse_ris(path):
            title = re.sub(r"\s+", " ", e.get("title", "")).strip()
            if title:
                items.append({"title": title, "author": ris_first_author(e.get("authors")), "year": e.get("year", ""), "category": cat})
    for c in PDF_CURATED:
        items.append({"title": c["title"], "author": c["author"], "year": c["year"], "category": c["category"]})

    # 去重（规范化标题）
    seen, uniq = set(), []
    for it in items:
        key = re.sub(r"\W+", "", it["title"].lower())
        if key in seen:
            print(f"  去重: {it['title'][:60]}")
            continue
        seen.add(key)
        uniq.append(it)

    for i, it in enumerate(uniq, 1):
        tags, nodes = topics_for(it["title"])
        it["id"] = f"lit{i:03d}"
        it["topics"] = tags
        it["kgNodes"] = nodes

    # 生成 TS
    lines = [
        "// ─────────────────────────────────────────────────────────────────",
        "// 文献证据库（自动生成，勿手改）",
        "// 生成：python scripts/build_literature.py · 2025 数据源为三包文献",
        "// · 文献分类汇总（RIS 解析 32 篇：大模型×高血压 13 / 数字孪生 4 / 真实数据 15 去重后）",
        "// · 高血压数据王冯誉豪（PDF 首页校订 4 篇）",
        "// · 高雨晴检索下载（PDF 首页校订 35 篇；bahloul2021×3 为同一篇误下载哲学论文，已排除）",
        "// 主题标签由标题关键词规则匹配，挂接 knowledgeGraph 节点；无匹配节点为「综合证据」",
        "// ─────────────────────────────────────────────────────────────────",
        "",
        "export type LitCategory =",
        '  | "大模型×高血压"',
        '  | "数字孪生"',
        '  | "真实数据"',
        '  | "数据统计"',
        '  | "生活方式与综合管理"',
        "",
        "export interface LiteratureItem {",
        "  id: string",
        "  title: string",
        "  author: string // 第一作者 et al.",
        "  year: string",
        "  category: LitCategory",
        "  topics: string[] // 主题标签",
        "  kgNodes: string[] // 挂接的知识图谱节点 id（空 = 综合证据）",
        "}",
        "",
        "export const LITERATURE: LiteratureItem[] = [",
    ]
    for it in uniq:
        lines.append(
            f'  {{ id: "{it["id"]}", title: "{esc(it["title"])}", author: "{esc(it["author"])}", '
            f'year: "{it["year"]}", category: "{it["category"]}", '
            f"topics: [{', '.join(chr(34) + esc(t) + chr(34) for t in it['topics'])}], "
            f"kgNodes: [{', '.join(chr(34) + n + chr(34) for n in it['kgNodes'])}] }},"
        )
    lines += [
        "]",
        "",
        "export const LIT_TOTAL = LITERATURE.length",
        "",
        "export const LIT_BY_CATEGORY: Record<LitCategory, LiteratureItem[]> = LITERATURE.reduce(",
        "  (acc, it) => { (acc[it.category] ??= []).push(it); return acc },",
        "  {} as Record<LitCategory, LiteratureItem[]>,",
        ")",
        "",
        "// 图谱节点 id → 关联文献",
        "export const LIT_BY_NODE: Record<string, LiteratureItem[]> = LITERATURE.reduce(",
        "  (acc, it) => { for (const n of it.kgNodes) (acc[n] ??= []).push(it); return acc },",
        "  {} as Record<string, LiteratureItem[]>,",
        ")",
        "",
    ]
    OUT.write_text("\n".join(lines), encoding="utf-8")

    from collections import Counter
    print(f"生成 {OUT}，共 {len(uniq)} 条")
    print("分类:", dict(Counter(it["category"] for it in uniq)))
    print("主题:", dict(Counter(t for it in uniq for t in it["topics"])))
    print("综合证据(无节点):", sum(1 for it in uniq if not it["kgNodes"]))

if __name__ == "__main__":
    main()
