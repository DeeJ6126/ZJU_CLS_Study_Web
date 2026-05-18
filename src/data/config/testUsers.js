export const defaultUserId = 'guest';

export const testUsers = [
  {
    id: 'guest',
    role: 'guest',
    nickname: '访客',
    cc98Nickname: '未认证',
    email: '',
    avatarInitials: 'G',
    avatarColor: '#708090',
    verifications: {
      cc98: false,
      email: false,
    },
  },
  {
    id: 'cc98-user',
    role: 'student',
    nickname: '青莲同学',
    cc98Nickname: 'cc98_greenleaf',
    email: '',
    avatarInitials: '青',
    avatarColor: '#2d4a2b',
    verifications: {
      cc98: true,
      email: false,
    },
  },
  {
    id: 'email-user',
    role: 'student',
    nickname: '蓝桥同学',
    cc98Nickname: '待绑定',
    email: '3240100000@zju.edu.cn',
    avatarInitials: '蓝',
    avatarColor: '#4a6fa5',
    verifications: {
      cc98: false,
      email: true,
    },
  },
  {
    id: 'dual-user',
    role: 'student',
    nickname: '双认证同学',
    cc98Nickname: 'bio_dual',
    email: '3240100001@zju.edu.cn',
    avatarInitials: '双',
    avatarColor: '#36454f',
    verifications: {
      cc98: true,
      email: true,
    },
  },
  {
    id: 'developer',
    role: 'developer',
    nickname: '学术部开发者',
    cc98Nickname: 'cls_admin',
    email: 'admin@zju.edu.cn',
    avatarInitials: '开',
    avatarColor: '#0066ff',
    verifications: {
      cc98: true,
      email: true,
    },
  },
];

export function getTestUserById(userId) {
  return testUsers.find((user) => user.id === userId) ?? testUsers[0];
}
