const strings = {
  en: {
    refresh: 'Refresh', taskViews: 'Activity details', activity: 'Activity and files',
    jumpToReview: 'Jump to shortlist review',
    newAfpkTask: 'New AFPK task', afpkInputSource: 'Input source', afpkSourceRequest: 'Project request JSON',
    afpkSourcePreset: 'Prepared example', afpkSourceGuided: 'Project sequence and model files', afpkPreparedExample: 'Example',
    afpkRequestPath: 'Request JSON path', afpkSequenceFiles: 'Protein FASTA paths', afpkChooseProtein: 'Add a project FASTA',
    afpkPathsPerLine: 'One project-relative path per line.', afpkWindowMin: 'FAS I bit-score minimum', afpkWindowMax: 'FAS I bit-score maximum',
    afpkOptionalEvidence: 'Reference and comparison inputs', afpkAnchorIds: 'Reference sequence IDs', afpkRunFinder: 'Run original AFPK-finder',
    afpkAnchorsHint: 'Enter one sequence ID from the selected FASTA files per line.',
    afpkPublishedFinderFiles: 'Published Finder table paths', afpkPublishedPath: 'Published KS scores path',
    afpkObjective: 'Research objective', afpkClose: 'Close', afpkStart: 'Create and start screening',
    afpkLoadingInputs: 'Loading project inputs…', afpkInputsUnavailable: 'Project input suggestions are unavailable. You can enter project-relative paths.',
    afpkPickFile: 'Select a file', afpkNeedInputs: 'Complete the required input fields.',
    afpkInvalidWindow: 'The minimum FAS I bit score must be at most the maximum.',
    afpkStarting: 'Creating research task…', afpkCreated: 'AFPK research task created.',
    afpkAdjustedTask: 'Start an adjusted AFPK task',
    afpkPreparing: 'Checking the runtime and preparing to start screening.', afpkPreparingBrief: 'Preparing screening',
    afpkReviewShortcut: 'Go to shortlist review', afpkReadinessShortcut: 'Go to runtime setup',
    afpkRecheck: 'Recheck and start screening', afpkRecheckQueued: 'Runtime recheck requested.',
    compute: 'Compute', artifacts: 'Artifacts', trajectory: 'Trajectory',
    loadingTask: 'Loading research task…', loadingArtifact: 'Verifying and loading artifact…',
    taskUnavailable: 'This task could not be opened', authRequired: 'Open AriadneBuddy from its launch link, then reopen the session.',
    denied: 'The server denied access to this workspace.', requestFailed: 'The server could not complete the request.',
    noConnection: 'Could not connect to AriadneBuddy. Refresh to try again.',
    workflow: 'Workflow', knowledge: 'Knowledge and hypotheses', engines: 'Computational screening',
    validationPhase: 'Experimental follow-up', outcome: 'Scientific outcome', review: 'Review and next action',
    methodsAndLimits: 'Workflow, methods, and limitations', openCompute: 'View computation', progress: 'Progress',
    jobStatus: 'Job status',
    cancelTask: 'Cancel research task', confirmCancelTask: 'Confirm task cancellation', keepTask: 'Keep task',
    taskCancelScope: 'Cancelling closes this research task and stops any active computation assigned to it. Find records and artifacts under Archived tasks.',
    handoffCancelScope: 'Cancelling closes this task at handoff. Find its review decisions, jobs, and artifacts under Archived tasks.',
    taskCancelReason: 'Cancellation reason', taskCancelReasonRequired: 'Enter a reason for cancelling this task.',
    cancellingTask: 'Requesting task cancellation…', taskCancelled: 'Research task cancelled.',
    cancelledTaskArchive: 'This research task is closed. Open Activity and files for its archived records.',
    taskAlreadyCancelled: 'The research task has already been cancelled.', taskCancelConflict: 'Review the refreshed task state before submitting cancellation again.',
    taskCancelUnconfirmed: 'Task cancellation could not be confirmed. Check the updated task status.',
    round: 'Round', version: 'Version', revision: 'Request revision', updated: 'Updated', audit: 'Audit',
    auditPending: 'Awaiting audit', limitations: 'Limitations', advancedInChat: 'Continue this step in Chat.',
    action: 'Decision', chooseAction: 'Choose a decision', reason: 'Reason', recordDecision: 'Record decision',
    callerDeclared: 'Decisions are recorded as caller-declared.', decisionRecorded: 'Decision recorded.',
    decisionConflict: 'This decision could not be recorded. Review the latest task state before resubmitting.',
    reasonRequired: 'Enter a reason for this decision.', inspect: 'Inspect',
    jobs: 'Engine jobs', noJobs: 'No engine jobs are recorded for this task.',
    computeNote: 'Job status reflects the controller’s latest recorded observation.',
    cancelJob: 'Stop job', confirmStop: 'Stop this computation?', keepRunning: 'Keep running',
    stopConfirmed: 'Confirm stop', stoppingJob: 'Requesting cancellation…', jobCancelled: 'Job cancelled.',
    jobAlreadyEnded: 'The job has already ended.', cancelUnconfirmed: 'Cancellation could not be confirmed. Check the job status.',
    retryJob: 'Retry job', retryingJob: 'Requesting a new attempt…', retryRecorded: 'New attempt recorded.',
    retryAlreadyRecorded: 'A newer attempt already exists.', retryUnconfirmed: 'A new attempt could not be confirmed. Check the job list.',
    retryBudget: 'The task has used its job budget.', retryOf: 'Retry of',
    jobsEnded: 'All jobs recorded for this task have ended.', jobsEndedForReview: 'Computation complete. Results are ready for review.',
    jobsEndedForShortlist: 'Computation complete. The shortlist is ready for review.',
    stopRequiresActive: 'Stop appears once a job is confirmed to be running.',
    fingerprints: 'SHA-256 fingerprints', requestHash: 'Request', outputHash: 'Output', resultHash: 'Result',
    started: 'Created', finished: 'Finished', consumed: 'Output consumed',
    noArtifacts: 'No artifacts are recorded for this task.', chooseArtifact: 'Select an artifact to inspect its contents.',
    previewLimited: 'Showing the first 100,000 characters of this artifact.', download: 'Download formatted JSON',
    verifiedBytes: 'Stored artifact SHA-256', noEvents: 'No trajectory events are recorded for this task.',
    partialHistory: 'This view shows the most recent recorded events. Earlier entries have been trimmed.',
    afpk: 'AFPK KS screening', afpkMethod: 'Three KS profile scores', afpkReport: 'AFPK KS screening report',
    afpkMethodDetail: 'The screen compares FAS I, mitochondrial FAS II, and PKS bit scores. A putative AFPK requires all three scores, a uniquely strongest FAS I score, and a FAS I score within the inclusive window.',
    afpkReviewScope: 'Review accepts a shortlist for research handoff. Experimental evidence establishes enzyme function.',
    scoreWindow: 'FAS I bit-score window', screened: 'Screened sequences', nominated: 'Nominated', anchors: 'Reference anchors', anchor: 'Reference anchor',
    sequence: 'Sequence ID', role: 'Role', classification: 'Classification', candidate: 'Screening input',
    finderClusters: 'Finder cluster', finderSeparate: 'AFPK Finder cluster data come from an imported record and are displayed alongside the KS classification.',
    finderMembership: 'Reported cluster membership',
    rowFilter: 'Show rows', sequenceFilter: 'Find sequence ID', allRows: 'All rows', previous: 'Previous', next: 'Next',
    noRows: 'No rows match these filters.', rawJson: 'Raw JSON', scoreUnavailable: 'No reportable score',
    scorePrecision: 'Table scores use two decimal places. Exact values are available in Raw JSON.',
    afpkComparison: 'AFPK evidence comparison', ksClassification: 'KS classification',
    nativeFinder: 'Original AFPK-finder', nativeFinderRuns: 'Clustering in this run', paperRecord: 'Published or imported records',
    paperScores: 'Published KS bit scores', noPaperRecord: 'No matching record',
    finderRunDetails: 'Run summary by perplexity', finderCluster: 'Cluster', finderClustered: 'Clustered', finderNoise: 'Noise', finderMissing: 'Missing',
    finderCounts: 'Training rows in cluster', finderUnrecorded: 'Unrecorded',
    finderCountBasis: 'The reported share uses the number of training sequences of that clade in this cluster over the number of training sequences of that clade in the full run.',
    finderInputLabel: 'INPUT_KS is the input-sequence label used in this run.',
    afpkComparisonScope: 'The KS screen proposes the shortlist. Review differences across this run and the published records before handoff.',
    afpkEvidenceReview: 'Screening results', afpkHumanReview: 'Shortlist review',
    afpkShortlistPreview: 'Nominated sequences and KS scores',
    afpkNoReport: 'A verified KS screening report is not available for this request revision yet.',
    afpkReportLink: 'Open source report', afpkNoReview: 'No shortlist decision recorded for this report.',
    afpkNoFinderRun: 'No original run recorded', afpkNoPaperScores: 'No published scores recorded',
    afpkImportedClusters: 'Imported cluster records', afpkNoImportedCluster: 'No imported cluster recorded',
    afpkClusterScope: 'Cluster IDs are specific to their run and perplexity setting.',
    afpkReportInvalid: 'The verified artifact does not contain a readable AFPK report.',
    dismiss: 'Dismiss', awaitingDecision: 'Awaiting decision', taskRecord: 'Task record',
    taskId: 'Task', justNow: 'just now',
    deskGuide: 'How this desk works',
    roundHelp: 'A round is one pass of the loop from hypothesis to validation. The controller opens a new round only when you choose to iterate.',
    versionHelp: 'Every decision advances the task version. If another surface records a decision first, the server answers 409 and the desk reloads instead of overwriting.',
    revisionHelp: 'A revision identifies one engine request. Artifacts and jobs are filed under the revision that produced them.',
    gates: 'Gates', gatesHelp: 'The loop stops at a gate whenever a human decision is required. Decisions are recorded as caller-declared with a written reason.',
    shownRows: 'Showing {value}', viewSwitched: '{value} view open',
    noJobsTitle: 'No engine jobs yet', noJobsHelp: 'Engine jobs appear once a stage asks the deterministic engines for retrieval, filtering, or scoring.',
    noArtifactsTitle: 'No frozen artifacts yet', noArtifactsHelp: 'Each stage freezes its record here with a SHA-256 fingerprint before the controller consumes it.',
    noEventsTitle: 'No trajectory events yet', noEventsHelp: 'The timeline records every gate, job, and decision as it happens.',
    noReportTitle: 'No screening report yet', noReportHelp: 'The verified KS screening report appears once the discovery stage finishes.',
    newAfpkTaskTitle: 'Start an AFPK screening', newAfpkTaskHelp: 'Screen a project protein set for putative animal fatty acyl phytyl ketone synthases.',
  },
  zh: {
    refresh: '刷新', taskViews: '记录类型', activity: '运行与文件记录', compute: '计算',
    jumpToReview: '前往候选审核',
    newAfpkTask: '新建 AFPK 任务', afpkInputSource: '输入来源', afpkSourceRequest: '项目请求 JSON',
    afpkSourcePreset: '已准备的示例', afpkSourceGuided: '项目序列与模型文件', afpkPreparedExample: '示例',
    afpkRequestPath: '请求 JSON 路径', afpkSequenceFiles: '蛋白 FASTA 路径', afpkChooseProtein: '添加项目 FASTA',
    afpkPathsPerLine: '每行填写一个项目相对路径。', afpkWindowMin: 'FAS I bit score 下限', afpkWindowMax: 'FAS I bit score 上限',
    afpkOptionalEvidence: '参照序列和对照记录', afpkAnchorIds: '参照序列 ID（可选）', afpkRunFinder: '运行原版 AFPK-finder',
    afpkAnchorsHint: '每行填写一个来自所选 FASTA 的序列 ID。',
    afpkPublishedFinderFiles: '已发表 Finder 表格路径', afpkPublishedPath: '已发表的 KS 得分文件路径',
    afpkObjective: '研究目标', afpkClose: '关闭', afpkStart: '创建并启动筛选',
    afpkLoadingInputs: '正在读取项目输入…', afpkInputsUnavailable: '暂时无法列出项目输入，可填写项目相对路径。',
    afpkPickFile: '选择文件', afpkNeedInputs: '请填写必需的输入。',
    afpkInvalidWindow: 'FAS I bit score 的下限须小于或等于上限。', afpkStarting: '正在创建研究任务…', afpkCreated: '已创建 AFPK 研究任务。',
    afpkAdjustedTask: '新建调整后的 AFPK 任务',
    afpkPreparing: '正在检查运行环境并准备启动筛选。', afpkPreparingBrief: '正在准备筛选',
    afpkReviewShortcut: '前往候选审核', afpkReadinessShortcut: '查看运行准备',
    afpkRecheck: '重新检查并启动筛选', afpkRecheckQueued: '已请求重新检查运行环境。',
    artifacts: '产物', trajectory: '轨迹', loadingTask: '正在加载任务详情…', loadingArtifact: '正在校验并加载产物…',
    taskUnavailable: '无法打开此任务', authRequired: '请从启动链接打开 AriadneBuddy，再打开会话。',
    denied: '服务拒绝访问此工作区。', requestFailed: '服务未能完成请求。',
    noConnection: '无法连接 AriadneBuddy，请刷新重试。', workflow: '工作流',
    knowledge: '文献与假说', engines: '计算筛选', validationPhase: '实验与验证',
    outcome: '科学结论状态', review: '审阅与下一步', round: '轮次', version: '任务版本',
    methodsAndLimits: '流程、方法与局限性', openCompute: '查看计算作业', progress: '进度',
    jobStatus: '作业状态',
    cancelTask: '取消研究任务', confirmCancelTask: '确认取消任务', keepTask: '保留任务',
    taskCancelScope: '取消会结束本研究任务，并停止其正在运行的计算。可在「已归档任务」查看记录和产物。',
    handoffCancelScope: '取消会关闭这项待交接任务。可在「已归档任务」查看审核决定、作业和产物。',
    taskCancelReason: '取消原因', taskCancelReasonRequired: '请填写取消原因。',
    cancellingTask: '正在请求取消研究任务…', taskCancelled: '研究任务已取消。',
    cancelledTaskArchive: '研究任务已关闭。展开「运行与文件记录」可查看归档。',
    taskAlreadyCancelled: '研究任务已经取消。', taskCancelConflict: '请核对刷新后的任务状态，再提交取消。',
    taskCancelUnconfirmed: '未能确认研究任务已取消，请核对最新任务状态。',
    revision: '请求修订', updated: '更新于', audit: '审计', auditPending: '待审计',
    limitations: '局限性', advancedInChat: '请在对话中继续此步骤。',
    action: '决策', chooseAction: '请选择决策', reason: '理由', recordDecision: '记录决策',
    callerDeclared: '系统将按提交者声明记录决策。', decisionRecorded: '已记录决策。',
    decisionConflict: '此次决策未能记录。请核对最新任务状态后再提交。',
    reasonRequired: '请填写决策理由。', inspect: '查看',
    jobs: '计算作业', noJobs: '该任务暂无计算作业。', computeNote: '这里显示任务控制器最近一次记录的作业状态。',
    cancelJob: '停止作业', confirmStop: '停止这项计算？', keepRunning: '继续运行',
    stopConfirmed: '确认停止', stoppingJob: '正在请求停止…', jobCancelled: '作业已停止。',
    jobAlreadyEnded: '作业已经结束。', cancelUnconfirmed: '未能确认作业已停止，请核对作业状态。',
    retryJob: '重试作业', retryingJob: '正在请求新尝试…', retryRecorded: '已记录新的尝试。',
    retryAlreadyRecorded: '已有新的尝试。', retryUnconfirmed: '未能确认新的尝试，请核对作业记录。',
    retryBudget: '此任务的作业预算已用完。', retryOf: '重试自',
    jobsEnded: '此任务已记录的作业均已结束。', jobsEndedForReview: '计算已完成，可以审阅结果。',
    jobsEndedForShortlist: '计算已完成，候选名单待审核。',
    stopRequiresActive: '作业确认处于运行中时会显示停止按钮。',
    fingerprints: 'SHA-256 指纹', requestHash: '请求', outputHash: '输出', resultHash: '结果',
    started: '创建于', finished: '结束于', consumed: '输出已纳入任务', noArtifacts: '该任务暂无产物。',
    chooseArtifact: '选择一个产物查看内容。', previewLimited: '此处预览产物的前 100,000 个字符。',
    download: '下载格式化 JSON', verifiedBytes: '已存档产物的 SHA-256', noEvents: '该任务暂无轨迹事件。',
    partialHistory: '此处显示最近记录的事件。较早的条目已裁剪。',
    afpk: 'AFPK KS 筛选', afpkMethod: '三个 KS 模型的得分', afpkReport: 'AFPK KS 筛选报告',
    afpkMethodDetail: '筛选比较 FAS I、线粒体 FAS II 和 PKS 的 bit score。初步提名要求三个得分均可报告，FAS I 得分独占最高，且落在含端点的 FAS I 得分区间内。',
    afpkReviewScope: '审阅决定候选名单是否进入研究交接。酶功能由实验结果确认。',
    scoreWindow: 'FAS I bit score 区间', screened: '筛选序列数', nominated: '已提名', anchors: '参照锚点', anchor: '参照锚点',
    sequence: '序列编号', role: '角色', classification: '分类', candidate: '筛选输入',
    finderClusters: 'Finder 聚类', finderSeparate: 'AFPK Finder 聚类来自导入记录，与 KS 分类并列显示。',
    finderMembership: '报告聚类归属度',
    rowFilter: '显示范围', sequenceFilter: '查找序列编号', allRows: '全部', previous: '上一页', next: '下一页',
    noRows: '无匹配记录。', rawJson: '原始 JSON', scoreUnavailable: '无可报告得分',
    scorePrecision: '表中得分保留两位小数。原始 JSON 保留完整精度。',
    afpkComparison: 'AFPK 证据对照', ksClassification: 'KS 分类',
    nativeFinder: '原版 AFPK-finder', nativeFinderRuns: '本次运行聚类', paperRecord: '论文与导入记录',
    paperScores: '论文 KS bit score', noPaperRecord: '无对应记录',
    finderRunDetails: '按 perplexity 查看运行汇总', finderCluster: '簇', finderClustered: '已聚类', finderNoise: '噪声点', finderMissing: '未返回',
    finderCounts: '同簇训练序列', finderUnrecorded: '未记录',
    finderCountBasis: '各类群的同簇占比以该簇内对应类群的训练序列数为分子，以本次运行中该类群的全部训练序列数为分母。',
    finderInputLabel: 'INPUT_KS 是本次运行使用的输入序列标签。',
    afpkComparisonScope: '候选名单来自 KS 筛选。交接前请复核本次聚类和论文记录中的差异。',
    afpkEvidenceReview: '筛选结果', afpkHumanReview: '候选名单审核',
    afpkShortlistPreview: '提名序列与 KS 得分',
    afpkNoReport: '当前请求版本暂无已核验的 KS 筛选报告。',
    afpkReportLink: '查看原始报告', afpkNoReview: '此报告暂无候选名单审核决定。',
    afpkNoFinderRun: '无本次原版运行记录', afpkNoPaperScores: '无论文得分记录',
    afpkImportedClusters: '导入的聚类记录', afpkNoImportedCluster: '无导入聚类记录',
    afpkClusterScope: '簇编号仅在同一次运行和同一 perplexity 设置内可比。',
    afpkReportInvalid: '已核验产物中没有可读取的 AFPK 报告。',
    dismiss: '关闭', awaitingDecision: '待决策', taskRecord: '任务记录',
    taskId: '任务', justNow: '刚刚',
    deskGuide: '这张记录台如何工作',
    roundHelp: '一轮是从假说到验证的一次完整循环。只有选择迭代时，控制器才会开启新一轮。',
    versionHelp: '每次决策都会推进任务版本。若其他界面先记录了决策，服务端会返回 409，记录台改为重新加载，不会覆盖。',
    revisionHelp: '一个修订号对应一次引擎请求。产物和作业都归在产生它的修订号下。',
    gates: '决策关卡', gatesHelp: '需要人工决策时循环会在关卡处停下。决策按提交者声明记录，并附书面理由。',
    shownRows: '当前显示 {value}', viewSwitched: '已打开{value}视图',
    noJobsTitle: '暂无计算作业', noJobsHelp: '当某个阶段请求确定性引擎进行检索、过滤或评分后，计算作业会显示在这里。',
    noArtifactsTitle: '暂无冻结产物', noArtifactsHelp: '每个阶段在被控制器采用前，都会在此冻结记录并附 SHA-256 指纹。',
    noEventsTitle: '暂无轨迹事件', noEventsHelp: '时间线会按顺序记录每一次关卡、作业和决策。',
    noReportTitle: '暂无筛选报告', noReportHelp: '检索阶段完成后，已核验的 KS 筛选报告会显示在这里。',
    newAfpkTaskTitle: '新建 AFPK 筛选', newAfpkTaskHelp: '在项目蛋白库中筛选潜在的动物脂肪酸酰基叶绿基酮合酶。',
  },
};

