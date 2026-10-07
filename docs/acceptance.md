# 验收记录（2026-10-07，开发预览）

## 测试边界

所有有副作用的测试使用本项目 `.personal-runtime` 的隔离 PostgreSQL 和模拟 Company。Pi fixture 是可执行 JSONL 协议模拟器，**不是实际 Pi 模型、设备、网络或文档发布验证**。浏览器测试使用下载到项目目录的 Chromium，不读取个人浏览器档案。宿主已有虚拟机、服务、SSH、Tailscale、防火墙未改动。

## 已有证据

| 验证 | 结果／范围 |
|---|---|
| shared 策略／日期和 Pi SSH 适配单测 | 最新定向测试 26 项通过；含不支持能力、未回答问题、模型伪造授权拒绝，以及显式扩展／shell 覆盖仍被无工具策略拦截 |
| Pi parser/model/runtime/SSH 与 MCP protocol/redaction | 6 文件、53 项通过；SSH 和 MCP 均为 fixture，不是现场连接 |
| 类型与构建 | shared build、db typecheck、Pi adapter typecheck、plugin SDK build 通过；初版 UI typecheck 通过，最终 UI build 通过；最终 UI typecheck 重跑遇到资源压力被停止，不宣称最新版全量类型通过 |
| 迁移 | 新侧表迁移在独立 embedded PostgreSQL 应用，迁移安全检查通过；保留旧 snapshot，未修改生产库 |
| 待办 API／数据库／假 Pi | 已跑通并发创建幂等、人类归属／AI off、日期重复只产生一个后继、撤销完成、同版分析任务去重、旅行／牙医／跑步分类、并发采纳、成果文档持久化、原人类任务不自动完成、过期授权拒绝；最终回归还通过 Agent bearer 拒绝、人类端点权限、程序派生授权报告、归档／恢复保留历史 |
| 多 Agent 协作 | Coordinator 创建两个不同负责人的子任务；Worker 保存证据；Reviewer 重新通过平台读取 Worker 的版本化文档并检查模拟标记；父任务等待依赖后完成；三份报告可从 API 读取 |
| 真浏览器 UI | Chromium 验证中文路由、表单创建、AI off 按钮禁用、人类完成、刷新后仍完成、撤销完成；没有未捕获 page error；已保存桌面和 390px 移动截图 |
| 本地中心重启 | 干净重启隔离中心后，事项状态／人类归属、重复后继 ID、完成的工作流、报告内容 hash 和版本 ID 均保持一致；不包含在途或远端运行 |
| 逻辑备份恢复 | 实测上游逻辑备份（898439 字节）恢复到新隔离数据库；核对 22 条 personal_todos、40 条 issues、26 条 documents、41 条 document_revisions；没有覆盖／删除原数据库 |

本地证据（不提交运行数据／截图到源码）：

- `/tmp/personal-api-final-tests.log`：最终完整待办闭环与授权／归档回归结果。
- `/tmp/personal-workflow-final-tests.log`：最终模拟多 Agent 工作流结果。
- `/tmp/personal-browser-final-tests.log`：最终实际 Chromium 结果。
- `/tmp/personal-backup-tests.log`：真实隔离逻辑数据库备份／恢复结果。
- `/tmp/personal-restart-tests.log`：本地中心重启完成态核对通过。
- `/tmp/personal-final-unit-tests.log`：最新策略与适配测试。
- `/tmp/personal-adapter-mcp-tests.log`：上游相关合同测试。
- `.personal-runtime/browser-evidence/`：仅包含模拟公司内容的截图。

最终硬化新增了：事务提交后才发布活动／执行 issue 后续动作，完成事项废弃旧分析授权，并发分析限额使用公司锁，以及程序派生的 `todo_id / assessed_revision / assistability / reason / proposed_actions / required_information / required_capabilities / authorization_result / linked_agent_task_ids` 报告。最终 API 回归通过这些硬化项；没有把模拟器输出当成真实模型或设备证据。

## 尚未通过／未执行

- 上游服务端 package typecheck 在 Rust runner 预构建处因 **cargo 缺失**失败；直接全量 tsc 也遇到内存／换页问题。资源受限的重试没有取得成功结果，**服务端全量类型检查未通过**。
- 仓库级 `pnpm -r typecheck`、`pnpm test:run`、`pnpm build` 未全部执行／通过；不标记 PR-ready。
- 原始 `pnpm install --frozen-lockfile` 因上游 patchedDependencies 与锁不一致失败。本地非 frozen 安装成功；遵循上游要求不提交本地锁文件修复。不承诺该基线 frozen 可复现。
- 实际 Pi＋真实模型、SSH 多设备会话／日志／停止、Tailscale 私网登录、真实 Notion／飞书读取及发布，均未验证。
- 中心重启后的在途队列恢复、网络分区、远端失联／孤儿进程核对、跨设备恢复、完整系统备份恢复，均须独立演练。逻辑数据库 roundtrip 和本地完成态重启核对不等于这些验收已通过。
- 公司内 Issue 可读性沿用上游。关闭 AI 不代表敏感资料对本公司其他 Agent 隐藏。
- 一个 revision 只创建一个分析 Issue，但上游恢复／continuation 可能产生多个运行尝试；没有模型调用或外部副作用 exactly-once 承诺。

## 实测纠错

1. 人类完成在外部事务中必须提供活动发布及 post-commit actions 队列；已按上游合同适配，不在回滚前发布成功。
2. Issue 的 Pi 参数覆盖必须嵌套在 `assigneeAdapterOverrides.adapterConfig`；原扁平写法无效，已纠正，并在 heartbeat／Pi 适配器追加服务端无工具强制策略。
3. `PAPERCLIP_API_URL` 的运行时值是服务根 URL，不保证带 `/api`；fixture 已规范化。
4. 手工等待不是持久调度：模拟多 Agent 测试客户端曾中断，保存的任务由中心继续处理，`--resume` 读取最终报告。此证据仅说明该本地 fixture 工作流不依赖浏览器或测试客户端，不是跨设备故障恢复证明。

## 下一步真实授权

只需由用户明确提供／在平台连接：一个模型、两台测试 SSH 目标（用户／目录／可信 host key／只读范围），以及一个受限文档页面／空间。GitHub fork 已创建；没有这些授权也可继续本地测试，但不能生成真实成功证据。
