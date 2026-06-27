f = "../client/src/components/MLScoreCard.jsx"
c = open(f).read()
old = """          听众活跃度评分（1-5分）
        </div>
        基于播放量和评论数预测听众活跃程度。分数越高代表相对于播放量，评论互动越超出预期。"""
new = """          听众活跃度评分（1-5分） | 训练准确率 {data?.evaluation?.train_accuracy || "?"}% | 测试准确率 {data?.evaluation?.test_accuracy || "?"}% | 泛化误差 {data?.evaluation?.generalization_gap || "?"}%
        </div>
        分数越高表示相对于播放量，该歌曲的听众评论互动越超出预期——即\"说的比听的多\"。"""
c = c.replace(old, new)
open(f, "w").write(c)
print("OK")
