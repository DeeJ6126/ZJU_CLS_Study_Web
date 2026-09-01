const timestamp = '2026-08-18T08:30:00.000Z';

function course(courseCode, courseName, teacherName, term, classTime, classLocation, catalogMatched = true) {
  return { courseCode, courseName, teacherName, term, classTime, classLocation, catalogMatched };
}

function post(id, courseCode, type, routeId, title, summary, body, status = 'published') {
  return { id, contentId: id, courseCode, type, routeId, title, summary, body, status, createdAt: timestamp };
}

function submission(id, courseCode, type, title, status, extra = {}) {
  return {
    id, courseCode, type, title, status,
    summary: `${title}的简要说明`,
    body: `这是用于体验投稿流程的演示正文。\n\n内容只保存在当前浏览器。`,
    author: '', reviewNote: '', createdAt: timestamp, ...extra,
  };
}

export const demoAccountSchemaVersion = 1;
export const demoAccountStorageKey = 'study-platform-demo-accounts-v1';

export function createDemoAccountSeeds() {
  return {
    version: demoAccountSchemaVersion,
    sequence: 100,
    auditLogs: [],
    adminContent: [],
    accounts: {
      cc98: {
        user: {
          id: 'demo-cc98', publicId: 'demo-cc98', role: 'student', nickname: '演示·青莲',
          cc98Nickname: 'cc98_demo_leaf', email: '', avatarInitials: '青', avatarColor: '#2d4a2b',
          avatarUrl: '', verifications: { cc98: true, email: false }, isDemo: true, grade: 2025,
        },
        courses: [
          course('BIO2110F', '微生物学及实验', '陈老师', '2025-2026秋冬', '周一3-4;周四6-8', '生物实验楼101;教学楼203'),
          course('BIO2023M', '分子生物学', '吴老师', '2025-2026秋冬', '周二1-2', '紫金港西1-205'),
          course('BIO2019F', '植物学及实验', '周老师', '2025-2026春夏', '周三6-8', '生物实验楼305'),
        ],
        favorites: [post('demo-content-micro-1', 'BIO2110F', 'material', '1', '微生物学期末复习提纲', '按章节整理的高频知识点。', '')],
        likedContentIds: [],
        posts: [post('demo-post-cc98-1', 'BIO2110F', 'experience', 'demo-post-cc98-1', '微生物学复习节奏记录', '从章节框架到错题回看的三周复习安排。', '先建立章节框架，再用错题补充容易混淆的概念。')],
        submissions: [submission('demo-sub-cc98-1', 'BIO2110F', 'material', '微生物学名词辨析表', 'pending')],
        comments: [{ id: 'demo-comment-cc98-1', contentId: 'demo-content-micro-1', courseCode: 'BIO2110F', type: 'material', routeId: '1', itemTitle: '微生物学期末复习提纲', body: '表格里的对照关系很适合考前快速回顾。', deleted: false, createdAt: timestamp }],
        notifications: [{ id: 'demo-note-cc98-1', title: '欢迎使用演示账号', body: '你的课程、收藏与投稿数据只保存在当前浏览器。', createdAt: timestamp, readAt: '', target: null, actor: null }],
      },
      email: {
        user: {
          id: 'demo-email', publicId: 'demo-email', role: 'student', nickname: '演示·蓝桥',
          cc98Nickname: '未绑定', email: '3240100000@zju.edu.cn', avatarInitials: '蓝', avatarColor: '#4a6fa5',
          avatarUrl: '', verifications: { cc98: false, email: true }, isDemo: true, grade: 2024,
        },
        courses: [
          course('BIO2019F', '植物学及实验', '周老师', '2025-2026春夏', '周三6-8', '生物实验楼305'),
          course('BIO3026M', '遗传学及实验', '王老师', '2025-2026春夏', '周一6-8', '生物实验楼201'),
        ],
        favorites: [post('demo-post-cc98-1', 'BIO2110F', 'experience', 'demo-post-cc98-1', '微生物学复习节奏记录', '从章节框架到错题回看的三周复习安排。', '')],
        likedContentIds: [],
        posts: [],
        submissions: [submission('demo-sub-email-1', 'BIO2019F', 'experience', '植物切片观察中的定位方法', 'rejected', { reviewNote: '请补充图片来源和观察倍率。' })],
        comments: [{ id: 'demo-comment-email-1', contentId: 'demo-post-cc98-1', courseCode: 'BIO2110F', type: 'experience', routeId: 'demo-post-cc98-1', itemTitle: '微生物学复习节奏记录', body: '这个三周安排很清楚，我准备照着试一次。', deleted: false, createdAt: timestamp }],
        notifications: [{ id: 'demo-note-email-1', title: '投稿需要修改', body: '“植物切片观察中的定位方法”未通过审核，请查看审核意见。', createdAt: timestamp, readAt: '', target: { courseCode: 'BIO2019F', type: 'experience', routeId: '' }, actor: { publicId: 'demo-admin', nickname: '演示·管理员', avatarUrl: '' } }],
      },
      dual: {
        user: {
          id: 'demo-dual', publicId: 'demo-dual', role: 'student', nickname: '演示·双认证',
          cc98Nickname: 'cc98_demo_dual', email: '3240100001@zju.edu.cn', avatarInitials: '双', avatarColor: '#36454f',
          avatarUrl: '', verifications: { cc98: true, email: true }, isDemo: true, grade: 2024,
        },
        courses: [
          course('BIO2023M', '分子生物学', '吴老师', '2025-2026秋冬', '周二1-2', '紫金港西1-205'),
          course('BIO2110F', '微生物学及实验', '陈老师', '2025-2026秋冬', '周一3-4', '生物实验楼101'),
          course('SIS0506G', '西方歌剧文化', '李老师', '2025-2026春夏', '周五9-10', '东2-101', false),
        ],
        favorites: [],
        likedContentIds: [],
        posts: [post('demo-post-dual-1', 'BIO2023M', 'material', 'demo-post-dual-1', '分子生物学概念关系图', '把复制、转录与翻译串成一张复习路线图。', '建议先按过程建立主线，再补充调控层面的例外。', 'archived')],
        submissions: [submission('demo-sub-dual-1', 'BIO2023M', 'material', '分子生物学概念关系图修订版', 'approved')],
        comments: [],
        notifications: [{ id: 'demo-note-dual-1', title: '修改已通过', body: '你的资料修订已经通过审核。', createdAt: timestamp, readAt: timestamp, target: { courseCode: 'BIO2023M', type: 'material', routeId: 'demo-post-dual-1' }, actor: { publicId: 'demo-admin', nickname: '演示·管理员', avatarUrl: '' } }],
      },
      admin: {
        user: {
          id: 'demo-admin', publicId: 'demo-admin', role: 'admin', nickname: '演示·管理员',
          cc98Nickname: 'cc98_demo_admin', email: '', avatarInitials: '管', avatarColor: '#0066ff',
          avatarUrl: '', verifications: { cc98: true, email: false }, isDemo: true, grade: 2023,
        },
        courses: [course('BIO2110F', '微生物学及实验', '陈老师', '2025-2026秋冬', '周一3-4', '生物实验楼101')],
        favorites: [], likedContentIds: [], posts: [], submissions: [], comments: [],
        notifications: [{ id: 'demo-note-admin-1', title: '有新的待审核投稿', body: '演示·青莲提交了“微生物学名词辨析表”。', createdAt: timestamp, readAt: '', target: null, actor: { publicId: 'demo-cc98', nickname: '演示·青莲', avatarUrl: '' } }],
      },
    },
  };
}
