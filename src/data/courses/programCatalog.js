// 培养方案目录：按「专业 × 年级」组织，章节结构逐字照搬培养方案原文。
//
// 各专业、各年级的写法差异很大，这里不做统一化：
//   · 生物科学       实践教学环节下分三个方向，每个方向再分 A.必修 / B.选修；
//                    个性修读的本专业进阶模块也分 A/B/C 三个方向。
//   · 求是科学班     没有方向细分，实践教学环节只分 1)必修 / 2)选修。
//   · 生物科学强基   没有「专业基础课程」一节；专业必修分两个模块二选一；
//                    2025 起新增「转段方向课程」，2026 又把实践教学环节改名
//                    为「科研实践环节」、转段方向的「生物工程」换成「人工智能」。
//   · 生态学         没有「专业选修课程」，实践教学环节不细分。
//   · 生态学强基     专业必修不分模块（与生物科学强基不同）；2024 的进阶模块
//                    分 A.基础生态学 / B.生态治理与管理；2025 的转段方向里
//                    「环境科学与工程」还要再分 A/B，层级深到第四级。
//   · 编号风格       2024/2025 用「2.」，2026 改用「二、」，四级编号用「A.」。
//
// 因此不要试图把这些结构归一，渲染层按 sections 树原样展开即可。
//
// 每门课只登记「课程代码 + 建议修读学期」，课程名、学分、学时来自
// public/resource/summary/introduction.csv，靠课程代码关联。培养方案引用但
// CSV 里没有的课程会被静默过滤，tests/programCatalog.test.js 守住这条。
//
// 学期粒度对齐 semesterOrder：原文的「秋」「冬」并入 autumn-winter，「春」
// 「夏」并入 spring-summer，「短」为 short，单学期信息在此丢失。
//
// 数据由培养方案 PDF 提取而来，改动请同步 public/resource/educational_program/。

export const semesterOrder = [
  '1-autumn-winter',
  '1-spring-summer',
  '1-short',
  '2-autumn-winter',
  '2-spring-summer',
  '2-short',
  '3-autumn-winter',
  '3-spring-summer',
  '3-short',
  '4-autumn-winter',
  '4-spring-summer',
  '4-short',
];

export const semesterLabels = {
  '1-autumn-winter': '一（秋冬）',
  '1-spring-summer': '一（春夏）',
  '1-short': '一（短）',
  '2-autumn-winter': '二（秋冬）',
  '2-spring-summer': '二（春夏）',
  '2-short': '二（短）',
  '3-autumn-winter': '三（秋冬）',
  '3-spring-summer': '三（春夏）',
  '3-short': '三（短）',
  '4-autumn-winter': '四（秋冬）',
  '4-spring-summer': '四（春夏）',
  '4-short': '四（短）',
};

export const ALL_PROGRAM_ID = 'all';
export const DEFAULT_MAJOR_ID = 'biology';

// 带这个说明的小节，其子节点是互斥选项，页面用页签展示。
export const ALTERNATIVE_NOTE = '选择一个模块进行必修';

// available: false 的专业在下拉框中可见但不可选，渲染为「（待整理）」。
// 目前五个专业 × 三个年级共 15 份方案均已收录。
export const majorOptions = [
  { id: 'biology', label: '生物科学', available: true },
  { id: 'biology-qiushi', label: '生物科学（求是科学班）', available: true },
  { id: 'biology-qiangji', label: '生物科学（强基计划）', available: true },
  { id: 'ecology', label: '生态学', available: true },
  { id: 'ecology-qiangji', label: '生态学（强基计划）', available: true },
];

export const curriculumOptions = [
  { id: '2024', label: '2024级培养方案', available: true },
  { id: '2025', label: '2025级培养方案', available: true },
  { id: '2026', label: '2026级培养方案', available: true },
];

