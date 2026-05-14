# AGENTS.md

本文件定义本项目中 AI 协作者必须遵循的工作方式。所有 AI 在开始任务前必须先阅读本文件。

## 基本要求

- Always respond in Chinese-simplified.
- 保持改动外科式、可验证、可回退。
- 不要擅自重构无关代码。
- 不要删除、覆盖或回滚他人未明确授权的改动。
- 不要提交密钥、个人配置、日志、构建产物、依赖目录或本地实验输出。

## 角色分工

- 其他 AI：负责在功能分支上实现代码。
- Codex reviewer：负责审查、验证、指出风险，并判断是否可合入。
- `main` 分支：只保留稳定代码。

## 分支规则

- 默认不要直接在 `main` 上开发，除非用户明确授权。
- 一个任务一个分支，命名建议：
  - `feat/short-feature-name`
  - `fix/short-bug-name`
  - `chore/short-maintenance-name`
- 完成后不要自行合并到 `main`，先交给 reviewer 审查。

## PR 协作流程

实现 AI 完成功能后必须把分支推送到远端，并创建 Pull Request。

推荐命令：

```bash
git push -u origin <branch-name>
```

PR 要求：

- base 必须是 `main`。
- compare 必须是当前任务分支。
- PR 标题应简明说明任务，例如 `feat: User Preference Rule`。
- PR 描述必须包含“交付格式”中要求的 5 项内容。
- 不要在 review 通过前自行合并 PR。

如果可以使用 GitHub CLI，可用：

```bash
gh pr create --base main --head <branch-name> --title "<title>" --body "<summary>"
```

如果不能使用 GitHub CLI，则到 GitHub 页面点击 `Compare & pull request` 创建。

## 审查问题传递规则

- reviewer 的问题必须写在 PR 评论或 PR review 中，PR 是协作事实来源。
- 聊天窗口里的临时说明不能替代 PR 评论；需要修复的问题必须同步到 PR。
- 实现 AI 修复问题前，必须先阅读 PR 评论，不要重新猜需求。
- 修复时继续推送到同一个分支，不要另开无关分支。
- 修复完成后，必须在 PR 中回复：
  1. 修了哪些 reviewer 问题
  2. 修改了哪些文件
  3. 运行了哪些验证命令及结果
  4. 仍有哪些风险或不确定点
- reviewer 复审通过前，PR 状态视为未完成。

当 reviewer 给出类似以下问题时：

```text
P2：偏好规则面板操作后 UI 不刷新。
位置：components/AnalysisWorkbench.tsx 的 PreferenceRulePanel。
原因：rules 只依赖父级 refreshKey；确认、禁用、启用、删除、编辑只写 localStorage，没有触发组件重新读取。
修复建议：PreferenceRulePanel 内维护 rules state，提供 reloadRules()；所有 mutation 后调用 reloadRules()；编辑操作改用 updatePreferenceRule。
```

实现 AI 必须按该问题逐项修复，并在 PR 中说明对应处理结果。

## 开工前

- 先阅读当前任务、相关文档和现有代码。
- 明确假设；不确定处要写出来。
- 优先沿用项目已有模式和工具。
- 只改完成任务所需的文件。
- 如果发现无关问题，记录给 reviewer，不要顺手大改。

## 验证要求

交付前至少运行：

```bash
npm run typecheck
npm test
```

如果改动涉及 UI、API、构建配置、Next 路由或依赖，还必须运行：

```bash
npm run build
```

如果某条验证无法运行，必须说明原因、报错摘要和剩余风险。

## 交付格式

每次交付必须包含：

1. 改了什么
2. 修改了哪些文件
3. 运行了哪些验证命令及结果
4. 已知风险或不确定点
5. reviewer 应重点看的地方

## 上传安全

禁止提交：

- `.env`
- `.env.*`
- `docs/`
- `node_modules/`
- `.next/`
- `.npm-cache/`
- `*.log`
- `raw_output_*.txt`
- `regression_sample_*.json`
- `tsconfig.tsbuildinfo`
- 任何 API key、token、secret、password、private key

提交前必须检查：

```bash
git status --short
git diff --cached --name-only
git diff --cached --name-only | rg "^(docs/|\\.env|.*\\.log$|raw_output_|regression_sample_|node_modules/|\\.next/|tsconfig\\.tsbuildinfo)"
```

最后一条命令应无输出；如有输出，必须取消暂存相关文件。

## Review Gate

任务只有在 reviewer 确认以下事项后才算完成：

- 没有数据丢失风险
- 没有明显状态流错乱
- 没有泄露密钥或本地隐私
- 测试和类型检查通过
- 行为符合当前产品文档或用户要求
- 新增复杂逻辑有对应测试或明确的人工验证说明

## 删除安全规则

禁止所有批量、强制、递归删除：

- 禁止 `del /f /q /s`
- 禁止 `rmdir /s /q`
- 禁止通配符删除，例如 `del *.txt`
- 禁止 `Remove-Item -Recurse`
- 禁止 `Remove-Item -Force`
- 禁止 `git clean`
- 禁止任何等价变体

只能删除当前项目根目录内的文件。项目根目录为：

```text
C:\Users\L\Documents\openai_project\socratic-learning-partner-v0.3
```

删除前必须逐项校验：

1. 解析待删除文件的完整绝对路径。
2. 确认该路径以项目根目录开头。
3. 确认目标是文件，不是目录。
4. 不允许删除符号链接、junction、shortcut 指向的项目外目标。
5. 不允许使用 `..\`、环境变量、通配符或未解析路径绕过校验。

删除前必须展示每个文件的：

- 完整路径
- 文件大小
- 修改时间

然后必须逐字询问：

```text
请回复确认删除执行，其他内容取消
```

只有用户完整回复：

```text
确认删除执行
```

才允许删除。

删除执行要求：

1. 只能使用单文件删除。
2. PowerShell 只能使用：

```powershell
Remove-Item -LiteralPath "<完整绝对路径>"
```

3. 禁止添加 `-Recurse`、`-Force`。
4. 每次删除前再次确认目标完整路径仍在项目根目录内。
5. 删除后检查文件是否已不存在。
6. 删除完成后报告实际删除文件列表。

如果用户回复不是完整的“确认删除执行”，必须取消删除。
如果路径不在项目根目录内，必须拒绝删除。
如果目标是目录，必须拒绝删除。
如果无法确认路径安全，必须拒绝删除。
