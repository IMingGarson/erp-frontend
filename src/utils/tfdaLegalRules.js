/**
 * 台灣 TFDA 特殊食品原料法規與強制警語判定引擎 (Static Rules)
 * 來源：衛生福利部 食品藥物管理署《食品原料使用限制及標示規定》
 */

export const TFDA_INGREDIENT_RULES = [
  {
    id: "aspartame",
    keywords: ["阿斯巴甜", "Aspartame"],
    type: "WARNING",
    limitText: null,
    warningText: "苯酮尿症患者(Phenylketonurics)不宜使用",
    lawReference: "含有阿斯巴甜之食品標示規定",
  },
  {
    id: "aloe",
    keywords: ["蘆薈", "Aloe"],
    type: "BOTH", // 同時有使用上限與警語
    limitText: "蘆薈素(Aloin)含量不得超過10 mg/kg",
    warningText: "孕婦忌食",
    lawReference: "食品原料蘆薈之使用限制及標示規定",
  },
  {
    id: "senna",
    keywords: ["番瀉", "番瀉葉", "Senna"],
    type: "BOTH",
    limitText: "番瀉苷(Sennosides)每日食用限量為12 mg以下",
    warningText:
      "本產品可能導致腹瀉；孕婦、體質虛弱者請勿食用及避免兒童任意食用",
    lawReference: "食品原料番瀉之使用限制及標示規定",
  },
  {
    id: "sugar_alcohol",
    // 常見的代糖/糖醇類，政府規定必須加註腹瀉警語
    keywords: [
      "山梨糖醇",
      "木糖醇",
      "赤藻糖醇",
      "麥芽糖醇",
      "乳糖醇",
      "甘露醇",
    ],
    type: "WARNING",
    limitText: null,
    warningText: "食用過量可能引起腹瀉",
    lawReference: "食品添加物使用範圍及限量暨規格標準(甜味劑)",
  },
  {
    id: "coq10",
    keywords: ["輔酵素Q10", "Coenzyme Q10", "CoQ10"],
    type: "BOTH",
    limitText: "每日食用限量為30 mg以下",
    warningText:
      "十五歲以下小孩、懷孕或哺乳期間婦女及服用抗凝血藥品(warfarin)之病患，不宜食用",
    lawReference: "食品原料輔酵素Q10之使用限制及標示規定",
  },
  {
    id: "red_yeast_rice",
    keywords: ["紅麴"],
    type: "BOTH",
    limitText: "每日食用限量為15 mg (以Monacolin K計)",
    warningText:
      "患有嚴重疾病、感染症、肝病或經外科手術等情況者，請勿食用；孕婦或哺乳期間婦女請勿食用",
    lawReference: "紅麴健康食品規格標準",
  },
  {
    id: "caffeine",
    keywords: ["咖啡因", "瓜拿納", "Guarana", "瑪黛茶", "Mate"],
    type: "WARNING",
    limitText: null,
    warningText: "孩童、孕婦及哺乳婦女與對咖啡因敏感者不宜飲用",
    lawReference: "含有咖啡因成分之包裝飲料標示規定",
  },
  {
    id: "cassia_fistula",
    keywords: ["阿勃勒", "Cassia fistula"],
    type: "BANNED", // 🚨 已經被政府禁用的地雷原料
    limitText: "自111年7月1日起，阿勃勒果實不得作為食品原料使用",
    warningText: "【違法警告】此原料已全面禁用，請立即更換配方",
    lawReference: "阿勃勒(Cassia fistula)果實之使用限制",
  },
  {
    id: "eggshell_membrane",
    keywords: ["蛋殼膜", "Eggshell membrane"],
    type: "BOTH",
    limitText: "每日食用限量為 500 毫克",
    warningText: "孕婦、哺乳期間婦女及對蛋過敏者應避免食用", // 法定連帶警語
    lawReference: "食品原料蛋殼膜之使用限制及標示規定",
  },
  {
    id: "devils_claw",
    keywords: ["魔鬼爪根", "Devil's claw"],
    type: "LIMIT_ONLY", // 只有限量
    limitText: "每日食用限量以乾燥根計為 4.5 公克，或以哈巴俄苷計為 100 毫克",
    warningText: null,
    lawReference: "食品原料使用限制及標示規定",
  },
  {
    id: "snow_lotus",
    keywords: ["雪蓮組織培養物"],
    type: "LIMIT_ONLY",
    limitText: "每日食用限量以鮮品計為 60 公克，以乾品計為 3 公克",
    warningText: null,
    lawReference: "食品原料使用限制及標示規定",
  },
  {
    id: "cordyceps",
    keywords: ["冬蟲夏草"],
    type: "WARNING",
    limitText: null,
    warningText:
      "【法規正名提示】不可簡寫！須標示完整七個字「冬蟲夏草菌絲體」，並強制加註警語：「本產品非中藥材冬蟲夏草之製品」",
    lawReference: "冬蟲夏草菌絲體食品標示規定",
  },
  {
    id: "hydrogenated_oils",
    keywords: ["氫化", "Hydrogenated"],
    type: "WARNING",
    limitText: null,
    warningText:
      "【法規標示提示】經氫化製得的油脂，於成分表展開時必須加註「氫化」字樣",
    lawReference: "包裝食品之內容物及食品添加物名稱標示原則",
  },
  {
    id: "general_oils",
    keywords: ["植物油", "動物油", "食用油脂"],
    type: "WARNING",
    limitText: null,
    warningText:
      "【法規標示提示】不得僅標示統稱，必須展開標示各別油脂名稱（如：大豆油、棕櫚油）",
    lawReference: "包裝食品之內容物及食品添加物名稱標示原則",
  },
];
