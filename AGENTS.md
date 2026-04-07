# UI 设计指南

> **设计类型**: App 设计（应用架构设计）
> **确认检查**: 本指南适用于可交互的应用/网站/工具。

> ℹ️ Section 1-2 为设计意图与决策上下文。Code agent 实现时以 Section 3 及之后的具体参数为准。

## 1. Design Archetype (设计原型)

### 1.1 内容理解

- **目标用户**: 投流团队营销人员，日常需要监控预算消耗进度，做出投放决策调整
- **核心目的**: 提供多维度预算消耗数据可视化，支持数据导入与预算配置，辅助投放决策
- **期望情绪**: 专注、清晰、掌控感
- **需避免的感受**: 信息过载、数据混乱、视觉疲劳、误操作

### 1.2 设计语言

- **Aesthetic Direction**: 专业数据看板风格，清晰的信息层级，让数据一目了然，支持高频日常使用不疲劳
- **Visual Signature**: 
  1. 沉稳专业的蓝绿色调主色，建立营销数据信任感
  2. 紧凑网格布局，高信息密度但保持呼吸感
  3. 状态色清晰区分（正常/超额完成），异常数据直观高亮
  4. 卡片分组设计，将不同功能区块清晰分隔
- **Emotional Tone**: 专业可靠 + 高效清晰 — 营销投流需要对数据敏感，设计帮助用户快速获取关键信息
- **Design Style**: Grid 网格 — 数据密集型看板需要规整的网格系统，直角设计强化专业感，紧凑间距提升信息密度
- **Application Type**: Admin/SaaS 数据看板 - 多页面功能系统，需要侧边栏导航

## 2. Design Principles (设计理念)

1. **数据优先**: 所有设计服务于数据阅读，核心指标一眼可见，异常数据自动高亮
2. **专业信任感**: 配色克制稳重，排版清晰有序，让营销人员对数据有掌控感
3. **高效交互**: 高频操作（筛选、导入、配置）置于顶部易于访问，减少点击路径
4. **清晰分组**: 通过卡片和网格将功能区块物理分隔，避免视觉混淆

## 3. Color System (色彩系统)

> 基于内容理解推导配色方案，确保整体协调。

**配色设计理由**：投流数据看板需要建立专业信任感，选择沉稳的青蓝色主色，既不过于冷硬也不过于活泼，适合业务决策场景。状态色清晰区分正常/超额，帮助用户快速识别异常。

### 3.1 主题颜色

> **Color Token 语义速查（供 code agent 参考）**:
> - `primary` → 主行动：按钮填充、激活态高亮、关键操作 CTA
> - `accent` → 状态反馈：Ghost/Outline 按钮 hover、DropdownMenu focus、Toggle 激活、Skeleton 占位背景
> - `muted` → 静态非交互：禁用态背景、次级说明背景、占位文字色（`text-muted-foreground`）
> - **选择原则**：用户"可以点击" → primary；交互"正在发生" → accent；内容"不可操作" → muted

| 角色               | CSS 变量               | Tailwind Class            | HSL 值    
| ------------------ | ---------------------- | ------------------------- | ---------- 
| bg                 | `--background`         | `bg-background`           | `hsl(210 20% 98%)`
| card               | `--card`               | `bg-card`                 | `hsl(0 0% 100%)`
| text               | `--foreground`         | `text-foreground`         | `hsl(215 25% 15%)`
| textMuted          | `--muted-foreground`   | `text-muted-foreground`   | `hsl(215 16% 45%)`
| primary            | `--primary`            | `bg-primary`              | `hsl(186 85% 30%)`
| primary-foreground | `--primary-foreground` | `text-primary-foreground` | `hsl(0 0% 100%)`
| accent             | `--accent`             | `bg-accent`               | `hsl(186 30% 95%)`
| accent-foreground  | `--accent-foreground`  | `text-accent-foreground`  | `hsl(186 85% 25%)`
| border             | `--border`             | `border-border`           | `hsl(210 20% 90%)`

### 3.2 Sidebar 颜色（仅当使用 Sidebar 导航时定义）

> **定义时机**：仅当 Navigation Type 为 Sidebar 时，必须定义此章节
> **设计原则**：Sidebar 作为全局导航区域，需要独立的配色方案以区分主内容区，所有 sidebar 颜色角色需保持统一的视觉基调。

