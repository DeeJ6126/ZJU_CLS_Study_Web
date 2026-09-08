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

export const demoAccountSchemaVersion = 2;
export const demoAccountStorageKey = 'study-platform-demo-accounts-v2';

export function createDemoAccountSeeds() {
  return {
    version: demoAccountSchemaVersion,
    sequence: 100,
    auditLogs: [],
    adminContent: [],
    accounts: {
      student: {
        user: {
          id: 'demo-student', publicId: 'demo-student', role: 'student', nickname: '演示·学生',
          cc98Nickname: '未绑定', email: '3240100000@zju.edu.cn', avatarInitials: '学', avatarColor: '#4a6fa5',
          avatarUrl: '', verifications: { cc98: false, email: true }, isDemo: true, grade: 2024,
        },
        courses: [
          course('BIO2110F', '微生物学及实验', '陈老师', '2025-2026秋冬', '周一3-4;周四6-8', '生物实验楼101;教学楼203'),
          course('BIO2023M', '分子生物学', '吴老师', '2025-2026秋冬', '周二1-2', '紫金港西1-205'),
          course('BIO2019F', '植物学及实验', '周老师', '2025-2026春夏', '周三6-8', '生物实验楼305'),
        ],
        favorites: [post('demo-content-micro-1', 'BIO2110F', 'material', '1', '微生物学期末复习提纲', '按章节整理的高频知识点。', '')],
        likedContentIds: [],
        posts: [post('demo-post-student-1', 'BIO2110F', 'experience', 'demo-post-student-1', '微生物学复习节奏记录', '从章节框架到错题回看的三周复习安排。', '先建立章节框架，再用错题补充容易混淆的概念。')],
        submissions: [submission('demo-sub-student-1', 'BIO2110F', 'material', '微生物学名词辨析表', 'pending')],
        comments: [{ id: 'demo-comment-student-1', contentId: 'demo-content-micro-1', courseCode: 'BIO2110F', type: 'material', routeId: '1', itemTitle: '微生物学期末复习提纲', body: '表格里的对照关系很适合考前快速回顾。', deleted: false, createdAt: timestamp }],
        notifications: [{ id: 'demo-note-student-1', title: '欢迎使用演示账号', body: '你的课程、收藏与投稿数据只保存在当前浏览器。', createdAt: timestamp, readAt: '', target: null, actor: null }],
      },
      admin: {
        user: {
          id: 'demo-admin', publicId: 'demo-admin', role: 'admin', nickname: '演示·管理员',
          cc98Nickname: '未绑定', email: '3230100000@zju.edu.cn', avatarInitials: '管', avatarColor: '#0066ff',
          avatarUrl: '', verifications: { cc98: false, email: true }, isDemo: true, grade: 2023,
        },
        courses: [course('BIO2110F', '微生物学及实验', '陈老师', '2025-2026秋冬', '周一3-4', '生物实验楼101')],
        favorites: [], likedContentIds: [], posts: [], submissions: [], comments: [],
        notifications: [{ id: 'demo-note-admin-1', title: '有新的待审核投稿', body: '演示·学生提交了“微生物学名词辨析表”。', createdAt: timestamp, readAt: '', target: null, actor: { publicId: 'demo-student', nickname: '演示·学生', avatarUrl: '' } }],
      },
    },
  };
}
