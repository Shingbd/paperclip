# 底座审计（2026-10-07）

## 版本与环境证据

- Fork: https://github.com/Shingbd/paperclip；origin 是用户 fork，upstream 是 paperclipai/paperclip。
- 审计／开发基线 SHA: `99a9de9940bf5974352d9dbfbb2f21e62e89689f`，不是声称验证了整个 master。
- Linux x86_64，非 root 用户 shingbd；可用磁盘约 166 GiB。已有服务不改动；本项目使用 loopback 4310。
- 上游 package.json 要求 Node >=24.11.0、pnpm@9.15.4。本次独立工具目录 Node 24.14.0；宿主默认 Node 22.23.3 未修改。
- 本机 Pi `@earendil-works/pi-coding-agent` 0.99.2。扩展：无新增扩展。
- Pi 适配器：`packages/adapters/pi-local/src/server/execute.ts`；`pi --mode json -p --session <file>`，消费 JSONL `message_end`／`agent_end`，保存 sessionParams 的 cwd、目标 identity，恢复前校验 session header cwd。
- 原远程自动安装版本是 Pi 0.74.0；本分支锁为 0.99.2（含本文使用的关闭工具与上下文选项）。不未经核实替换历史包名。
- 原始 frozen 安装失败：`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`（上游 patchedDependencies 与提交的锁不一致）。允许一次本地非 frozen 修复，必须在验收记录报告解析结果；不能把原锁称为可复现成功。
- Git 完整单包下载多次超时，改为按 blob 分批下载，并用 sparse checkout 排除截图／设计资产。源码、迁移、开发文档与构建所需目录已获取；并未创建无历史的假克隆。

## 能力矩阵（源码存在不等于通过现场测试）

| 能力 | 状态 | 证据／处理 |
|---|---|---|
| Issues、父子、单负责人、原子 checkout | 已存在 | issues service + routes；不建第二份任务表 |
| 评论、定向交互、成果／附件、文档版本 | 已存在 | issue thread interactions、documents、work products |
| 心跳队列、预算、停止、恢复、monitor、routine | 已存在；需验证 | heartbeat service 与 execution-semantics；不另写独立调度 daemon |
| Pi JSON、任务会话、日志、远程目标 | 已存在；需配置 | Pi execute.ts + agent_task_sessions |
| SSH Environments、探测、租约容量 | 已存在；真实设备未验证 | environments routes 包含 /probe；连接成功不等于 Pi 工作正常 |
| SSH 工作区同步／回收 | 已存在；需核验 | Pi prepareAdapterExecutionTargetRuntime；不用于 /etc 或生产目录 |
| 原生 Runner 的 Pi | 未验证，不采用 | 首版使用 pi_local，不从名称推断 Runner provider 支持 |
| 个人日期、重复、AI 协助策略 | 已实现并通过隔离 API 验收 | personal_todos 设置侧表；标题、状态、历史仍来自 Issues |
| 中文个人入口 | 已实现并通过 Chromium 验收 | /:companyPrefix/personal，Sidebar 导航 |
| Notion 文档 | 已存在，需账号连接 | app-definitions/notion.json + 通用 MCP OAuth/gateway；复用而非另存 token |
| 飞书 | 保留第二连接边界 | 使用现有通用 MCP／连接器贡献合同；无凭证不伪造连接 |
| 生活待办保密隔离 | 上游缺口 | V1 普通公司任务默认公司可见；关闭 AI 分析不是 issue ACL。敏感生活资料应放无其他 Agent 的独立公司，不能声称默认企业隐私 |
| OS 只读／运维权限 | 需用户部署 | Pi 工具／工作目录不是 OS 沙箱；普通角色指令不构成权限拦截 |

## 设计决策

不增加 agent-node：没有完成 SSH 现有路线的失败复现，不能据历史 Issue 就新增常驻执行系统。控制中心单实例停机期间不继续调度；浏览器断开不影响中心的运行。

个人分析和草稿的 Pi 调用关闭所有工具、扩展与项目上下文；程序只允许草稿／清单子任务。不开放支付、预约、消息发送、共享或真实报告发布的自动授权。普通排障 Agent 保留上游工具能力，真实部署需非 root OS 权限边界。