export const curriculumPrograms = {
  biology: {
    2024: {
      id: 'biology-2024',
      majorId: 'biology',
      year: '2024',
      label: '2024级生物科学专业培养方案',
      sourceUrl: '/resource/educational_program/2024.pdf',
      sections: [
      {
        tag: "2.专业基础课程", credits: "28学分",
        courses: [
          { code: 'CHEM1002F', semester: '1-autumn-winter' },
          { code: 'CHEM1004F', semester: '1-spring-summer' },
          { code: 'CHEM1007F', semester: '1-spring-summer' },
          { code: 'BIO2011F', semester: '2-autumn-winter' },
          { code: 'BIO2012F', semester: '2-autumn-winter' },
          { code: 'BIO2005F', semester: '2-spring-summer' },
          { code: 'BIO2019F', semester: '2-spring-summer' },
          { code: 'MATH2432F', semester: '2-spring-summer' },
        ],
      },
      {
        tag: "3.专业课程", credits: "39学分",
        children: [
          {
            tag: "(1)专业必修课程", credits: "25学分",
            courses: [
              { code: 'BIO2028M', semester: '2-autumn-winter' },
              { code: 'BIO2029M', semester: '2-spring-summer' },
              { code: 'BIO2110F', semester: '2-spring-summer' },
              { code: 'BIO2113F', semester: '2-spring-summer' },
              { code: 'BIO3015F', semester: '3-autumn-winter' },
              { code: 'BIO3026M', semester: '3-autumn-winter' },
              { code: 'CAB2001F', semester: '3-autumn-winter' },
              { code: 'BIO4032M', semester: '3-short' },
              { code: 'BIO3109M', semester: '3-spring-summer' },
              { code: 'BIO4031M', semester: '4-autumn-winter' },
            ],
          },
          {
            tag: "(2)实践教学环节", credits: "6学分",
            children: [
              {
                tag: "1)生物科学方向", credits: "6学分",
                children: [
                  {
                    tag: "A.必修课程", credits: "3学分",
                    courses: [
                      { code: 'BIO2085M', semester: '2-short' },
                    ],
                  },
                  {
                    tag: "B.选修课程", credits: "3学分",
                    courses: [
                      { code: 'BIO2048M', semester: '2-short' },
                      { code: 'BIO2080M', semester: '2-short' },
                      { code: 'BIO3081M', semester: '3-short' },
                      { code: 'BIO3082M', semester: '3-short' },
                    ],
                  },
                ],
              },
              {
                tag: "2)生物技术方向", credits: "6学分",
                courses: [
                  { code: 'BIO2048M', semester: '2-short' },
                  { code: 'BIO2080M', semester: '2-short' },
                  { code: 'BIO3081M', semester: '3-short' },
                  { code: 'BIO3082M', semester: '3-short' },
                ],
              },
              {
                tag: "3)生物信息学方向", credits: "6学分",
                courses: [
                  { code: 'BIO2048M', semester: '3-short' },
                  { code: 'BIO3056M', semester: '3-spring-summer' },
                  { code: 'BIO4083M', semester: '4-autumn-winter' },
                ],
              },
            ],
          },
          {
            tag: "(3)毕业论文（设计）", credits: "8学分",
            courses: [
              { code: 'BIO4087M', semester: '4-spring-summer' },
            ],
          },
        ],
      },
      {
        tag: "4.个性修读课程", credits: "15学分",
        children: [
          {
            tag: "1)本专业进阶模块", credits: "15学分",
            children: [
              {
                tag: "A.生物科学方向", credits: "15学分",
                courses: [
                  { code: 'BIO3052M', semester: '3-autumn-winter' },
                  { code: 'BIO3066M', semester: '3-autumn-winter' },
                  { code: 'BIO2017F', semester: '3-autumn-winter' },
                  { code: 'BIO3045M', semester: '3-autumn-winter' },
                  { code: 'BIO3070M', semester: '3-autumn-winter' },
                  { code: 'BIO3047M', semester: '3-spring-summer' },
                  { code: 'BIO3053M', semester: '3-spring-summer' },
                  { code: 'BIO3057M', semester: '3-spring-summer' },
                  { code: 'BIO3060M', semester: '3-spring-summer' },
                  { code: 'BIO3062M', semester: '3-spring-summer' },
                  { code: 'BIO3065M', semester: '3-spring-summer' },
                  { code: 'BIO3090M', semester: '3-spring-summer' },
                  { code: 'BIO3092M', semester: '3-spring-summer' },
                  { code: 'BIO3077M', semester: '3-spring-summer' },
                  { code: 'BIO3050M', semester: '3-spring-summer' },
                  { code: 'BIO3097M', semester: '4-autumn-winter' },
                  { code: 'BIO3099M', semester: '4-autumn-winter' },
                  { code: 'BIO4059M', semester: '4-autumn-winter' },
                  { code: 'BIO4064M', semester: '4-autumn-winter' },
                  { code: 'BIO3025M', semester: '4-autumn-winter' },
                  { code: 'BIO3093M', semester: '4-autumn-winter' },
                  { code: 'BIO3094M', semester: '4-autumn-winter' },
                  { code: 'BIO3095M', semester: '4-autumn-winter' },
                  { code: 'BIO3096M', semester: '4-autumn-winter' },
                  { code: 'BIO3055M', semester: '4-autumn-winter' },
                  { code: 'BIO3088M', semester: '4-autumn-winter' },
                  { code: 'BIO3091M', semester: '4-autumn-winter' },
                  { code: 'BIO3100M', semester: '4-autumn-winter' },
                  { code: 'BIO4049M', semester: '4-autumn-winter' },
                ],
              },
              {
                tag: "B.生物技术方向", credits: "15学分",
                courses: [
                  { code: 'BIO3066M', semester: '3-autumn-winter' },
                  { code: 'BIO3061M', semester: '3-autumn-winter' },
                  { code: 'BIO3070M', semester: '3-autumn-winter' },
                  { code: 'BIO2027M', semester: '3-spring-summer' },
                  { code: 'BIO3047M', semester: '3-spring-summer' },
                  { code: 'BIO3053M', semester: '3-spring-summer' },
                  { code: 'BIO3057M', semester: '3-spring-summer' },
                  { code: 'BIO3060M', semester: '3-spring-summer' },
                  { code: 'BIO3062M', semester: '3-spring-summer' },
                  { code: 'BIO3065M', semester: '3-spring-summer' },
                  { code: 'BIO3090M', semester: '3-spring-summer' },
                  { code: 'BIO3092M', semester: '3-spring-summer' },
                  { code: 'BIO3097M', semester: '4-autumn-winter' },
                  { code: 'BIO4064M', semester: '4-autumn-winter' },
                  { code: 'BIO3025M', semester: '4-autumn-winter' },
                  { code: 'BIO3093M', semester: '4-autumn-winter' },
                  { code: 'BIO3094M', semester: '4-autumn-winter' },
                  { code: 'BIO3095M', semester: '4-autumn-winter' },
                  { code: 'BIO3096M', semester: '4-autumn-winter' },
                  { code: 'BIO3088M', semester: '4-autumn-winter' },
                  { code: 'BIO3091M', semester: '4-autumn-winter' },
                ],
              },
              {
                tag: "C.生物信息学方向", credits: "15学分",
                courses: [
                  { code: 'BIO3097M', semester: '3-autumn-winter' },
                  { code: 'BIO3025M', semester: '3-autumn-winter' },
                  { code: 'BIO3060M', semester: '3-spring-summer' },
                  { code: 'BIO3062M', semester: '3-spring-summer' },
                  { code: 'BIO3065M', semester: '3-spring-summer' },
                  { code: 'BIO3058M', semester: '3-spring-summer' },
                  { code: 'BIO3089M', semester: '3-spring-summer' },
                  { code: 'BIO4064M', semester: '4-autumn-winter' },
                ],
              },
            ],
          },
          {
            tag: "2)跨专业学习模块", credits: "15学分",
          },
          {
            tag: "3)学生自主修读模块", credits: "15学分",
            children: [
              {
                tag: "A.跨专业课程至少1门", credits: "1门",
              },
            ],
          },
        ],
      },
      ],
    },
    2025: {
      id: 'biology-2025',
      majorId: 'biology',
      year: '2025',
      label: '2025级生物科学专业培养方案',
      sourceUrl: '/resource/educational_program/2025.pdf',
      sections: [
      {
        tag: "2.专业基础课程", credits: "28学分",
        courses: [
          { code: 'CHEM1002F', semester: '1-autumn-winter' },
          { code: 'CHEM1004F', semester: '1-spring-summer' },
          { code: 'BIO2011F', semester: '2-autumn-winter' },
          { code: 'BIO2012F', semester: '2-autumn-winter' },
          { code: 'CHEM1007F', semester: '2-autumn-winter' },
          { code: 'BIO2005F', semester: '2-spring-summer' },
          { code: 'BIO2009F', semester: '2-spring-summer' },
          { code: 'BIO2019F', semester: '2-spring-summer' },
          { code: 'MATH2432F', semester: '2-spring-summer' },
        ],
      },
      {
        tag: "3.专业课程", credits: "39学分",
        children: [
          {
            tag: "(1)专业必修课程", credits: "25学分",
            courses: [
              { code: 'BIO2028M', semester: '2-autumn-winter' },
              { code: 'BIO2029M', semester: '2-spring-summer' },
              { code: 'BIO3015F', semester: '3-autumn-winter' },
              { code: 'BIO3026M', semester: '3-autumn-winter' },
              { code: 'CAB2001F', semester: '3-autumn-winter' },
              { code: 'BIO4032M', semester: '3-short' },
              { code: 'BIO3109M', semester: '3-spring-summer' },
              { code: 'BIO4031M', semester: '4-autumn-winter' },
            ],
          },
          {
            tag: "(2)实践教学环节", credits: "6学分",
            children: [
              {
                tag: "1)生物科学方向", credits: "6学分",
                children: [
                  {
                    tag: "A.必修课程", credits: "3学分",
                    courses: [
                      { code: 'BIO2085M', semester: '2-short' },
                    ],
                  },
                  {
                    tag: "B.选修课程", credits: "3学分",
                    courses: [
                      { code: 'BIO2048M', semester: '2-short' },
                      { code: 'BIO2080M', semester: '2-short' },
                      { code: 'BIO3081M', semester: '3-short' },
                      { code: 'BIO3082M', semester: '3-short' },
                    ],
                  },
                ],
              },
              {
                tag: "2)生物技术方向", credits: "6学分",
                courses: [
                  { code: 'BIO2048M', semester: '2-short' },
                  { code: 'BIO2080M', semester: '2-short' },
                  { code: 'BIO3081M', semester: '3-short' },
                  { code: 'BIO3082M', semester: '3-short' },
                ],
              },
              {
                tag: "3)生物信息学方向", credits: "6学分",
                courses: [
                  { code: 'BIO2048M', semester: '3-short' },
                  { code: 'BIO3056M', semester: '3-spring-summer' },
                  { code: 'BIO4083M', semester: '4-autumn-winter' },
                ],
              },
            ],
          },
          {
            tag: "(3)毕业论文（设计）", credits: "8学分",
            courses: [
              { code: 'BIO4087M', semester: '4-spring-summer' },
            ],
          },
        ],
      },
      {
        tag: "4.个性修读课程", credits: "15学分",
        children: [
          {
            tag: "1)本专业进阶模块", credits: "15学分",
            children: [
              {
                tag: "A.生物科学方向", credits: "15学分",
                courses: [
                  { code: 'BIO3052M', semester: '3-autumn-winter' },
                  { code: 'BIO3066M', semester: '3-autumn-winter' },
                  { code: 'BIO2017F', semester: '3-autumn-winter' },
                  { code: 'BIO3045M', semester: '3-autumn-winter' },
                  { code: 'BIO3070M', semester: '3-autumn-winter' },
                  { code: 'BIO3047M', semester: '3-spring-summer' },
                  { code: 'BIO3053M', semester: '3-spring-summer' },
                  { code: 'BIO3057M', semester: '3-spring-summer' },
                  { code: 'BIO3060M', semester: '3-spring-summer' },
                  { code: 'BIO3062M', semester: '3-spring-summer' },
                  { code: 'BIO3065M', semester: '3-spring-summer' },
                  { code: 'BIO3090M', semester: '3-spring-summer' },
                  { code: 'BIO3092M', semester: '3-spring-summer' },
                  { code: 'BIO3077M', semester: '3-spring-summer' },
                  { code: 'BIO3050M', semester: '3-spring-summer' },
                  { code: 'BIO3097M', semester: '4-autumn-winter' },
                  { code: 'BIO3099M', semester: '4-autumn-winter' },
                  { code: 'BIO4059M', semester: '4-autumn-winter' },
                  { code: 'BIO4064M', semester: '4-autumn-winter' },
                  { code: 'BIO3025M', semester: '4-autumn-winter' },
                  { code: 'BIO3093M', semester: '4-autumn-winter' },
                  { code: 'BIO3094M', semester: '4-autumn-winter' },
                  { code: 'BIO3095M', semester: '4-autumn-winter' },
                  { code: 'BIO3096M', semester: '4-autumn-winter' },
                  { code: 'BIO3055M', semester: '4-autumn-winter' },
                  { code: 'BIO3088M', semester: '4-autumn-winter' },
                  { code: 'BIO3091M', semester: '4-autumn-winter' },
                  { code: 'BIO3100M', semester: '4-autumn-winter' },
                  { code: 'BIO4049M', semester: '4-autumn-winter' },
                ],
              },
              {
                tag: "B.生物技术方向", credits: "15学分",
                courses: [
                  { code: 'BIO3066M', semester: '3-autumn-winter' },
                  { code: 'BIO3061M', semester: '3-autumn-winter' },
                  { code: 'BIO3070M', semester: '3-autumn-winter' },
                  { code: 'BIO2027M', semester: '3-spring-summer' },
                  { code: 'BIO3047M', semester: '3-spring-summer' },
                  { code: 'BIO3053M', semester: '3-spring-summer' },
                  { code: 'BIO3057M', semester: '3-spring-summer' },
                  { code: 'BIO3060M', semester: '3-spring-summer' },
                  { code: 'BIO3062M', semester: '3-spring-summer' },
                  { code: 'BIO3065M', semester: '3-spring-summer' },
                  { code: 'BIO3090M', semester: '3-spring-summer' },
                  { code: 'BIO3092M', semester: '3-spring-summer' },
                  { code: 'BIO3097M', semester: '4-autumn-winter' },
                  { code: 'BIO4064M', semester: '4-autumn-winter' },
                  { code: 'BIO3025M', semester: '4-autumn-winter' },
                  { code: 'BIO3093M', semester: '4-autumn-winter' },
                  { code: 'BIO3094M', semester: '4-autumn-winter' },
                  { code: 'BIO3095M', semester: '4-autumn-winter' },
                  { code: 'BIO3096M', semester: '4-autumn-winter' },
                  { code: 'BIO3088M', semester: '4-autumn-winter' },
                  { code: 'BIO3091M', semester: '4-autumn-winter' },
                ],
              },
              {
                tag: "C.生物信息学方向", credits: "15学分",
                courses: [
                  { code: 'BIO3097M', semester: '3-autumn-winter' },
                  { code: 'BIO3025M', semester: '3-autumn-winter' },
                  { code: 'BIO3060M', semester: '3-spring-summer' },
                  { code: 'BIO3062M', semester: '3-spring-summer' },
                  { code: 'BIO3065M', semester: '3-spring-summer' },
                  { code: 'BIO3058M', semester: '3-spring-summer' },
                  { code: 'BIO3089M', semester: '3-spring-summer' },
                  { code: 'BIO4064M', semester: '4-autumn-winter' },
                ],
              },
            ],
          },
          {
            tag: "2)跨专业学习模块", credits: "15学分",
          },
          {
            tag: "3)学生自主修读模块", credits: "15学分",
            children: [
              {
                tag: "A.跨专业课程至少1门", credits: "1门",
              },
            ],
          },
        ],
      },
      ],
    },
    2026: {
      id: 'biology-2026',
      majorId: 'biology',
      year: '2026',
      label: '2026级生物科学专业培养方案',
      sourceUrl: '/resource/educational_program/2026.pdf',
      sections: [
      {
        tag: "二、专业基础课程", credits: "28学分",
        courses: [
          { code: 'CHEM1002F', semester: '1-autumn-winter' },
          { code: 'CHEM1004F', semester: '1-spring-summer' },
          { code: 'CHEM1007F', semester: '1-spring-summer' },
          { code: 'BIO2011F', semester: '2-autumn-winter' },
          { code: 'BIO2012F', semester: '2-autumn-winter' },
          { code: 'BIO2005F', semester: '2-spring-summer' },
          { code: 'BIO2019F', semester: '2-spring-summer' },
          { code: 'BIO2110F', semester: '2-spring-summer' },
          { code: 'BIO2113F', semester: '2-spring-summer' },
          { code: 'MATH2432F', semester: '2-spring-summer' },
        ],
      },
      {
        tag: "三、专业课程", credits: "36学分",
        children: [
          {
            tag: "(1)专业必修课程", credits: "22学分",
            courses: [
              { code: 'BIO2028M', semester: '2-autumn-winter' },
              { code: 'BIO2029M', semester: '2-spring-summer' },
              { code: 'BIO3015F', semester: '3-autumn-winter' },
              { code: 'BIO3026M', semester: '3-autumn-winter' },
              { code: 'BIO4032M', semester: '3-short' },
              { code: 'BIO3109M', semester: '3-spring-summer' },
              { code: 'BIO4031M', semester: '4-autumn-winter' },
            ],
          },
          {
            tag: "(2)实践教学环节", credits: "6学分",
            children: [
              {
                tag: "1)生物科学方向", credits: "6学分",
                children: [
                  {
                    tag: "A.必修课程", credits: "3学分",
                    courses: [
                      { code: 'BIO2085M', semester: '2-short' },
                    ],
                  },
                  {
                    tag: "B.选修课程", credits: "3学分",
                    courses: [
                      { code: 'BIO2048M', semester: '2-short' },
                      { code: 'BIO2080M', semester: '2-short' },
                      { code: 'BIO3081M', semester: '3-short' },
                      { code: 'BIO3082M', semester: '3-short' },
                    ],
                  },
                ],
              },
              {
                tag: "2)生物技术方向", credits: "6学分",
                courses: [
                  { code: 'BIO2080M', semester: '2-short' },
                  { code: 'BIO2048M', semester: '3-short' },
                  { code: 'BIO3081M', semester: '3-short' },
                  { code: 'BIO3082M', semester: '3-short' },
                ],
              },
              {
                tag: "3)生物信息学方向", credits: "6学分",
                courses: [
                  { code: 'BIO2048M', semester: '3-short' },
                  { code: 'BIO3056M', semester: '3-spring-summer' },
                  { code: 'BIO4083M', semester: '4-autumn-winter' },
                ],
              },
            ],
          },
          {
            tag: "(3)毕业论文（设计）", credits: "8学分",
            courses: [
              { code: 'BIO4087M', semester: '4-spring-summer' },
            ],
          },
        ],
      },
      {
        tag: "四、个性修读课程", credits: "15学分",
        children: [
          {
            tag: "1)本专业进阶模块", credits: "15学分",
            children: [
              {
                tag: "A.生物科学方向", credits: "15学分",
                courses: [
                  { code: 'PHY2005G', semester: '2-autumn-winter' },
                  { code: 'BIO2114M', semester: '2-spring-summer' },
                  { code: 'BIO3052M', semester: '3-autumn-winter' },
                  { code: 'BIO2017F', semester: '3-autumn-winter' },
                  { code: 'BIO3045M', semester: '3-autumn-winter' },
                  { code: 'BIO3070M', semester: '3-autumn-winter' },
                  { code: 'CAB2001F', semester: '3-autumn-winter' },
                  { code: 'BIO3053M', semester: '3-spring-summer' },
                  { code: 'BIO3062M', semester: '3-spring-summer' },
                  { code: 'BIO3077M', semester: '3-spring-summer' },
                  { code: 'BIO3099M', semester: '4-autumn-winter' },
                  { code: 'BIO4059M', semester: '4-autumn-winter' },
                  { code: 'BIO3025M', semester: '4-autumn-winter' },
                  { code: 'BIO3093M', semester: '4-autumn-winter' },
                  { code: 'BIO3055M', semester: '4-autumn-winter' },
                  { code: 'BIO3088M', semester: '4-autumn-winter' },
                  { code: 'BIO3100M', semester: '4-autumn-winter' },
                ],
              },
              {
                tag: "B.生物技术方向", credits: "15学分",
                courses: [
                  { code: 'PHY2005G', semester: '2-autumn-winter' },
                  { code: 'BIO2114M', semester: '2-spring-summer' },
                  { code: 'BIO3066M', semester: '3-autumn-winter' },
                  { code: 'BIO3061M', semester: '3-autumn-winter' },
                  { code: 'BIO2027M', semester: '3-spring-summer' },
                  { code: 'BIO3047M', semester: '3-spring-summer' },
                  { code: 'BIO3057M', semester: '3-spring-summer' },
                  { code: 'BIO3090M', semester: '3-spring-summer' },
                  { code: 'BIO3092M', semester: '3-spring-summer' },
                  { code: 'BIO4064M', semester: '4-autumn-winter' },
                  { code: 'BIO3094M', semester: '4-autumn-winter' },
                  { code: 'BIO3095M', semester: '4-autumn-winter' },
                  { code: 'BIO3096M', semester: '4-autumn-winter' },
                  { code: 'BIO3091M', semester: '4-autumn-winter' },
                ],
              },
              {
                tag: "C.生物信息学方向", credits: "15学分",
                courses: [
                  { code: 'PHY2005G', semester: '2-autumn-winter' },
                  { code: 'BIO2114M', semester: '2-spring-summer' },
                  { code: 'BIO3025M', semester: '3-autumn-winter' },
                  { code: 'BIO3060M', semester: '3-spring-summer' },
                  { code: 'BIO3065M', semester: '3-spring-summer' },
                  { code: 'BIO3058M', semester: '3-spring-summer' },
                  { code: 'BIO3089M', semester: '3-spring-summer' },
                ],
              },
            ],
          },
          {
            tag: "2)跨专业学习模块", credits: "15学分",
          },
          {
            tag: "3)学生自主修读模块", credits: "15学分",
            children: [
              {
                tag: "A.跨专业课程至少1门", credits: "1门",
              },
            ],
          },
        ],
      },
      ],
    },
  },
  'biology-qiushi': {
    2024: {
      id: 'biology-qiushi-2024',
      majorId: 'biology-qiushi',
      year: '2024',
      label: '2024级生物科学（求是科学班）专业培养方案',
      sourceUrl: '/resource/educational_program/2024-qiushi.pdf',
      sections: [
      {
        tag: "2.专业基础课程", credits: "10学分",
        courses: [
          { code: 'BIO2033MZ', semester: '2-autumn-winter' },
          { code: 'BIO2043MZ', semester: '2-spring-summer' },
          { code: 'BIO3040MZ', semester: '2-spring-summer' },
        ],
      },
      {
        tag: "3.专业课程", credits: "43学分",
        children: [
          {
            tag: "(1)专业必修课程", credits: "21学分",
            courses: [
              { code: 'BIO2042MZ', semester: '2-autumn-winter' },
              { code: 'BIO2034MZ', semester: '2-spring-summer' },
              { code: 'BIO3036MZ', semester: '3-autumn-winter' },
              { code: 'BIO3041MZ', semester: '3-autumn-winter' },
              { code: 'BIO3088M', semester: '3-autumn-winter' },
              { code: 'BIO3037MZ', semester: '3-spring-summer' },
              { code: 'BIO3039MZ', semester: '3-spring-summer' },
              { code: 'BIO3109M', semester: '3-spring-summer' },
              { code: 'BIO3038MZ', semester: '3-spring-summer' },
            ],
          },
          {
            tag: "(2)专业选修课程", credits: "8学分",
            courses: [
              { code: 'BIO2019F', semester: '2-autumn-winter' },
              { code: 'BIO2005F', semester: '2-spring-summer' },
              { code: 'BIO2110F', semester: '2-spring-summer' },
              { code: 'BIO2113F', semester: '2-spring-summer' },
            ],
          },
          {
            tag: "(3)实践教学环节", credits: "6学分",
            children: [
              {
                tag: "1)必修课程", credits: "3学分",
                courses: [
                  { code: 'BIO4044MZ', semester: '4-autumn-winter' },
                ],
              },
              {
                tag: "2)选修课程", credits: "3学分",
                courses: [
                  { code: 'BIO2078M', semester: '1-short' },
                  { code: 'BIO2079M', semester: '1-short' },
                  { code: 'BIO2048M', semester: '2-short' },
                  { code: 'BIO2085M', semester: '2-short' },
                  { code: 'BIO3081M', semester: '2-short' },
                  { code: 'BIO2080M', semester: '3-short' },
                  { code: 'BIO3082M', semester: '3-short' },
                ],
              },
            ],
          },
          {
            tag: "(4)毕业论文（设计）", credits: "8学分",
            courses: [
              { code: 'BIO4087M', semester: '4-spring-summer' },
            ],
          },
        ],
      },
      {
        tag: "4.个性修读课程", credits: "15学分",
        children: [
          {
            tag: "1)本专业进阶模块", credits: "15学分",
            courses: [
              { code: 'BIO2017F', semester: '3-autumn-winter' },
              { code: 'BIO3025M', semester: '3-autumn-winter' },
              { code: 'BIO3045M', semester: '3-autumn-winter' },
              { code: 'BIO3061M', semester: '3-autumn-winter' },
              { code: 'BIO3070M', semester: '3-autumn-winter' },
              { code: 'BIO4032M', semester: '3-short' },
              { code: 'BIO3047M', semester: '3-spring-summer' },
              { code: 'BIO3057M', semester: '3-spring-summer' },
              { code: 'BIO3090M', semester: '3-spring-summer' },
              { code: 'CAB2001F', semester: '3-spring-summer' },
              { code: 'MED2308M', semester: '3-spring-summer' },
            ],
          },
          {
            tag: "2)跨专业学习模块", credits: "15学分",
          },
          {
            tag: "3)学生自主修读模块", credits: "15学分",
            children: [
              {
                tag: "A.跨专业课程至少1门", credits: "1门",
              },
            ],
          },
        ],
      },
      ],
    },
    2025: {
      id: 'biology-qiushi-2025',
      majorId: 'biology-qiushi',
      year: '2025',
      label: '2025级生物科学（求是科学班）专业培养方案',
      sourceUrl: '/resource/educational_program/2025-qiushi.pdf',
      sections: [
      {
        tag: "2.专业基础课程", credits: "10学分",
        courses: [
          { code: 'BIO2033MZ', semester: '2-autumn-winter' },
          { code: 'BIO2042MZ', semester: '2-autumn-winter' },
          { code: 'BIO2034MZ', semester: '2-spring-summer' },
          { code: 'BIO3040MZ', semester: '2-spring-summer' },
        ],
      },
      {
        tag: "3.专业课程", credits: "43学分",
        children: [
          {
            tag: "(1)专业必修课程", credits: "21学分",
            courses: [
              { code: 'BIO3036MZ', semester: '3-autumn-winter' },
              { code: 'BIO3041MZ', semester: '3-autumn-winter' },
              { code: 'BIO3088M', semester: '3-autumn-winter' },
              { code: 'BIO3037MZ', semester: '3-spring-summer' },
              { code: 'BIO3039MZ', semester: '3-spring-summer' },
              { code: 'MED2308M', semester: '3-spring-summer' },
              { code: 'BIO3038MZ', semester: '3-spring-summer' },
            ],
          },
          {
            tag: "(2)专业选修课程", credits: "8学分",
            courses: [
              { code: 'BIO2019F', semester: '2-autumn-winter' },
              { code: 'BIO2005F', semester: '2-spring-summer' },
              { code: 'BIO2110F', semester: '2-spring-summer' },
              { code: 'BIO2113F', semester: '2-spring-summer' },
            ],
          },
          {
            tag: "(3)实践教学环节", credits: "6学分",
            children: [
              {
                tag: "1)必修课程", credits: "3学分",
                courses: [
                  { code: 'BIO4044MZ', semester: '4-autumn-winter' },
                ],
              },
              {
                tag: "2)选修课程", credits: "3学分",
                courses: [
                  { code: 'BIO2078M', semester: '1-short' },
                  { code: 'BIO2079M', semester: '1-short' },
                  { code: 'BIO2048M', semester: '2-short' },
                  { code: 'BIO2085M', semester: '2-short' },
                  { code: 'BIO3081M', semester: '2-short' },
                  { code: 'BIO2080M', semester: '3-short' },
                  { code: 'BIO3082M', semester: '3-short' },
                ],
              },
            ],
          },
          {
            tag: "(4)毕业论文（设计）", credits: "8学分",
            courses: [
              { code: 'BIO4087M', semester: '4-spring-summer' },
            ],
          },
        ],
      },
      {
        tag: "4.个性修读课程", credits: "15学分",
        children: [
          {
            tag: "1)本专业进阶模块", credits: "15学分",
            courses: [
              { code: 'BIO2017F', semester: '3-autumn-winter' },
              { code: 'BIO3025M', semester: '3-autumn-winter' },
              { code: 'BIO3045M', semester: '3-autumn-winter' },
              { code: 'BIO3061M', semester: '3-autumn-winter' },
              { code: 'BIO3070M', semester: '3-autumn-winter' },
              { code: 'BIO4032M', semester: '3-short' },
              { code: 'BIO3047M', semester: '3-spring-summer' },
              { code: 'BIO3057M', semester: '3-spring-summer' },
              { code: 'BIO3090M', semester: '3-spring-summer' },
              { code: 'BIO3109M', semester: '3-spring-summer' },
              { code: 'CAB2001F', semester: '3-spring-summer' },
            ],
          },
          {
            tag: "2)跨专业学习模块", credits: "15学分",
          },
          {
            tag: "3)学生自主修读模块", credits: "15学分",
            children: [
              {
                tag: "A.跨专业课程至少1门", credits: "1门",
              },
            ],
          },
        ],
      },
      ],
    },
    2026: {
      id: 'biology-qiushi-2026',
      majorId: 'biology-qiushi',
      year: '2026',
      label: '2026级生物科学（求是科学班）专业培养方案',
      sourceUrl: '/resource/educational_program/2026-qiushi.pdf',
      sections: [
      {
        tag: "二、专业基础课程", credits: "10学分",
        courses: [
          { code: 'BIO2033MZ', semester: '2-autumn-winter' },
          { code: 'BIO2042MZ', semester: '2-autumn-winter' },
          { code: 'BIO2034MZ', semester: '2-spring-summer' },
          { code: 'BIO3040MZ', semester: '2-spring-summer' },
        ],
      },
      {
        tag: "三、专业课程", credits: "43学分",
        children: [
          {
            tag: "(1)专业必修课程", credits: "21学分",
            courses: [
              { code: 'BIO3036MZ', semester: '3-autumn-winter' },
              { code: 'BIO3041MZ', semester: '3-autumn-winter' },
              { code: 'BIO3088M', semester: '3-autumn-winter' },
              { code: 'BIO3037MZ', semester: '3-spring-summer' },
              { code: 'BIO3039MZ', semester: '3-spring-summer' },
              { code: 'MED2308M', semester: '3-spring-summer' },
              { code: 'BIO3038MZ', semester: '3-spring-summer' },
            ],
          },
          {
            tag: "(2)专业选修课程", credits: "8学分",
            courses: [
              { code: 'BIO2019F', semester: '2-autumn-winter' },
              { code: 'BIO2005F', semester: '2-spring-summer' },
              { code: 'BIO2110F', semester: '2-spring-summer' },
              { code: 'BIO2113F', semester: '2-spring-summer' },
            ],
          },
          {
            tag: "(3)实践教学环节", credits: "6学分",
            children: [
              {
                tag: "1)必修课程", credits: "3学分",
                courses: [
                  { code: 'BIO4044MZ', semester: '4-autumn-winter' },
                ],
              },
              {
                tag: "2)选修课程", credits: "3学分",
                courses: [
                  { code: 'BIO2048M', semester: '2-short' },
                  { code: 'BIO2085M', semester: '2-short' },
                  { code: 'BIO3081M', semester: '2-short' },
                  { code: 'BIO2080M', semester: '3-short' },
                  { code: 'BIO3082M', semester: '3-short' },
                ],
              },
            ],
          },
          {
            tag: "(4)毕业论文（设计）", credits: "8学分",
            courses: [
              { code: 'BIO4087M', semester: '4-spring-summer' },
            ],
          },
        ],
      },
      {
        tag: "四、个性修读课程", credits: "15学分",
        children: [
          {
            tag: "1)本专业进阶模块", credits: "15学分",
            courses: [
              { code: 'BIO2114M', semester: '2-spring-summer' },
              { code: 'BIO2017F', semester: '3-autumn-winter' },
              { code: 'BIO3025M', semester: '3-autumn-winter' },
              { code: 'BIO3045M', semester: '3-autumn-winter' },
              { code: 'BIO3061M', semester: '3-autumn-winter' },
              { code: 'BIO3070M', semester: '3-autumn-winter' },
              { code: 'BIO3115M', semester: '3-autumn-winter' },
              { code: 'BIO4032M', semester: '3-short' },
              { code: 'BIO3047M', semester: '3-spring-summer' },
              { code: 'BIO3057M', semester: '3-spring-summer' },
              { code: 'BIO3090M', semester: '3-spring-summer' },
              { code: 'BIO3109M', semester: '3-spring-summer' },
              { code: 'CAB2001F', semester: '3-spring-summer' },
            ],
          },
          {
            tag: "2)跨专业学习模块", credits: "15学分",
          },
          {
            tag: "3)学生自主修读模块", credits: "15学分",
            children: [
              {
                tag: "A.跨专业课程至少1门", credits: "1门",
              },
            ],
          },
        ],
      },
      ],
    },
  },
  'biology-qiangji': {
    2024: {
      id: 'biology-qiangji-2024',
      majorId: 'biology-qiangji',
      year: '2024',
      label: '2024级生物科学（强基计划）本博贯通培养方案',
      sourceUrl: '/resource/educational_program/2024-qiangji.pdf',
      sections: [
      {
        tag: "2.专业课程", credits: "41学分",
        children: [
          {
            tag: "(1)专业必修课程", credits: "30学分",
            note: "选择一个模块进行必修",
            children: [
              {
                tag: "1)生物科学模块", credits: "30学分",
                courses: [
                  { code: 'BIO2011F', semester: '2-autumn-winter' },
                  { code: 'BIO2012F', semester: '2-autumn-winter' },
                  { code: 'BIO2029M', semester: '3-autumn-winter' },
                  { code: 'BIO3015F', semester: '3-autumn-winter' },
                  { code: 'BIO3025M', semester: '3-autumn-winter' },
                  { code: 'BIO3026M', semester: '3-autumn-winter' },
                  { code: 'BIO4032M', semester: '3-short' },
                  { code: 'BIO3038MZ', semester: '3-spring-summer' },
                  { code: 'CAB2001F', semester: '3-spring-summer' },
                  { code: 'MED2308M', semester: '3-spring-summer' },
                ],
              },
              {
                tag: "2)神经生物学模块", credits: "30学分",
                courses: [
                  { code: 'BIO2011F', semester: '2-autumn-winter' },
                  { code: 'BIO2012F', semester: '2-autumn-winter' },
                  { code: 'BIO2029M', semester: '2-spring-summer' },
                  { code: 'BIO3015F', semester: '3-autumn-winter' },
                  { code: 'BIO3025M', semester: '3-autumn-winter' },
                  { code: 'BIO3026M', semester: '3-autumn-winter' },
                  { code: 'MED5075M', semester: '3-autumn-winter' },
                  { code: 'BIO3053M', semester: '3-spring-summer' },
                  { code: 'MED2307M', semester: '3-spring-summer' },
                  { code: 'MED2308M', semester: '3-spring-summer' },
                ],
              },
            ],
          },
          {
            tag: "(2)专业选修课程", credits: "8学分",
            children: [
              {
                tag: "1)限选课程", credits: "8学分",
                note: "下列课程三选二",
                courses: [
                  { code: 'BIO2019F', semester: '2-autumn-winter' },
                  { code: 'BIO2005F', semester: '2-spring-summer' },
                  { code: 'BIO2110F', semester: '2-spring-summer' },
                  { code: 'BIO2113F', semester: '2-spring-summer' },
                ],
              },
            ],
          },
          {
            tag: "(3)实践教学环节", credits: "3学分",
            note: "以下课程必修",
            courses: [
              { code: 'BIO2085M', semester: '2-short' },
            ],
          },
        ],
      },
      {
        tag: "3.个性修读课程", credits: "15学分",
        children: [
          {
            tag: "1)本专业进阶模块", credits: "15学分",
            courses: [
              { code: 'BIO2028M', semester: '2-autumn-winter' },
              { code: 'BIO2048M', semester: '2-short' },
              { code: 'BIO2080M', semester: '2-short' },
              { code: 'MED4065M', semester: '3-autumn-winter' },
              { code: 'PSY4001M', semester: '3-autumn-winter' },
              { code: 'BIO2017F', semester: '3-autumn-winter' },
              { code: 'BIO3070M', semester: '3-autumn-winter' },
              { code: 'BIO3088M', semester: '3-autumn-winter' },
              { code: 'BIO3091M', semester: '3-autumn-winter' },
              { code: 'BIO3081M', semester: '3-short' },
              { code: 'BIO3082M', semester: '3-short' },
              { code: 'MED2310M', semester: '3-short' },
              { code: 'MED3309M', semester: '3-short' },
              { code: 'BIO3065M', semester: '3-spring-summer' },
              { code: 'BIO3089M', semester: '3-spring-summer' },
              { code: 'BIO3090M', semester: '3-spring-summer' },
              { code: 'BIO3092M', semester: '3-spring-summer' },
              { code: 'BIO3109M', semester: '3-spring-summer' },
            ],
          },
          {
            tag: "2)跨专业学习模块", credits: "15学分",
          },
          {
            tag: "3)学生自主修读模块", credits: "15学分",
            children: [
              {
                tag: "A.跨专业课程至少1门", credits: "1门",
              },
            ],
          },
        ],
      },
      ],
    },
    2025: {
      id: 'biology-qiangji-2025',
      majorId: 'biology-qiangji',
      year: '2025',
      label: '2025级生物科学（强基计划）本博贯通培养方案',
      sourceUrl: '/resource/educational_program/2025-qiangji.pdf',
      sections: [
      {
        tag: "2.专业课程", credits: "64学分",
        children: [
          {
            tag: "(1)专业必修课程", credits: "30学分",
            note: "选择一个模块进行必修",
            children: [
              {
                tag: "1)生物科学模块", credits: "30学分",
                courses: [
                  { code: 'BIO2011F', semester: '2-autumn-winter' },
                  { code: 'BIO2012F', semester: '2-autumn-winter' },
                  { code: 'BIO2029M', semester: '3-autumn-winter' },
                  { code: 'BIO3015F', semester: '3-autumn-winter' },
                  { code: 'BIO3025M', semester: '3-autumn-winter' },
                  { code: 'BIO3026M', semester: '3-autumn-winter' },
                  { code: 'BIO4032M', semester: '3-short' },
                  { code: 'BIO3038MZ', semester: '3-spring-summer' },
                  { code: 'CAB2001F', semester: '3-spring-summer' },
                  { code: 'MED2308M', semester: '3-spring-summer' },
                ],
              },
              {
                tag: "2)神经生物学模块", credits: "30学分",
                courses: [
                  { code: 'BIO2011F', semester: '2-autumn-winter' },
                  { code: 'BIO2012F', semester: '2-autumn-winter' },
                  { code: 'BIO2029M', semester: '2-spring-summer' },
                  { code: 'BIO3015F', semester: '3-autumn-winter' },
                  { code: 'BIO3025M', semester: '3-autumn-winter' },
                  { code: 'BIO3026M', semester: '3-autumn-winter' },
                  { code: 'MED5075M', semester: '3-autumn-winter' },
                  { code: 'BIO3053M', semester: '3-spring-summer' },
                  { code: 'MED2307M', semester: '3-spring-summer' },
                  { code: 'MED2308M', semester: '3-spring-summer' },
                ],
              },
            ],
          },
          {
            tag: "(2)专业选修课程", credits: "8学分",
            courses: [
              { code: 'BIO2019F', semester: '2-autumn-winter' },
              { code: 'BIO2005F', semester: '2-spring-summer' },
              { code: 'BIO2110F', semester: '2-spring-summer' },
              { code: 'BIO2113F', semester: '2-spring-summer' },
            ],
          },
          {
            tag: "(3)实践教学环节", credits: "3学分",
            note: "以下课程必修",
            courses: [
              { code: 'BIO2085M', semester: '2-short' },
            ],
          },
          {
            tag: "(4)转段方向课程", credits: "15学分",
            children: [
              {
                tag: "1)生物科学\\基础医学", credits: "15学分",
                courses: [
                  { code: 'BIO2028M', semester: '2-autumn-winter' },
                  { code: 'BIO2048M', semester: '2-short' },
                  { code: 'BIO2080M', semester: '2-short' },
                  { code: 'MED4065M', semester: '3-autumn-winter' },
                  { code: 'PSY4001M', semester: '3-autumn-winter' },
                  { code: 'BIO2017F', semester: '3-autumn-winter' },
                  { code: 'BIO3070M', semester: '3-autumn-winter' },
                  { code: 'BIO3088M', semester: '3-autumn-winter' },
                  { code: 'BIO3091M', semester: '3-autumn-winter' },
                  { code: 'BIO3081M', semester: '3-short' },
                  { code: 'BIO3082M', semester: '3-short' },
                  { code: 'MED2310M', semester: '3-short' },
                  { code: 'MED3309M', semester: '3-short' },
                  { code: 'BIO3065M', semester: '3-spring-summer' },
                  { code: 'BIO3089M', semester: '3-spring-summer' },
                  { code: 'BIO3090M', semester: '3-spring-summer' },
                  { code: 'BIO3109M', semester: '3-spring-summer' },
                ],
              },
              {
                tag: "2)药学", credits: "15学分",
                courses: [
                  { code: 'PHAR3002M', semester: '3-autumn-winter' },
                  { code: 'PHAR3008M', semester: '3-autumn-winter' },
                  { code: 'PHAR3005M', semester: '3-spring-summer' },
                  { code: 'PHAR3013M', semester: '3-spring-summer' },
                  { code: 'PHAR4003M', semester: '4-autumn-winter' },
                ],
              },
              {
                tag: "3)生物工程", credits: "15学分",
                courses: [
                  { code: 'CBE3001M', semester: '3-autumn-winter' },
                  { code: 'CBE3024M', semester: '3-autumn-winter' },
                  { code: 'CBE3004M', semester: '3-spring-summer' },
                  { code: 'CBE3005M', semester: '3-spring-summer' },
                ],
              },
            ],
          },
          {
            tag: "(5)毕业论文（设计）", credits: "8学分",
            courses: [
              { code: 'BIO4087M', semester: '4-spring-summer' },
            ],
          },
        ],
      },
      ],
    },
    2026: {
      id: 'biology-qiangji-2026',
      majorId: 'biology-qiangji',
      year: '2026',
      label: '2026级生物科学（强基计划）本博贯通培养方案',
      sourceUrl: '/resource/educational_program/2026-qiangji.pdf',
      sections: [
      {
        tag: "二、专业课程", credits: "64学分",
        children: [
          {
            tag: "(1)专业必修课程", credits: "30学分",
            note: "选择一个模块进行必修",
            children: [
              {
                tag: "1)生物科学模块", credits: "30学分",
                courses: [
                  { code: 'BIO2011F', semester: '2-autumn-winter' },
                  { code: 'BIO2012F', semester: '2-autumn-winter' },
                  { code: 'BIO2029M', semester: '3-autumn-winter' },
                  { code: 'BIO3015F', semester: '3-autumn-winter' },
                  { code: 'BIO3025M', semester: '3-autumn-winter' },
                  { code: 'BIO3026M', semester: '3-autumn-winter' },
                  { code: 'BIO4032M', semester: '3-short' },
                  { code: 'BIO3038MZ', semester: '3-spring-summer' },
                  { code: 'CAB2001F', semester: '3-spring-summer' },
                  { code: 'MED2308M', semester: '3-spring-summer' },
                ],
              },
              {
                tag: "2)神经生物学模块", credits: "30学分",
                courses: [
                  { code: 'BIO2011F', semester: '2-autumn-winter' },
                  { code: 'BIO2012F', semester: '2-autumn-winter' },
                  { code: 'BIO2029M', semester: '2-spring-summer' },
                  { code: 'BIO3015F', semester: '3-autumn-winter' },
                  { code: 'BIO3025M', semester: '3-autumn-winter' },
                  { code: 'BIO3026M', semester: '3-autumn-winter' },
                  { code: 'MED5075M', semester: '3-autumn-winter' },
                  { code: 'BIO3053M', semester: '3-spring-summer' },
                  { code: 'MED2307M', semester: '3-spring-summer' },
                  { code: 'MED2308M', semester: '3-spring-summer' },
                ],
              },
            ],
          },
          {
            tag: "(2)专业选修课程", credits: "8学分",
            courses: [
              { code: 'BIO2019F', semester: '2-autumn-winter' },
              { code: 'BIO2005F', semester: '2-spring-summer' },
              { code: 'BIO2110F', semester: '2-spring-summer' },
              { code: 'BIO2113F', semester: '2-spring-summer' },
            ],
          },
          {
            tag: "(3)毕业论文（设计）", credits: "8学分",
            courses: [
              { code: 'BIO4087M', semester: '4-spring-summer' },
            ],
          },
          {
            tag: "(4)科研实践环节", credits: "3学分",
            note: "以下课程必修",
            courses: [
              { code: 'BIO2085M', semester: '2-short' },
            ],
          },
          {
            tag: "(5)转段方向课程", credits: "15学分",
            children: [
              {
                tag: "1)生物科学\\基础医学", credits: "15学分",
                courses: [
                  { code: 'BIO2028M', semester: '2-autumn-winter' },
                  { code: 'BIO2048M', semester: '2-short' },
                  { code: 'BIO2080M', semester: '2-short' },
                  { code: 'BIO2114M', semester: '2-spring-summer' },
                  { code: 'MED4065M', semester: '3-autumn-winter' },
                  { code: 'PSY4001M', semester: '3-autumn-winter' },
                  { code: 'BIO2017F', semester: '3-autumn-winter' },
                  { code: 'BIO3070M', semester: '3-autumn-winter' },
                  { code: 'BIO3115M', semester: '3-autumn-winter' },
                  { code: 'BIO3088M', semester: '3-autumn-winter' },
                  { code: 'BIO3091M', semester: '3-autumn-winter' },
                  { code: 'BIO3081M', semester: '3-short' },
                  { code: 'BIO3082M', semester: '3-short' },
                  { code: 'MED2310M', semester: '3-short' },
                  { code: 'MED3309M', semester: '3-short' },
                  { code: 'BIO3065M', semester: '3-spring-summer' },
                  { code: 'BIO3089M', semester: '3-spring-summer' },
                  { code: 'BIO3090M', semester: '3-spring-summer' },
                  { code: 'BIO3109M', semester: '3-spring-summer' },
                ],
              },
              {
                tag: "2)药学", credits: "15学分",
                courses: [
                  { code: 'PHAR2004M', semester: '2-spring-summer' },
                  { code: 'PHAR3002M', semester: '3-autumn-winter' },
                  { code: 'PHAR3008M', semester: '3-autumn-winter' },
                  { code: 'PHAR3005M', semester: '3-spring-summer' },
                  { code: 'PHAR3013M', semester: '3-spring-summer' },
                  { code: 'PHAR4003M', semester: '4-autumn-winter' },
                ],
              },
              {
                tag: "3)人工智能", credits: "15学分",
                courses: [
                  { code: 'AI1003M', semester: '3-autumn-winter' },
                  { code: 'AI2002M', semester: '3-autumn-winter' },
                  { code: 'AI2003M', semester: '3-autumn-winter' },
                  { code: 'AI1001M', semester: '3-spring-summer' },
                  { code: 'AI2004M', semester: '3-spring-summer' },
                  { code: 'AI2007M', semester: '3-spring-summer' },
                ],
              },
            ],
          },
        ],
      },
      ],
    },
  },
  ecology: {
    2024: {
      id: 'ecology-2024',
      majorId: 'ecology',
      year: '2024',
      label: '2024级生态学专业培养方案',
      sourceUrl: '/resource/educational_program/2024-ecology.pdf',
      sections: [
      {
        tag: "2.专业基础课程", credits: "26学分",
        courses: [
          { code: 'CHEM1002F', semester: '1-autumn-winter' },
          { code: 'CHEM1004F', semester: '1-spring-summer' },
          { code: 'BIO2011F', semester: '2-autumn-winter' },
          { code: 'BIO2013F', semester: '2-autumn-winter' },
          { code: 'BIO2005F', semester: '2-spring-summer' },
          { code: 'BIO2019F', semester: '2-spring-summer' },
          { code: 'MATH2432F', semester: '2-spring-summer' },
        ],
      },
      {
        tag: "3.专业课程", credits: "37学分",
        children: [
          {
            tag: "(1)专业必修课程", credits: "24学分",
            courses: [
              { code: 'BIO2028M', semester: '2-autumn-winter' },
              { code: 'BIO3026M', semester: '2-autumn-winter' },
              { code: 'BIO2110F', semester: '2-spring-summer' },
              { code: 'BIO2113F', semester: '2-spring-summer' },
              { code: 'BIO3070M', semester: '3-autumn-winter' },
              { code: 'BIO3071M', semester: '3-autumn-winter' },
              { code: 'BIO3088M', semester: '3-autumn-winter' },
              { code: 'BIO3072M', semester: '3-spring-summer' },
              { code: 'BIO3073M', semester: '3-spring-summer' },
              { code: 'CAB2001F', semester: '3-spring-summer' },
            ],
          },
          {
            tag: "(2)实践教学环节", credits: "5学分",
            courses: [
              { code: 'BIO2085M', semester: '2-short' },
              { code: 'BIO2086M', semester: '2-short' },
            ],
          },
          {
            tag: "(3)毕业论文（设计）", credits: "8学分",
            courses: [
              { code: 'BIO4087M', semester: '4-spring-summer' },
            ],
          },
        ],
      },
      {
        tag: "4.个性修读课程", credits: "15学分",
        children: [
          {
            tag: "1)本专业进阶模块", credits: "15学分",
            courses: [
              { code: 'BIO2068M', semester: '2-autumn-winter' },
              { code: 'BIO3102M', semester: '3-autumn-winter' },
              { code: 'ENVR3301M', semester: '3-autumn-winter' },
              { code: 'BIO3110M', semester: '3-autumn-winter' },
              { code: 'BIO3101M', semester: '3-autumn-winter' },
              { code: 'BIO3055M', semester: '3-spring-summer' },
              { code: 'BIO3016F', semester: '3-spring-summer' },
              { code: 'BIO3103M', semester: '4-autumn-winter' },
              { code: 'BIO3104M', semester: '4-autumn-winter' },
              { code: 'BIO4059M', semester: '4-autumn-winter' },
              { code: 'BIO3025M', semester: '4-autumn-winter' },
              { code: 'ENVR4312M', semester: '4-autumn-winter' },
              { code: 'BIO4098M', semester: '4-autumn-winter' },
            ],
          },
          {
            tag: "2)跨专业学习模块", credits: "15学分",
          },
          {
            tag: "3)学生自主修读模块", credits: "15学分",
          },
        ],
      },
      ],
    },
    2025: {
      id: 'ecology-2025',
      majorId: 'ecology',
      year: '2025',
      label: '2025级生态学专业培养方案',
      sourceUrl: '/resource/educational_program/2025-ecology.pdf',
      sections: [
      {
        tag: "2.专业基础课程", credits: "26学分",
        courses: [
          { code: 'CHEM1002F', semester: '1-autumn-winter' },
          { code: 'CHEM1004F', semester: '1-spring-summer' },
          { code: 'BIO2011F', semester: '2-autumn-winter' },
          { code: 'BIO2013F', semester: '2-autumn-winter' },
          { code: 'BIO2005F', semester: '2-spring-summer' },
          { code: 'BIO2009F', semester: '2-spring-summer' },
          { code: 'BIO2019F', semester: '2-spring-summer' },
          { code: 'MATH2432F', semester: '2-spring-summer' },
        ],
      },
      {
        tag: "3.专业课程", credits: "37学分",
        children: [
          {
            tag: "(1)专业必修课程", credits: "24学分",
            courses: [
              { code: 'BIO2028M', semester: '2-autumn-winter' },
              { code: 'BIO3026M', semester: '2-autumn-winter' },
              { code: 'BIO3070M', semester: '3-autumn-winter' },
              { code: 'BIO3071M', semester: '3-autumn-winter' },
              { code: 'BIO3073M', semester: '3-autumn-winter' },
              { code: 'BIO3088M', semester: '3-autumn-winter' },
              { code: 'BIO3072M', semester: '3-spring-summer' },
              { code: 'CAB2001F', semester: '3-spring-summer' },
            ],
          },
          {
            tag: "(2)实践教学环节", credits: "5学分",
            courses: [
              { code: 'BIO2085M', semester: '2-short' },
              { code: 'BIO2086M', semester: '2-short' },
            ],
          },
          {
            tag: "(3)毕业论文（设计）", credits: "8学分",
            courses: [
              { code: 'BIO4087M', semester: '4-spring-summer' },
            ],
          },
        ],
      },
      {
        tag: "4.个性修读课程", credits: "15学分",
        children: [
          {
            tag: "1)本专业进阶模块", credits: "15学分",
            courses: [
              { code: 'BIO2068M', semester: '2-autumn-winter' },
              { code: 'BIO3102M', semester: '3-autumn-winter' },
              { code: 'ENVR3301M', semester: '3-autumn-winter' },
              { code: 'BIO3110M', semester: '3-autumn-winter' },
              { code: 'BIO3101M', semester: '3-autumn-winter' },
              { code: 'BIO3055M', semester: '3-spring-summer' },
              { code: 'BIO3016F', semester: '3-spring-summer' },
              { code: 'BIO3103M', semester: '4-autumn-winter' },
              { code: 'BIO3104M', semester: '4-autumn-winter' },
              { code: 'BIO4059M', semester: '4-autumn-winter' },
              { code: 'BIO3025M', semester: '4-autumn-winter' },
              { code: 'ENVR4312M', semester: '4-autumn-winter' },
              { code: 'BIO4098M', semester: '4-autumn-winter' },
            ],
          },
          {
            tag: "2)跨专业学习模块", credits: "15学分",
          },
          {
            tag: "3)学生自主修读模块", credits: "15学分",
          },
        ],
      },
      ],
    },
    2026: {
      id: 'ecology-2026',
      majorId: 'ecology',
      year: '2026',
      label: '2026级生态学专业培养方案',
      sourceUrl: '/resource/educational_program/2026-ecology.pdf',
      sections: [
      {
        tag: "二、专业基础课程", credits: "26学分",
        courses: [
          { code: 'CHEM1002F', semester: '1-autumn-winter' },
          { code: 'CHEM1004F', semester: '1-spring-summer' },
          { code: 'BIO2011F', semester: '2-autumn-winter' },
          { code: 'BIO2013F', semester: '2-autumn-winter' },
          { code: 'BIO2005F', semester: '2-spring-summer' },
          { code: 'BIO2019F', semester: '2-spring-summer' },
          { code: 'BIO2110F', semester: '2-spring-summer' },
          { code: 'BIO2113F', semester: '2-spring-summer' },
          { code: 'MATH2432F', semester: '2-spring-summer' },
        ],
      },
      {
        tag: "三、专业课程", credits: "31学分",
        children: [
          {
            tag: "(1)专业必修课程", credits: "18学分",
            courses: [
              { code: 'BIO2028M', semester: '2-autumn-winter' },
              { code: 'BIO3070M', semester: '3-autumn-winter' },
              { code: 'BIO3071M', semester: '3-autumn-winter' },
              { code: 'BIO3073M', semester: '3-autumn-winter' },
              { code: 'BIO3088M', semester: '3-autumn-winter' },
              { code: 'CAB2001F', semester: '3-spring-summer' },
            ],
          },
          {
            tag: "(2)实践教学环节", credits: "5学分",
            courses: [
              { code: 'BIO2085M', semester: '2-short' },
              { code: 'BIO2086M', semester: '2-short' },
            ],
          },
          {
            tag: "(3)毕业论文（设计）", credits: "8学分",
            courses: [
              { code: 'BIO4087M', semester: '4-spring-summer' },
            ],
          },
        ],
      },
      {
        tag: "四、个性修读课程", credits: "15学分",
        children: [
          {
            tag: "1)本专业进阶模块", credits: "15学分",
            courses: [
              { code: 'BIO3026M', semester: '2-autumn-winter' },
              { code: 'BIO2068M', semester: '2-autumn-winter' },
              { code: 'BIO2029M', semester: '2-spring-summer' },
              { code: 'BIO2114M', semester: '2-spring-summer' },
              { code: 'BIO3102M', semester: '3-autumn-winter' },
              { code: 'ENVR3301M', semester: '3-autumn-winter' },
              { code: 'BIO3110M', semester: '3-autumn-winter' },
              { code: 'BIO3101M', semester: '3-autumn-winter' },
              { code: 'BIO3055M', semester: '3-spring-summer' },
              { code: 'BIO3072M', semester: '3-spring-summer' },
              { code: 'BIO3016F', semester: '3-spring-summer' },
              { code: 'BIO3103M', semester: '4-autumn-winter' },
              { code: 'BIO3104M', semester: '4-autumn-winter' },
              { code: 'BIO4059M', semester: '4-autumn-winter' },
              { code: 'BIO3025M', semester: '4-autumn-winter' },
              { code: 'ENVR4312M', semester: '4-autumn-winter' },
            ],
          },
          {
            tag: "2)跨专业学习模块", credits: "15学分",
          },
          {
            tag: "3)学生自主修读模块", credits: "15学分",
            courses: [
              { code: 'BIO2028M', semester: '2-autumn-winter' },
              { code: 'BIO3070M', semester: '3-autumn-winter' },
              { code: 'BIO3071M', semester: '3-autumn-winter' },
              { code: 'BIO3073M', semester: '3-autumn-winter' },
              { code: 'BIO3088M', semester: '3-autumn-winter' },
            ],
          },
        ],
      },
      ],
    },
  },
  'ecology-qiangji': {
    2024: {
      id: 'ecology-qiangji-2024',
      majorId: 'ecology-qiangji',
      year: '2024',
      label: '2024级生态学（强基计划）本博贯通培养方案',
      sourceUrl: '/resource/educational_program/2024-ecology-qiangji.pdf',
      sections: [
      {
        tag: "2.专业课程", credits: "45.5学分",
        children: [
          {
            tag: "(1)专业必修课程", credits: "40.5学分",
            courses: [
              { code: 'BIO2011F', semester: '2-autumn-winter' },
              { code: 'BIO2013F', semester: '2-autumn-winter' },
              { code: 'BIO2019F', semester: '2-autumn-winter' },
              { code: 'BIO2028M', semester: '2-autumn-winter' },
              { code: 'BIO2005F', semester: '2-spring-summer' },
              { code: 'BIO2110F', semester: '2-spring-summer' },
              { code: 'BIO2113F', semester: '2-spring-summer' },
              { code: 'BIO3025M', semester: '3-autumn-winter' },
              { code: 'BIO3026M', semester: '3-autumn-winter' },
              { code: 'BIO3070M', semester: '3-autumn-winter' },
              { code: 'BIO3073M', semester: '3-autumn-winter' },
              { code: 'CAB2001F', semester: '3-spring-summer' },
            ],
          },
          {
            tag: "(2)实践教学环节", credits: "5学分",
            courses: [
              { code: 'BIO2085M', semester: '2-short' },
              { code: 'BIO2086M', semester: '2-short' },
            ],
          },
        ],
      },
      {
        tag: "3.个性修读课程", credits: "15学分",
        children: [
          {
            tag: "1)本专业进阶模块", credits: "15学分",
            children: [
              {
                tag: "A.基础生态学", credits: "15学分",
                courses: [
                  { code: 'BIO2023M', semester: '2-spring-summer' },
                  { code: 'BIO3016F', semester: '2-spring-summer' },
                  { code: 'BIO3055M', semester: '2-spring-summer' },
                  { code: 'BIO3101M', semester: '3-autumn-winter' },
                  { code: 'BIO3102M', semester: '3-autumn-winter' },
                  { code: 'BIO3088M', semester: '3-autumn-winter' },
                  { code: 'BIO3072M', semester: '3-spring-summer' },
                  { code: 'BIO3071M', semester: '3-spring-summer' },
                ],
              },
              {
                tag: "B.生态治理与管理", credits: "15学分",
                courses: [
                  { code: 'ECON2001F', semester: '2-autumn-winter' },
                  { code: 'PA2001F', semester: '2-autumn-winter' },
                  { code: 'ENVR3301M', semester: '2-spring-summer' },
                  { code: 'ENVR2307M', semester: '2-spring-summer' },
                  { code: 'CAB2004M', semester: '2-spring-summer' },
                  { code: 'BIO3104M', semester: '3-autumn-winter' },
                  { code: 'ENVR4312M', semester: '3-autumn-winter' },
                  { code: 'PA3037M', semester: '3-autumn-winter' },
                  { code: 'CAB3313M', semester: '3-autumn-winter' },
                  { code: 'CAB4315M', semester: '3-autumn-winter' },
                  { code: 'ENVR3307M', semester: '3-spring-summer' },
                  { code: 'ENVR3202M', semester: '3-spring-summer' },
                  { code: 'ENVR3211M', semester: '3-spring-summer' },
                ],
              },
            ],
          },
          {
            tag: "2)跨专业学习模块", credits: "15学分",
          },
          {
            tag: "3)学生自主修读模块", credits: "15学分",
            children: [
              {
                tag: "A.跨专业课程至少1门", credits: "1门",
              },
            ],
          },
        ],
      },
      ],
    },
    2025: {
      id: 'ecology-qiangji-2025',
      majorId: 'ecology-qiangji',
      year: '2025',
      label: '2025级生态学（强基计划）本博贯通培养方案',
      sourceUrl: '/resource/educational_program/2025-ecology-qiangji.pdf',
      sections: [
      {
        tag: "2.专业课程", credits: "62.5学分",
        children: [
          {
            tag: "(1)专业必修课程", credits: "34.5学分",
            courses: [
              { code: 'BIO2011F', semester: '2-autumn-winter' },
              { code: 'BIO2013F', semester: '2-autumn-winter' },
              { code: 'BIO2019F', semester: '2-autumn-winter' },
              { code: 'BIO2028M', semester: '2-autumn-winter' },
              { code: 'BIO2005F', semester: '2-spring-summer' },
              { code: 'BIO2110F', semester: '2-spring-summer' },
              { code: 'BIO2113F', semester: '2-spring-summer' },
              { code: 'BIO3025M', semester: '3-autumn-winter' },
              { code: 'BIO3026M', semester: '3-autumn-winter' },
              { code: 'CAB2001F', semester: '3-spring-summer' },
              { code: 'MED2308M', semester: '3-spring-summer' },
            ],
          },
          {
            tag: "(2)实践教学环节", credits: "5学分",
            courses: [
              { code: 'BIO2085M', semester: '2-short' },
              { code: 'BIO2086M', semester: '2-short' },
            ],
          },
          {
            tag: "(3)转段方向课程", credits: "15学分",
            children: [
              {
                tag: "1)生态学", credits: "15学分",
                courses: [
                  { code: 'BIO2023M', semester: '2-spring-summer' },
                  { code: 'BIO3016F', semester: '2-spring-summer' },
                  { code: 'BIO3055M', semester: '2-spring-summer' },
                  { code: 'BIO3101M', semester: '3-autumn-winter' },
                  { code: 'BIO3102M', semester: '3-autumn-winter' },
                  { code: 'BIO3070M', semester: '3-autumn-winter' },
                  { code: 'BIO3073M', semester: '3-autumn-winter' },
                  { code: 'BIO3088M', semester: '3-autumn-winter' },
                  { code: 'BIO3072M', semester: '3-spring-summer' },
                  { code: 'BIO3071M', semester: '3-spring-summer' },
                ],
              },
              {
                tag: "2)生物学", credits: "15学分",
                courses: [
                  { code: 'BIO2048M', semester: '2-short' },
                  { code: 'BIO2080M', semester: '2-short' },
                  { code: 'MED4065M', semester: '3-autumn-winter' },
                  { code: 'PSY4001M', semester: '3-autumn-winter' },
                  { code: 'BIO2017F', semester: '3-autumn-winter' },
                  { code: 'BIO3088M', semester: '3-autumn-winter' },
                  { code: 'BIO3091M', semester: '3-autumn-winter' },
                  { code: 'BIO3081M', semester: '3-short' },
                  { code: 'BIO3082M', semester: '3-short' },
                  { code: 'MED2310M', semester: '3-short' },
                  { code: 'MED3309M', semester: '3-short' },
                  { code: 'BIO3065M', semester: '3-spring-summer' },
                  { code: 'BIO3089M', semester: '3-spring-summer' },
                  { code: 'BIO3090M', semester: '3-spring-summer' },
                  { code: 'BIO3109M', semester: '3-spring-summer' },
                ],
              },
              {
                tag: "3)环境科学与工程", credits: "15学分",
                children: [
                  {
                    tag: "A.环境科学", credits: "15学分",
                    courses: [
                      { code: 'ENVR3102M', semester: '2-autumn-winter' },
                      { code: 'ENVR2101M', semester: '2-spring-summer' },
                      { code: 'ENVR2102M', semester: '2-spring-summer' },
                      { code: 'ENVR2111M', semester: '2-spring-summer' },
                      { code: 'ENVR3116M', semester: '3-autumn-winter' },
                      { code: 'ENVR3119M', semester: '3-autumn-winter' },
                      { code: 'ENVR3112M', semester: '3-spring-summer' },
                    ],
                  },
                  {
                    tag: "B.环境工程", credits: "15学分",
                    courses: [
                      { code: 'ENVR2205M', semester: '2-spring-summer' },
                      { code: 'ENVR3202M', semester: '3-autumn-winter' },
                      { code: 'ENVR3206M', semester: '3-spring-summer' },
                      { code: 'ENVR3211M', semester: '3-spring-summer' },
                    ],
                  },
                ],
              },
              {
                tag: "4)海洋技术与工程", credits: "15学分",
                courses: [
                  { code: 'ECON4004M', semester: '2-autumn-winter' },
                  { code: 'ECON2009M', semester: '2-spring-summer' },
                  { code: 'OC3003M', semester: '3-autumn-winter' },
                  { code: 'OC3023M', semester: '3-autumn-winter' },
                  { code: 'OC3041M', semester: '3-spring-summer' },
                ],
              },
            ],
          },
          {
            tag: "(4)毕业论文（设计）", credits: "8学分",
            courses: [
              { code: 'BIO4087M', semester: '4-spring-summer' },
            ],
          },
        ],
      },
      ],
    },
    2026: {
      id: 'ecology-qiangji-2026',
      majorId: 'ecology-qiangji',
      year: '2026',
      label: '2026级生态学（强基计划）本博贯通培养方案',
      sourceUrl: '/resource/educational_program/2026-ecology-qiangji.pdf',
      sections: [
      {
        tag: "二、专业课程", credits: "62.5学分",
        children: [
          {
            tag: "(1)专业必修课程", credits: "34.5学分",
            courses: [
              { code: 'BIO2011F', semester: '2-autumn-winter' },
              { code: 'BIO2013F', semester: '2-autumn-winter' },
              { code: 'BIO2019F', semester: '2-autumn-winter' },
              { code: 'BIO2028M', semester: '2-autumn-winter' },
              { code: 'BIO2005F', semester: '2-spring-summer' },
              { code: 'BIO2110F', semester: '2-spring-summer' },
              { code: 'BIO2113F', semester: '2-spring-summer' },
              { code: 'BIO3025M', semester: '3-autumn-winter' },
              { code: 'BIO3026M', semester: '3-autumn-winter' },
              { code: 'CAB2001F', semester: '3-spring-summer' },
              { code: 'MED2308M', semester: '3-spring-summer' },
            ],
          },
          {
            tag: "(2)毕业论文（设计）", credits: "8学分",
            courses: [
              { code: 'BIO4087M', semester: '4-spring-summer' },
            ],
          },
          {
            tag: "(3)科研实践环节", credits: "5学分",
            courses: [
              { code: 'BIO2085M', semester: '2-short' },
              { code: 'BIO2086M', semester: '2-short' },
            ],
          },
          {
            tag: "(4)转段方向课程", credits: "15学分",
            children: [
              {
                tag: "1)生态学", credits: "15学分",
                courses: [
                  { code: 'BIO2023M', semester: '2-spring-summer' },
                  { code: 'BIO3016F', semester: '2-spring-summer' },
                  { code: 'BIO3055M', semester: '2-spring-summer' },
                  { code: 'BIO3101M', semester: '3-autumn-winter' },
                  { code: 'BIO3102M', semester: '3-autumn-winter' },
                  { code: 'BIO3070M', semester: '3-autumn-winter' },
                  { code: 'BIO3073M', semester: '3-autumn-winter' },
                  { code: 'BIO3088M', semester: '3-autumn-winter' },
                  { code: 'BIO3072M', semester: '3-spring-summer' },
                  { code: 'BIO2114M', semester: '3-spring-summer' },
                  { code: 'BIO3071M', semester: '3-spring-summer' },
                ],
              },
              {
                tag: "2)生物学", credits: "15学分",
                courses: [
                  { code: 'BIO2048M', semester: '2-short' },
                  { code: 'BIO2080M', semester: '2-short' },
                  { code: 'MED4065M', semester: '3-autumn-winter' },
                  { code: 'PSY4001M', semester: '3-autumn-winter' },
                  { code: 'BIO2017F', semester: '3-autumn-winter' },
                  { code: 'BIO3115M', semester: '3-autumn-winter' },
                  { code: 'BIO3088M', semester: '3-autumn-winter' },
                  { code: 'BIO3091M', semester: '3-autumn-winter' },
                  { code: 'BIO3081M', semester: '3-short' },
                  { code: 'BIO3082M', semester: '3-short' },
                  { code: 'MED2310M', semester: '3-short' },
                  { code: 'MED3309M', semester: '3-short' },
                  { code: 'BIO3065M', semester: '3-spring-summer' },
                  { code: 'BIO3089M', semester: '3-spring-summer' },
                  { code: 'BIO3090M', semester: '3-spring-summer' },
                  { code: 'BIO3109M', semester: '3-spring-summer' },
                ],
              },
              {
                tag: "3)能源动力", credits: "15学分",
                courses: [
                  { code: 'ENER3021M', semester: '3-autumn-winter' },
                  { code: 'ENER3062M', semester: '3-autumn-winter' },
                  { code: 'ENER3044M', semester: '3-spring-summer' },
                  { code: 'ENER2003M', semester: '3-spring-summer' },
                  { code: 'ENER3061M1', semester: '3-spring-summer' },
                  { code: 'ENER3039M', semester: '3-spring-summer' },
                ],
              },
              {
                tag: "4)人工智能", credits: "15学分",
                courses: [
                  { code: 'AI1003M', semester: '3-autumn-winter' },
                  { code: 'AI2002M', semester: '3-autumn-winter' },
                  { code: 'AI2003M', semester: '3-autumn-winter' },
                  { code: 'AI1001M', semester: '3-spring-summer' },
                  { code: 'AI2004M', semester: '3-spring-summer' },
                  { code: 'AI2007M', semester: '3-spring-summer' },
                ],
              },
            ],
          },
        ],
      },
      ],
    },
  },};

