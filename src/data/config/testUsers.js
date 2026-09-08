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
    id: 'student',
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
    id: 'admin',
    role: 'admin',
    nickname: '管理员',
    cc98Nickname: '未绑定',
    email: '3240100001@zju.edu.cn',
    avatarInitials: '管',
    avatarColor: '#0066ff',
    verifications: {
      cc98: false,
      email: true,
    },
  },
];

export function getTestUserById(userId) {
  return testUsers.find((user) => user.id === userId) ?? testUsers[0];
}
