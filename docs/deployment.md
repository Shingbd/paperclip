# Linux／Tailscale 私网部署

## 本次隔离开发

见 `README.personal-workspace.md`。默认只监听 `127.0.0.1:4310`，不是已部署到 Tailscale 的服务。宿主 SSH、防火墙、Serve／ACL、Docker 和生产数据库未修改。`.personal-runtime` 是本项目独立状态；不要删除它来更新应用。

版本：Node 24.14.0、pnpm 9.15.4、Pi 0.99.2。上游 Node 最低要求 24.11 来自选定 commit。Pi JSON／CLI 合同按 0.99.2 的实际文档审计；真实模型／远程运行须单独验证。

## 常开 VPS

1. 用专用非 root OS 用户部署到独立 `/opt/personal-workspace`。不要沿用 root SSH 账户。
2. 安装锁定工具链、项目依赖，构建；使用独立 `PAPERCLIP_HOME=/var/lib/personal-workspace` 或专用 PostgreSQL。不要指向已有业务数据库。
3. 用上游 CLI `pnpm paperclipai configure` 设置 `authenticated` + `private`、loopback 4310、明确外部私网 HTTPS 地址与 allowed hostname。用 `pnpm paperclipai auth bootstrap-ceo` 或浏览器首次管理员流程；不要在网络上运行无登录 local_trusted。
4. PostgreSQL、附件、secrets/master.key、Pi 配置／会话、工作区和运行日志必须持久化。容器可复用 `docker/docker-compose.quickstart.yml`，把对外映射限定 `127.0.0.1:4310:3100`，再设置 authenticated/private；首次迁移先备份。
5. 可参考下述 systemd 文件，由用户审阅后安装。默认不安装或启用本机 systemd 服务。
6. 检查现有 Tailscale Serve 配置，再由用户按当前 Serve CLI 设置私网 HTTPS → loopback 4310。示例 `tailscale serve --bg http://127.0.0.1:4310` 可能改变全局配置，不由开发 Agent 自动执行。不能使用 Funnel；应用会话验证与 hostname 校验保留。OAuth callback 可达性遵循 Notion 的实际约束，不自动开公网。

## Pi、SSH 与权限

- `scripts/personal-bootstrap.mjs` 默认只建暂停的真实配置，设置 `PERSONAL_PI_COMMAND` 和 `PERSONAL_PI_MODEL=provider/model`；没有 key 不唤醒。
- 用现有 Agent 配置／AI Connections 密钥库授权模型。密钥只在后端与目标执行环境；不要放前端、角色指令、日志或 PR。
- Bootstrap 为每个 Company／角色创建独立 cwd 和 Pi 配置目录；不自动连接真实设备。部署时须在平台给四角色显式绑定环境，不依赖未验证的项目默认继承。每个 Agent `maxConcurrentRuns=1`；环境容量用 Environments 的租约容量设置。角色指令里的并发建议不是设备级锁。
- SSH 指定专用用户、私钥秘钥引用与可信 host key；通过可信渠道核对主机 fingerprint。不得关闭 host key checking。执行目录必须是隔离工作区，不是生产业务目录。
- 环境 probe 是非模型的限时程序；分别核实 SSH 可达、Pi 可用和真实运行，不把一个绿点当所有能力。
- 远程默认上传／回收工作区与运行资产，使用上游排除／恢复合同；不自行删除 node_modules 或生产文件来“优化同步”。验证会话、日志、取消和断网后核对之前，不承诺远端故障恢复。
- 普通角色 Pi 的 bash 权限等于 OS 用户权限。审批文案无法防止一个拥有生产 shell 的 Agent 改服务。只读运维要在 OS/容器/工具边界落实。
- 生活分析／自动草稿固定无工具、无扩展、无上下文加载，不能直接完成外部动作；当前只支持一个建议动作。

## 文档连接

首选已有 Notion Apps：在公司连接设置中连接官方托管 MCP，完成用户 OAuth，把访问限制到授权页面／空间；不要新建旧 Notion MCP server 依赖。写操作的 Action 设为 Ask first，验证一次真实读取和新建报告，保存真实返回链接。未连接时只有引用和本地文档，不显示已发布。飞书留在通用连接器贡献／MCP 边界，需具体 scope 与身份授权后再实施。

## 备份与恢复

维护窗口暂停新调度并等待／停止当前运行，记录真实停止状态。运行上游 `pnpm db:backup`（同一个 PAPERCLIP_HOME）；同时备份附件、secrets/master.key、Pi sessions、工作区和必要运行状态到权限受限位置。不要把数据库目录的随意在线文件复制称为一致备份。

恢复到**新隔离目录／数据库**：先恢复逻辑 dump 和密钥，再附件／会话；保持原版本启动，检查任务、文档、secret 解密与迁移状态，核对远端旧运行。不能把旧数据库回滚后直接重放外部预约或消息。本次已在模拟 PostgreSQL 上实测逻辑备份并恢复到新数据库，核对事项／任务／文档／版本数量。它不是完整系统恢复：secret 解密、附件／会话、恢复库启动及远端故障演练仍未验收，见 `docs/acceptance.md`。
