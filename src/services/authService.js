export function isAuthenticated(user) {
  return Boolean(user && (user.role !== 'guest' || user.verifications?.cc98 || user.verifications?.email));
}

export function isVerifiedUser(user) {
  return Boolean(user?.verifications?.cc98 || user?.verifications?.email || user?.role === 'developer');
}

export function getAccountState(user) {
  if (!isAuthenticated(user)) {
    return {
      id: 'guest',
      label: '游客',
      description: '当前以游客身份浏览，可查看公开资源。',
    };
  }

  if (user.role === 'developer') {
    return {
      id: 'developer',
      label: '开发者',
      description: '可接收投稿申请，并用于测试平台管理状态。',
    };
  }

  const hasCc98 = Boolean(user.verifications?.cc98);
  const hasEmail = Boolean(user.verifications?.email);

  if (hasCc98 && hasEmail) {
    return {
      id: 'dual',
      label: 'CC98 + 邮箱认证',
      description: '已完成两类认证，可投稿、评论和收藏。',
    };
  }

  if (hasCc98) {
    return {
      id: 'cc98',
      label: 'CC98认证',
      description: '已通过 CC98 验证码认证，可投稿、评论和收藏。',
    };
  }

  if (hasEmail) {
    return {
      id: 'email',
      label: '邮箱认证',
      description: '已通过浙大邮箱验证码认证，可投稿、评论和收藏。',
    };
  }

  return {
    id: 'student',
    label: '已登录',
    description: '账号已登录，认证状态待补充。',
  };
}

export function getVerificationBadges(user) {
  if (!isAuthenticated(user)) {
    return ['未登录'];
  }

  if (user.role === 'developer') {
    return ['开发者', 'CC98认证', '邮箱认证'];
  }

  const badges = [];

  if (user.verifications?.cc98) {
    badges.push('CC98认证');
  }

  if (user.verifications?.email) {
    badges.push('邮箱认证');
  }

  return badges.length ? badges : ['已登录'];
}

export function canSubmitResource(user) {
  return isVerifiedUser(user);
}

export function canComment(user) {
  return isVerifiedUser(user);
}

export function canFavorite(user) {
  return isAuthenticated(user);
}

export function canRequestCc98PrototypeVerification(user) {
  return Boolean(user && user.role !== 'developer' && !user.verifications?.cc98);
}

export function createSubmissionMessage({
  fromUser,
  courseCode,
  tabId,
  title,
  subtitle = '',
  cc98Name = '',
  cc98Link = '',
  body = '',
  materialLink = '',
}) {
  const extra = [
    subtitle ? `副标题：${subtitle}` : '',
    cc98Name ? `CC98：${cc98Name}` : '',
    cc98Link ? `CC98链接：${cc98Link}` : '',
    materialLink ? `资料链接：${materialLink}` : '',
    body ? `内容：${body}` : '',
  ].filter(Boolean).join('；');

  return {
    id: `submission-${courseCode}-${tabId}-${Date.now()}`,
    toRole: 'developer',
    fromUserId: fromUser.id,
    title: '新的投稿申请',
    body: `${fromUser.nickname} 想在 ${courseCode} 的${tabId === 'experiences' ? '学习心得' : tabId === 'materials' ? '复习资料' : '历年试卷'}中投稿：${title}${extra ? `。${extra}` : ''}`,
    createdAt: new Date().toISOString(),
    read: false,
  };
}

export function createCommentMessage({ fromUser, toUserId, courseCode, tabId, itemTitle }) {
  return {
    id: `comment-${courseCode}-${tabId}-${Date.now()}`,
    toUserId,
    fromUserId: fromUser.id,
    title: '收到一条新评论',
    body: `${fromUser.nickname} 评论了 ${courseCode} 的「${itemTitle}」。`,
    createdAt: new Date().toISOString(),
    read: false,
  };
}

export function messageBelongsToUser(message, user) {
  if (message.toUserId === user.id) {
    return true;
  }

  return Boolean(message.toRole && message.toRole === user.role);
}