const terms = {
  stage: {
    readiness: ['Readiness', '准备检查'], literature: ['Literature', '文献调研'],
    hypothesis: ['Hypothesis', '假说生成'], pathway: ['Pathway', '途径重构'],
    discovery: ['Discovery', '检索'], filtering: ['Filtering', '过滤'],
    nomination: ['Nomination', '候选提名'], audit: ['Audit', '证据审计'],
    experiment: ['Experiment', '实验设计'], validation: ['Validation', '验证解读'],
    iteration: ['Iteration', '迭代决策'], handoff: ['Handoff', '研究交接'],
  },
  status: {
    open: ['Open', '进行中'], running: ['Running', '计算中'], waiting: ['Waiting', '等待处理'],
    ready: ['Handoff ready', '待交接'], cancelled: ['Cancelled', '已取消'],
    launching: ['Launching', '正在启动'], succeeded: ['Job succeeded', '作业成功'],
    failed: ['Job failed', '作业失败'], unknown: ['Unknown', '状态待确认'],
    not_started: ['Unstarted', '未启动'], queued: ['Queued', '排队中'],
  },
  waiting: {
    nomination_review: ['Shortlist review pending', '待候选审核'],
    afpk_nomination_review: ['Shortlist review pending', '待候选审核'],
    stage_review: ['Hypothesis review pending', '待假说审核'], stage_input: ['Stage input pending', '待阶段材料'],
    iteration_decision: ['Iteration decision pending', '待迭代决策'], scientific_review: ['Scientific review pending', '待科学复核'],
    afpk_empty_shortlist: ['No AFPK nominations', '暂无 AFPK 提名'], afpk_revision: ['Request revision pending', '待修订筛选请求'],
    environment_readiness: ['Runtime setup pending', '待配置运行环境'], configuration_drift: ['Configuration changed', '待处理配置变更'],
    integrity: ['Integrity check pending', '待核查完整性'], budget_exhausted: ['Job budget exhausted', '作业预算用尽'],
    execution_unknown: ['Job state unconfirmed', '待确认作业状态'], execution_failure: ['Job failed', '作业失败，待处理'],
    execution_cancelled: ['Job stopped', '作业已停止，待处理'], preflight_failure: ['Input check failed', '输入检查失败'],
    esm_unavailable: ['ESM scoring decision pending', '待确认 ESM 评分'], malformed_result: ['Result review pending', '待复核异常结果'],
  },
  science: {
    pending: ['Pending evidence', '证据待补充'], blocked: ['Blocked', '流程受阻'],
    conditional_nomination: ['Conditional nomination', '有条件提名'],
    review_required: ['Review required', '需要科学审阅'],
    validated: ['Validation reviewed', '验证记录已审阅'], cancelled: ['Cancelled', '已取消'],
  },
  audit: { pass: ['Passed', '通过'], warn: ['Warnings', '有警告'], fail: ['Failed', '未通过'] },
  action: {
    approve: ['Approve hypotheses', '通过假说'], approveShortlist: ['Approve shortlist', '批准候选名单'],
    reviseShortlist: ['Request shortlist revision', '要求修订候选名单'],
    revise: ['Request revised hypotheses', '要求修订假说'], iterate: ['Start next iteration', '开始下一轮'],
    conclude: ['Finalize handoff', '完成研究交接'],
  },
  shortlistDecision: {
    approve: ['Shortlist approved', '已批准候选名单'],
    revise: ['Revision requested', '已要求修订'],
    amend_request: ['Request amended', '已修订筛选请求'],
    cancel: ['Review closed with task', '审核随任务关闭'],
  },
  attention: {
    stage_input: ['Stage input required', '待提交阶段记录'], stage_review: ['Hypothesis review', '假说审阅'],
    nomination_review: ['Shortlist review', '候选审阅'], iteration_decision: ['Iteration decision', '迭代决策'],
    afpk_nomination_review: ['AFPK shortlist review', 'AFPK 候选审阅'],
    afpk_empty_shortlist: ['No AFPK nominations', '暂无 AFPK 提名'], afpk_revision: ['AFPK request revision', 'AFPK 请求修订'],
    scientific_review: ['Scientific review', '科学审阅'], environment_readiness: ['Runtime readiness', '运行环境'],
    integrity: ['Integrity check', '完整性检查'], configuration_drift: ['Configuration changed', '配置已变更'],
    execution_unknown: ['Job state unknown', '作业状态待确认'], execution_failure: ['Execution failed', '作业执行失败'],
    execution_cancelled: ['Job cancelled', '作业已停止'],
    budget_exhausted: ['Job budget exhausted', '作业预算用尽'], esm_unavailable: ['ESM unavailable', 'ESM 暂不可用'],
    malformed_result: ['Malformed result', '结果格式错误'], preflight_failure: ['Input check failed', '输入预检失败'],
  },
  event: {
    created: ['Created', '创建任务'], artifact_submitted: ['Artifact submitted', '提交产物'],
    gate_passed: ['Gate passed', '审阅通过'], iteration_opened: ['Iteration opened', '开启迭代'],
    handoff_ready: ['Handoff ready', '待交接'], response: ['Decision recorded', '记录决策'],
    cancelled: ['Cancelled', '已取消'], readiness: ['Readiness checked', '完成准备检查'],
    launch_intent: ['Job reserved', '预留作业'], submitted: ['Job started', '启动作业'],
    observation_recovered: ['Job state confirmed', '确认作业状态'], stage_completed: ['Stage completed', '阶段完成'],
    job_cancelled: ['Job cancelled', '停止作业'],
    attention: ['Attention required', '需要处理'],
  },
  role: {
    'Literature Surveyor': ['Literature Surveyor', '文献调研专家'],
    'Hypothesis Architect': ['Hypothesis Architect', '假说生成专家'],
    'Pathway Reconstructor': ['Pathway Reconstructor', '途径重构专家'],
    'Nomination Steward': ['Nomination Steward', '候选提名专家'],
    'Experimental Designer': ['Experimental Designer', '实验设计专家'],
    'Validation Interpreter': ['Validation Interpreter', '验证解读专家'],
  },
  afpkClass: {
    putative_afpk: ['Putative AFPK', '初步 AFPK'], fas_i: ['FAS I', 'FAS I'],
    fas_ii: ['FAS II', 'FAS II'], pks: ['PKS', 'PKS'], unresolved: ['Unresolved', '未确定'],
  },
};

