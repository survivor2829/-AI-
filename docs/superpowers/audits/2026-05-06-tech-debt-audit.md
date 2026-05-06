# 技术债中度审计报告 v1

> **日期**: 2026-05-06
> **触发**: master roadmap §7 (Q5=B 中度审计 audit-only)
> **范围**: 全仓库 .py / templates/ / static/ / scripts/ / migrations/ / docs/
> **输出方法**: 4 sub-agent 真并行扫描
> **承诺**: audit-only, 本报告产生 0 行业务代码改动

---

## 总览

| 维度 | 严重度高 | 严重度中 | 严重度低 |
|---|---|---|---|
| 安全债 (security-reviewer) | TBD | TBD | TBD |
| 架构债 (architect) | TBD | TBD | TBD |
| 风味债 (code-reviewer) | TBD | TBD | TBD |
| Dead code (explore) | TBD | TBD | TBD |
| **合计** | TBD | TBD | TBD |

---

## Top 10 严重度排名

| # | 债 | 类型 | 严重度 | 修复估时 | spec stub | Scott 决策 |
|---|---|---|---|---|---|---|
| 1 | TBD | TBD | 严重 | TBD | _stubs/TBD-stub.md | [ ] 修 [ ] 不修 [ ] 延后 |

---

## 分类细节

### §A. 安全债

(由 security-reviewer agent 输出, T3 填入)

### §B. 架构债

(由 architect agent 输出, T3 填入)

### §C. 代码风味债

(由 code-reviewer agent 输出, T3 填入)

### §D. Dead code 债

(由 explore agent 输出, T3 填入)

---

## 根因模式分析

(T3 跨 4 类输出后的 meta 分析: 是否多个债共享同一根因? 例: 5 处硬编码源于 config 缺失 → 真根因是没有 config 体系)

---

## Scott 决策栏

每条 Top 10 旁勾选, 30 秒一条 = 5 分钟决策.

转化:
- 修 → 该 stub 转正式 spec, 进入 P4 队列
- 不修 → stub 标 deferred, 备注理由
- 延后 → stub 标 backlog, 季度复盘

---

**起草人**: Claude Opus 4.7
**对应 Plan**: docs/superpowers/plans/2026-05-06-P2-tech-debt-audit-implementation.md
