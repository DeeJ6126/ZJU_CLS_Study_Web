export const navigationItems = [
  {
    id: 'resources',
    label: '资源中心',
    kicker: 'Resource',
    description: '课程资料、工具入口与学习清单',
    href: '#resources',
  },
  {
    id: 'academic-guidance',
    label: '学业领航',
    kicker: 'Navigator',
    description: '培养方案、选课路径与升学经验',
    href: '#academic-guidance',
  },
  {
    id: 'peer-support',
    label: '朋辈辅学',
    kicker: 'Peer',
    description: '答疑预约、学习小组与经验分享',
    href: '#peer-support',
  },
  {
    id: 'lab-open-day',
    label: '实验室开放日',
    kicker: 'Lab',
    description: '实验室开放、导师方向与报名入口',
    href: '#lab-open-day',
  },
  {
    id: 'beautiful-activities',
    label: '最美活动',
    kicker: 'Showcase',
    description: '学习生活作品展示与活动征集',
    href: '#beautiful-activities',
    children: [
      {
        id: 'beautiful-notes',
        label: '最美笔记',
        href: '#beautiful-notes',
      },
      {
        id: 'beautiful-schedule',
        label: '最美日程表',
        href: '#beautiful-schedule',
      },
      {
        id: 'beautiful-desk',
        label: '最美书桌',
        href: '#beautiful-desk',
      },
    ],
  },
];