const tones = {
  running: 'progress', launching: 'progress', queued: 'progress', waiting: 'warning', ready: 'success',
  succeeded: 'success', validated: 'success', pass: 'success', blocked: 'danger',
  failed: 'danger', fail: 'danger', warn: 'warning', unknown: 'warning',
  conditional_nomination: 'warning', review_required: 'warning',
  open: 'progress', cancelled: 'neutral', not_started: 'neutral',
};

const phases = [
  ['knowledge', ['readiness', 'literature', 'hypothesis', 'pathway']],
  ['engines', ['discovery', 'filtering', 'nomination', 'audit']],
  ['validationPhase', ['experiment', 'validation', 'iteration', 'handoff']],
];
const AFPK_WORKFLOW = 'afpk-ks';
const AFPK_REPORT = 'ariadne.afpk-ks-report';
const AFPK_PHASES = [['afpkMethod', ['readiness', 'discovery', 'nomination', 'handoff']]];
const AFPK_ROWS_PER_PAGE = 25;
const KS_SCORE_COLUMNS = [['fas_i', 'FAS I'], ['fas_ii', 'FAS II'], ['pks', 'PKS']];
const REVIEW_ARTIFACT_STAGES = {
  stage_review: ['hypothesis'], nomination_review: ['nomination', 'audit'], iteration_decision: ['validation'],
  afpk_nomination_review: ['discovery'], afpk_empty_shortlist: ['discovery'], afpk_revision: ['discovery'],
};

const REVIEW_ACTIONS = new Set(['approve', 'revise', 'iterate', 'conclude']);
const TERMINAL_JOB_STATES = new Set(['succeeded', 'failed', 'cancelled']);
const RETRY_JOB_STATES = new Set(['failed', 'cancelled']);
const CANCELLABLE_TASK_STATES = new Set(['open', 'running', 'waiting', 'ready']);
const SHORTLIST_REVIEW_ATTENTION = new Set(['nomination_review', 'afpk_nomination_review']);
const STORE_KEY = 'kimi-web.server-credential';
const APPEARANCE_KEY = 'kimi-web.color-scheme';
const API = '/api/v1/ariadne/research';
const TASK_ID = /^research_[a-f0-9]{24}$/;
const PREVIEW_LIMIT = 100_000;
const AFPK_POLL_INTERVAL = 3_000;
const get = (id) => document.getElementById(id);
let preferredLanguage;
try { preferredLanguage = localStorage.getItem('kimi-locale'); } catch { /* Use the browser language. */ }
const language = preferredLanguage === 'zh' || preferredLanguage === 'en'
  ? preferredLanguage : navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
const copy = strings[language];
const dates = new Intl.DateTimeFormat(navigator.language, { dateStyle: 'medium', timeStyle: 'short' });
const tabs = [...document.querySelectorAll('[data-tab]')];
const params = new URLSearchParams(location.search);
const refresh = get('refresh');
const sessionControls = get('session-controls');
const afpkDialog = get('afpk-create-dialog');
const afpkCreateForm = get('afpk-create-form');
const drafts = new Map();

let selected = params.get('task');
let task = null;
let saving = false;
let refreshing = false;
let currentTab = 'overview';
let activeArtifact = null;
let artifactRequest;
let evidenceRequest;
let downloadUrl;
let afpkInputRequest;
let afpkDraft;
let afpkPollTimer;
let afpkPollDelay = AFPK_POLL_INTERVAL;

const launchToken = new URLSearchParams(location.hash.slice(1)).get('token');
if (launchToken) {
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ version: 1, credential: launchToken, expiresAt })); } catch { /* Storage can be disabled. */ }
  history.replaceState(history.state, '', location.pathname + location.search);
}

document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
window.addEventListener('storage', (event) => {
  if (event.key !== APPEARANCE_KEY && event.key !== null) return;
  const scheme = event.newValue;
  document.documentElement.dataset.colorScheme = scheme === 'dark' || scheme === 'system' ? scheme : 'light';
});
for (const node of document.querySelectorAll('[data-copy]')) node.textContent = copy[node.dataset.copy];
for (const node of document.querySelectorAll('[data-label]')) node.setAttribute('aria-label', copy[node.dataset.label]);

function notifyParent(type) {
  window.parent.postMessage({ type, taskId: selected }, location.origin);
}

function credential() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORE_KEY));
    if (stored?.version === 1 && typeof stored.credential === 'string' && stored.expiresAt > Date.now()) {
      return stored.credential;
    }
  } catch { /* A fresh launch link can still authenticate this page. */ }
  return launchToken;
}

async function request(path, { body, signal } = {}) {
  const token = credential();
  if (!token) throw new Error(copy.authRequired);
  const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method: body === undefined ? 'GET' : 'POST', headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store', redirect: 'error', signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(copy.noConnection, { cause: error });
  }
  if (response.status === 401) throw new Error(copy.authRequired);
  if (response.status === 403) throw new Error(copy.denied);
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload === null) {
    const message = typeof payload?.error === 'string' ? payload.error : copy.requestFailed;
    throw Object.assign(new Error(message), { status: response.status });
  }
  return payload;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function term(group, key) {
  return Object.hasOwn(terms[group], key) ? terms[group][key][Number(language === 'zh')] : String(key).replaceAll('_', ' ');
}

function stageName(stage, workflow) {
  if (workflow === AFPK_WORKFLOW) {
    if (stage === 'discovery') return copy.afpk;
    if (stage === 'nomination') return term('attention', 'afpk_nomination_review');
  }
  return term('stage', stage);
}

function taskWaitingReason(detail) {
  if (detail.status !== 'open' && detail.status !== 'waiting') return undefined;
  const reason = detail.attention?.find((item) => item.status === 'open')?.kind ?? detail.waitingReason;
  return Object.hasOwn(terms.waiting, reason) ? reason : undefined;
}

function taskStatusText(status, waitingReason) {
  return waitingReason === undefined ? term('status', status) : term('waiting', waitingReason);
}

function pill(group, value) {
  const node = element('span', 'pill', term(group, value));
  if (Object.hasOwn(tones, value)) node.dataset.tone = tones[value];
  return node;
}

function time(value, label) {
  const date = new Date(value);
  const formatted = Number.isFinite(date.valueOf()) ? dates.format(date) : value;
  const node = element('time', 'meta-text', label ? `${label} ${formatted}` : formatted);
  node.dateTime = value;
  return node;
}

const RELATIVE_STEPS = [[60_000, 'second', 1], [3_600_000, 'minute', 60], [86_400_000, 'hour', 3_600_000], [604_800_000, 'day', 86_400_000]];
const relativeFormatter = new Intl.RelativeTimeFormat(navigator.language, { numeric: 'auto' });

function relativeTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return undefined;
  const elapsed = Date.now() - date.valueOf();
  if (elapsed < 45_000) return copy.justNow;
  for (const [limit, unit, scale] of RELATIVE_STEPS) {
    if (elapsed < limit) return relativeFormatter.format(-Math.round(elapsed / scale), unit);
  }
  return undefined;
}

function relativeStamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return element('span', 'meta-text task-metadata-time');
  const relative = relativeTime(value);
  const node = element('span', 'meta-text task-metadata-time', relative);
  node.title = dates.format(date);
  return node;
}

function section(label) {
  const node = element('section', 'section');
  node.append(element('h3', '', label));
  return node;
}

