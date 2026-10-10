# 课程内容 JSON 导入与导出

管理员在学习心得或复习资料管理页的顶部打开“批量导入”和“批量导出”。

## 文件格式

```json
{
  "version": 1,
  "items": [
    {
      "courseCode": "BIO2011F",
      "type": "experience",
      "title": "资源楼",
      "summary": "CC98 资源楼 5L",
      "author": "原作者",
      "teacher": "老师姓名",
      "sourcePlatform": "cc98",
      "sourceUrl": "https://www.cc98.org/topic/6003753/1#5",
      "bodyFormat": "markdown",
      "body": "正文第一段。\n\n### 学习建议\n\n正文第二段。",
      "externalUrl": "",
      "gpa": "",
      "gradePercentage": "",
      "year": ""
    }
  ]
}
```

- `version` 可省略；提供时必须为数字 `1`。每条业务字段的值使用字符串。
- `courseCode`、`type`、`title` 必填。课程号必须属于当前管理课程目录。
- `type` 为 `experience`（学习心得）或 `material`（复习资料）。第一版不导入历年试卷。
- 心得必须有 `body`；资料至少有 `body` 或 `externalUrl`。
- `bodyFormat` 为 `markdown` 或 `ubb`，默认 Markdown。正文换行在 JSON 中写成 `\n`，由 JSON 编辑器或生成工具正确转义。
- `sourcePlatform` 为 `cc98`、`duoduo` 或 `other`。原帖链接使用 HTTP(S)；旧 `cc98Url` 字段仍兼容。
- `gpa` 为 0 到 5，最多两位小数；`gradePercentage` 为 0 到 100 的整数字符串。选填字段可以省略或留空。
- 每批 1 到 200 条，文件最大 8 MiB。未知字段会显示校验错误，不导入数据库 ID、作者账号 ID、状态、审计记录或文件本体。

## 导入

上传 JSON 后，先校验并预览课程、标题、作者和错误。全部通过后，点击“确认生成草稿”。整批写入和操作日志共同提交；一条有错时不写入其他条。生成内容保留原作者，录入管理员只记在操作日志中。

导入不会自动发布，也不会覆盖已有帖子。网络响应丢失或失败后可重试；未确认成功的请求标识保存在当前管理员的浏览器中，刷新后重新选择同一文件仍可继续原请求。

## 导出

仅导出已发布的学习心得和复习资料。选择类别，再勾选课程；课程显示“课程名称 [数量]”，数量按当前类别计算。可搜索课程及选择全部搜索结果，最多导出 200 条、8 MiB。

导出的 JSON 使用相同的可导入字段白名单。PDF 不包含文件本体；当资料没有外部链接时，PDF 下载链接写入 `externalUrl`。JSON 再次导入时生成新草稿，不关联或覆盖原记录；PDF 链接仍指向原站文件。

## 后端接口

- `POST /api/admin/content-batch/preview`：`{document}`，返回只读预览及文件指纹。
- `POST /api/admin/content-batch/import`：`{document, fingerprint, requestId}`，确认生成草稿。`requestId` 使用 UUID，并按管理员隔离。
- `GET /api/admin/content-batch/catalog?type=experience`：返回有已发布内容的课程及数量；不传类型时统计两类。
- `POST /api/admin/content-batch/export`：`{courseCodes, type}`，返回 JSON 文档。空课程数组表示当前管理目录全部课程；前端要求明确勾选。

接口均要求管理员会话。浏览器通过共享客户端使用 `/zjubio/api/` 前缀。批量接口单独限制请求大小，普通 JSON 接口仍保持原来的 256 KiB 上限。
