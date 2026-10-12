export const markdownToolbar = [
  { id: 'heading', label: 'H', title: '标题', prefix: '## ' },
  { id: 'bold', label: 'B', title: '加粗', wrap: ['**', '**'] },
  { id: 'italic', label: 'I', title: '斜体', wrap: ['*', '*'] },
  { id: 'strike', label: 'S', title: '删除线', wrap: ['~~', '~~'] },
  { id: 'link', title: '插入链接', format: 'markdown', prompt: '请输入链接地址' },
  { id: 'file', title: '插入文件', format: 'markdown', prompt: '请输入文件地址' },
  { id: 'quote', label: '❞', title: '引用块', prefix: '> ' },
  { id: 'code', label: '</>', title: '代码块', wrap: ['\n```\n', '\n```\n'] },
  { id: 'list', label: '•', title: '无序列表', prefix: '- ' },
];
