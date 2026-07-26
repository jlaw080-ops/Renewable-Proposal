// 로드 순서 중요: data → settingsStore(OPT_CONFIG 초기화) → LP솔버 → 최적화 엔진
export const ENGINE_SCRIPTS = [
  "/data/신재생에너지계수라이브러리.js",
  "/data/지역계수라이브러리.js",
  "/data/건축물종류별단위에너지사용량라이브러리.js",
  "/data/의무비율라이브러리.js",
  "/data/설비최적화라이브러리.js",
  "/data/건물적합도라이브러리.js",
  "/data/제약가중치라이브러리.js",
  "/data/경관계수라이브러리.js",
  "/data/요구도라이브러리.js",
  "/data/전력원단위라이브러리.js",
  "/settings/settingsStore.js",
  "/vendor/javascript-lp-solver.js",
  "/optimize/targetCalculator.js",
  "/optimize/powerEstimator.js",
  "/optimize/optimizer.js",
];

export const READY_GLOBALS = [
  "LIB_신재생에너지계수", "LIB_지역계수", "LIB_단위에너지사용량", "LIB_의무비율",
  "LIB_설비최적화", "SettingsStore", "OPT_CONFIG", "solver",
];