function emptyState(title, detail, { retry = false, figure = false, action } = {}) {
  const node = element('div', 'empty-state');
  if (figure) {
    const ornament = element('div', 'empty-state-figure');
    ornament.setAttribute('aria-hidden', 'true');
    ornament.append(element('span', 'workspace-column'), element('span', 'medallion'), element('span', 'workspace-column'));
    ornament.querySelector('.medallion')?.append(element('span', 'workspace-mark'));
    node.append(ornament);
  }
  if (title) node.append(element('h1', '', title));
  if (detail) node.append(element('p', '', detail));
  if (action) node.append(action);
  if (retry) node.append(refresh);
  return node;
}

function showState(title, detail, { retry = false, figure = false, action } = {}) {
  const node = get('state');
  node.replaceChildren(emptyState(title, detail, { retry, figure, action }));
  get('task').hidden = true;
}

const NOTICE_TONES = new Set(['success', 'info', 'warning', 'error']);

function notice(message, tone = 'success') {
  const node = get('notice');
  const text = get('notice-text');
  const dismiss = get('notice-dismiss');
  const resolved = typeof tone === 'boolean' ? (tone ? 'error' : 'success') : tone;
  const safeTone = NOTICE_TONES.has(resolved) ? resolved : 'success';
  node.hidden = !message;
  text.textContent = message ?? '';
  node.dataset.tone = safeTone;
  node.setAttribute('role', safeTone === 'error' ? 'alert' : 'status');
  dismiss.hidden = !message;
  if (message) announce(message);
}

function announce(message) {
  const node = get('announcer');
  if (!node) return;
  node.textContent = '';
  window.setTimeout(() => { node.textContent = message; }, 60);
}

function updateControls() {
  const pending = saving || refreshing;
  refresh.disabled = pending;
  updateAfpkInputMode();
  for (const control of document.querySelectorAll('[data-mutation-control]')) control.disabled = pending;
}

async function reload() {
  if (!TASK_ID.test(selected ?? '')) {
    showState(copy.taskUnavailable, undefined, { figure: true });
    return;
  }
  refreshing = true;
  updateControls();
  get('task').setAttribute('aria-busy', 'true');
  if (!task) showState('', copy.loadingTask, { figure: true });
  try {
    showTask(await request('/' + encodeURIComponent(selected)));
  } catch (error) {
    if (task?.id === selected) notice(error.message, 'error');
    else showState(copy.taskUnavailable, error.message, { retry: true, figure: true });
  } finally {
    refreshing = false;
    get('task').removeAttribute('aria-busy');
    updateControls();
  }
}

function showTask(detail) {
  task = detail;
  if (!sessionControls.contains(refresh)) sessionControls.prepend(refresh);
  get('state').replaceChildren();
  get('task').hidden = false;
  get('task-objective').textContent = task.objective;
  sessionControls.querySelector('.task-cancel')?.remove();
  if (detail.canCancelTask === true && CANCELLABLE_TASK_STATES.has(detail.status)) {
    sessionControls.append(taskCancellationControl(detail));
  }
  const reason = taskWaitingReason(task);
  const status = pill('status', reason === undefined ? task.status : 'waiting');
  status.textContent = taskStatusText(task.status, reason);
  const context = task.workflow === AFPK_WORKFLOW ? [] : [element('span', 'meta-text', `${copy.round} ${task.iteration}`)];
  get('task-metadata').replaceChildren(
    status,
    ...context,
    time(task.updatedAt, copy.updated),
    relativeStamp(task.updatedAt),
  );
  const taskId = element('code', 'task-id', task.id);
  taskId.title = `${copy.taskId} ${task.id}`;
  get('task-metadata').append(taskId);
  const activityMeta = get('session-activity-meta');
  const latestJob = detail.assignments.at(-1);
  const counts = `${copy.compute} ${detail.assignments.length} · ${copy.artifacts} ${detail.artifacts.length}`;
  activityMeta.textContent = afpkInProgress(detail)
    ? latestJob ? term('status', latestJob.notStarted ? 'not_started' : latestJob.status) : copy.afpkPreparingBrief
    : counts;
  const relative = afpkInProgress(detail) ? relativeStamp(detail.updatedAt) : undefined;
  if (relative) activityMeta.append(' · ', relative);
  showTab(currentTab, { redraw: true });
  scheduleAfpkPoll();
  notifyParent('ariadne:session');
}

function updateAfpkInputMode() {
  const source = get('afpk-source');
  const starting = afpkDialog.dataset.starting === 'true';
  for (const mode of ['request', 'preset', 'guided']) {
    const section = get(`afpk-source-${mode}`);
    section.hidden = source.value !== mode;
    section.disabled = section.hidden || starting;
  }
  source.disabled = starting;
  get('afpk-objective').disabled = starting;
  get('afpk-create-close').disabled = starting;
  get('afpk-create-start').disabled = saving || refreshing || (source.value === 'preset' && !get('afpk-preset').value);
}

function afpkFormMessage(id, message) {
  const node = get(id);
  node.hidden = !message;
  node.textContent = message;
}

function catalogOptions(entries, valueOf) {
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    const value = valueOf(entry);
    if (typeof value !== 'string' || !value) return [];
    const option = element('option', '', entry.label || value);
    option.value = value;
    if (typeof entry.objective === 'string') option.dataset.objective = entry.objective;
    return [option];
  });
}

function applyAfpkCatalog(catalog) {
  const pathValue = (entry) => entry?.path;
  const requestOptions = catalogOptions(catalog.requests, pathValue);
  get('afpk-request-options').replaceChildren(...requestOptions);
  get('afpk-model-options').replaceChildren(...catalogOptions(catalog.files?.models, pathValue));

  const preset = get('afpk-preset');
  const previous = preset.value;
  const examples = catalogOptions(catalog.presets, (entry) => entry?.requestFile);
  preset.replaceChildren(...examples);
  if (examples.some((option) => option.value === previous)) preset.value = previous;
  const mode = get('afpk-source');
  const presetMode = mode.querySelector('option[value="preset"]');
  presetMode.hidden = examples.length === 0;
  presetMode.disabled = presetMode.hidden;
  if (examples.length && !mode.dataset.chosen && !get('afpk-request-path').value && !get('afpk-objective').value.trim()) {
    mode.value = 'preset';
    fillAfpkPresetObjective();
  }
  if (presetMode.disabled && mode.value === 'preset') mode.value = 'request';
  if (!get('afpk-request-path').value && requestOptions.length === 1) get('afpk-request-path').value = requestOptions[0].value;

  const proteins = catalogOptions(catalog.files?.proteins, pathValue);
  const placeholder = element('option', '', copy.afpkPickFile);
  placeholder.value = '';
  placeholder.disabled = true;
  const picker = get('afpk-protein-list');
  picker.replaceChildren(placeholder, ...proteins);
  picker.value = '';
  get('afpk-protein-picker').hidden = proteins.length === 0;
  updateAfpkInputMode();
}

function fillAfpkPresetObjective() {
  if (get('afpk-source').value !== 'preset') return;
  const example = get('afpk-preset').selectedOptions[0];
  const objective = get('afpk-objective');
  if (!example || (objective.value.trim() && objective.value !== objective.dataset.prefilled)) return;
  objective.value = example.dataset.objective || example.textContent;
  objective.dataset.prefilled = objective.value;
}

async function loadAfpkCatalog() {
  afpkInputRequest?.abort();
  const controller = new AbortController();
  afpkInputRequest = controller;
  afpkFormMessage('afpk-input-status', copy.afpkLoadingInputs);
  try {
    const catalog = await request('/afpk/inputs', { signal: controller.signal });
    if (controller.signal.aborted) return;
    applyAfpkCatalog(catalog);
    afpkFormMessage('afpk-input-status', '');
  } catch {
    if (controller.signal.aborted) return;
    applyAfpkCatalog({});
    afpkFormMessage('afpk-input-status', copy.afpkInputsUnavailable);
  }
}

function openAfpkDialog(objective) {
  if (afpkDialog.open || saving || refreshing) return;
  if (typeof objective === 'string') {
    const source = get('afpk-source');
    source.value = 'guided';
    source.dataset.chosen = 'true';
    get('afpk-objective').value = objective;
    afpkDraft = undefined;
  }
  afpkFormMessage('afpk-create-error', '');
  updateAfpkInputMode();
  afpkDialog.showModal();
  get('afpk-source').focus();
  void loadAfpkCatalog();
}

function projectPaths(id) {
  return get(id).value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function afpkStartInputs() {
  const objective = get('afpk-objective').value.trim();
  if (!objective) throw new Error(copy.afpkNeedInputs);
  const mode = get('afpk-source').value;
  if (mode !== 'guided') {
    const requestFile = get(mode === 'preset' ? 'afpk-preset' : 'afpk-request-path').value.trim();
    if (!requestFile) throw new Error(copy.afpkNeedInputs);
    return { objective, requestFile };
  }
  const inputProteins = projectPaths('afpk-proteins');
  const ksModels = {
    fasI: get('afpk-fas-i').value.trim(), fasII: get('afpk-fas-ii').value.trim(), pks: get('afpk-pks').value.trim(),
  };
  if (!inputProteins.length || !ksModels.fasI || !ksModels.fasII || !ksModels.pks) throw new Error(copy.afpkNeedInputs);
  const min = get('afpk-window-min').valueAsNumber;
  const max = get('afpk-window-max').valueAsNumber;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) throw new Error(copy.afpkInvalidWindow);
  const referenceAnchors = projectPaths('afpk-anchors');
  const afpkFinderFiles = projectPaths('afpk-finder-files');
  const publishedKsScoresFile = get('afpk-published-ks').value.trim();
  return {
    objective, inputProteins, ksModels, window: { min, max },
    referenceAnchors: referenceAnchors.length ? referenceAnchors : undefined,
    afpkFinderFiles: afpkFinderFiles.length ? afpkFinderFiles : undefined,
    runAfpkFinder: get('afpk-run-finder').checked || undefined,
    publishedKsScoresFile: publishedKsScoresFile || undefined,
  };
}

async function startAfpkTask() {
  if (saving || refreshing) return;
  let input;
  try { input = afpkStartInputs(); }
  catch (error) {
    afpkFormMessage('afpk-create-error', error.message);
    return;
  }
  const signature = JSON.stringify(input);
  if (afpkDraft?.signature !== signature) {
    const key = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
    afpkDraft = { signature, requestId: `afpk-desk-${key}` };
  }

  saving = true;
  afpkDialog.dataset.starting = 'true';
  updateControls();
  afpkFormMessage('afpk-create-error', '');
  afpkFormMessage('afpk-input-status', copy.afpkStarting);
  try {
    const created = await request('/afpk/start', { body: { ...input, requestId: afpkDraft.requestId } });
    selected = created.id;
    params.delete('new');
    params.set('task', selected);
    history.replaceState(history.state, '', `${location.pathname}?${params}`);
    afpkDialog.close();
    afpkCreateForm.reset();
    delete get('afpk-source').dataset.chosen;
    delete get('afpk-objective').dataset.prefilled;
    afpkDraft = undefined;
    currentTab = 'overview';
    activeArtifact = null;
    releasePreview();
    showTask(created);
    await reload();
    notice(copy.afpkCreated);
    focusCurrentView();
  } catch (error) {
    afpkFormMessage('afpk-create-error', error.message);
  } finally {
    saving = false;
    delete afpkDialog.dataset.starting;
    afpkFormMessage('afpk-input-status', '');
    updateControls();
  }
}

function afpkInProgress(detail) {
  return detail?.workflow === AFPK_WORKFLOW && (detail.autoProgress === true || detail.status === 'running');
}

