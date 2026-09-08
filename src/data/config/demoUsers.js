// Demo identities for the account switcher (development/demo use only).
//
// These records define the stable identity metadata for the browser-local
// demo sandboxes. Their mutable profile and learning data is owned by
// demoAccountService; no demo operation grants backend authority.

export const demoIdentities = [
  {
    id: 'guest',
    label: '游客',
    description: '未登录浏览，仅可查看公开资源。',
    user: {
      id: 'guest',
      role: 'guest',
      nickname: '访客',
      cc98Nickname: '未绑定',
      email: '',
      avatarInitials: 'G',
      avatarColor: '#708090',
      verifications: { cc98: false, email: false },
    },
  },
  {
    id: 'student',
    label: '学号认证学生',
    description: '已完成浙大学号邮箱认证，可使用需要留痕的功能。',
    user: {
      id: 'demo-student',
      role: 'student',
      nickname: '演示·学生',
      cc98Nickname: '未绑定',
      email: '3240100000@zju.edu.cn',
      avatarInitials: '学',
      avatarColor: '#4a6fa5',
      publicId: 'demo-student',
      verifications: { cc98: false, email: true },
      grade: 2024,
    },
  },
  {
    id: 'admin',
    label: '管理员',
    description: '管理员角色，可进入 #admin 管理台。',
    user: {
      id: 'demo-admin',
      role: 'admin',
      nickname: '演示·管理员',
      cc98Nickname: '未绑定',
      email: '3230100000@zju.edu.cn',
      avatarInitials: '管',
      avatarColor: '#0066ff',
      publicId: 'demo-admin',
      verifications: { cc98: false, email: true },
      grade: 2023,
    },
  },
];
