// Frontend authentication / authorization helpers. The functions in this
// module are pure: they take a User-shaped object and return booleans or
// display descriptors. No DOM, no network — safe to call from any layer.

/**
 * @typedef {Object} UserVerifications
 * @property {boolean} [cc98]  True when the user has been verified through CC98.
 * @property {boolean} [email] True when the user has been verified through a ZJU email.
 */

/**
 * @typedef {Object} User
 * @property {string|number} id                Stable user identifier.
 * @property {'guest'|'student'|'admin'} role Account role.
 * @property {string} [nickname]               Display name.
 * @property {string} [cc98Nickname]           CC98 handle if linked.
 * @property {string} [email]                  Email address if linked.
 * @property {string} [publicId]              Public handle used in profile URLs.
 * @property {UserVerifications} [verifications] Verification flags.
 * @property {string} [avatarUrl]              Avatar image URL.
 */

/**
 * @typedef {Object} AccountState
 * @property {'guest'|'student'|'admin'} id
 * @property {string} label        Human-readable label.
 * @property {string} description Short tooltip-style description.
 */

/**
 * @typedef {Object} Message
 * @property {string} id
 * @property {string} [toUserId]   Recipient user id.
 * @property {'admin'} [toRole] Recipient role (broadcast).
 * @property {string|number} fromUserId
 * @property {string} title
 * @property {string} body
 * @property {string} createdAt    ISO timestamp.
 * @property {boolean} read
 */

/**
 * @param {User|null|undefined} user
 * @returns {boolean} true when the user is logged in OR has a verified identity.
 */
export function isAuthenticated(user) {
  return Boolean(user && (user.role === 'admin' || user.verifications?.email));
}

/**
 * @param {User|null|undefined} user
 * @returns {boolean} true when the user holds the admin role.
 */
export function isAdministrator(user) {
  return Boolean(user && user.role === 'admin');
}

/**
 * Only student-ID verified users and administrators can leave persistent
 * traces such as likes, favorites, comments, submissions, or profile edits.
 * @param {User|null|undefined} user
 * @returns {boolean}
 */
export function isVerifiedUser(user) {
  return Boolean(user?.role === 'admin' || user?.verifications?.email);
}

/**
 * Derive a human-friendly account state descriptor for the UI badge area.
 * @param {User|null|undefined} user
 * @returns {AccountState}
 */
export function getAccountState(user) {
  if (!isAuthenticated(user)) {
    return {
      id: 'guest',
      label: '游客',
      description: '当前以游客身份浏览，可查看公开资源。',
    };
  }

  if (user.role === 'admin') {
    return {
      id: 'admin',
      label: '管理员',
      description: '可维护课程资源，并使用已认证账号功能。',
    };
  }

  return {
    id: 'student',
    label: '学号认证学生',
    description: '已通过浙大学号邮箱认证，可使用需要留痕的功能。',
  };
}

/**
 * @param {User|null|undefined} user
 * @returns {string[]} list of short badge labels shown next to the user chip.
 */
export function getVerificationBadges(user) {
  if (!isAuthenticated(user)) {
    return ['未登录'];
  }

  if (user.role === 'admin') {
    return ['管理员', ...(user.verifications?.email ? ['学号认证'] : [])];
  }
  return ['学号认证'];
}

/**
 * @param {User|null|undefined} user
 * @returns {boolean} true when the user may submit 学习心得/复习资料/历年试卷.
 */
export function canSubmitResource(user) {
  return isVerifiedUser(user);
}

/**
 * @param {User|null|undefined} user
 * @returns {boolean}
 */
export function canComment(user) {
  return isVerifiedUser(user);
}

/**
 * @param {User|null|undefined} user
 * @returns {boolean} true when the user may favorite a content item.
 */
export function canFavorite(user) {
  return isVerifiedUser(user);
}

/**
 * Build an inbox message describing a new submission for the administrator queue.
 *
 * @param {Object} params
 * @param {User} params.fromUser
 * @param {string} params.courseCode
 * @param {'experiences'|'materials'|'papers'} params.tabId
 * @param {string} params.title
 * @param {string} [params.subtitle]
 * @param {string} [params.cc98Name]
 * @param {string} [params.cc98Link]
 * @param {string} [params.body]
 * @param {string} [params.materialLink]
 * @returns {Message}
 */
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
    toRole: 'admin',
    fromUserId: fromUser.id,
    title: '新的投稿申请',
    body: `${fromUser.nickname} 想在 ${courseCode} 的${tabId === 'experiences' ? '学习心得' : tabId === 'materials' ? '复习资料' : '历年试卷'}中投稿：${title}${extra ? `。${extra}` : ''}`,
    createdAt: new Date().toISOString(),
    read: false,
  };
}

/**
 * @param {Object} params
 * @param {User} params.fromUser
 * @param {string|number} params.toUserId
 * @param {string} params.courseCode
 * @param {string} params.tabId
 * @param {string} params.itemTitle
 * @returns {Message}
 */
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

/**
 * @param {Message} message
 * @param {User} user
 * @returns {boolean}
 */
export function messageBelongsToUser(message, user) {
  if (message.toUserId === user.id) {
    return true;
  }

  return Boolean(message.toRole && message.toRole === user.role);
}