| 角色                       | CSS 变量                       | Tailwind Class                    | HSL 值     | 设计说明                         |
| -------------------------- | ------------------------------ | --------------------------------- | ---------- | -------------------------------- |
| sidebar                    | `--sidebar`                    | `bg-sidebar`                      | `hsl(215 25% 12%)` | Sidebar 深色背景，形成对比，突出品牌 |
| sidebar-foreground         | `--sidebar-foreground`         | `text-sidebar-foreground`         | `hsl(210 20% 90%)` | 浅色文字，对比度 6.2:1，满足 WCAG |
| sidebar-primary            | `--sidebar-primary`            | `bg-sidebar-primary`              | `hsl(186 85% 30%)` | 激活态使用主色，保持一致性       |
| sidebar-primary-foreground | `--sidebar-primary-foreground` | `text-sidebar-primary-foreground` | `hsl(0 0% 100%)` | 激活态白色文字，对比度充足       |
| sidebar-accent             | `--sidebar-accent`             | `bg-sidebar-accent`               | `hsl(215 20% 20%)` | Hover 态浅化背景，提供交互反馈   |
| sidebar-accent-foreground  | `--sidebar-accent-foreground`  | `text-sidebar-accent-foreground`  | `hsl(210 20% 85%)` | Hover 态文字保持可读性           |
| sidebar-border             | `--sidebar-border`             | `border-sidebar-border`           | `hsl(215 20% 25%)` | 细边框分隔侧边栏和主内容         |
| sidebar-ring               | `--sidebar-ring`               | `ring-sidebar-ring`               | `hsl(186 85% 40%)` | 聚焦环使用主色变体               |

### 3.4 语义颜色（可选）

> 需要状态反馈，定义超额/正常/警告三种状态

| 用途 | 角色 | CSS 变量 | HSL 值 | 用途说明 |
| ---- | ---- | -------- | ------- | -------- |
| 正常消耗 | success | `--success` | `hsl(142 70% 35%)` | 完成率在合理范围内 |
| 超额消耗 | warning | `--warning` | `hsl(20 90% 50%)` | 完成率超过预警阈值（如 >90%）高亮 |
| 过度消耗 | danger | `--danger` | `hsl(0 75% 50%)` | 完成率超过预算（>100%）高亮 |
| 正常背景 | success-bg | `--success-bg` | `hsl(142 30% 95%)` | 正常状态背景 |
| 警告背景 | warning-bg | `--warning-bg` | `hsl(20 30% 95%)` | 警告状态背景 |
| 危险背景 | danger-bg | `--danger-bg` | `hsl(0 30% 95%)` | 危险状态背景 |

## 4. Typography (字体排版)

- **Heading**: 思源黑体 (Source Han Sans SC) → 系统字体栈: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Body**: 思源黑体 (Source Han Sans SC) → 系统字体栈: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **数字数据**: Roboto Mono → 系统字体栈: `Roboto Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
- **字体导入**: 使用系统字体栈，无需引入外部字体

**排版层级**:
- H1 标题: `text-2xl font-bold`
- 卡片标题: `text-base font-semibold`
- 正文/表格: `text-sm`
- 辅助文字: `text-xs text-muted-foreground`
- 大数字指标: `text-3xl font-bold` (用于指标卡)
- 表格数字右对齐，使用等宽字体

## 5. Layout Strategy (布局策略)

### 5.1 结构方向

**导航策略**：功能模块分为三个页面（概览看板、明细列表、预算配置），功能模块清晰需要持久导航 → **侧边栏布局**。左侧固定导航，右侧内容区滚动，符合后台系统使用习惯。

**页面架构特征**：数据密集型营销看板，采用紧凑网格布局，保持高信息密度同时通过卡片分组和留白保持呼吸感。核心指标区置顶，可视化图表在中栏，明细数据在下方。

### 5.2 响应式原则

**断点策略**：
- 移动端 (<768px): 侧边栏折叠为抽屉汉堡菜单，内容区单列布局
- 平板 (768px-1200px): 侧边栏收起仅显示图标，hover 展开文字
- 桌面端 (>1200px): 完整显示侧边栏和内容区

**内容密度**：
- 移动端单列展示，所有图表和表格自适应宽度
- 触摸设备增大可点击区域（按钮最小 44px，表格行高增加）
- 桌面端网格布局展示多图表并列，提升信息获取效率

## 6. Visual Language (视觉语言)

**形态特征**：基于 Grid 网格风格
- 锐利现代，所有组件使用 `rounded-none` / `rounded-sm`（直角/微小圆角）保持专业感
- 卡片使用细边框 `border border-border` 分隔，不使用阴影（或仅 `shadow-sm`）
- 整体采用紧凑间距 `gap-3` / `p-4`，提升信息密度
- 强调网格线和表格边框，帮助用户对齐阅读数据

**装饰策略**：极简设计，不使用额外装饰元素。通过网格排版、清晰分组和状态色彩建立视觉层次。唯一装饰是侧边栏深色背景和主色高亮，保持专业清爽。

**动效原则**：
- 快速响应，交互反馈时长 150ms，干脆利落
- 所有可交互元素必须有 hover/focus 状态反馈
- 图表切换和数据加载使用淡入淡出，不使用夸张动画
- 表格展开/收起使用平滑过渡，保持体验连贯

**可及性保障**：
- 正文文字与背景对比度 ≥ 4.5:1（当前配色对比度约 7.2:1，满足要求）
- 大号标题对比度 ≥ 3:1（满足）
- 异常状态高亮使用文字+背景双重标记，不依赖色彩单独传递信息
- 交互元素有明确的 hover/focus 边框高亮
- 图表数据提供文字标签，色觉障碍用户可通过标签识别

---

## AGENTS.md 补充规范

```markdown
# 投流预算消耗看板 开发规范

