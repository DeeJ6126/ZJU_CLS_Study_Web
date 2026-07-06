// Front-end prototype mock data only. This is not real security authentication.
// Replace this list with a backend verification API when the project leaves the static-data stage.
export const cc98TestVerificationCodes = Array.from({ length: 30 }, (_, index) => {
  const serial = String(index + 1).padStart(3, '0');
  return {
    code: `zjubio-test-${serial}`,
    cc98Nickname: `zjubio_test_${serial}`,
    label: `zjubio disposable test code ${serial}`,
  };
});

export const cc98VerificationCodes = [
  {
    code: 'bio-cc98',
    cc98Nickname: 'cc98_bio_visitor',
    label: '生命科学学院 CC98 前端原型验证码',
  },
  {
    code: 'cls-open-day',
    cc98Nickname: 'cc98_open_day',
    label: '实验室开放日前端原型验证码',
  },
  {
    code: 'study-platform',
    cc98Nickname: 'cc98_study_peer',
    label: '生科智学前端原型验证码',
  },
  ...cc98TestVerificationCodes,
];