function scheduleAfpkPoll() {
  clearTimeout(afpkPollTimer);
  if (!document.hidden && afpkInProgress(task)) {
    afpkPollTimer = setTimeout(pollAfpkStatus, afpkPollDelay);
  }
}

async function pollAfpkStatus() {
  const observed = task;
  if (!afpkInProgress(observed) || document.hidden) return;
  if (saving || refreshing || document.querySelector('dialog[open]')) {
    scheduleAfpkPoll();
    return;
  }
  try {
    const next = await request(`/${encodeURIComponent(observed.id)}`, { signal: AbortSignal.timeout(6_000) });
    afpkPollDelay = AFPK_POLL_INTERVAL;
    if (task !== observed || saving || refreshing || document.querySelector('dialog[open]')) return;
    const changedJobs = next.assignments.length !== observed.assignments.length || next.assignments.some((entry, index) => {
      const old = observed.assignments[index];
      return entry.status !== old.status || entry.canCancel !== old.canCancel || entry.canRetry !== old.canRetry;
    });
    if (next.version !== observed.version || next.status !== observed.status || next.autoProgress !== observed.autoProgress || changedJobs) {
      showTask(next);
    }
  } catch {
    afpkPollDelay = 8_000;
  } finally {
    scheduleAfpkPoll();
  }
}

async function resumeAfpkTask(detail) {
  if (saving || refreshing || task !== detail) return;
  saving = true;
  updateControls();
  notice(copy.afpkPreparing, 'info');
  try {
    const updated = await request(`/${encodeURIComponent(detail.id)}/advance`, { body: { expectedVersion: detail.version } });
    currentTab = 'compute';
    await reload();
    if (task?.id !== detail.id || task.version < updated.version) showTask(updated);
    notice(copy.afpkRecheckQueued);
  } catch (error) {
    if (error.status === 409) await reload();
    notice(error.message, 'error');
  } finally {
    saving = false;
    updateControls();
    focusCurrentView();
  }
}

function taskCancellationControl(detail) {
  const control = element('div', 'task-cancel');
  const trigger = element('button', 'button button-danger', copy.cancelTask);
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'dialog');
  const dialog = element('dialog', 'task-cancel-dialog');
  dialog.setAttribute('aria-labelledby', 'cancel-task-heading');
  dialog.setAttribute('aria-describedby', 'cancel-task-scope');
  const form = element('form', 'task-cancel-form');
  const title = element('h3', '', copy.cancelTask);
  title.id = 'cancel-task-heading';
  const scope = element('p', 'subtle', detail.status === 'ready' ? copy.handoffCancelScope : copy.taskCancelScope);
  scope.id = 'cancel-task-scope';

  const label = element('label', '', copy.taskCancelReason);
  const reason = element('textarea');
  reason.maxLength = 4000;
  reason.required = true;
  reason.addEventListener('input', () => reason.setCustomValidity(''));
  label.append(reason);

  const actions = element('div', 'meta-row task-cancel-actions');
  const keep = element('button', 'button', copy.keepTask);
  keep.type = 'button';
  const confirm = element('button', 'button button-danger', copy.confirmCancelTask);
  confirm.type = 'submit';
  for (const node of [trigger, keep, confirm, reason]) node.dataset.mutationControl = '';
  actions.append(keep, confirm);
  form.append(title, scope, label, actions);
  dialog.append(form);
  control.append(trigger, dialog);

  trigger.addEventListener('click', () => {
    dialog.showModal();
    keep.focus();
  });
  keep.addEventListener('click', () => dialog.close());
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const explanation = reason.value.trim();
    if (!explanation) {
      reason.setCustomValidity(copy.taskCancelReasonRequired);
      reason.reportValidity();
      return;
    }
    if (saving || refreshing || task !== detail) return;
    dialog.close();
    void cancelTask(detail, explanation);
  });
  return control;
}

async function cancelTask(detail, reason) {
  saving = true;
  updateControls();
  notice(copy.cancellingTask, 'info');
  try {
    const updated = await request(`/${encodeURIComponent(detail.id)}/cancel`, { body: { expectedVersion: detail.version, reason } });
    await reload();
    if (task === null || task.version < updated.version) showTask(updated);
    if (updated.status === 'cancelled' && task?.status === 'cancelled') notice(copy.taskCancelled);
    else notice(copy.taskCancelUnconfirmed, 'error');
  } catch (error) {
    if (error.status === 409) {
      await reload();
      if (task?.status === 'cancelled') notice(copy.taskAlreadyCancelled, 'warning');
      else notice(`${copy.taskCancelConflict}\n${error.message}`, 'error');
    } else {
      notice(`${copy.taskCancelUnconfirmed}\n${error.message}`, 'error');
    }
  } finally {
    saving = false;
    updateControls();
    if (task?.id === detail.id) focusCurrentView();
  }
}

function focusCurrentView() {
  const target = currentTab === 'overview' ? 'tab-panel' : `tab-${currentTab}`;
  get(target).focus({ preventScroll: true });
}

function showTab(tab, { redraw = false } = {}) {
  if (task === null) return;
  currentTab = tab;
  const activity = get('session-activity');
  activity.open = tab !== 'overview';
  activity.querySelector('summary')?.setAttribute('aria-expanded', String(activity.open));
  const activeActivity = activity.open ? tab : 'compute';
  const label = tab === 'overview' ? copy.taskRecord : (copy[tab] ?? tab);
  announce(copy.viewSwitched.replace('{value}', label));
  for (const button of tabs) {
    const active = button.dataset.tab === activeActivity;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  }
  if (redraw) {
    evidenceRequest?.abort();
    const results = get('tab-panel');
    results.replaceChildren();
    showOverview(results);
  }

  const panel = get('activity-panel');
  panel.setAttribute('aria-labelledby', `tab-${activeActivity}`);
  releaseArtifactPreview();
  panel.replaceChildren();
  if (tab === 'compute') showCompute(panel);
  if (tab === 'artifacts') showArtifacts(panel);
  if (tab === 'trajectory') showTrajectory(panel);
  updateControls();
}

function showOverview(panel) {
  const thread = element('div', 'overview-thread');
  const afpk = task.workflow === AFPK_WORKFLOW;
  const cancelled = task.status === 'cancelled';
  const inProgress = afpkInProgress(task);
  const linkedReview = afpk ? task.afpkEvidence?.attentionId : undefined;
  const waiting = cancelled ? [] : task.attention.filter((item) => item.status === 'open' && item.id !== linkedReview);
  const evidence = afpk && (!inProgress || task.afpkEvidence?.artifactId) ? afpkEvidencePanel(task) : null;
  if (evidence && linkedReview && !waiting.length) thread.append(evidence);
  else {
    const review = section(inProgress ? copy.progress : copy.review);
    review.classList.add('thread-entry');
    const latestJob = task.assignments.at(-1);
    const preparation = !latestJob && inProgress;
    const jobStatus = latestJob?.notStarted ? 'not_started' : latestJob?.status;
    const jobNeedsAttention = latestJob?.stage === task.stage
      && (RETRY_JOB_STATES.has(jobStatus) || jobStatus === 'not_started');
    const showJob = !cancelled && latestJob && (task.status === 'running' || jobNeedsAttention);
    if (!waiting.length && !showJob) {
      review.append(element('p', 'thread-next', cancelled ? copy.cancelledTaskArchive : preparation ? copy.afpkPreparing : task.nextAction));
    }
    if (showJob || preparation) {
      const activity = element('div', 'thread-job meta-row');
      if (showJob) activity.append(element('span', '', stageName(latestJob.stage, task.workflow)), pill('status', jobStatus));
      const open = element('button', 'button button-quiet', copy.openCompute);
      open.type = 'button';
      open.addEventListener('click', () => {
        showTab('compute');
        get('tab-compute').focus();
      });
      activity.append(open);
      review.append(activity);
    }
    for (const item of waiting) review.append(reviewCard(task, item));
    thread.append(review);
    if (evidence) thread.append(evidence);
  }

  const methods = element('details', 'thread-disclosure');
  const background = element('div', 'thread-reference');
  const plan = element('dl', 'workflow');
  for (const [phase, stages] of afpk ? AFPK_PHASES : phases) {
    const group = element('div');
    const list = element('ol', 'stage-list');
    const entry = element('dd');
    for (const stage of stages) {
      const item = element('li', '', stageName(stage, task.workflow));
      if (stage === task.stage) item.setAttribute('aria-current', 'step');
      list.append(item);
    }
    entry.append(list);
    group.append(element('dt', '', copy[phase]), entry);
    plan.append(group);
  }
  background.append(element('h3', '', copy.workflow), plan);
  if (afpk) background.append(element('p', 'subtle workflow-note', copy.afpkMethodDetail));
  const outcomes = element('div', 'meta-row');
  outcomes.append(element('span', 'meta-text', copy.outcome), pill('science', task.scientificOutcome.status));
  const audit = task.scientificOutcome.auditStatus;
  if (audit || !afpk) outcomes.append(element('span', 'meta-text', audit ? `${copy.audit} · ${term('audit', audit)}` : copy.auditPending));
  background.append(outcomes);
  if (task.scientificOutcome.limitations.length) {
    const limits = element('ul', 'limits');
    limits.append(...task.scientificOutcome.limitations.map((limit) => element('li', '', limit)));
    background.append(element('h3', '', copy.limitations), limits);
  }
  methods.append(element('summary', '', copy.methodsAndLimits), background);
  thread.append(methods);

  panel.append(thread);
}

function afpkEvidencePanel(detail) {
  const evidence = section(copy.afpkEvidenceReview);
  evidence.classList.add('thread-entry', 'afpk-evidence');
  const details = element('div', 'afpk-evidence-details');
  const actions = element('div', 'afpk-evidence-actions');
  const report = detail.artifacts.find((artifact) => artifact.id === detail.afpkEvidence?.artifactId);
  const preview = element('div', 'afpk-evidence-preview');
  if (report) {
    const inspect = artifactButton(report, copy.afpkReportLink);
    inspect.dataset.afpkReportLink = '';
    actions.append(inspect);
    void loadArtifact(detail.id, report.id, preview, { overview: true, details });
  } else {
    preview.append(element('h4', '', copy.noReportTitle), element('p', 'subtle', copy.afpkNoReport), element('p', 'subtle', copy.noReportHelp));
  }

  const review = element('section', 'afpk-review');
  review.setAttribute('aria-label', copy.afpkHumanReview);
  const item = detail.attention.find((entry) => entry.id === detail.afpkEvidence?.attentionId);
  const needsReview = item?.status === 'open' && detail.status !== 'cancelled';
  if (needsReview) {
    review.dataset.pending = '';
    review.dataset.pendingLabel = copy.awaitingDecision;
    review.setAttribute('aria-live', 'polite');
    review.append(reviewCard(detail, item, { includeArtifacts: false }));
    const decision = review.querySelector('.review-form select');
    if (decision) {
      const jump = element('button', 'button button-quiet', copy.jumpToReview);
      jump.type = 'button';
      jump.dataset.afpkReviewJump = '';
      jump.addEventListener('click', () => {
        review.scrollIntoView({ block: 'start' });
        decision.focus({ preventScroll: true });
      });
      actions.append(jump);
    }
  } else if (item?.resolution) {
    const action = item.resolution.action;
    const decision = pill('shortlistDecision', action);
    decision.dataset.reviewDecision = action;
    if (action === 'approve') decision.dataset.tone = 'success';
    const meta = element('div', 'meta-row');
    meta.append(decision);
    if (item.resolvedAt) meta.append(time(item.resolvedAt));
    review.append(element('h4', '', copy.afpkHumanReview), meta, element('p', 'review-reason', item.resolution.reason));
  } else if (report) {
    review.append(element('p', 'subtle', copy.afpkNoReview));
  }
  evidence.append(preview);
  if (review.childElementCount) evidence.append(review);
  if (actions.childElementCount) {
    details.append(actions);
    evidence.append(details);
  }
  return evidence;
}

