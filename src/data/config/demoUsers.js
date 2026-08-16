// Demo identities for the account switcher (development/demo use only).
//
// These are front-end display identities: they preview how each role sees
// the UI without a real backend session. Frontend permission checks are not
// a real security boundary (see docs/project-guides/decisions.md), and real
// write operations still run against the real signed-in session.

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
    id: 'cc98',
    label: 'CC98 认证学生',
    description: '仅完成 CC98 验证码认证。',
    user: {
      id: 'demo-cc98',
      role: 'student',
      nickname: '演示·青莲',
      cc98Nickname: 'cc98_demo_leaf',
      email: '',
      avatarInitials: '青',
      avatarColor: '#2d4a2b',
      publicId: 'demo-cc98',
      verifications: { cc98: true, email: false },
    },
  },
  {
    id: 'email',
    label: '学号认证学生',
    description: '仅完成浙大学号邮箱认证。',
    user: {
      id: 'demo-email',
      role: 'student',
      nickname: '演示·蓝桥',
      cc98Nickname: '未绑定',
      email: '3240100000@zju.edu.cn',
      avatarInitials: '蓝',
      avatarColor: '#4a6fa5',
      publicId: 'demo-email',
      verifications: { cc98: false, email: true },
    },
  },
  {
    id: 'dual',
    label: '双认证学生',
    description: 'CC98 与浙大邮箱均已认证。',
    user: {
      id: 'demo-dual',
      role: 'student',
      nickname: '演示·双认证',
      cc98Nickname: 'cc98_demo_dual',
      email: '3240100001@zju.edu.cn',
      avatarInitials: '双',
      avatarColor: '#36454f',
      publicId: 'demo-dual',
      verifications: { cc98: true, email: true },
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
      cc98Nickname: 'cc98_demo_admin',
      email: '',
      avatarInitials: '管',
      avatarColor: '#0066ff',
      publicId: 'demo-admin',
      verifications: { cc98: true, email: false },
    },
  },
];
