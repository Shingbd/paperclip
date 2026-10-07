# 中文个人 Agent 工作台（开发预览）

基于 Paperclip fork，Agent 执行使用 Pi；不另建任务系统、队列或常驻 agent-node。个人事项和 Agent 子任务都是 Issues，个人设置存在 `personal_todos` 侧表。**这是可运行的开发预览，不是已完成真实设备／模型验收的生产部署。**

## 版本

基线 `99a9de9940bf5974352d9dbfbb2f21e62e89689f`；Node **24.14.0**、pnpm **9.15.4**、Pi **0.99.2**。Fork：https://github.com/Shingbd/paperclip。

## 隔离启动

```sh
# 在仓库根目录；工具安装仅影响本项目。
npm install --prefix .personal-tools node@24.14.0 pnpm@9.15.4
export PATH="$PWD/.personal-tools/node_modules/.bin:$PATH"
# 所选上游的 patch 配置与锁不一致，原始 frozen 安装失败；见审计记录。
pnpm install --no-frozen-lockfile
pnpm --filter @paperclipai/shared build
pnpm --filter @paperclipai/db build
pnpm --filter @paperclipai/plugin-sdk build
pnpm --filter @paperclipai/ui build
scripts/personal-start.sh
```

访问 `http://127.0.0.1:4310`。配置示例见 `.env.personal.example`。状态、数据库、附件、Pi 配置和工作区默认隔离在 `.personal-runtime/`，并被 Git 忽略；更新代码不要删除这个目录。新实例生成私有的运行 JWT 签名密钥，不打印、不覆盖已有密钥文件。宿主默认 Node、SSH、防火墙和 Tailscale 配置不修改。

上游 `dev:once` 和服务端 package typecheck 会预构建 Rust runner；此环境没有 cargo。启动脚本使用已构建 UI／SDK，直接启动原服务端，Pi 使用 legacy adapter，不声称验证了原生 runner。

## 初始配置

```sh
# 不接模型／设备的演示；只运行明确标识的假 Pi 程序。
node scripts/personal-bootstrap.mjs --fake
# 或：创建暂停的真实角色；需自行授权模型和环境，再在 UI 中启用。
PERSONAL_PI_COMMAND=pi PERSONAL_PI_MODEL=provider/model node scripts/personal-bootstrap.mjs
```

Bootstrap 会创建一个新 Company 和 Coordinator、VPS Operator、Server Worker、Reviewer；再次运行会创建另一套实例，不修改已有角色。真实角色默认暂停，未验证模型时不要启用。角色指令在 `personal/roles/`。

Sidebar 的「个人工作台」或 `/:companyPrefix/personal` 提供中文需求提交、待办记录、归档／恢复、七种视图、日期／时区、每日／每周重复、分析与确认草稿。普通 Agent 页面仍提供运行、评论、依赖、文档和控制。

### 授权边界

- 待办默认人类归属、AI 关闭。关闭开关不是公司内的隐私 ACL；敏感资料请使用没有其他 Agent 的独立 Company。
- 「建议」只允许确认后的无工具草稿；「自动草稿」是明确预授权，仍不能预约、支付、发送消息或发布真实文档。
- 模型只提供建议，授权由程序根据当前内容版本、协助范围、能力和拒绝记录判定。过期建议、未回答问题和不支持的能力不能执行。
- 服务端强制 personal assessment/draft 的 Pi 禁用工具、显式扩展、skills 和上下文文件；不继承协调 Agent 的 shell 工具。
- 原待办只能由人类完成。AI 生成行李清单不等于已经打包；牙医预约仍需要资料与单独外部授权；跑步必须本人完成。
- 修改／关闭协助取消未来子任务并废弃旧结果。推理可能已经开始，取消不等于远端进程已确认停止。
- 浏览器关闭不停止中心调度；中心停机期间不调度。每个版本只创建一个分析任务，恢复可能有多次运行尝试；不承诺外部副作用 exactly-once。

## 验证（仅在隔离模拟公司中）

```sh
node scripts/personal-acceptance.mjs
node scripts/personal-workflow-acceptance.mjs
# 浏览器测试可选，下载到项目目录，不复用个人浏览器档案。
PLAYWRIGHT_BROWSERS_PATH="$PWD/.personal-runtime/playwright" pnpm exec playwright install chromium --only-shell
PLAYWRIGHT_BROWSERS_PATH="$PWD/.personal-runtime/playwright" node scripts/personal-browser-acceptance.mjs
pnpm exec vitest run --maxWorkers=1 packages/shared/src/personal-workspace.test.ts packages/adapters/pi-local/src/server/execute.remote.test.ts
pnpm check:token-gates
# 已完成的模拟工作流：先记录，手工重启自己的隔离实例，再核对。
node scripts/personal-restart-acceptance.mjs --before
# 重启后：node scripts/personal-restart-acceptance.mjs
# 可选：只在此隔离 PostgreSQL 创建新恢复库，不覆盖／删除原库。
PERSONAL_ALLOW_ISOLATED_RESTORE=1 pnpm --filter @paperclipai/db exec tsx ../../scripts/personal-backup-acceptance.mjs
```

API 验收每次产生三条分析，滚动 24 小时每人每公司上限五条；需要重跑时创建新的模拟公司，不绕过限额。多 Agent 测试支持 `--resume` 检查已保存的测试任务。

## 文档与生产配置

- [底座审计](docs/upstream-assessment.md)
- [架构与控制合同](docs/architecture.md)
- [部署／Tailscale／SSH／Notion／备份](docs/deployment.md)
- [验收证据与未通过项](docs/acceptance.md)

使用现有 Notion Apps OAuth/MCP 网关和审批，不另存 token。当前模拟报告保存在 Issue 文档；**真实 Notion／飞书读取和发布未验收**。不要把生活待办的自动草稿授权扩展成文档发布授权。

生产必须配置 authenticated/private，专用非 root 用户、独立持久存储、可信 SSH host key、后端凭证和私网访问；不得把 local_trusted 实例直接暴露到网络。