function artifactButton(artifact, label) {
  const inspect = element('button', 'button button-quiet', label);
  inspect.type = 'button';
  inspect.addEventListener('click', () => {
    activeArtifact = artifact.id;
    showTab('artifacts');
    get('tab-artifacts').focus();
  });
  return inspect;
}

function artifactLinks(detail, stages) {
  const links = element('div', 'meta-row');
  for (const stage of stages) {
    const artifact = detail.artifacts.findLast((entry) => entry.stage === stage
      && (entry.iteration === undefined || entry.iteration === detail.iteration));
    if (!artifact) continue;
    links.append(artifactButton(artifact, `${copy.inspect} ${artifactTitle(artifact)}`));
  }
  return links;
}

function reviewCard(detail, item, { includeArtifacts = true } = {}) {
  const card = element('div', 'review-card');
  const meta = element('div', 'meta-row');
  meta.append(element('strong', '', term('attention', item.kind)), time(item.createdAt));
  card.append(meta, element('p', '', item.message));
  const afpk = item.kind === 'afpk_nomination_review';
  const actions = item.allowedActions.filter((action) => afpk ? action === 'approve' || action === 'revise' : REVIEW_ACTIONS.has(action));
  if (includeArtifacts && Object.hasOwn(REVIEW_ARTIFACT_STAGES, item.kind)) {
    const links = artifactLinks(detail, REVIEW_ARTIFACT_STAGES[item.kind]);
    if (links.childElementCount) card.append(links);
  }
  if (actions.length && detail.status !== 'ready' && detail.status !== 'cancelled') {
    if (afpk) card.append(element('p', 'subtle', copy.afpkReviewScope));
    card.append(reviewForm(detail, item, actions));
  } else if (item.kind === 'afpk_empty_shortlist' || item.kind === 'afpk_revision') {
    const button = element('button', 'button job-action', copy.afpkAdjustedTask);
    button.type = 'button';
    button.dataset.mutationControl = '';
    button.addEventListener('click', () => openAfpkDialog(detail.objective));
    card.append(button);
  } else if (detail.workflow === AFPK_WORKFLOW && item.kind === 'environment_readiness' && detail.canResume === true) {
    const button = element('button', 'button job-action', copy.afpkRecheck);
    button.type = 'button';
    button.dataset.mutationControl = '';
    button.addEventListener('click', () => void resumeAfpkTask(detail));
    card.append(button);
  } else if (item.allowedActions.length) {
    const back = element('button', 'button button-quiet', copy.advancedInChat);
    back.type = 'button';
    back.addEventListener('click', () => notifyParent('ariadne:close-session'));
    card.append(back);
  }
  return card;
}

function reviewForm(detail, item, actions) {
  const form = element('form', 'review-form');
  const actionLabel = element('label', '', copy.action);
  const action = element('select');
  action.required = true;
  const placeholder = element('option', '', copy.chooseAction);
  placeholder.value = '';
  placeholder.disabled = true;
  action.append(placeholder);
  for (const value of actions) {
    const shortlist = item.kind === 'nomination_review' || item.kind === 'afpk_nomination_review';
    let title = value;
    if (value === 'approve' && shortlist) title = 'approveShortlist';
    if (value === 'revise' && item.kind === 'afpk_nomination_review') title = 'reviseShortlist';
    const option = element('option', '', term('action', title));
    option.value = value;
    action.append(option);
  }
  actionLabel.append(action);
  const reasonLabel = element('label', '', copy.reason);
  const reason = element('textarea');
  reason.maxLength = 4000;
  reason.required = true;
  reasonLabel.append(reason);

  const draftKey = `${detail.id}:${detail.version}:${item.id}`;
  const draft = drafts.get(draftKey);
  action.value = draft?.action ?? '';
  reason.value = draft?.reason ?? '';
  form.addEventListener('input', () => {
    reason.setCustomValidity('');
    drafts.set(draftKey, { action: action.value, reason: reason.value });
  });

  const submit = element('button', 'button button-primary', copy.recordDecision);
  submit.type = 'submit';
  submit.dataset.mutationControl = '';
  form.append(actionLabel, reasonLabel, element('p', 'subtle', copy.callerDeclared), submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!reason.value.trim()) {
      reason.setCustomValidity(copy.reasonRequired);
      reason.reportValidity();
      return;
    }
    if (saving || refreshing || task !== detail) return;
    const body = { attentionId: item.id, expectedVersion: detail.version, action: action.value, reason: reason.value.trim() };
    void recordDecision(detail.id, draftKey, body);
  });
  return form;
}

async function recordDecision(taskId, draftKey, body) {
  saving = true;
  updateControls();
  notice('');
  try {
    const detail = await request(`/${encodeURIComponent(taskId)}/respond`, { body });
    drafts.delete(draftKey);
    await reload();
    if (task === null || task.version < detail.version) showTask(detail);
    notice(copy.decisionRecorded);
  } catch (error) {
    if (error.status === 409) {
      drafts.delete(draftKey);
      await reload();
      notice(`${copy.decisionConflict}\n${error.message}`, 'error');
    } else {
      notice(error.message, 'error');
    }
  } finally {
    saving = false;
    updateControls();
  }
}

function jobCancellationControl(detail, job) {
  const control = element('div', 'job-action');
  const start = element('button', 'button button-danger', copy.cancelJob);
  const confirmation = element('div', 'job-cancel-confirmation');
  confirmation.hidden = true;
  confirmation.setAttribute('role', 'group');
  confirmation.setAttribute('aria-label', copy.confirmStop);
  const keep = element('button', 'button', copy.keepRunning);
  const stop = element('button', 'button button-danger', copy.stopConfirmed);
  for (const button of [start, keep, stop]) {
    button.type = 'button';
    button.dataset.mutationControl = '';
  }
  confirmation.append(element('p', 'subtle', copy.confirmStop), keep, stop);
  control.append(start, confirmation);
  start.addEventListener('click', () => {
    start.hidden = true;
    confirmation.hidden = false;
    keep.focus();
  });
  function dismiss() {
    confirmation.hidden = true;
    start.hidden = false;
    start.focus();
  }
  keep.addEventListener('click', dismiss);
  confirmation.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !saving) {
      event.preventDefault();
      dismiss();
    }
  });
  stop.addEventListener('click', () => {
    if (saving || refreshing || task !== detail) return;
    void runJobAction(detail, job, 'cancel');
  });
  return control;
}

function jobRetryControl(detail, job) {
  const control = element('div', 'job-action');
  const retry = element('button', 'button', copy.retryJob);
  retry.type = 'button';
  retry.dataset.mutationControl = '';
  retry.addEventListener('click', () => {
    if (saving || refreshing || task !== detail) return;
    void runJobAction(detail, job, 'retry');
  });
  control.append(retry);
  return control;
}

async function runJobAction(detail, job, action) {
  saving = true;
  updateControls();
  notice(action === 'cancel' ? copy.stoppingJob : copy.retryingJob, 'info');
  try {
    const path = `/${encodeURIComponent(detail.id)}/jobs/${encodeURIComponent(job.jobId)}/${action}`;
    const updated = await request(path, { body: { expectedVersion: detail.version } });
    await reload();
    if (task === null || task.version < updated.version) showTask(updated);
    showJobActionResult(detail, job, action, { updated });
  } catch (error) {
    if (error.status === 409) await reload();
    else if (task === detail && currentTab === 'compute') showTab(currentTab);
    showJobActionResult(detail, job, action, { error });
  } finally {
    saving = false;
    updateControls();
    if (task?.id === detail.id && currentTab === 'compute') get('tab-compute').focus({ preventScroll: true });
  }
}

function showJobActionResult(detail, job, action, { updated, error }) {
  const diagnostic = error?.message ? `\n${error.message}` : '';
  if (action === 'retry') {
    const previousIds = new Set(detail.assignments.map((entry) => entry.jobId));
    const newAttempt = (projection) => projection?.assignments.findLast((entry) =>
      entry.retryOf === job.id && job.id !== undefined && !previousIds.has(entry.jobId));
    const recorded = newAttempt(updated);
    const concurrent = error?.status === 409 ? newAttempt(task) : undefined;
    const attempt = recorded ?? concurrent;
    if (!attempt) {
      notice(`${copy.retryUnconfirmed}${diagnostic}`, 'error');
      return;
    }
    const current = task?.assignments.find((entry) => entry.jobId === attempt.jobId) ?? attempt;
    const status = current.notStarted ? 'not_started' : current.status;
    const label = recorded ? copy.retryRecorded : copy.retryAlreadyRecorded;
    notice(`${label}\n${current.jobId} · ${term('status', status)}`, current.notStarted || RETRY_JOB_STATES.has(status) || status === 'unknown' ? 'warning' : 'success');
    return;
  }

  const status = task?.assignments.find((entry) => entry.jobId === job.jobId)?.status;
  const confirmed = updated?.assignments.some((entry) => entry.jobId === job.jobId && entry.status === 'cancelled');
  if (confirmed && status === 'cancelled') notice(copy.jobCancelled);
  else if ((updated || error?.status === 409) && TERMINAL_JOB_STATES.has(status)) notice(`${copy.jobAlreadyEnded} ${term('status', status)}`, 'warning');
  else notice(`${copy.cancelUnconfirmed}${diagnostic}`, 'error');
}

function canStopJob(job) {
  return job.canCancel === true && job.status === 'running' && !job.notStarted;
}

function computeStatusMessage(detail) {
  const jobs = detail.assignments;
  if (jobs.every((job) => job.notStarted || TERMINAL_JOB_STATES.has(job.status))) {
    const reason = taskWaitingReason(detail);
    if (SHORTLIST_REVIEW_ATTENTION.has(reason)) return copy.jobsEndedForShortlist;
    return reason === 'scientific_review' ? copy.jobsEndedForReview : copy.jobsEnded;
  }
  return jobs.some(canStopJob) ? copy.computeNote : copy.stopRequiresActive;
}

function showCompute(panel) {
  const node = section(`${copy.jobs} · ${task.jobsUsed} / ${task.maxJobs}`);
  const jobs = task.assignments;
  panel.append(node);
  if (!jobs.length) {
    const hint = afpkInProgress(task) ? copy.afpkPreparing : copy.noJobs;
    node.append(element('p', 'subtle', hint));
    if (!afpkInProgress(task)) node.append(element('p', 'subtle', copy.noJobsHelp));
    if (task.workflow === AFPK_WORKFLOW && task.canResume === true) addOverviewShortcut(node, copy.afpkReadinessShortcut);
    return;
  }
  const list = element('ol', 'record-list');
  for (const job of jobs.toReversed()) {
    const row = element('li', 'record-row');
    const heading = element('div', 'meta-row');
    const status = pill('status', job.notStarted ? 'not_started' : job.status);
    status.setAttribute('aria-label', `${copy.jobStatus} ${status.textContent}`);
    heading.append(element('strong', '', stageName(job.stage, task.workflow)), status);
    const meta = element('div', 'meta-row');
    meta.append(element('span', 'meta-text', `${copy.revision} ${job.queryRevision}`), time(job.createdAt, copy.started));
    if (job.finishedAt) meta.append(time(job.finishedAt, copy.finished));
    if (job.consumed && job.status === 'succeeded') meta.append(element('span', 'meta-text', copy.consumed));
    const prior = job.retryOf ? jobs.find((entry) => entry.id === job.retryOf) : undefined;
    if (prior) meta.append(element('span', 'meta-text', `${copy.retryOf} ${prior.jobId}`));
    row.append(heading, element('code', '', job.jobId), meta);

    const hashes = [[copy.requestHash, job.requestSha256], [copy.outputHash, job.outputSha256], [copy.resultHash, job.resultSha256]];
    if (hashes.some(([, hash]) => hash)) {
      const fingerprints = element('details', 'fingerprints');
      const entries = element('dl');
      for (const [label, hash] of hashes) {
        if (!hash) continue;
        const data = element('dd');
        data.append(element('code', '', hash));
        entries.append(element('dt', '', label), data);
      }
      fingerprints.append(element('summary', '', copy.fingerprints), entries);
      row.append(fingerprints);
    }
    if (canStopJob(job)) row.append(jobCancellationControl(task, job));
    if (job.canRetry === true && RETRY_JOB_STATES.has(job.status)) row.append(jobRetryControl(task, job));
    else if (job.retryUnavailable === 'budget_exhausted') row.append(element('p', 'subtle job-action', copy.retryBudget));
    list.append(row);
  }
  const note = element('p', 'subtle timeline-notice', computeStatusMessage(task));
  node.append(note);
  if (task.workflow === AFPK_WORKFLOW && SHORTLIST_REVIEW_ATTENTION.has(taskWaitingReason(task))) {
    addOverviewShortcut(node, copy.afpkReviewShortcut);
  }
  node.append(list);
}