/**
 * @param {string} majorId
 * @param {string|number} year
 * @returns {Object|null} 培养方案，未收录时返回 null。
 */
export function findCurriculumProgram(majorId, year) {
  return curriculumPrograms[majorId]?.[String(year)] ?? null;
}

/**
 * @param {string} majorId
 * @returns {string[]} 该专业已收录培养方案的年级，升序。
 */
export function listProgramYears(majorId) {
  return Object.keys(curriculumPrograms[majorId] ?? {}).sort();
}

/** 深度优先遍历章节树。 */
export function walkSections(sections, visit, depth = 0) {
  for (const section of sections ?? []) {
    visit(section, depth);
    walkSections(section.children, visit, depth + 1);
  }
}

/**
 * 找出所有「二选一」小节（note 为 ALTERNATIVE_NOTE），其 children 为互斥分支。
 * @returns {Array<{tag: string, options: Object[]}>}
 */
export function listAlternativeGroups(program) {
  const groups = [];
  walkSections(program?.sections, (section) => {
    if (section.note === ALTERNATIVE_NOTE && section.children?.length > 1) {
      groups.push({ tag: section.tag, options: section.children });
    }
  });
  return groups;
}

/**
 * 判定每个互斥组选中了哪一支，并收集需要跳过的小节（含其子树）。
 *
 * @param {Object|null} program
 * @param {Iterable<string>} [chosen] 已选分支 tag
 * @returns {{selectedByGroup: Map<string,string>, skipped: Set<Object>}}
 */