## 设计原则遵循

本应用严格遵循本文档定义的 **Grid 网格** 设计风格：
- 直角设计（`rounded-sm` 最大）
- 细边框分隔，无厚重阴影
- 紧凑间距，高信息密度
- 等宽字体展示数字数据

## 页面结构

应用包含三个主页面，使用侧边栏导航：

1. **预算消耗概览看板** → `/`
   - 顶部操作区：月份选择器、数据导入按钮、预算配置入口
   - 4 个核心指标卡并排：当月总预算、已消耗、完成率、剩余预算
   - 三图表网格布局：平台对比柱状图、SKU 占比饼图、消耗趋势折线图

2. **消耗明细列表页** → `/details`
   - 顶部筛选区：平台筛选、SKU 筛选、月份筛选
   - 数据表格：平台、SKU、预算金额、已消耗、完成率，异常高亮
   - 可展开行：点击展开查看每日明细

3. **预算配置页** → `/config`
   - 月份选择器
   - 批量配置区域：设置平台总预算 + 比例分配
   - 配置表格：每个平台/SKU 可单独编辑预算，实时计算占比

## 数据集成规范

- 数据源：飞书多维表格 `feishu-bitable` 插件
- 严格遵循 `.agent/skills/steering/nestjs-react-fullstack/plugin-guide/references/table.md` 读写格式
- 导入流程：显示进度 → 成功展示条数 → 失败显示错误详情 → 支持重试
- 聚合统计：使用 `aggregateQuery` 接口，不要前端全量聚合

## 组件状态规范

- **Primary 按钮**: `bg-primary text-primary-foreground hover:bg-primary/90`
- **Ghost 按钮 hover**: `bg-accent text-accent-foreground`
- **表格行 hover**: `bg-accent/50`
- **完成率状态**:
  - `< 90%`: 默认样式
  - `90% - 100%`: `bg-warning-bg text-warning` 高亮
  - `> 100%`: `bg-danger-bg text-danger` 高亮
- **表单焦点**: `ring-2 ring-ring ring-offset-0 focus:ring-primary/50`

## 图表规范

- 配色从主色衍生：
  - 预算柱：主色 `hsl(186 85% 30%)` 浅变体 `hsl(186 60% 70%)`
  - 消耗柱：主色 `hsl(186 85% 30%)` 深变体 `hsl(186 85% 25%)`
  - 折线趋势：主色 `hsl(186 85% 30%)`
  - 饼图各SKU：从主色相偏 ± 30° 生成 6 个区分度好的颜色
- 预算警戒线：使用 `warning` 橙色虚线标注
- 鼠标悬停显示详细数据提示框

## 响应式断点

- `< 768px`: 侧边栏抽屉，单列布局
- `768px - 1024px`: 侧边栏图标模式，双列图表
- `> 1024px`: 完整侧边栏，三图表网格布局

## 权限控制

- **管理员角色**: `admin` - 拥有数据导入、预算配置、清空数据等管理权限
- **权限控制方式**: 使用 `CanRole` 组件/装饰器
  - 后端: `@CanRole(['admin'])` 装饰器保护敏感接口
  - 前端: `<CanRole roles={['admin']}>` 组件控制按钮/页面显示
- **受控功能**:
  - 数据导入（Dashboard 页面）
  - 预算配置（Config 页面及保存接口）
  - 清空数据（消费记录模块）

## 发布前检查清单

- [ ] 数据库表结构已确认 (`budget`, `consumption_record`)
- [ ] 飞书多维表格插件已配置
- [ ] 自动化任务触发器已启用 (`daily_bitable_import` - 每天12点自动导入)
- [ ] 管理员角色已创建 (`admin`)
- [ ] 管理员已授权（通过角色面板添加自己为管理员）

## 禁止事项

- ❌ 不要使用大圆角（超过 `rounded-sm`）
- ❌ 不要添加额外装饰元素（渐变、几何图形、斑点等）
- ❌ 不要使用高饱和度鲜艳配色干扰数据阅读
- ❌ 不要让表格内容在大屏幕无限拉伸，容器 `max-w-[1600px]` 居中
- ❌ 所有数字金额使用等宽字体确保对齐
```
```