function addOverviewShortcut(node, label) {
  const button = element('button', 'button overview-shortcut', label);
  button.type = 'button';
  button.addEventListener('click', () => {
    showTab('overview');
    get('tab-panel').focus();
  });
  node.append(button);
}

function artifactTitle(artifact) {
  if (task?.workflow === AFPK_WORKFLOW && artifact.kind === 'engine' && artifact.stage === 'discovery') return copy.afpkReport;
  if (language === 'en') return artifact.label;
  if (artifact.kind === 'request') return '研究请求';
  if (artifact.stage) return `${term('stage', artifact.stage)}${artifact.kind === 'engine' ? '结果' : '记录'}`;
  return artifact.label;
}

function artifactContext(artifact) {
  const context = [];
  if (artifact.role && artifact.kind === 'stage') context.push(term('role', artifact.role));
  if (artifact.iteration !== undefined) context.push(`${copy.round} ${artifact.iteration}`);
  if (artifact.queryRevision !== undefined) context.push(`${copy.revision} ${artifact.queryRevision}`);
  return context.join(' · ');
}

function showArtifacts(panel) {
  const node = section(copy.artifacts);
  panel.append(node);
  const artifacts = task.artifacts;
  if (!artifacts.length) {
    node.append(element('p', 'subtle', copy.noArtifacts), element('p', 'subtle', copy.noArtifactsHelp));
    return;
  }
  const grid = element('div', 'artifact-grid');
  const list = element('ul', 'artifact-list');
  const preview = element('div', 'artifact-preview');
  preview.setAttribute('aria-label', copy.artifacts);
  preview.append(element('p', 'subtle', copy.chooseArtifact));
  const buttons = new Map();
  for (const artifact of artifacts) {
    const entry = element('li');
    const button = element('button');
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    button.append(element('strong', '', artifactTitle(artifact)), element('span', 'meta-text', artifactContext(artifact)));
    button.addEventListener('click', () => inspect(artifact.id));
    buttons.set(artifact.id, button);
    entry.append(button);
    list.append(entry);
  }
  grid.append(list, preview);
  node.append(grid);

  const taskId = task.id;
  function inspect(id) {
    for (const [artifactId, button] of buttons) button.setAttribute('aria-pressed', String(artifactId === id));
    activeArtifact = id;
    void loadArtifact(taskId, id, preview);
  }
  if (buttons.has(activeArtifact)) inspect(activeArtifact);
}

function releasePreview() {
  evidenceRequest?.abort();
  evidenceRequest = undefined;
  releaseArtifactPreview();
}

function releaseArtifactPreview() {
  artifactRequest?.abort();
  artifactRequest = undefined;
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = undefined;
}

function isAfpkReport(content) {
  return content?.kind === AFPK_REPORT && content.schema_version === 1 && content.method === 'three-profile-ks'
    && Number.isFinite(content.window?.min) && Number.isFinite(content.window?.max)
    && Array.isArray(content.rows) && Array.isArray(content.candidates);
}

function setScore(cell, value) {
  if (Number.isFinite(value)) {
    cell.textContent = value.toFixed(2);
    cell.title = String(value);
  } else {
    const missing = element('abbr', '', '—');
    missing.title = copy.scoreUnavailable;
    cell.append(missing);
  }
}

function originalFinderCell(row, runs) {
  const cell = element('td', 'native-finder-cell');
  const settings = Array.isArray(row.afpk_finder_run) ? row.afpk_finder_run : [];
  const byPerplexity = new Map(settings.map((entry) => [entry?.perplexity, entry]));
  const list = element('ul', 'finder-settings');
  for (const run of runs) {
    const setting = byPerplexity.get(run.perplexity);
    const item = element('li');
    const heading = element('span', 'finder-perplexity', `p=${run.perplexity}`);
    heading.title = `Perplexity ${run.perplexity}`;
    item.append(heading);

    if (setting?.status === 'clustered') {
      const label = Number.isInteger(setting.cluster) ? `${copy.finderCluster} ${setting.cluster}` : copy.finderClustered;
      const state = element('span', 'finder-status', setting.clade ? `${label} · ${setting.clade}` : label);
      item.append(state);
      if (Array.isArray(setting.memberships) && setting.memberships.length) {
        const details = element('details', 'finder-memberships');
        const members = element('ul');
        for (const member of setting.memberships) {
          if (!member) continue;
          const count = `${member.in_cluster}/${member.training_total}`;
          const percentage = Number.isFinite(member.percentage) ? ` (${member.percentage.toFixed(2)}%)` : '';
          members.append(element('li', '', `${member.clade} ${count}${percentage}`));
        }
        details.append(element('summary', '', copy.finderCounts), members);
        item.append(details);
      }
    } else {
      const status = setting?.status;
      const label = status === 'noise' ? copy.finderNoise : status === 'missing' ? copy.finderMissing : copy.finderUnrecorded;
      item.append(element('span', 'finder-status finder-muted', label));
    }
    list.append(item);
  }
  cell.append(list);
  return cell;
}

function historicalFinderCell(row, evidence) {
  const cell = element('td', 'finder-cell');
  const publishedScores = row.published_ks_scores;
  if (evidence.overview) cell.append(element('strong', 'finder-record-heading', copy.paperScores));
  if (KS_SCORE_COLUMNS.some(([profile]) => Number.isFinite(publishedScores?.[profile]))) {
    const scores = element('dl', 'paper-scores');
    for (const [profile, label] of KS_SCORE_COLUMNS) {
      const value = element('dd');
      setScore(value, publishedScores[profile]);
      scores.append(element('dt', '', label), value);
    }
    if (!evidence.overview) cell.append(element('span', 'finder-record-heading', copy.paperScores));
    cell.append(scores);
  } else if (evidence.overview) {
    cell.append(element('span', 'finder-empty', copy.afpkNoPaperScores));
  }
  const records = Array.isArray(row.afpk_finder) ? row.afpk_finder.filter((record) => Number.isInteger(record?.cluster)) : [];
  if (evidence.overview) {
    cell.append(element('strong', 'finder-record-heading imported-heading', copy.afpkImportedClusters));
    if (!records.length) cell.append(element('span', 'finder-empty', copy.afpkNoImportedCluster));
  }
  for (const record of records) {
    const label = element('div', 'finder-record', record.clade ? `${record.cluster} · ${record.clade}` : record.cluster);
    if (typeof record.membership === 'string' && record.membership) {
      label.append(element('span', 'row-reason', `${copy.finderMembership} ${record.membership}`));
    }
    cell.append(label);
  }
  if (!cell.childElementCount) cell.textContent = evidence.runs.length ? copy.noPaperRecord : '—';
  return cell;
}

function afpkRow(row, nominated, evidence) {
  const entry = element('tr');
  if (evidence.overview && nominated) entry.classList.add('nominated-row');
  const sequence = element('th', 'sequence-cell');
  sequence.scope = 'row';
  sequence.append(element('code', '', row.sequence_id));
  const role = row.role === 'anchor' ? copy.anchor : nominated ? copy.nominated : copy.candidate;
  const roleCell = element('td', 'role-cell', role);
  const classification = element('td', '', term('afpkClass', row.classification));
  if (row.reason) {
    if (evidence.overview) classification.title = row.reason;
    else classification.append(element('span', 'row-reason', row.reason));
  }
  entry.append(sequence, roleCell);
  for (const [profile] of KS_SCORE_COLUMNS) {
    const cell = element('td', 'score-cell');
    setScore(cell, row.scores?.[profile]);
    entry.append(cell);
  }
  entry.append(classification);
  if (evidence.runs.length) entry.append(originalFinderCell(row, evidence.runs));
  else if (evidence.overview) entry.append(element('td', 'native-finder-cell finder-muted', copy.afpkNoFinderRun));
  if (evidence.hasRecords) entry.append(historicalFinderCell(row, evidence));
  return entry;
}

function finderRunSummary(runs, { overview = false } = {}) {
  const view = element('details', 'fingerprints report-run-summary');
  const list = element('ul', 'finder-run-list');
  for (const run of runs) {
    const item = element('li');
    const counts = [
      [run.clustered, copy.finderClustered], [run.noise, copy.finderNoise], [run.missing, copy.finderMissing],
    ];
    item.append(element('strong', '', `Perplexity ${run.perplexity}`));
    for (const [count, label] of counts) {
      if (Number.isInteger(count)) item.append(element('span', '', `${label} ${count}`));
    }
    list.append(item);
  }
  view.append(element('summary', '', copy.finderRunDetails), list, element('p', 'subtle', `${copy.finderInputLabel} ${copy.finderCountBasis}`));
  if (overview) view.append(element('p', 'subtle', `${copy.afpkClusterScope} ${copy.scorePrecision}`));
  return view;
}

function shortlistScorePreview(rows) {
  const region = element('div', 'report-table-scroll');
  region.tabIndex = 0;
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', copy.afpkShortlistPreview);
  const table = element('table', 'report-table shortlist-score-table');
  const head = table.createTHead().insertRow();
  for (const [index, label] of [copy.sequence, ...KS_SCORE_COLUMNS.map(([, label]) => label)].entries()) {
    const cell = element('th', index ? 'score-cell' : '', label);
    cell.scope = 'col';
    head.append(cell);
  }
  const body = table.createTBody();
  for (const row of rows) {
    const entry = body.insertRow();
    const name = element('th', 'sequence-cell');
    name.scope = 'row';
    name.append(element('code', '', row.sequence_id));
    entry.append(name);
    for (const [profile] of KS_SCORE_COLUMNS) {
      const score = element('td', 'score-cell');
      setScore(score, row.scores?.[profile]);
      entry.append(score);
    }
  }
  region.append(table);
  return region;
}