export function resolveAlternatives(program, chosen = []) {
  const wanted = new Set(chosen);
  const selectedByGroup = new Map();
  const skipped = new Set();

  for (const group of listAlternativeGroups(program)) {
    const pick = group.options.find((option) => wanted.has(option.tag)) ?? group.options[0];
    selectedByGroup.set(group.tag, pick.tag);
    for (const option of group.options) {
      if (option === pick) continue;
      skipped.add(option);
      walkSections(option.children, (node) => skipped.add(node));
    }
  }
  return { selectedByGroup, skipped };
}

/**
 * 把章节树压平成课程清单，供「按学期」视图使用。
 *
 * 互斥小节只取选中的那一支；`chosen` 是已选分支 tag 的集合（直接来自 URL 的
 * module 参数），某组没有命中时取该组第一个分支。同一门课在不同分支的建议
 * 学期可能不同，取选中分支的值。
 *
 * @param {Object|null} program
 * @param {Iterable<string>} [chosen]
 * @returns {{courseCodes: string[], semesterByCourse: Object}}
 */
export function flattenProgram(program, chosen = []) {
  const { skipped } = resolveAlternatives(program, chosen);
  const semesterByCourse = {};
  walkSections(program?.sections, (section) => {
    if (skipped.has(section)) return;
    for (const course of section.courses ?? []) {
      semesterByCourse[course.code] = course.semester;
    }
  });
  return { courseCodes: Object.keys(semesterByCourse), semesterByCourse };
}
