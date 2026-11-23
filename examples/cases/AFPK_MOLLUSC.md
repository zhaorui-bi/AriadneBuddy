# 软体动物 AFPK 筛查示例

这个示例使用 Lin 等人已发表的四条软体动物 KS 结构域。两条来自 *Elysia chlorotica* 的 EcPKS1/2 用作参照，另两条来自 *Gigantopelta aegis*，分别是 FAS I 对照与作者已报道的 putative AFPK。同一份报告会显示三种 HMM 的 bit score、两条参照记录的身份，以及作者导出的 AFPK-finder 聚类证据。 [论文](https://www.nature.com/articles/s41467-023-44497-0) · [FAS I 对照注释](https://www.ncbi.nlm.nih.gov/protein/XP_041363356.1) · [putative AFPK 的 RefSeq 注释](https://www.ncbi.nlm.nih.gov/protein/XP_041375027.1)

## 从任务会话启动

AFPK 任务会话可加载当前工作区已准备的软体动物案例。首次准备时，用已安装 PyHMMER 0.12.1 的 Python 运行下列命令，将路径替换为你在 AriadneBuddy 中打开的工作区。脚本会写入 `.ariadne/cases/afpk-mollusc/desk-request.json` 和对应输入。登录当前实例后，打开 `/?researchSession=new`，选择软体动物案例，核对目标后启动。筛查完成后，结果保存在任务会话中，等待审核。

```sh
python examples/cases/prepare-afpk-mollusc.py --desk-workspace /path/to/workspace
```

工作台从所选工作区读取准备好的文件。如需同时执行本机已配置的原版 AFPK-finder，准备时加 `--run-original`。

## 准备并运行

在已构建 AriadneBuddy 的仓库根目录运行。示例使用 Python、PyHMMER 0.12.1 和 `curl`。准备脚本按 SHA-256 校验公开源文件，从补充比对构建三份 HMM，并输出 `request.json`、`create.json` 和 `sources.json`。如果源文件已下载，可通过 `--source-dir` 指定包含这些文件的目录，文件名见脚本 `SOURCES`。

```sh
python3 -m venv .tmp/afpk-python
.tmp/afpk-python/bin/python -m pip install 'pyhmmer==0.12.1'
.tmp/afpk-python/bin/python examples/cases/prepare-afpk-mollusc.py --out .tmp/afpk-mollusc

export ARIADNE_AFPK_PYTHON="$PWD/.tmp/afpk-python/bin/python"
export ARIADNE_WORKDIR="$PWD/.tmp/afpk-mollusc"
bin/ariadnebuddy research create --input create.json
```

用返回的 `id` 运行 `bin/ariadnebuddy research advance --id <id>` 检查运行环境，再运行一次提交筛查。作业结束后运行同一命令收取结果。运行 `bin/ariadnebuddy web`，登录后打开 `/?researchSession=<id>`，查看产物并记录审阅决定。

## 调用原版 AFPK-finder v1.0

将原版发行包解压到本机，并准备 Bash、R、HMMER 和 Prodigal。R 环境需要
`Rtsne`、`dbscan`、`ggplot2` 和 `getopt`。创建示例时加 `--run-original`，并为
`--out` 指定一个新目录。用 `ARIADNE_AFPK_FINDER_REPO` 指向解压目录，依赖安装在
独立环境时，用 `ARIADNE_AFPK_FINDER_BIN` 指向其 `bin` 目录。桌面版也可以在应用的
`ariadne-data` 目录放置 `afpk-finder.json`，其 `repo`、`bin`、`python` 字段接受本机绝对路径。

适配器核验 v1.0 发布文件的指纹，用同一批 KS 输入执行原版脚本并记录依赖版本和
随机种子。报告并列展示本次三模型分数、原版工具每个 perplexity 的聚类结果，以及论文
的 Fig. 2 分数和已发布聚类。比较依据是同一序列和训练类群，同一个簇号只在其运行内有意义。
这次复跑中，候选在 perplexity 35 和 52 分别落入簇 8 和 5，两簇均包含 179/179 条
AFPK 训练记录。论文归档中该候选位于第 4 簇，原标签为 `AFLP`。 [原版发行包](https://doi.org/10.5281/zenodo.10125497)

## 得分与来源

使用三份重建的 HMM，示例应筛查 4 条记录并生成 1 条待审核候选。下表的 bit score 按 FAS I、动物 PKS、FAS II 的顺序排列，示例值保留一位小数。

| KS 结构域 | 示例重算 | 论文 Fig. 2 参考值 | 示例用途 |
| --- | --- | --- | --- |
| EcPKS1 | 583.7 / 304.8 / 121.6 | 587.7 / 274.6 / 123.1 | 参照 |
| EcPKS2 | 578.9 / 310.9 / 132.6 | 581.7 / 285.2 / 133.5 | 参照 |
| XP_041363356.1:1-468 | 802.8 / 371.1 / 153.9 | 775.6 / 338.4 / 151.1 | FAS I 对照 |
| XP_041375027.1:1-432 | 456.3 / 292.6 / 127.7 | 447.5 / 267.0 / 127.8 | putative AFPK，待审核 |

EcPKS1/2 的参考值来自 Fig. 2 图注。另两条来自 Source Data 的 `Figure_2A_mollusk_KS_hmm_scores` 工作表。Fig. 3B 使用专为软体动物构建的两份模型，作者将 `XP_041375027.1` 列在 `clade4`，相应的 FAS 与动物 PKS 得分为 442.2 和 265.0。示例重算使用补充数据 1–3 提供的序列比对及固定版本的默认构建设置，保留和原文对应的分类参照。400–600 的 FAS I 窗口适用于这一演示配置，得分本身受所用模型与序列版本影响。 [Fig. 2](https://www.nature.com/articles/s41467-023-44497-0/figures/2) · [Source Data XLSX](https://static-content.springer.com/esm/art%3A10.1038%2Fs41467-023-44497-0/MediaObjects/41467_2023_44497_MOESM18_ESM.xlsx) · [补充数据说明](https://static-content.springer.com/esm/art%3A10.1038%2Fs41467-023-44497-0/MediaObjects/41467_2023_44497_MOESM3_ESM.pdf)

候选的外部聚类记录取自 Figshare 文件 `mollusk_AFPK_hit`，保留 `cluster 4`、`AFLP` 的原始拼写和 `100%` 成员比例。这个比例描述外部工具报告的聚类成员比例。工作台以三 HMM 分类和原始聚类记录支持人工复核。 [数据集 v3，CC BY 4.0](https://doi.org/10.6084/m9.figshare.24066234.v3) · [AFPK-finder v1.0 软件存档](https://doi.org/10.5281/zenodo.10125497)