function showAfpkReport(report, { overview = false, details } = {}) {
  const view = element('div', 'afpk-report');
  const rows = report.rows.filter((row) => typeof row?.sequence_id === 'string');
  const nominees = new Set(report.candidates);
  const sequenceRows = overview ? rows.toSorted((a, b) => Number(nominees.has(b.sequence_id)) - Number(nominees.has(a.sequence_id))) : rows;
  const hasFinder = sequenceRows.some((row) => Array.isArray(row.afpk_finder) && row.afpk_finder.length);
  const paperSource = report.published_ks_source;
  const runRecord = report.original_afpk_finder;
  const runs = Array.isArray(runRecord?.runs) ? runRecord.runs.filter((run) => Number.isFinite(run?.perplexity)) : [];
  const comparison = runs.length > 0;
  if (comparison) view.classList.add('has-comparison');
  const hasRecords = overview || comparison || hasFinder || Boolean(paperSource);
  const evidence = { runs, hasRecords, overview };
  const stats = [
    [copy.screened, report.summary?.screened], [copy.nominated, report.summary?.nominated],
  ];
  const method = [[copy.scoreWindow, `${report.window.min}–${report.window.max}`]];
  if (comparison) method.push([copy.nativeFinder, runRecord.release]);
  view.append(reportMetrics(overview ? stats : [...stats, ...method]));
  let reportDetails = view;
  if (overview) {
    const shortlist = sequenceRows.filter((row) => row.role === 'candidate' && nominees.has(row.sequence_id)).slice(0, 3);
    if (shortlist.length) view.append(shortlistScorePreview(shortlist));
    const comparisonDetails = element('details', 'afpk-comparison thread-disclosure');
    reportDetails = element('div', 'afpk-comparison-body');
    comparisonDetails.append(element('summary', '', copy.afpkComparison), reportDetails);
    details.prepend(comparisonDetails);
    reportDetails.append(reportMetrics(method));
  } else {
    reportDetails.append(element('p', 'subtle', copy.scorePrecision));
  }
  if (comparison) {
    if (!overview) reportDetails.append(element('p', 'subtle', copy.afpkComparisonScope));
    reportDetails.append(finderRunSummary(runs, { overview }));
  }
  else if (hasFinder && !overview) reportDetails.append(element('p', 'subtle', copy.finderSeparate));
  if (paperSource) {
    const citation = [copy.paperScores, paperSource.figure, paperSource.doi].filter(Boolean).join(' · ');
    reportDetails.append(element('p', 'subtle', citation));
  }

  const controls = element('div', 'report-controls');
  const searchLabel = element('label', '', copy.sequenceFilter);
  const search = element('input');
  search.type = 'search';
  searchLabel.append(search);
  const filterLabel = element('label', '', copy.rowFilter);
  const filter = element('select');
  for (const [value, label] of [['all', copy.allRows], ['nominated', copy.nominated], ['anchor', copy.anchors]]) {
    const option = element('option', '', label);
    option.value = value;
    filter.append(option);
  }
  filterLabel.append(filter);
  controls.append(searchLabel, filterLabel);

  const tableRegion = element('div', 'report-table-scroll');
  tableRegion.tabIndex = 0;
  tableRegion.setAttribute('role', 'region');
  const tableLabel = comparison || overview ? copy.afpkComparison : copy.afpkReport;
  tableRegion.setAttribute('aria-label', tableLabel);
  const table = element('table', comparison || overview ? 'report-table comparison-table' : 'report-table');
  table.append(element('caption', 'visually-hidden', `${tableLabel} · ${copy.scorePrecision}`));
  const head = element('thead');
  const heading = element('tr');
  const columns = [
    [copy.sequence, ''], [copy.role, 'role-cell'],
    ...KS_SCORE_COLUMNS.map(([, label]) => [label, 'score-cell']),
    [comparison || overview ? copy.ksClassification : copy.classification, ''],
  ];
  if (comparison || overview) columns.push([overview ? copy.nativeFinder : copy.nativeFinderRuns, 'native-finder-cell']);
  if (hasRecords) columns.push([comparison || overview || paperSource ? copy.paperRecord : copy.finderClusters, 'finder-cell']);
  for (const [label, className] of columns) {
    const column = element('th', className, label);
    column.scope = 'col';
    heading.append(column);
  }
  const body = element('tbody');
  head.append(heading);
  table.append(head, body);
  tableRegion.append(table);

  const paging = element('div', 'report-paging');
  const rowCount = element('span', 'subtle');
  rowCount.setAttribute('role', 'status');
  const previous = element('button', 'button', copy.previous);
  const next = element('button', 'button', copy.next);
  previous.type = 'button';
  next.type = 'button';
  paging.append(rowCount, previous, next);
  reportDetails.append(controls, tableRegion, paging);

  let page = 0;
  let matches = sequenceRows;
  function isNominated(row) { return row.role === 'candidate' && nominees.has(row.sequence_id); }
  function renderPage() {
    const start = page * AFPK_ROWS_PER_PAGE;
    const batch = matches.slice(start, start + AFPK_ROWS_PER_PAGE);
    body.replaceChildren(...batch.map((row) => afpkRow(row, isNominated(row), evidence)));
    rowCount.textContent = batch.length ? `${start + 1}–${start + batch.length} / ${matches.length}` : copy.noRows;
    tableRegion.hidden = !batch.length;
    previous.disabled = page === 0;
    next.disabled = start + batch.length === matches.length;
    previous.hidden = next.hidden = overview && matches.length <= AFPK_ROWS_PER_PAGE;
  }
  function applyFilters() {
    const query = search.value.trim().toLowerCase();
    matches = sequenceRows.filter((row) => row.sequence_id.toLowerCase().includes(query)
      && (filter.value === 'all' || (filter.value === 'nominated' ? isNominated(row) : row.role === 'anchor')));
    page = 0;
    renderPage();
    announce(rowCount.textContent);
  }
  search.addEventListener('input', applyFilters);
  filter.addEventListener('change', applyFilters);
  previous.addEventListener('click', () => { page--; renderPage(); announce(rowCount.textContent); });
  next.addEventListener('click', () => { page++; renderPage(); announce(rowCount.textContent); });
  renderPage();
  return view;
}

function reportMetrics(metrics) {
  const summary = element('dl', 'report-summary');
  for (const [label, value] of metrics) {
    if (value === undefined) continue;
    const metric = element('div');
    metric.append(element('dt', '', label), element('dd', '', value));
    summary.append(metric);
  }
  return summary;
}

async function loadArtifact(taskId, artifactId, preview, { overview = false, details } = {}) {
  if (overview) evidenceRequest?.abort();
  else releaseArtifactPreview();
  const controller = new AbortController();
  if (overview) evidenceRequest = controller;
  else artifactRequest = controller;
  const status = element('p', 'subtle', copy.loadingArtifact);
  status.setAttribute('role', 'status');
  preview.setAttribute('aria-busy', 'true');
  preview.replaceChildren(status);
  try {
    const { artifact, content } = await request(`/${encodeURIComponent(taskId)}/artifacts/${encodeURIComponent(artifactId)}`, { signal: controller.signal });
    if (controller.signal.aborted) return;
    preview.removeAttribute('aria-busy');
    const typedReport = isAfpkReport(content) ? showAfpkReport(content, { overview, details }) : undefined;
    if (overview) {
      if (typedReport) preview.replaceChildren(typedReport);
      else status.textContent = copy.afpkReportInvalid;
      return;
    }
    const json = JSON.stringify(content, null, 2);
    const title = typedReport?.classList.contains('has-comparison') ? copy.afpkComparison : artifactTitle(artifact);
    const heading = element('strong', '', title);
    const hash = element('p', 'subtle', `${copy.verifiedBytes} `);
    hash.append(element('code', '', artifact.sha256));
    const pre = element('pre', '', json.slice(0, PREVIEW_LIMIT));
    pre.tabIndex = 0;
    preview.replaceChildren(heading, hash);
    let raw = preview;
    if (typedReport) {
      raw = element('details', 'fingerprints raw-report');
      raw.append(element('summary', '', copy.rawJson));
      preview.append(typedReport, raw);
    }
    raw.append(pre);
    if (json.length > PREVIEW_LIMIT) raw.append(element('p', 'subtle', copy.previewLimited));
    downloadUrl = URL.createObjectURL(new Blob([`${json}\n`], { type: 'application/json' }));
    const download = element('a', 'button', copy.download);
    download.href = downloadUrl;
    download.download = `${artifactId.replace(/[^a-zA-Z0-9_-]/g, '-')}.json`;
    preview.append(download);
  } catch (error) {
    preview.removeAttribute('aria-busy');
    if (!controller.signal.aborted) status.textContent = error.message;
  }
}

function showTrajectory(panel) {
  const node = section(copy.trajectory);
  panel.append(node);
  if (task.eventsTruncated) node.append(element('p', 'subtle timeline-notice', copy.partialHistory));
  if (!task.events.length) {
    node.append(element('p', 'subtle', copy.noEvents), element('p', 'subtle', copy.noEventsHelp));
    return;
  }
  const list = element('ol', 'record-list timeline');
  for (const event of task.events.toReversed()) {
    const item = element('li', 'record-row');
    const meta = element('div', 'meta-row');
    meta.append(element('strong', '', term('event', event.type)), element('span', 'meta-text', stageName(event.stage, task.workflow)), time(event.at));
    item.append(meta, element('p', 'subtle', event.detail));
    list.append(item);
  }
  node.append(list);
}

get('tabs').addEventListener('keydown', (event) => {
  const current = tabs.indexOf(document.activeElement);
  if (current < 0) return;
  let next;
  if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
  else if (event.key === 'ArrowLeft') next = (current + tabs.length - 1) % tabs.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = tabs.length - 1;
  else return;
  event.preventDefault();
  showTab(tabs[next].dataset.tab);
  tabs[next].focus();
});

for (const button of tabs) button.addEventListener('click', () => showTab(button.dataset.tab));
get('session-activity').addEventListener('toggle', (event) => {
  const { open } = event.currentTarget;
  event.currentTarget.querySelector('summary')?.setAttribute('aria-expanded', String(open));
  if (open && currentTab === 'overview') showTab('compute');
  else if (!open && currentTab !== 'overview') showTab('overview');
});
get('afpk-source').addEventListener('change', (event) => {
  event.target.dataset.chosen = 'true';
  fillAfpkPresetObjective();
  updateAfpkInputMode();
});
get('afpk-preset').addEventListener('change', fillAfpkPresetObjective);
get('afpk-protein-list').addEventListener('change', (event) => {
  const path = event.target.value;
  if (path) get('afpk-proteins').value = [...new Set([...projectPaths('afpk-proteins'), path])].join('\n');
  event.target.value = '';
});
get('afpk-create-close').addEventListener('click', () => afpkDialog.close());
afpkDialog.addEventListener('cancel', (event) => {
  if (afpkDialog.dataset.starting === 'true') event.preventDefault();
});
afpkDialog.addEventListener('close', () => {
  afpkInputRequest?.abort();
  if (params.get('new') === '1' && !selected) notifyParent('ariadne:close-session');
});
afpkCreateForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void startAfpkTask();
});
document.addEventListener('visibilitychange', () => {
  scheduleAfpkPoll();
  // A decision recorded in Chat advances the task without any desk action;
  // pick it up when the desk becomes visible again instead of waiting for a
  // manual Refresh.
  if (!document.hidden && task !== null && !refreshing && !saving) void reload();
});
window.addEventListener('pagehide', releasePreview);
refresh.addEventListener('click', () => {
  notice('');
  void reload();
});
get('new-afpk-task').addEventListener('click', () => {
  notice('');
  openAfpkDialog();
});
get('notice-dismiss').addEventListener('click', () => notice(''));

document.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
  if (document.querySelector('dialog[open]')) return;
  if (event.key === '/') {
    event.preventDefault();
    const search = document.querySelector('.report-controls input[type="search"]');
    if (search) search.focus();
    else refresh.focus();
    return;
  }
  if (event.key === 'r' && task !== null) {
    event.preventDefault();
    notice('');
    void reload();
    refresh.focus();
  }
});

if (params.get('new') === '1' && !selected) openAfpkDialog();
else void reload();
