-- 添加缺失的字段到现有表

-- 为 apps 表添加 last_fetched 字段
ALTER TABLE apps ADD COLUMN IF NOT EXISTS last_fetched TIMESTAMP WITH TIME ZONE;

-- 为 analysis_results 表添加缺失字段（如果需要）
-- 检查表结构并添加必要的字段
DO $$
BEGIN
    -- 检查 analysis_results 表是否存在 version_refs 字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'analysis_results' 
        AND column_name = 'version_refs'
    ) THEN
        ALTER TABLE analysis_results ADD COLUMN version_refs TEXT[];
    END IF;
END $$;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_apps_last_fetched ON apps(last_fetched);
CREATE INDEX IF NOT EXISTS idx_analysis_results_analyzed_at ON analysis_results(analyzed_at);
