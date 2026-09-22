# Contributing to BioLit Lens

感谢参与。请先阅读 `docs/methodology.md`，尤其是引用数、地域和开放获取状态的口径。

- 后端改动运行 `python -m pytest backend/tests -q`。
- 前端改动运行 `pnpm build`。
- 不提交 `.env`、缓存、用户数据或第三方密钥。
- 任何新的数据结论都应能回溯到 PMID，并明确标注数据源与不确定性。
- 不添加 Sci-Hub、未知 PDF 代理或绕过出版商访问控制的能力。

