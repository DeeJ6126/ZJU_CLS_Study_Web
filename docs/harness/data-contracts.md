# Data Contracts

## 课程 CSV

核心数据源：

```txt
public/resource/summary/introduction.csv
```

约定：

- 课程代码唯一。
- 课程代码是 URL、详情页查找、收藏 key 的稳定身份。
- 不要用课程中文名或英文名做路由。
- 课程总览字段应由代码从 CSV 模型生成。

## 路由契约

资源中心：

```txt
#resources
```

课程详情：

```txt
#resources/#BIO2110F
```

课程详情子页：

```txt
#resources/#BIO2110F/#experiences
#resources/#BIO2110F/#materials
#resources/#BIO2110F/#papers
```

子项详情：

```txt
#resources/#BIO2110F/#materials/#1
```

所有路由生成和解析集中在：

```txt
src/data/courses/resourcePaths.js
```

## 内容位置

长内容、用户投稿、学习心得、复习资料和试卷正文不写进 Vue 组件。应放在：

```txt
public/resource/courses/
public/showcase/
public/lab/
public/navigator/
public/peer/
```

## GitHub Pages 路径

引用 `public/` 资源时需要考虑 Vite base，优先使用：

```txt
src/utils/publicPath.js
```

## Harness 检查

- `npm run harness:routes`：检查课程路由契约。
- `npm run harness:content`：检查长内容是否误入组件。
