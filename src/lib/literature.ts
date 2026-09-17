// ─────────────────────────────────────────────────────────────────
// 文献证据库（自动生成，勿手改）
// 生成：python scripts/build_literature.py · 2025 数据源为三包文献
// · 文献分类汇总（RIS 解析 32 篇：大模型×高血压 13 / 数字孪生 4 / 真实数据 15 去重后）
// · 高血压数据王冯誉豪（PDF 首页校订 4 篇）
// · 高雨晴检索下载（PDF 首页校订 35 篇；bahloul2021×3 为同一篇误下载哲学论文，已排除）
// 主题标签由标题关键词规则匹配，挂接 knowledgeGraph 节点；无匹配节点为「综合证据」
// ─────────────────────────────────────────────────────────────────

export type LitCategory =
  | "大模型×高血压"
  | "数字孪生"
  | "真实数据"
  | "数据统计"
  | "生活方式与综合管理"

export interface LiteratureItem {
  id: string
  title: string
  author: string // 第一作者 et al.
  year: string
  category: LitCategory
  topics: string[] // 主题标签
  kgNodes: string[] // 挂接的知识图谱节点 id（空 = 综合证据）
}

export const LITERATURE: LiteratureItem[] = [
  { id: "lit001", title: "Comparative effectiveness of monotherapies and combination therapies for patients with hypertension: protocol for a systematic review with network meta-analyses", author: "Hutton 等", year: "2013", category: "大模型×高血压", topics: ["药物治疗"], kgNodes: ["amlodipine"] },
  { id: "lit002", title: "ChatHTN: a consultation model for hypertension", author: "Wang 等", year: "2026", category: "大模型×高血压", topics: ["大模型推理"], kgNodes: [] },
  { id: "lit003", title: "Evaluating the Clinical Effectiveness and Patient Experience of a Large Language Model-Based Digital Tool for Home-Based Blood Pressure Management: Mixed Methods Study", author: "Jelic 等", year: "2025", category: "大模型×高血压", topics: ["大模型推理"], kgNodes: [] },
  { id: "lit004", title: "RAG-Enhanced Open SLMs for Hypertension Management Chatbots", author: "Aguzzi 等", year: "2025", category: "大模型×高血压", topics: ["大模型推理"], kgNodes: [] },
  { id: "lit005", title: "Enhancing clinical decision-making: Optimizing ChatGPT's performance in hypertension care", author: "Miao 等", year: "2024", category: "大模型×高血压", topics: ["大模型推理"], kgNodes: [] },
  { id: "lit006", title: "Performance of Large Language Models in Analyzing Common Hypertension Scenarios", author: "Zand 等", year: "2026", category: "大模型×高血压", topics: ["大模型推理"], kgNodes: [] },
  { id: "lit007", title: "Large Language Model Agent for Managing Patients With Suspected Hypertension", author: "Wang 等", year: "2026", category: "大模型×高血压", topics: ["大模型推理"], kgNodes: [] },
  { id: "lit008", title: "The role of artificial intelligence in hypertension management", author: "Dherani 等", year: "2026", category: "大模型×高血压", topics: ["机器学习建模"], kgNodes: [] },
  { id: "lit009", title: "Integrating large language models with human expertise for disease detection in electronic health records", author: "Pan 等", year: "2025", category: "大模型×高血压", topics: ["大模型推理"], kgNodes: [] },
  { id: "lit010", title: "Assessment of ChatGPT-4.0 versus ChatGPT-Mini in Generating Guideline-Based Hypertension Content", author: "Ataídes 等", year: "2026", category: "大模型×高血压", topics: ["大模型推理"], kgNodes: [] },
  { id: "lit011", title: "A Heart-to-Heart With ChatGPT: AI Applications in Hypertension", author: "Layton", year: "2025", category: "大模型×高血压", topics: ["大模型推理", "机器学习建模", "心脏靶器官"], kgNodes: ["hf"] },
  { id: "lit012", title: "Evaluation of the Accuracy of ChatGPT in Answering Clinical Questions on the Japanese Society of Hypertension Guidelines", author: "Kusunose 等", year: "2023", category: "大模型×高血压", topics: ["大模型推理"], kgNodes: [] },
  { id: "lit013", title: "AI, Machine Learning, and ChatGPT in Hypertension", author: "Layton", year: "2024", category: "大模型×高血压", topics: ["大模型推理", "机器学习建模"], kgNodes: [] },
  { id: "lit014", title: "A Digital Twin of the Angiotensin II Receptor Blocker Losartan: Physiologically Based Modeling of Blood Pressure Regulation", author: "Tensil 等", year: "2026", category: "数字孪生", topics: ["数字孪生", "药物治疗"], kgNodes: ["amlodipine"] },
  { id: "lit015", title: "Artificial Intelligence and Advanced Digital Health for Hypertension: Evolving Tools for Precision Cardiovascular Care", author: "Skalidis 等", year: "2025", category: "数字孪生", topics: ["机器学习建模"], kgNodes: [] },
  { id: "lit016", title: "Artificial intelligence and digital twins for the personalised prediction of hypertension risk", author: "Naik 等", year: "2025", category: "数字孪生", topics: ["数字孪生", "机器学习建模"], kgNodes: [] },
  { id: "lit017", title: "From clinic to home monitoring: Diagnostic strategies and evidence landscape of white-coat uncontrolled hypertension", author: "Zheng 等", year: "2026", category: "数字孪生", topics: ["白大衣高血压"], kgNodes: ["whiteCoat"] },
  { id: "lit018", title: "Young Age at Hysterectomy and Elevated Hypertension Risk: A Combined Observational and Mendelian Randomization Study", author: "Yan 等", year: "2025", category: "真实数据", topics: ["综合证据"], kgNodes: [] },
  { id: "lit019", title: "Association of Rare Variants in Kidney Developmental Genes With Chronic Kidney Disease and Blood Pressure: A UK Biobank Study", author: "Spector 等", year: "2025", category: "真实数据", topics: ["肾损害指标"], kgNodes: ["microalb"] },
  { id: "lit020", title: "Selenium and Lead Exposure are Associated with Elevated Blood Pressure in Individuals with Undiagnosed Hypertension: Findings from NHANES 2013-2020", author: "Tang 等", year: "2025", category: "真实数据", topics: ["流行病学数据"], kgNodes: ["elderly"] },
  { id: "lit021", title: "Remnant Cholesterol is Associated with Blood Pressure Control in US Adults with Hypertension: NHANES 2007-2018 Analysis", author: "Feng 等", year: "2025", category: "真实数据", topics: ["流行病学数据"], kgNodes: ["elderly"] },
  { id: "lit022", title: "Designing an implementation science clinical trial to integrate hypertension and cardiovascular diseases care into existing HIV services package in Botswana (InterCARE)", author: "Youssouf 等", year: "2024", category: "真实数据", topics: ["综合证据"], kgNodes: [] },
  { id: "lit023", title: "Update on the INTEnsive ambulance-delivered blood pressure Reduction in hyper-ACute stroke Trial (INTERACT4): progress and baseline features in 2053 participants", author: "Chen 等", year: "2023", category: "真实数据", topics: ["脑卒中风险"], kgNodes: ["stroke"] },
  { id: "lit024", title: "Reach out behavioral intervention for hypertension initiated in the emergency department connecting multiple health systems: study protocol for a randomized control trial", author: "Meurer 等", year: "2020", category: "真实数据", topics: ["生活方式干预"], kgNodes: ["briskWalk"] },
  { id: "lit025", title: "The Treatment In Morning versus Evening (TIME) study: analysis of recruitment, follow-up and retention rates post-recruitment", author: "Rorie 等", year: "2017", category: "真实数据", topics: ["睡眠与作息"], kgNodes: ["sleepReg"] },
  { id: "lit026", title: "MEF2 in cardiac hypertrophy in response to hypertension", author: "Cornwell 等", year: "2023", category: "真实数据", topics: ["心脏靶器官"], kgNodes: ["hf"] },
  { id: "lit027", title: "Retrospective review of the use of as-needed hydralazine and labetalol for the treatment of acute hypertension in hospitalized medicine patients", author: "Gaynor 等", year: "2018", category: "真实数据", topics: ["服药依从性", "药物治疗"], kgNodes: ["amlodipine"] },
  { id: "lit028", title: "Long Short-Term Memory Network for Accelerometer-Based Hypertension Classification", author: "Ouellet 等", year: "2025", category: "真实数据", topics: ["运动干预"], kgNodes: ["briskWalk"] },
  { id: "lit029", title: "Nurses' Experience of Using an Electronic Medical Records - OpenMRS Module for the Management of Hypertension and Diabetes in Rwanda: A Qualitative Study", author: "Ntakirutimana 等", year: "2024", category: "真实数据", topics: ["家庭血压监测", "糖尿病合并"], kgNodes: ["homeBP", "t2dm"] },
  { id: "lit030", title: "Making Medication Data Meaningful: Illustrated with Hypertension", author: "Williams 等", year: "2016", category: "真实数据", topics: ["服药依从性"], kgNodes: ["amlodipine"] },
  { id: "lit031", title: "Implementation of a Cloud-based Blood Pressure Data Management System", author: "Kuo", year: "2015", category: "真实数据", topics: ["家庭血压监测"], kgNodes: ["homeBP"] },
  { id: "lit032", title: "A mobile logbook to diagnose masked hypertension: a pilot application", author: "Eccher 等", year: "2014", category: "真实数据", topics: ["家庭血压监测", "隐匿性高血压"], kgNodes: ["homeBP", "maskedHtn"] },
  { id: "lit033", title: "A review of machine learning in hypertension detection and blood pressure estimation based on clinical and physiological data", author: "Martinez-Ríos 等", year: "2021", category: "数据统计", topics: ["机器学习建模"], kgNodes: [] },
  { id: "lit034", title: "Machine Learning Approaches for Predicting Hypertension and Its Associated Factors Using Population-Level Data From Three South Asian Countries", author: "Islam 等", year: "2022", category: "数据统计", topics: ["机器学习建模", "流行病学数据"], kgNodes: ["elderly"] },
  { id: "lit035", title: "Predicting the Risk of Hypertension Based on Several Easy-to-Collect Risk Factors: A Machine Learning Method", author: "Zhao 等", year: "2021", category: "数据统计", topics: ["机器学习建模"], kgNodes: [] },
  { id: "lit036", title: "Hypertension Statistics for US Adults: An Open-Source Web Application for Analysis and Visualization of NHANES Data", author: "Jaeger 等", year: "2023", category: "数据统计", topics: ["流行病学数据"], kgNodes: ["elderly"] },
  { id: "lit037", title: "Ambulatory blood pressure monitoring and 24-h blood pressure control as predictors of outcome in treated hypertensive patients (ASCOT sub-study)", author: "O'Brien 等", year: "2001", category: "生活方式与综合管理", topics: ["家庭血压监测"], kgNodes: ["homeBP"] },
  { id: "lit038", title: "A Hypertensive Conundrum (Editorial)", author: "Welch", year: "2025", category: "生活方式与综合管理", topics: ["综合证据"], kgNodes: [] },
  { id: "lit039", title: "Patients' concepts of hypertension: new insights support the need for more shared decision making", author: "Altiner", year: "2012", category: "生活方式与综合管理", topics: ["患者教育"], kgNodes: ["homeBP"] },
  { id: "lit040", title: "Associations and attributable burden between risk factors and all-cause and cause-specific mortality at different ages in patients with hypertension", author: "Jin 等", year: "2024", category: "生活方式与综合管理", topics: ["流行病学数据"], kgNodes: ["elderly"] },
  { id: "lit041", title: "Behavior of albuminuria in patients with a more intense control of their blood pressure", author: "Maria-Tablado", year: "2023", category: "生活方式与综合管理", topics: ["肾损害指标"], kgNodes: ["microalb"] },
  { id: "lit042", title: "Behavioural approach-avoidance tendencies among individuals with elevated blood pressure", author: "Shukla 等", year: "2024", category: "生活方式与综合管理", topics: ["生活方式干预"], kgNodes: ["briskWalk"] },
  { id: "lit043", title: "Risk Factors Associated With Newly Diagnosed High Blood Pressure in Men and Women", author: "Carlsson 等", year: "2008", category: "生活方式与综合管理", topics: ["流行病学数据"], kgNodes: ["elderly"] },
  { id: "lit044", title: "Comparison of data-driven identified hypertension-protective dietary patterns among Chinese adults: based on a nationwide study", author: "Yang 等", year: "2023", category: "生活方式与综合管理", topics: ["膳食与限盐"], kgNodes: ["saltLimit"] },
  { id: "lit045", title: "A behavioral typology of hypertensive out-patients followed up in general practice", author: "Consoli 等", year: "1989", category: "生活方式与综合管理", topics: ["患者教育", "生活方式干预"], kgNodes: ["homeBP", "briskWalk"] },
  { id: "lit046", title: "Constipation and high blood pressure variability", author: "Mishima", year: "2024", category: "生活方式与综合管理", topics: ["综合证据"], kgNodes: [] },
  { id: "lit047", title: "Effect of antihypertensive medications on sleep status in hypertensive patients", author: "Zeng 等", year: "2022", category: "生活方式与综合管理", topics: ["睡眠与作息", "药物治疗"], kgNodes: ["sleepReg", "amlodipine"] },
  { id: "lit048", title: "Effects of probiotics on hypertension", author: "Yuan 等", year: "2023", category: "生活方式与综合管理", topics: ["膳食与限盐"], kgNodes: ["saltLimit"] },
  { id: "lit049", title: "Epidemiology of cardiovascular diseases and hypertension (EAS 2014 abstract)", author: "Erden", year: "2014", category: "生活方式与综合管理", topics: ["流行病学数据"], kgNodes: ["elderly"] },
  { id: "lit050", title: "Exploration of patients' practices related to home blood pressure monitoring", author: "Litvin 等", year: "2024", category: "生活方式与综合管理", topics: ["家庭血压监测", "患者教育"], kgNodes: ["homeBP"] },
  { id: "lit051", title: "A hybrid machine learning approach for hypertension risk prediction", author: "Fang 等", year: "2021", category: "生活方式与综合管理", topics: ["机器学习建模"], kgNodes: [] },
  { id: "lit052", title: "Global guidelines recommendations for lifestyle modifications in patients with hypertension", author: "Arakawa 等", year: "2026", category: "生活方式与综合管理", topics: ["生活方式干预"], kgNodes: ["briskWalk"] },
  { id: "lit053", title: "Modeling of hypertensive patient's behavior based on the health information", author: "Li 等", year: "2015", category: "生活方式与综合管理", topics: ["综合证据"], kgNodes: [] },
  { id: "lit054", title: "How to deal with a hypertensive patient who has documented non-adherence to the prescribed antihypertensive therapy?", author: "Georgianos 等", year: "2024", category: "生活方式与综合管理", topics: ["服药依从性", "药物治疗"], kgNodes: ["amlodipine"] },
  { id: "lit055", title: "Hypertension (clinical review chapter: diagnosis, evaluation and treatment)", author: "Landefeld 等", year: "", category: "生活方式与综合管理", topics: ["综合证据"], kgNodes: [] },
  { id: "lit056", title: "Hypertension (Chapter 20: ABPM/ASCVD review)", author: "Agrawal 等", year: "2020", category: "生活方式与综合管理", topics: ["家庭血压监测"], kgNodes: ["homeBP"] },
  { id: "lit057", title: "Hypertensive Management", author: "Thomas", year: "2023", category: "生活方式与综合管理", topics: ["综合证据"], kgNodes: [] },
  { id: "lit058", title: "Profile of hypertensive patients: biosocial characteristics, knowledge, and treatment compliance", author: "Jesus 等", year: "2008", category: "生活方式与综合管理", topics: ["服药依从性", "患者教育"], kgNodes: ["amlodipine", "homeBP"] },
  { id: "lit059", title: "Personality Factors in Hypertension", author: "Kidson", year: "1971", category: "生活方式与综合管理", topics: ["综合证据"], kgNodes: [] },
  { id: "lit060", title: "Hypertensive patients' knowledge of high blood pressure", author: "Kjellgren 等", year: "1997", category: "生活方式与综合管理", topics: ["患者教育"], kgNodes: ["homeBP"] },
  { id: "lit061", title: "Knowledge, Attitude, and Practice Toward Hypertension Among Hypertensive Patients Residing in Lebanon", author: "Machaalani 等", year: "2022", category: "生活方式与综合管理", topics: ["患者教育"], kgNodes: ["homeBP"] },
  { id: "lit062", title: "Research on Information Required in Health Behavior Changes of Hypertensive Patients", author: "Li 等", year: "2018", category: "生活方式与综合管理", topics: ["患者教育"], kgNodes: ["homeBP"] },
  { id: "lit063", title: "Essential Hypertension and Social Coping Behavior", author: "Linden 等", year: "1981", category: "生活方式与综合管理", topics: ["生活方式干预"], kgNodes: ["briskWalk"] },
  { id: "lit064", title: "Lifestyle Behaviors in Treated Hypertensives as Prediction of Blood Pressure Control", author: "MacDonald 等", year: "1988", category: "生活方式与综合管理", topics: ["生活方式干预"], kgNodes: ["briskWalk"] },
  { id: "lit065", title: "Phenotypic variations of hypertension at high altitude", author: "Narvaez-Guerra 等", year: "2023", category: "生活方式与综合管理", topics: ["综合证据"], kgNodes: [] },
  { id: "lit066", title: "Profiles of echocardiographic features associated with blood pressure in patients with hypertension", author: "Zhao 等", year: "2025", category: "生活方式与综合管理", topics: ["心脏靶器官"], kgNodes: ["hf"] },
  { id: "lit067", title: "Selten besprochene Fragen zum Bluthochdruck (Editorial, German)", author: "van der Giet 等", year: "2018", category: "生活方式与综合管理", topics: ["综合证据"], kgNodes: [] },
  { id: "lit068", title: "Behavioral and Environmental Aspects of Hypertension", author: "Shapiro", year: "1978", category: "生活方式与综合管理", topics: ["生活方式干预"], kgNodes: ["briskWalk"] },
  { id: "lit069", title: "The gut microbiome and hypertension", author: "O'Donnell 等", year: "2023", category: "生活方式与综合管理", topics: ["膳食与限盐"], kgNodes: ["saltLimit"] },
  { id: "lit070", title: "Therapeutic intervention exploring hypertensive patients who respond to health coaching behavior modification therapy", author: "Narita", year: "2024", category: "生活方式与综合管理", topics: ["服药依从性"], kgNodes: ["amlodipine"] },
  { id: "lit071", title: "Understanding clinical inertia in hypertension management: clues from real-world data", author: "Satoh", year: "2025", category: "生活方式与综合管理", topics: ["服药依从性"], kgNodes: ["amlodipine"] },
]

export const LIT_TOTAL = LITERATURE.length

export const LIT_BY_CATEGORY: Record<LitCategory, LiteratureItem[]> = LITERATURE.reduce(
  (acc, it) => { (acc[it.category] ??= []).push(it); return acc },
  {} as Record<LitCategory, LiteratureItem[]>,
)

// 图谱节点 id → 关联文献
export const LIT_BY_NODE: Record<string, LiteratureItem[]> = LITERATURE.reduce(
  (acc, it) => { for (const n of it.kgNodes) (acc[n] ??= []).push(it); return acc },
  {} as Record<string, LiteratureItem[]>,
)
